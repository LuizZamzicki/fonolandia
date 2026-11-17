// Monta as perguntas de cada fase. Funções puras (o sorteio vem de fora), para poder testar.

import { pairOf, SOUNDS, type Level } from '../data/sounds'
import { rhymes, WORDS, wordsStartingWith, type Word } from '../data/words'

export type Rng = () => number

/** Gerador com semente (para os testes e para sortear o mesmo de novo). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

/** Sorteia com peso: quem pesa mais sai mais. */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let r = rng() * total
  for (const item of items) {
    r -= weight(item)
    if (r <= 0) return item
  }
  return items[items.length - 1]
}

/** Peso de cada som: os que a criança mais erra saem mais. Sem dados, todos pesam 1. */
export type Weights = Record<string, number>

export type Question =
  | { kind: 'caca'; target: string; options: Word[]; correct: string[] }
  | { kind: 'falta'; word: Word; options: string[]; answer: string }
  | { kind: 'monta'; word: Word; pieces: string[] }
  | { kind: 'rima'; a: Word; b: Word; rhymes: boolean }

const VOWELS = ['A', 'E', 'I', 'O', 'U']

/** Palavras ainda não usadas na rodada vêm primeiro. */
function freshFirst(words: Word[], used: Set<string>, rng: Rng): Word[] {
  const shuffled = shuffle(words, rng)
  return [...shuffled.filter((w) => !used.has(w.id)), ...shuffled.filter((w) => used.has(w.id))]
}

function pickTarget(level: Level, weights: Weights, rng: Rng): string {
  return weightedPick(level.sounds, (s) => weights[s] ?? 1, rng)
}

export function cacaQuestion(level: Level, weights: Weights, used: Set<string>, rng: Rng): Question {
  const target = pickTarget(level, weights, rng)
  const candidates = freshFirst(wordsStartingWith(target), used, rng)
  const correctCount = Math.min(candidates.length, rng() < 0.5 ? 2 : 3)
  const correct = candidates.slice(0, correctCount)

  // Figuras erradas: até 2 com o som "par" (P para B), que é a troca que mais importa treinar
  const pair = pairOf(target)
  const pairWords = pair ? shuffle(wordsStartingWith(pair), rng).slice(0, 2) : []
  const others = shuffle(
    WORDS.filter((w) => w.start !== target && w.start !== pair),
    rng,
  )
  // Nas vogais, as erradas também começam com vogal, para ouvir a diferença
  const pool = VOWELS.includes(target)
    ? [...others.filter((w) => VOWELS.includes(w.start)), ...others.filter((w) => !VOWELS.includes(w.start))]
    : others
  const wrong = [...pairWords, ...pool].slice(0, 6 - correct.length)

  correct.forEach((w) => used.add(w.id))
  return {
    kind: 'caca',
    target,
    options: shuffle([...correct, ...wrong], rng),
    correct: correct.map((w) => w.id),
  }
}

export function faltaQuestion(level: Level, weights: Weights, used: Set<string>, rng: Rng): Question {
  const target = pickTarget(level, weights, rng)
  const word = freshFirst(wordsStartingWith(target), used, rng)[0]
  used.add(word.id)

  const options = new Set([target])
  const pair = pairOf(target)
  if (pair) options.add(pair)
  const pool = VOWELS.includes(target) ? VOWELS : SOUNDS.map((s) => s.key).filter((k) => !VOWELS.includes(k))
  for (const key of shuffle(pool, rng)) {
    if (options.size >= 3) break
    options.add(key)
  }
  return { kind: 'falta', word, options: shuffle([...options], rng), answer: target }
}

/** Troca a primeira letra da sílaba pelo som "par" (PA → BA); nas vogais, por outra vogal. */
export function swapFirstLetter(syllable: string, rng: Rng): string {
  const first = syllable[0]
  const plain = first.normalize('NFD')[0]
  const pair = pairOf(plain)
  const replacement = pair ?? pick(VOWELS.filter((v) => v !== plain), rng)
  return replacement + syllable.slice(1)
}

