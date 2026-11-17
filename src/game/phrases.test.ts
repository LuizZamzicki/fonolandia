import { describe, expect, it } from 'vitest'
import { speechRange } from '../audio/recorder'
import { cacaInstruction, clipGroups, faltaWrong, montaListen, PHRASES, rimaExplanation } from '../data/phrases'
import { wordById } from '../data/words'
import { lineText } from '../lib/speech'
import { phraseKey, soundKey } from '../store/recordings'

const word = (id: string) => wordById(id)!

describe('falas em partes', () => {
  it('formam a frase inteira para a voz do aparelho', () => {
    expect(lineText(cacaInstruction('P'))).toBe('Toque nas figuras que começam com o som do pê, como em pato.')
    expect(lineText(faltaWrong('B', word('pato')))).toBe('Não é bê. Escute de novo: pato.')
    expect(lineText(rimaExplanation(word('pato'), word('gato'), true, false))).toBe('Ops! pato e gato rimam!')
    expect(lineText(montaListen(word('bola')))).toBe('Escute: bo... la...')
  })

  it('cada parte de texto tem uma gravação possível na lista da professora', () => {
    const keys = new Set(clipGroups(phraseKey, soundKey, []).flatMap((g) => g.items.map((i) => i.key)))
    const parts = [...cacaInstruction('P'), ...faltaWrong('B', word('pato')), ...montaListen(word('bola'))]
    for (const part of parts) {
      const key = typeof part === 'string' ? phraseKey(part) : soundKey(part.sound)
      if (key) expect(keys, String(key)).toContain(key)
    }
    for (const text of Object.values(PHRASES)) expect(keys).toContain(phraseKey(text))
  })
})

describe('chave da gravação', () => {
  it('ignora maiúsculas e pontuação, mas mantém acentos', () => {
    expect(phraseKey('Olá! Quem vai jogar?')).toBe('olá quem vai jogar')
    expect(phraseKey('pato.')).toBe('pato')
    expect(phraseKey(',')).toBe('')
  })
})

describe('corte do silêncio', () => {
  it('acha a fala no meio do silêncio', () => {
    const rate = 22050
    const samples = new Float32Array(rate * 2)
    for (let i = rate * 0.8; i < rate * 1.2; i++) samples[i] = 0.5 * Math.sin(i / 5)
    const [start, end] = speechRange(samples)!
    expect(start / rate).toBeGreaterThan(0.6)
    expect(start / rate).toBeLessThan(0.8)
    expect(end / rate).toBeGreaterThan(1.2)
    expect(end / rate).toBeLessThan(1.4)
  })

  it('silêncio puro não vira gravação', () => {
    expect(speechRange(new Float32Array(22050))).toBeNull()
  })
})
