// Detecta onde começa e termina cada som numa gravação contínua (código puro, testável sem microfone).

/** Trechos mais curtos que isto são estalos, não sons. */
const MIN_SECONDS = 0.12
const MAX_SECONDS = 1.6
/** Quanto tempo de silêncio encerra um som. */
const END_SILENCE_SECONDS = 0.25
/** Quanto do começo é guardado antes de o som "disparar" (o P e o T começam baixinho). */
const PRE_ROLL_SECONDS = 0.1
/** O começo da escuta mede o ruído da sala. */
const CALIBRATION_SECONDS = 0.35

export class Segmenter {
  private floor = 0.004
  private calibration: number
  private speaking = false
  private quietSeconds = 0
  private chunks: Float32Array[] = []
  private preRoll: Float32Array[] = []
  private preRollSeconds = 0

  private readonly rate: number
  private readonly onSegment: (samples: Float32Array, rate: number) => void

  constructor(rate: number, onSegment: (samples: Float32Array, rate: number) => void) {
    this.rate = rate
    this.onSegment = onSegment
    this.calibration = CALIBRATION_SECONDS
  }

  /** Recebe o próximo pedaço de áudio. Devolve o volume (RMS) do pedaço. */
  push(input: Float32Array): number {
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const rms = Math.sqrt(sum / input.length)
    const seconds = input.length / this.rate

    if (this.calibration > 0) {
      this.calibration -= seconds
      this.floor = this.floor * 0.6 + rms * 0.4
      return rms
    }

    const start = Math.max(0.012, this.floor * 3.5)
    const stop = Math.max(0.007, this.floor * 2)

    if (!this.speaking) {
      // O ruído de fundo acompanha a sala (devagar)
      this.floor = this.floor * 0.97 + Math.min(rms, start) * 0.03
      this.preRoll.push(input)
      this.preRollSeconds += seconds
      while (this.preRoll.length > 1 && this.preRollSeconds - this.preRoll[0].length / this.rate >= PRE_ROLL_SECONDS) {
        this.preRollSeconds -= this.preRoll.shift()!.length / this.rate
      }
      if (rms > start) {
        this.speaking = true
        this.quietSeconds = 0
        this.chunks = [...this.preRoll]
      }
      return rms
    }

    this.chunks.push(input)
    this.quietSeconds = rms < stop ? this.quietSeconds + seconds : 0
    const total = this.chunks.reduce((n, c) => n + c.length, 0)
    if (this.quietSeconds >= END_SILENCE_SECONDS || total / this.rate >= MAX_SECONDS) {
      this.speaking = false
      if (total / this.rate >= MIN_SECONDS + END_SILENCE_SECONDS * 0.5) {
        const out = new Float32Array(total)
        let off = 0
        for (const c of this.chunks) {
          out.set(c, off)
          off += c.length
        }
        this.onSegment(out, this.rate)
      }
      this.chunks = []
      this.preRoll = []
      this.preRollSeconds = 0
    }
    return rms
  }
}
