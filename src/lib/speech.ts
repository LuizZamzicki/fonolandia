// Voz em português (Web Speech API, voz do próprio aparelho). As crianças que ainda não leem
// dependem dela: toda instrução e toda figura podem ser ouvidas.

import { useEffect, useState } from 'react'
import { soundInfo } from '../data/sounds'
import { getRecording, hasRecording, phraseKey, soundKey } from '../store/recordings'
import { readPref } from './prefs'
import { audio } from './sounds'

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
let currentSource: AudioBufferSourceNode | null = null

/**
 * Um pedaço de fala: um texto ou o som de uma letra. As falas que juntam partes (palavra + frase)
 * usam a gravação da professora de cada parte que ela gravou.
 */
export type Part = string | { sound: string }
/** Uma fala inteira: um texto só ou uma lista de partes. */
export type Line = string | Part[]

function partText(part: Part): string {
  return typeof part === 'string' ? part : (soundInfo(part.sound)?.spoken ?? part.sound)
}

function partKey(part: Part): string {
  return typeof part === 'string' ? phraseKey(part) : soundKey(part.sound)
}

function partsOf(line: Line): Part[] {
  return typeof line === 'string' ? [line] : line
}

/** O texto da fala, para mostrar na tela ou para a voz do aparelho. */
export function lineText(line: Line): string {
  return partsOf(line)
    .map(partText)
    .join(' ')
    .replace(/\s+([,.!?:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stopSpeaking(): void {
  current++
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  try {
    currentSource?.stop()
  } catch {
    // Já tinha parado
  }
  currentSource = null
}

/** Voz do aparelho. `done` é chamado no fim (ou logo, sem voz). */
function synth(text: string, rate: number, done: () => void) {
  if (typeof speechSynthesis === 'undefined' || !text) {
    done()
    return
  }
  const v = voice()
  let finished = false
  const finish = () => {
    window.clearTimeout(watchdog)
    if (finished) return
    finished = true
    done()
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

const decodedClips = new Map<string, Promise<AudioBuffer | null>>()

/** Esquece o áudio decodificado de uma gravação (depois de regravar ou apagar). */
export function forgetClip(key: string): void {
  decodedClips.delete(key)
}

function decodeClip(ctx: AudioContext, key: string): Promise<AudioBuffer | null> {
  let clip = decodedClips.get(key)
  if (!clip) {
    clip = getRecording(key)
      .then(async (blob) => (blob ? await ctx.decodeAudioData(await blob.arrayBuffer()) : null))
      .catch(() => null)
    decodedClips.set(key, clip)
  }
  return clip
}

/** Toca uma gravação. `done(false)` se não deu para tocar. */
function playClip(key: string, id: number, done: (played: boolean) => void) {
  const ctx = audio()
  if (!ctx) {
    done(false)
    return
  }
  void decodeClip(ctx, key).then((buffer) => {
    if (id !== current) return
    if (!buffer) {
      done(false)
      return
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => {
      if (currentSource === source) currentSource = null
      done(true)
    }
    currentSource = source
    source.start()
  })
}

/**
 * Fala uma frase; cada fala nova interrompe a anterior. Toca a voz gravada da professora quando
 * existe (parte por parte) e usa a voz do aparelho no resto. `onEnd` é chamado no fim.
 */
export function speak(line: Line, onEnd?: () => void, rate = 0.9): void {
  stopSpeaking()
  const id = current
  if (!readPref(VOICE_PREF, true)) {
    onEnd?.()
    return
  }
  // Pontuação solta (",", ".") só serve para o texto inteiro
  const parts = partsOf(line).filter((p) => partKey(p) !== '')
  const finish = () => {
    if (id === current) onEnd?.()
  }
  // Sem nenhuma gravação: a frase inteira de uma vez na voz do aparelho (soa mais natural)
  if (!parts.some((p) => hasRecording(partKey(p)))) {
    synth(lineText(line), rate, finish)
    return
  }
  const next = (i: number) => {
    if (id !== current) return
    if (i >= parts.length) {
      finish()
      return
    }
    const part = parts[i]
    const key = partKey(part)
    const fallback = () => synth(partText(part), rate, () => next(i + 1))
    if (hasRecording(key)) playClip(key, id, (played) => (played ? next(i + 1) : fallback()))
    else fallback()
  }
  next(0)
}

/** Palavra falada devagar, para a criança ouvir bem cada som. */
export function speakWord(word: string, onEnd?: () => void): void {
  speak(word.toLowerCase(), onEnd, 0.75)
}

/** Toca a gravação de uma chave (para a professora conferir). */
export function playRecording(key: string, onEnd?: () => void): void {
  stopSpeaking()
  const id = current
  playClip(key, id, () => {
    if (id === current) onEnd?.()
  })
}
