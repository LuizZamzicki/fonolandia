// Gravador da voz da professora: grava pelo microfone, corta o silêncio do começo e do fim, deixa o
// volume parecido entre as gravações e guarda em WAV (toca igual em qualquer navegador, inclusive iPhone).

import { micSupported } from './mic'

export { micSupported }

export interface Recorder {
  /** Para e entrega o áudio pronto (ou null se não deu para ouvir nada). */
  stop(): Promise<Blob | null>
  cancel(): void
}

/** Taxa de amostragem guardada: boa para voz e ocupa pouco espaço. */
const RATE = 22050
/** Folga mantida antes e depois da fala (s), para não cortar o começo do som. */
const PAD = 0.08

export async function startRecording(onLevel?: (level: number) => void): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  // Medidor de volume, só para a tela
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  ctx.createMediaStreamSource(stream).connect(analyser)
  const buffer = new Float32Array(analyser.fftSize)
  let frame = 0
  const meter = () => {
    analyser.getFloatTimeDomainData(buffer)
    let sum = 0
    for (const v of buffer) sum += v * v
    onLevel?.(Math.min(1, Math.sqrt(sum / buffer.length) * 8))
    frame = requestAnimationFrame(meter)
  }
  meter()

  recorder.start()

  function release() {
    cancelAnimationFrame(frame)
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }

  return {
    stop() {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          release()
          const raw = new Blob(chunks, { type: recorder.mimeType })
          processClip(raw).then(resolve, () => resolve(null))
        }
        recorder.stop()
      })
    },
    cancel() {
      recorder.onstop = release
      recorder.stop()
    },
  }
}

/** Decodifica, deixa em mono, corta o silêncio, iguala o volume e devolve um WAV. */
async function processClip(raw: Blob): Promise<Blob | null> {
  const decoder = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await decoder.decodeAudioData(await raw.arrayBuffer())
  } finally {
    void decoder.close()
  }

  // Muda para 22 kHz mono
  const length = Math.ceil(decoded.duration * RATE)
  if (length === 0) return null
  const offline = new OfflineAudioContext(1, length, RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const samples = (await offline.startRendering()).getChannelData(0)

  const range = speechRange(samples)
  if (!range) return null
  const [start, end] = range
  const clip = samples.slice(start, end)

  // Volume: o pico fica em 90%
  let peak = 0
  for (const v of clip) peak = Math.max(peak, Math.abs(v))
  const gain = peak > 0 ? 0.9 / peak : 1
  for (let i = 0; i < clip.length; i++) clip[i] *= gain

  // Suaviza as pontas (sem estalo)
  const fade = Math.min(clip.length / 2, Math.round(0.01 * RATE))
  for (let i = 0; i < fade; i++) {
    clip[i] *= i / fade
    clip[clip.length - 1 - i] *= i / fade
  }
  return encodeWav(clip, RATE)
}

/** Onde começa e termina a fala (janelas de 10 ms acima de um limiar relativo ao trecho mais alto). */
export function speechRange(samples: Float32Array): [number, number] | null {
  const win = Math.round(RATE * 0.01)
  const energies: number[] = []
  for (let i = 0; i + win <= samples.length; i += win) {
    let sum = 0
    for (let j = i; j < i + win; j++) sum += samples[j] * samples[j]
    energies.push(Math.sqrt(sum / win))
  }
  const loudest = Math.max(0, ...energies)
  if (loudest < 0.01) return null
  const threshold = Math.max(0.006, loudest * 0.08)
  const first = energies.findIndex((e) => e > threshold)
  let last = energies.length - 1
  while (last > first && energies[last] <= threshold) last--
  const pad = Math.round(PAD * RATE)
  return [Math.max(0, first * win - pad), Math.min(samples.length, (last + 1) * win + pad)]
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const text = (offset: number, s: string) => [...s].forEach((c, i) => data.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  data.setUint32(4, 36 + samples.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true) // PCM
  data.setUint16(22, 1, true) // mono
  data.setUint32(24, rate, true)
  data.setUint32(28, rate * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  text(36, 'data')
  data.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    data.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return new Blob([data], { type: 'audio/wav' })
}
