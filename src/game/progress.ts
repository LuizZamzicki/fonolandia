// Progresso de cada criança, calculado só a partir das rodadas gravadas (iguais em qualquer aparelho).

import { ALL_LEVELS, ISLANDS } from '../data/sounds'
import type { Round } from '../store/types'

/** Melhor número de estrelas em cada fase. */
export function bestStars(rounds: Round[], studentId: string): Map<string, number> {
  const best = new Map<string, number>()
  for (const r of rounds) {
    if (r.studentId !== studentId) continue
    best.set(r.levelId, Math.max(best.get(r.levelId) ?? 0, r.stars))
  }
  return best
}

export function totalStars(best: Map<string, number>): number {
  let total = 0
  for (const stars of best.values()) total += stars
  return total
}

export const MAX_STARS = ALL_LEVELS.length * 3

/**
 * Uma fase abre quando a anterior da mesma ilha tem estrela; a primeira fase de cada ilha abre quando o
 * chefão da ilha anterior foi vencido. A professora pode liberar tudo.
 */
export function isUnlocked(levelId: string, best: Map<string, number>, unlockAll: boolean): boolean {
  if (unlockAll) return true
  for (let i = 0; i < ISLANDS.length; i++) {
    const levels = ISLANDS[i].levels
    const index = levels.findIndex((l) => l.id === levelId)
    if (index < 0) continue
    if (index > 0) return (best.get(levels[index - 1].id) ?? 0) > 0
    if (i === 0) return true
    const previous = ISLANDS[i - 1].levels
    return (best.get(previous[previous.length - 1].id) ?? 0) > 0
  }
  return false
}

export function islandUnlocked(islandIndex: number, best: Map<string, number>, unlockAll: boolean): boolean {
  return isUnlocked(ISLANDS[islandIndex].levels[0].id, best, unlockAll)
}

export function islandDone(islandIndex: number, best: Map<string, number>): boolean {
  const levels = ISLANDS[islandIndex].levels
  return (best.get(levels[levels.length - 1].id) ?? 0) > 0
}

/** A próxima fase a jogar: a primeira aberta ainda sem estrela. */
export function nextLevel(best: Map<string, number>, unlockAll: boolean): string | null {
  for (const level of ALL_LEVELS) {
    if (isUnlocked(level.id, best, unlockAll) && !best.has(level.id)) return level.id
  }
  return null
}

/** Dias seguidos com pelo menos uma rodada (até hoje ou até ontem). */
export function streakDays(rounds: Round[], studentId: string, today = new Date()): number {
  const days = new Set(rounds.filter((r) => r.studentId === studentId).map((r) => localDay(new Date(r.at))))
  const cursor = new Date(today)
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (days.has(localDay(cursor))) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  return count
}

export function localDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
