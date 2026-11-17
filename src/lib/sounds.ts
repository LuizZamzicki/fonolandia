// Sons curtos de acerto, erro e conclusão, gerados na hora (Web Audio), sem arquivos.
// Podem ser desligados na área da professora (preferência "sons").

import { readPref } from './prefs'

export const SOUNDS_PREF = 'sons'

export type Sound = 'right' | 'wrong' | 'complete' | 'levelup' | 'pop' | 'chest'

let context: AudioContext | null = null

/** O mesmo AudioContext para efeitos e gravações (no iPhone, ele é liberado no primeiro toque). */
export function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Uma nota: frequência (Hz), início e duração (s) a partir de agora. */
function note(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const t = ctx.currentTime + start
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, t)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(t)
  oscillator.stop(t + duration + 0.02)
}

const MELODIES: Record<Sound, [frequency: number, start: number, duration: number][]> = {
  // Duas notas subindo (mi → lá)
  right: [
    [659, 0, 0.12],
    [880, 0.09, 0.22],
  ],
  // Duas notas graves descendo
  wrong: [
    [220, 0, 0.16],
    [175, 0.12, 0.24],
  ],
  // Arpejo de dó maior
  complete: [
    [523, 0, 0.14],
    [659, 0.1, 0.14],
    [784, 0.2, 0.14],
    [1047, 0.3, 0.4],
  ],
  // Toque curto (tocar numa peça)
  pop: [[880, 0, 0.07]],
  // Baú abrindo: brilho subindo
  chest: [
    [523, 0, 0.1],
    [784, 0.08, 0.1],
    [1047, 0.16, 0.1],
    [1319, 0.24, 0.1],
    [1568, 0.32, 0.5],
  ],
  levelup: [
    [784, 0, 0.12],
    [988, 0.1, 0.12],
    [1175, 0.2, 0.12],
    [1568, 0.3, 0.5],
  ],
}

export function playSound(sound: Sound): void {
  if (!readPref(SOUNDS_PREF, true)) return
  try {
    const ctx = audio()
    if (!ctx) return
    const type: OscillatorType = sound === 'wrong' ? 'triangle' : 'sine'
    for (const [frequency, start, duration] of MELODIES[sound]) note(ctx, frequency, start, duration, type, 0.09)
  } catch {
    // Sem áudio (navegador antigo ou bloqueado): segue em silêncio
  }
}
