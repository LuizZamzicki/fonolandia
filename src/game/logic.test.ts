import { describe, expect, it } from 'vitest'
import { ALL_LEVELS, ISLANDS, levelById, SOUNDS } from '../data/sounds'
import { rhymes, wordById, WORDS, wordsStartingWith } from '../data/words'
import type { Attempt, Round } from '../store/types'
import { bestStars, isUnlocked, nextLevel, streakDays } from './progress'
import { buildRound, seededRng, starsFor, swapFirstLetter } from './questions'
import { album, stickerForRound } from './rewards'
import { adaptiveWeights, confusions, pairConfusions, weekStart } from './stats'

describe('banco de palavras', () => {
  it('as sílabas formam a palavra', () => {
    for (const w of WORDS) expect(w.syllables.join(''), w.word).toBe(w.word.replace('-', ''))
  })

  it('ids e figuras não se repetem', () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length)
    expect(new Set(WORDS.map((w) => w.emoji)).size).toBe(WORDS.length)
  })

  it('cada som tem palavras suficientes e uma palavra-exemplo que começa com ele', () => {
    for (const s of SOUNDS) {
      expect(wordsStartingWith(s.key).length, s.key).toBeGreaterThanOrEqual(4)
      expect(wordById(s.example)?.start, s.key).toBe(s.key)
    }
  })

  it('a primeira letra (sem acento) é o som inicial', () => {
    for (const w of WORDS) expect(w.word.normalize('NFD')[0], w.word).toBe(w.start[0])
  })

  it('rimas', () => {
    expect(rhymes(wordById('pato')!, wordById('gato')!)).toBe(true)
    expect(rhymes(wordById('pato')!, wordById('bola')!)).toBe(false)
    expect(rhymes(wordById('pato')!, wordById('pato')!)).toBe(false)
  })
})

describe('perguntas', () => {
  it('todas as fases geram perguntas válidas', () => {
    for (const level of ALL_LEVELS) {
      for (let seed = 1; seed <= 20; seed++) {
        const round = buildRound(level, {}, seededRng(seed))
        expect(round.length).toBe(level.game === 'chefao' ? 8 : 6)
        for (const q of round) {
          if (q.kind === 'caca') {
            expect(q.options).toHaveLength(6)
            expect(q.correct.length).toBeGreaterThanOrEqual(2)
            for (const o of q.options) expect(q.correct.includes(o.id)).toBe(o.start === q.target)
          } else if (q.kind === 'falta') {
            expect(q.options).toHaveLength(3)
            expect(q.options).toContain(q.answer)
            expect(q.word.start).toBe(q.answer)
          } else if (q.kind === 'monta') {
            for (const s of q.word.syllables) expect(q.pieces).toContain(s)
            if (q.word.syllables.length > 1) expect(q.pieces.join('-')).not.toBe(q.word.syllables.join('-'))
          } else {
            expect(rhymes(q.a, q.b)).toBe(q.rhymes)
          }
        }
      }
    }
  })

  it('no Caça-Sons do P aparecem figuras do B para treinar a troca', () => {
    const level = levelById('pb-1')!
    const round = buildRound({ ...level, sounds: ['P'] }, {}, seededRng(3))
    for (const q of round) if (q.kind === 'caca') expect(q.options.some((o) => o.start === 'B')).toBe(true)
  })

  it('o som com mais erros sai mais', () => {
    const level = { ...levelById('pb-2')!, sounds: ['P', 'B'] }
    const rng = seededRng(7)
    let b = 0
    for (let i = 0; i < 50; i++) {
      for (const q of buildRound(level, { P: 0.5, B: 3 }, rng)) if (q.kind === 'falta' && q.answer === 'B') b++
    }
    expect(b / 300).toBeGreaterThan(0.75)
  })

  it('sílaba trocada', () => {
    expect(swapFirstLetter('PA', seededRng(1))).toBe('BA')
    expect(swapFirstLetter('VO', seededRng(1))).toBe('FO')
    expect(['A', 'E', 'I', 'O']).toContain(swapFirstLetter('U', seededRng(1)))
  })

  it('estrelas', () => {
    expect(starsFor(6, 6)).toBe(3)
    expect(starsFor(4, 6)).toBe(2)
    expect(starsFor(1, 6)).toBe(1)
  })
})

