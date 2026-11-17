// Gravações dos sons (as "impressões digitais", não o áudio), guardadas no aparelho. Cada gravação é da
// turma (a professora ensinou) ou de uma criança (a própria voz, que deixa o reconhecimento melhor).

import { get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import type { Frames, Template } from '../audio/features'

const KEY = 'fonolandia:vozes'
/** Gravações guardadas por som e por dono (as mais antigas saem). */
export const MAX_PER_SOUND = 5

export interface VoiceSample {
  id: string
  sound: string
  /** "turma" ou o id da criança. */
  owner: string
  frames: Frames
  at: string
}

export const CLASS_OWNER = 'turma'

let samples: VoiceSample[] = []
let loaded: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function save() {
  set(KEY, samples).catch((e) => console.warn('Não foi possível guardar as vozes:', e))
}

export function loadVoices(): Promise<void> {
  loaded ??= get<VoiceSample[]>(KEY)
    .then((stored) => {
      samples = stored ?? []
      emit()
    })
    .catch(() => {})
  return loaded
}

export function useVoices(): VoiceSample[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => samples,
  )
}

/** Arredonda (guarda menos espaço; não muda o reconhecimento). */
function compact(frames: Frames): Frames {
  return frames.map((f) => f.map((v) => Math.round(v * 100) / 100))
}

export function addVoice(sound: string, owner: string, frames: Frames): void {
  const sample: VoiceSample = { id: crypto.randomUUID(), sound, owner, frames: compact(frames), at: new Date().toISOString() }
  const same = samples.filter((s) => s.sound === sound && s.owner === owner)
  const drop = new Set(same.slice(0, Math.max(0, same.length - MAX_PER_SOUND + 1)).map((s) => s.id))
  samples = [...samples.filter((s) => !drop.has(s.id)), sample]
  emit()
  save()
}

export function clearVoices(sound: string, owner: string): void {
  samples = samples.filter((s) => !(s.sound === sound && s.owner === owner))
  emit()
  save()
}

/** Modelos que valem para uma criança: os da turma e os da própria voz dela. */
export function templatesFor(all: VoiceSample[], studentId: string | null): Template[] {
  return all
    .filter((s) => s.owner === CLASS_OWNER || (studentId !== null && s.owner === studentId))
    .map((s) => ({ sound: s.sound, frames: s.frames }))
}

/** Sons que têm pelo menos uma gravação para essa criança. */
export function taughtSounds(all: VoiceSample[], studentId: string | null): string[] {
  return [...new Set(templatesFor(all, studentId).map((t) => t.sound))]
}
