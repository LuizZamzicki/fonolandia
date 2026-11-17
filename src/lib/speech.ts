// Voz em português (Web Speech API, voz do próprio aparelho). As crianças que ainda não leem
// dependem dela: toda instrução e toda figura podem ser ouvidas.

import { useEffect, useState } from 'react'
import { readPref } from './prefs'

export const VOICE_PREF = 'voz'

let cachedVoice: SpeechSynthesisVoice | null | undefined

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  const voices = speechSynthesis.getVoices()
  const br = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === 'pt-br')
  const pt = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'))
  const list = br.length > 0 ? br : pt
  // As vozes "naturais"/"Google" costumam soar melhor que as básicas
  return (
    list.find((v) => /natural|google|luciana|francisca|thalita/i.test(v.name)) ??
    list.find((v) => v.localService) ??
    list[0] ??
    null
  )
}

function voice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice
  cachedVoice = pickVoice()
  return cachedVoice
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = pickVoice()
  })
}

/** Indica se o aparelho tem voz em português (as vozes carregam depois da página). */
export function usePortugueseVoice(): boolean {
  const [available, setAvailable] = useState(() => voice() !== null)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const update = () => setAvailable(pickVoice() !== null)
    speechSynthesis.addEventListener('voiceschanged', update)
    const timer = window.setTimeout(update, 800)
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', update)
      window.clearTimeout(timer)
    }
  }, [])
  return available
}

let current = 0
// Guardada de propósito: no Chrome, se a fala for descartada da memória, o fim dela não é avisado
let currentUtterance: SpeechSynthesisUtterance | null = null

export function stopSpeaking(): void {
  current++
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

/** Fala o texto; cada fala nova interrompe a anterior. `onEnd` é chamado no fim (ou logo, sem voz). */
export function speak(text: string, onEnd?: () => void, rate = 0.9): void {
  stopSpeaking()
  const id = current
  const v = voice()
  if (!readPref(VOICE_PREF, true) || typeof speechSynthesis === 'undefined') {
    onEnd?.()
    return
  }
  let finished = false
  const finish = () => {
    window.clearTimeout(watchdog)
    if (finished || id !== current) return
    finished = true
    onEnd?.()
  }
  // Se o navegador não avisar o fim, segue mesmo assim depois de um tempo
  const watchdog = window.setTimeout(finish, 2500 + text.length * 120)
  const utterance = new SpeechSynthesisUtterance(text)
  if (v) utterance.voice = v
  utterance.lang = v?.lang ?? 'pt-BR'
  utterance.rate = rate
  utterance.pitch = 1.1
  utterance.onend = finish
  utterance.onerror = finish
  currentUtterance = utterance
  speechSynthesis.resume()
  speechSynthesis.speak(currentUtterance)
}

/** Palavra falada devagar, para a criança ouvir bem cada som. */
export function speakWord(word: string, onEnd?: () => void): void {
  speak(word.toLowerCase(), onEnd, 0.75)
}