export function montaQuestion(level: Level, weights: Weights, used: Set<string>, rng: Rng, hard: boolean): Question {
  const target = pickTarget(level, weights, rng)
  const all = wordsStartingWith(target)
  // Palavras curtas primeiro (2 ou 3 sílabas); as longas só no chefão
  const maxSyllables = hard ? 4 : 3
  const fitting = all.filter((w) => w.syllables.length >= 2 && w.syllables.length <= maxSyllables)
  const word = freshFirst(fitting.length > 0 ? fitting : all, used, rng)[0]
  used.add(word.id)

  const pieces = [...word.syllables]
  if (hard) {
    const distractor = swapFirstLetter(word.syllables[0], rng)
    if (!pieces.includes(distractor)) pieces.push(distractor)
  }
  // Embaralha até sair fora de ordem (com uma sílaba só, não tem como)
  let shuffled = shuffle(pieces, rng)
  for (let i = 0; i < 10 && pieces.length > 1 && shuffled.join('-') === pieces.join('-'); i++) {
    shuffled = shuffle(pieces, rng)
  }
  return { kind: 'monta', word, pieces: shuffled }
}

export function rimaQuestion(level: Level, used: Set<string>, rng: Rng): Question {
  const groups = new Map<string, Word[]>()
  for (const w of WORDS) {
    if (!w.rhyme) continue
    groups.set(w.rhyme, [...(groups.get(w.rhyme) ?? []), w])
  }
  const rhymeGroups = [...groups.values()].filter((g) => g.length >= 2)
  // De preferência, a primeira palavra começa com um som da ilha
  const fromIsland = (g: Word[]) => g.some((w) => level.sounds.includes(w.start))
  const preferred = rhymeGroups.filter(fromIsland)

  if (rng() < 0.5) {
    const group = pick(preferred.length > 0 ? preferred : rhymeGroups, rng)
    const [a, b] = freshFirst(group, used, rng)
    used.add(a.id)
    used.add(b.id)
    return { kind: 'rima', a, b, rhymes: true }
  }

  const islandWords = WORDS.filter((w) => level.sounds.includes(w.start))
  const a = freshFirst(islandWords.length > 0 ? islandWords : WORDS, used, rng)[0]
  const b = freshFirst(
    WORDS.filter((w) => w.id !== a.id && !rhymes(a, w)),
    used,
    rng,
  )[0]
  used.add(a.id)
  used.add(b.id)
  return { kind: 'rima', a, b, rhymes: false }
}

export const ROUND_SIZE = 6

/** As perguntas de uma fase. O chefão mistura os quatro jogos e é mais longo. */
export function buildRound(level: Level, weights: Weights, rng: Rng): Question[] {
  const used = new Set<string>()
  switch (level.game) {
    case 'caca':
      return Array.from({ length: ROUND_SIZE }, () => cacaQuestion(level, weights, used, rng))
    case 'falta':
      return Array.from({ length: ROUND_SIZE }, () => faltaQuestion(level, weights, used, rng))
    case 'monta':
      return Array.from({ length: ROUND_SIZE }, () => montaQuestion(level, weights, used, rng, false))
    case 'rima':
      return Array.from({ length: ROUND_SIZE }, () => rimaQuestion(level, used, rng))
    case 'chefao':
      return shuffle(
        [
          cacaQuestion(level, weights, used, rng),
          cacaQuestion(level, weights, used, rng),
          faltaQuestion(level, weights, used, rng),
          faltaQuestion(level, weights, used, rng),
          montaQuestion(level, weights, used, rng, true),
          montaQuestion(level, weights, used, rng, true),
          rimaQuestion(level, used, rng),
          rimaQuestion(level, used, rng),
        ],
        rng,
      )
  }
}

/** Estrelas da rodada pelos acertos de primeira. Terminar sempre vale pelo menos uma. */
export function starsFor(firstTry: number, total: number): 1 | 2 | 3 {
  const ratio = total > 0 ? firstTry / total : 0
  if (ratio >= 0.9) return 3
  if (ratio >= 0.6) return 2
  return 1
}

