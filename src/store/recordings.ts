// Gravações da voz da professora (o áudio de verdade), guardadas no aparelho. Quando existe gravação
// para uma fala, o jogo toca a voz dela no lugar da voz do aparelho.
//
// Cada gravação tem uma chave: o texto falado "normalizado" (minúsculas, sem pontuação) ou, para os
// sons das letras, "som:P". Assim qualquer fala do jogo encontra a gravação só pelo texto.

import { del, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'

const INDEX_KEY = 'fonolandia:gravacoes'
const clipKey = (key: string) => `fonolandia:gravacao:${key}`

let keys: ReadonlySet<string> = new Set()
let loaded: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

/** Chave de uma fala: "Olá! Quem vai jogar?" → "olá quem vai jogar". */
export function phraseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:…"“”()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Chave do som de uma letra (o som, não o nome). */
export function soundKey(letter: string): string {
  return `som:${letter}`
}

export function loadRecordings(): Promise<void> {
  loaded ??= get<string[]>(INDEX_KEY)
    .then((stored) => {
      keys = new Set(stored ?? [])
      emit()
    })
    .catch(() => {})
  return loaded
}

export function hasRecording(key: string): boolean {
  return keys.has(key)
}

export function useRecordings(): ReadonlySet<string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => keys,
  )
}

export function getRecording(key: string): Promise<Blob | undefined> {
  return get<Blob>(clipKey(key))
}

export async function saveRecording(key: string, audio: Blob): Promise<void> {
  await set(clipKey(key), audio)
  keys = new Set([...keys, key])
  await set(INDEX_KEY, [...keys])
  emit()
  // Pede ao navegador para não apagar as gravações quando faltar espaço
  void navigator.storage?.persist?.().catch(() => {})
}

export async function deleteRecording(key: string): Promise<void> {
  const next = new Set(keys)
  next.delete(key)
  keys = next
  emit()
  await del(clipKey(key))
  await set(INDEX_KEY, [...keys])
}