const round = (levelId: string, stars: number, at = '2026-11-10T12:00:00Z', id = levelId + stars): Round => ({
  id,
  studentId: 'a',
  levelId,
  stars,
  correct: 0,
  total: 6,
  at,
})

describe('progresso', () => {
  it('abre as fases em ordem e a ilha seguinte depois do chefão', () => {
    const best = bestStars([round('vogais-1', 2), round('vogais-1', 3)], 'a')
    expect(best.get('vogais-1')).toBe(3)
    expect(isUnlocked('vogais-2', best, false)).toBe(true)
    expect(isUnlocked('vogais-3', best, false)).toBe(false)
    expect(isUnlocked('pb-1', best, false)).toBe(false)
    expect(isUnlocked('pb-1', bestStars([round('vogais-5', 1)], 'a'), false)).toBe(true)
    expect(isUnlocked('lr-5', new Map(), true)).toBe(true)
    expect(nextLevel(best, false)).toBe('vogais-2')
    expect(ISLANDS[0].levels[0].id).toBe('vogais-1')
  })

  it('dias seguidos', () => {
    const rounds = [
      round('vogais-1', 1, '2026-11-09T12:00:00'),
      round('vogais-1', 1, '2026-11-10T12:00:00', 'x'),
      round('vogais-1', 1, '2026-11-07T12:00:00', 'y'),
    ]
    expect(streakDays(rounds, 'a', new Date('2026-11-10T18:00:00'))).toBe(2)
    expect(streakDays(rounds, 'a', new Date('2026-11-11T18:00:00'))).toBe(2)
    expect(streakDays(rounds, 'a', new Date('2026-11-12T18:00:00'))).toBe(0)
  })

  it('figurinhas: só com 2 ou 3 estrelas, e sempre a mesma para a mesma rodada', () => {
    expect(stickerForRound({ id: 'r1', stars: 1 })).toBeNull()
    expect(stickerForRound({ id: 'r1', stars: 3 })).toEqual(stickerForRound({ id: 'r1', stars: 3 }))
    const counts = album([round('vogais-1', 3, undefined, 'r1'), round('vogais-2', 1)], 'a')
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(1)
  })
})

const attempt = (target: string, answer: string, correct: boolean, game: Attempt['game'] = 'falta'): Attempt => ({
  id: Math.random().toString(),
  studentId: 'a',
  roundId: 'r',
  game,
  target,
  answer,
  correct,
  at: '2026-11-10T12:00:00Z',
})

describe('estatísticas', () => {
  it('trocas', () => {
    const attempts = [
      attempt('P', 'B', false),
      attempt('P', 'B', false),
      attempt('B', 'P', false),
      attempt('P', 'M', false),
      attempt('P', 'P', true),
      attempt('P', 'PA', false, 'monta'),
    ]
    const list = confusions(attempts)
    expect(list[0]).toEqual({ target: 'P', answer: 'B', count: 2, classic: true })
    expect(list.find((c) => c.answer === 'M')?.classic).toBe(false)
    expect(pairConfusions(attempts)).toEqual([{ pair: ['P', 'B'], count: 3 }])
  })

  it('pesos adaptativos', () => {
    const w = adaptiveWeights([attempt('P', 'B', false), attempt('P', 'B', false), attempt('B', 'B', true)])
    expect(w.P).toBeGreaterThan(w.B)
  })

  it('semana começa na segunda', () => {
    expect(weekStart(new Date(2026, 10, 11))).toBe('2026-11-09')
    expect(weekStart(new Date(2026, 10, 9))).toBe('2026-11-09')
    expect(weekStart(new Date(2026, 10, 8))).toBe('2026-11-02')
  })
})

