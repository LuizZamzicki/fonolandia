// Corrida da Voz: quais palavras servem e como decidir qual som a criança fez.

import type { Ranked } from '../audio/features'
import { soundPromptLine } from '../data/phrases'
import { WORDS, type Word } from '../data/words'
import { lineText, type Part } from '../lib/speech'

/** Sem acento, maiúsculas, só letras (PÃO → PAO). */
export function plainLetters(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

const VOWEL = /[AEIOU]/

/**
 * A palavra é "transparente": cada letra tem o seu som básico, então dá para formar a palavra fazendo
 * o som de cada letra. Fica de fora: til (PÃO), dígrafos (CH, LH, NH, QU, GU, RR, SS), C/G antes de E/I
 * (som de S/J), S entre vogais (som de Z, CASA), R entre vogais (R fraco, PERA), encontros (TR, BL),
 * consoante no fim da sílaba (SOL, LÁPIS, CAMPO) e X ou H (vários sons).
 */
export function isTransparent(word: string): boolean {
  if (/[ÃÕ-]/.test(word)) return false
  const w = plainLetters(word)
  if (/[XHKWYQ]/.test(w)) return false
  if (/CH|LH|NH|QU|GU|RR|SS|SC/.test(w)) return false
  for (let i = 0; i < w.length; i++) {
    const c = w[i]
    const next = w[i + 1]
    const prev = w[i - 1]
    if (VOWEL.test(c)) continue
    if ((c === 'C' || c === 'G') && (next === 'E' || next === 'I')) return false
    if ((c === 'S' || c === 'R') && prev && VOWEL.test(prev) && next && VOWEL.test(next)) return false
    // Toda consoante precisa vir antes de uma vogal (nada de fim de sílaba nem encontro)
    if (!next || !VOWEL.test(next)) return false
  }
  return true
}

/** Palavras curtas e transparentes que só usam os sons ensinados. */
export function runWords(sounds: string[]): Word[] {
  const allowed = new Set(sounds)
  const seen = new Set<string>()
  return WORDS.filter((w) => {
    const letters = plainLetters(w.word)
    if (letters.length < 2 || letters.length > 4 || !isTransparent(w.word)) return false
    if (![...letters].every((l) => allowed.has(l))) return false
    // Sem repetir a mesma grafia (VOVÓ e VOVÔ viram VOVO)
    if (seen.has(letters)) return false
    seen.add(letters)
    return true
  })
}

/**
 * Qual som vale. Ganha o mais parecido; mas se o som esperado estiver quase empatado (até 6% mais
 * distante), vale o esperado: a voz de criança varia muito, e errar a favor dela frustra menos.
 */
export function chooseSound(ranked: Ranked[], wanted: string | null): string | null {
  if (ranked.length === 0) return null
  const best = ranked[0]
  if (wanted && best.sound !== wanted) {
    const w = ranked.find((r) => r.sound === wanted)
    if (w && w.distance <= best.distance * 1.06) return wanted
  }
  return best.sound
}

/** O pedido falado: o som, nunca o nome da letra ("Faça o som do começo de sapo!"). */
export function soundPrompt(letter: string): string {
  return lineText(soundPromptParts(letter))
}

/** O mesmo pedido em partes, para tocar a voz gravada da professora. */
export function soundPromptParts(letter: string): Part[] {
  return soundPromptLine(letter, VOWEL.test(letter))
}
