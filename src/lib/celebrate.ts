import confetti from 'canvas-confetti'

const COLORS = ['#6d5efc', '#a855f7', '#ec4899', '#f5b915', '#1fb85a']

/** Chuva de confete para as conquistas (respeita quem prefere menos movimento). */
export function celebrate(intensity: 'small' | 'big' = 'big'): void {
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 50 }
  if (intensity === 'small') {
    void confetti({ ...base, particleCount: 60, spread: 70, origin: { y: 0.7 } })
    return
  }
  void confetti({ ...base, particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } })
  void confetti({ ...base, particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } })
}
