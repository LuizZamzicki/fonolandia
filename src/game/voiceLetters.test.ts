import { describe, expect, it } from 'vitest'
import { dtw, features, mfcc, rank, RATE } from '../audio/features'
import { SOUNDS } from '../data/sounds'
import { chooseSound, isTransparent, plainLetters, runWords } from './voiceLetters'

describe('palavras da corrida', () => {
  it('transparentes: cada letra com o seu som básico', () => {
    for (const w of ['PATO', 'BOLA', 'DADO', 'FOCA', 'VACA', 'MALA', 'NOTA', 'GATO', 'SAPO', 'LUA', 'UVA', 'MEIA', 'PÉ'])
      expect(isTransparent(w), w).toBe(true)
    for (const w of ['CASA', 'PERA', 'PÃO', 'SOL', 'LÁPIS', 'TREM', 'FOLHA', 'GIRAFA', 'CENOURA', 'CACHORRO', 'PEIXE', 'GUARDA-CHUVA'])
      expect(isTransparent(w), w).toBe(false)
  })

  it('só usa os sons ensinados', () => {
    const all = SOUNDS.map((s) => s.key)
    expect(runWords(all).length).toBeGreaterThan(20)
    for (const w of runWords(['P', 'A', 'T', 'O'])) expect(plainLetters(w.word)).toMatch(/^[PATO]+$/)
    expect(runWords(['P', 'A', 'T', 'O']).map((w) => w.word)).toContain('PATO')
    expect(runWords(['P', 'B'])).toEqual([])
  })

  it('escolhe o som: o mais parecido, ou o esperado se estiver quase empatado', () => {
    const ranked = [
      { sound: 'B', distance: 10 },
      { sound: 'P', distance: 10.4 },
      { sound: 'M', distance: 14 },
    ]
    expect(chooseSound(ranked, null)).toBe('B')
    expect(chooseSound(ranked, 'P')).toBe('P')
    expect(chooseSound(ranked, 'M')).toBe('B')
    expect(chooseSound([], 'P')).toBeNull()
  })
})

/** Som sintético: ruído agudo (como "ssss") ou tom grave com harmônicos (como "mmmm"). */
function synth(kind: 'chiado' | 'zumbido', seconds: number, seed: number): Float32Array {
  const out = new Float32Array(Math.floor(RATE * seconds))
  let s = seed
  let prev = 0
  for (let i = 0; i < out.length; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    const noise = s / 1073741824 - 1
    if (kind === 'chiado') {
      out[i] = (noise - prev) * 0.2 // diferença = passa-alta
      prev = noise
    } else {
      const t = i / RATE
      out[i] = 0.3 * Math.sin(2 * Math.PI * (140 + seed) * t) + 0.1 * Math.sin(2 * Math.PI * (280 + seed) * t) + 0.01 * noise
    }
  }
  return out
}

describe('reconhecimento por comparação', () => {
  it('impressões digitais: 24 números a cada 20 ms', () => {
    const frames = features(synth('zumbido', 0.5, 1), RATE)
    expect(frames.length).toBeGreaterThan(15)
    expect(frames[0]).toHaveLength(24)
    expect(mfcc(new Float32Array(100))).toEqual([])
  })

  it('o mesmo som fica mais perto de si do que de outro', () => {
    const s1 = features(synth('chiado', 0.6, 3), RATE)
    const s2 = features(synth('chiado', 0.9, 7), RATE)
    const m1 = features(synth('zumbido', 0.7, 5), RATE)
    expect(dtw(s1, s2)).toBeLessThan(dtw(s1, m1))
  })

  it('separa chiado de zumbido com gravações diferentes', () => {
    const templates = [
      { sound: 'S', frames: features(synth('chiado', 0.5, 11), RATE) },
      { sound: 'S', frames: features(synth('chiado', 0.8, 12), RATE) },
      { sound: 'M', frames: features(synth('zumbido', 0.6, 13), RATE) },
      { sound: 'M', frames: features(synth('zumbido', 0.9, 14), RATE) },
    ]
    expect(rank(features(synth('chiado', 0.7, 99), RATE), templates)[0].sound).toBe('S')
    expect(rank(features(synth('zumbido', 0.4, 20), RATE), templates)[0].sound).toBe('M')
  })
})

describe('pedido falado', () => {
  it('pede o som, não o nome da letra', async () => {
    const { soundPrompt } = await import('./voiceLetters')
    expect(soundPrompt('S')).toBe('Faça o som do começo de sapo!')
    expect(soundPrompt('A')).toBe('Faça á, como no começo de abelha!')
  })
})
