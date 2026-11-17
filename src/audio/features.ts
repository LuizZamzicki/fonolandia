// Reconhecimento dos sons das letras (fonemas) sem internet e sem modelo pronto: a professora grava
// cada som algumas vezes; o jogo compara o som da criança com essas gravações.
//
// Como: cada som vira uma sequência de "impressões digitais" de 20 ms (MFCC, o resumo do espectro que os
// reconhecedores de fala usam) e a comparação é feita por DTW, que alinha duas gravações mesmo quando uma
// é mais longa ou mais curta ("ssss" curto × "ssssssss" longo). Ganha o som com as gravações mais parecidas.

export const RATE = 16000
const FRAME = 400 // 25 ms
const HOP = 320 // 20 ms
const FFT_SIZE = 512
const MEL_FILTERS = 26
const COEFFS = 12
/** Gravações mais longas que isto (em quadros) são encurtadas, para a comparação ser rápida. */
const MAX_FRAMES = 60

export type Frames = number[][]

/** Muda a taxa de amostragem (interpolação linear: suficiente para voz). */
export function resample(samples: Float32Array, from: number, to = RATE): Float32Array {
  if (from === to) return samples
  const ratio = from / to
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio
    const j = Math.floor(pos)
    const frac = pos - j
    out[i] = samples[j] * (1 - frac) + (samples[j + 1] ?? samples[j]) * frac
  }
  return out
}

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wr = Math.cos(angle)
    const wi = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k + len / 2] = re[i + k] - ar
        im[i + k + len / 2] = im[i + k] - ai
        re[i + k] += ar
        im[i + k] += ai
        const t = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = t
      }
    }
  }
}

const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700)
const hzFromMel = (m: number) => 700 * (10 ** (m / 2595) - 1)

/**
 * Banco de filtros na escala mel. `warp` estica (>1) ou encolhe (<1) as frequências: é assim que se
 * compara a voz de uma criança (trato vocal curto, sons mais agudos) com a de um adulto.
 */
function filterbank(warp: number): number[][] {
  const low = mel(80)
  const high = mel(7600)
  const points = Array.from({ length: MEL_FILTERS + 2 }, (_, i) =>
    Math.min(RATE / 2 - 1, hzFromMel(low + ((high - low) * i) / (MEL_FILTERS + 1)) * warp),
  )
  const bins = points.map((hz) => Math.floor(((FFT_SIZE + 1) * hz) / RATE))
  return Array.from({ length: MEL_FILTERS }, (_, m) => {
    const filter = new Array(FFT_SIZE / 2 + 1).fill(0)
    for (let k = bins[m]; k < bins[m + 1]; k++) filter[k] = (k - bins[m]) / Math.max(1, bins[m + 1] - bins[m])
    for (let k = bins[m + 1]; k < bins[m + 2]; k++) filter[k] = (bins[m + 2] - k) / Math.max(1, bins[m + 2] - bins[m + 1])
    return filter
  })
}

const FILTERBANKS = new Map<number, number[][]>()
function filterbankFor(warp: number): number[][] {
  let fb = FILTERBANKS.get(warp)
  if (!fb) {
    fb = filterbank(warp)
    FILTERBANKS.set(warp, fb)
  }
  return fb
}

const HAMMING = Array.from({ length: FRAME }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)))

/** Energia (RMS) de cada quadro. */
function frameEnergies(x: Float32Array): number[] {
  const out: number[] = []
  for (let start = 0; start + FRAME <= x.length; start += HOP) {
    let sum = 0
    for (let i = 0; i < FRAME; i++) sum += x[start + i] ** 2
    out.push(Math.sqrt(sum / FRAME))
  }
  return out
}

/**
 * Tira o silêncio do começo e do fim: fica do primeiro ao último quadro com pelo menos 8% da energia
 * máxima (o "sss" é fraco perto de uma vogal, por isso o limite é baixo).
 */
export function trimSilence(x: Float32Array): Float32Array {
  const energies = frameEnergies(x)
  if (energies.length === 0) return x
  const max = Math.max(...energies)
  const limit = max * 0.08
  const first = energies.findIndex((e) => e >= limit)
  let last = energies.length - 1
  while (last > first && energies[last] < limit) last--
  return x.subarray(first * HOP, Math.min(x.length, last * HOP + FRAME))
}

/** MFCC de cada quadro (sem o coeficiente de energia: falar mais alto ou mais baixo não muda o som). */
export function mfcc(samples16k: Float32Array, warp = 1): Frames {
  const bank = filterbankFor(warp)
  const x = new Float32Array(samples16k.length)
  x[0] = samples16k[0] ?? 0
  for (let i = 1; i < x.length; i++) x[i] = samples16k[i] - 0.97 * samples16k[i - 1]

  const frames: Frames = []
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  for (let start = 0; start + FRAME <= x.length; start += HOP) {
    re.fill(0)
    im.fill(0)
    for (let i = 0; i < FRAME; i++) re[i] = x[start + i] * HAMMING[i]
    fft(re, im)
    const power = new Float64Array(FFT_SIZE / 2 + 1)
    for (let k = 0; k <= FFT_SIZE / 2; k++) power[k] = (re[k] ** 2 + im[k] ** 2) / FFT_SIZE
    const logMel = bank.map((filter) => {
      let sum = 0
      for (let k = 0; k < filter.length; k++) if (filter[k] > 0) sum += filter[k] * power[k]
      return Math.log(sum + 1e-10)
    })
    const coeffs: number[] = []
    for (let c = 1; c <= COEFFS; c++) {
      let sum = 0
      for (let m = 0; m < MEL_FILTERS; m++) sum += logMel[m] * Math.cos((Math.PI * c * (m + 0.5)) / MEL_FILTERS)
      coeffs.push(sum)
    }
    frames.push(coeffs)
  }
  return frames
}

