// Números do painel da professora e pesos do sorteio adaptativo.

import { CONFUSION_PAIRS, SOUNDS } from '../data/sounds'
import type { Attempt } from '../store/types'
import type { Weights } from './questions'

export interface Score {
  right: number
  total: number
}

export function rate(score: Score | undefined): number | null {
  return score && score.total > 0 ? score.right / score.total : null
}

/** Acertos por som (as rimas ficam de fora: não são de um som só). */
export function accuracyBySound(attempts: Attempt[]): Map<string, Score> {
  const scores = new Map<string, Score>()
  for (const a of attempts) {
    if (a.game === 'rima') continue
    const s = scores.get(a.target) ?? { right: 0, total: 0 }
    s.total++
    if (a.correct) s.right++
    scores.set(a.target, s)
  }
  return scores
}

export function accuracyByGame(attempts: Attempt[]): Map<string, Score> {
  const scores = new Map<string, Score>()
  for (const a of attempts) {
    const s = scores.get(a.game) ?? { right: 0, total: 0 }
    s.total++
    if (a.correct) s.right++
    scores.set(a.game, s)
  }
  return scores
}

export function overall(attempts: Attempt[]): Score {
  return { right: attempts.filter((a) => a.correct).length, total: attempts.length }
}

const SOUND_KEYS = new Set(SOUNDS.map((s) => s.key))

export interface Confusion {
  target: string
  answer: string
  count: number
  /** Uma das trocas clássicas (P/B, T/D, F/V, M/N...). */
  classic: boolean
}

function isClassic(a: string, b: string): boolean {
  return CONFUSION_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** Trocas de som: esperava um, escolheu outro (no Caça-Sons e no Qual som falta). */
export function confusions(attempts: Attempt[]): Confusion[] {
  const counts = new Map<string, number>()
  for (const a of attempts) {
    if (a.correct || (a.game !== 'caca' && a.game !== 'falta')) continue
    if (!SOUND_KEYS.has(a.answer) || a.answer === a.target) continue
    const key = `${a.target}>${a.answer}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [target, answer] = key.split('>')
      return { target, answer, count, classic: isClassic(target, answer) }
    })
    .sort((x, y) => y.count - x.count || Number(y.classic) - Number(x.classic))
}

/** Trocas clássicas somando os dois sentidos (P→B e B→P), para o resumo da turma. */
export function pairConfusions(attempts: Attempt[]): { pair: [string, string]; count: number }[] {
  const all = confusions(attempts)
  return CONFUSION_PAIRS.map((pair) => ({
    pair,
    count: all
      .filter((c) => (c.target === pair[0] && c.answer === pair[1]) || (c.target === pair[1] && c.answer === pair[0]))
      .reduce((sum, c) => sum + c.count, 0),
  })).filter((p) => p.count > 0)
}

/** Semana (segunda-feira) de uma data, no formato AAAA-MM-DD. */
export function weekStart(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Acerto por semana, em ordem, para o gráfico de evolução. */
export function weeklyEvolution(attempts: Attempt[]): { week: string; score: Score }[] {
  const weeks = new Map<string, Score>()
  for (const a of attempts) {
    const key = weekStart(new Date(a.at))
    const s = weeks.get(key) ?? { right: 0, total: 0 }
    s.total++
    if (a.correct) s.right++
    weeks.set(key, s)
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, score]) => ({ week, score }))
}

/**
 * Pesos do sorteio: os sons com mais erro saem mais. A taxa de erro começa em 1/3 (como se houvesse
 * 1 erro em 3 tentativas), para poucos dados não mudarem muito o sorteio. Só contam as últimas 200 respostas.
 */
export function adaptiveWeights(attempts: Attempt[]): Weights {
  const recent = attempts.slice(-200)
  const weights: Weights = {}
  for (const [sound, score] of accuracyBySound(recent)) {
    const errorRate = (score.total - score.right + 1) / (score.total + 3)
    weights[sound] = 0.5 + 3 * errorRate
  }
  return weights
}