/** Encurta uma sequência longa pegando quadros espaçados (mantém o formato do som). */
function shorten(frames: Frames): Frames {
  if (frames.length <= MAX_FRAMES) return frames
  return Array.from({ length: MAX_FRAMES }, (_, i) => frames[Math.floor((i * frames.length) / MAX_FRAMES)])
}

/**
 * Peso das diferenças. Medido com 8 vozes do macOS (treina com 7, testa com a que ficou de fora):
 * sem diferenças 78% de acerto; peso 1 → 82%; peso 3 → 85%; 4 ou 6 → 84%.
 */
const DELTA_WEIGHT = 3

/**
 * Acrescenta a cada quadro como o som está mudando (diferença entre os vizinhos). Ajuda nas consoantes
 * explosivas (P, B, T, D...), que são justamente uma mudança rápida.
 */
export function withDeltas(frames: Frames, weight = DELTA_WEIGHT): Frames {
  return frames.map((f, i) => {
    const before = frames[Math.max(0, i - 2)]
    const after = frames[Math.min(frames.length - 1, i + 2)]
    return [...f, ...f.map((_, c) => ((after[c] - before[c]) / 4) * weight)]
  })
}


/** Da gravação crua até as impressões digitais prontas para comparar. Vazio = quase nada de som. */
export function features(samples: Float32Array, sampleRate: number, warp = 1): Frames {
  const x = trimSilence(resample(samples, sampleRate))
  return shorten(withDeltas(mfcc(x, warp)))
}

function distance(a: number[], b: number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2
  return Math.sqrt(sum)
}

/** Distância DTW, dividida pelo tamanho do caminho (gravações longas não ficam "mais distantes"). */
export function dtw(a: Frames, b: Frames): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY
  const n = a.length
  const m = b.length
  let prev = new Float64Array(m + 1).fill(Number.POSITIVE_INFINITY)
  let prevLen = new Float64Array(m + 1)
  prev[0] = 0
  for (let i = 1; i <= n; i++) {
    const cur = new Float64Array(m + 1).fill(Number.POSITIVE_INFINITY)
    const curLen = new Float64Array(m + 1)
    for (let j = 1; j <= m; j++) {
      const d = distance(a[i - 1], b[j - 1])
      // Escolhe o melhor vizinho (diagonal, cima ou esquerda)
      let best = prev[j - 1]
      let len = prevLen[j - 1]
      if (prev[j] < best) {
        best = prev[j]
        len = prevLen[j]
      }
      if (cur[j - 1] < best) {
        best = cur[j - 1]
        len = curLen[j - 1]
      }
      cur[j] = best + d
      curLen[j] = len + 1
    }
    prev = cur
    prevLen = curLen
  }
  return prev[m] / prevLen[m]
}

export interface Template {
  sound: string
  frames: Frames
}

export interface Ranked {
  sound: string
  distance: number
}

/** Ordena os sons do mais parecido ao menos parecido (média das 2 gravações mais próximas de cada som). */
export function rank(frames: Frames, templates: Template[]): Ranked[] {
  const bySound = new Map<string, number[]>()
  for (const t of templates) {
    const list = bySound.get(t.sound) ?? []
    list.push(dtw(frames, t.frames))
    bySound.set(t.sound, list)
  }
  return [...bySound.entries()]
    .map(([sound, ds]) => {
      const best = ds.sort((x, y) => x - y).slice(0, 2)
      return { sound, distance: best.reduce((s, d) => s + d, 0) / best.length }
    })
    .sort((x, y) => x.distance - y.distance)
}

/**
 * Esticadas de frequência testadas em cada som ouvido (1 = sem mudar). Com vozes do macOS, a voz mais
 * diferente das outras passou de 3 para 6 acertos em 19; as demais ficaram iguais ou melhores.
 */
export const WARPS = [0.8, 0.88, 1, 1.12, 1.25]

/**
 * Reconhece um som gravado: testa a voz "esticada" de alguns jeitos e fica, para cada som, com o
 * jeito que mais combinou. Corrige boa parte da diferença entre a voz da professora e a da criança.
 */
export function recognize(samples: Float32Array, sampleRate: number, templates: Template[]): Ranked[] {
  const best = new Map<string, number>()
  for (const warp of WARPS) {
    const frames = features(samples, sampleRate, warp)
    if (frames.length < 4) continue
    for (const r of rank(frames, templates)) best.set(r.sound, Math.min(best.get(r.sound) ?? Infinity, r.distance))
  }
  return [...best.entries()].map(([sound, distance]) => ({ sound, distance })).sort((a, b) => a.distance - b.distance)
}
