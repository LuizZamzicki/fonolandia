// Banco local do aparelho (IndexedDB). Tudo funciona sem internet; o que é novo fica no "outbox" até
// ser enviado para a nuvem (store/cloud.ts), quando houver uma turma ligada.

import { get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { EMPTY_DB, type Attempt, type Db, type Round, type Settings, type Student } from './types'

const KEY = 'fonolandia:db'

let db: Db = EMPTY_DB
let loaded = false
const listeners = new Set<() => void>()
let saveTimer: number | undefined

function emit() {
  listeners.forEach((l) => l())
}

function persist() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    set(KEY, db).catch((e) => console.warn('Não foi possível salvar no aparelho:', e))
  }, 300)
}

function update(next: Db) {
  db = next
  emit()
  persist()
}

/** Carrega o banco do aparelho (uma vez, ao abrir o app). */
export async function loadDb(): Promise<void> {
  if (loaded) return
  try {
    const stored = await get<Db>(KEY)
    if (stored) {
      db = {
        ...EMPTY_DB,
        ...stored,
        settings: { ...EMPTY_DB.settings, ...stored.settings },
        outbox: { ...EMPTY_DB.outbox, ...stored.outbox },
      }
    }
  } catch (e) {
    console.warn('Sem acesso ao armazenamento do aparelho; os dados valem só até fechar:', e)
  }
  loaded = true
  emit()
}

/** Garante que o que está pendente vai para o disco antes de a página fechar. */
export function flushDb(): void {
  if (saveTimer === undefined) return
  window.clearTimeout(saveTimer)
  saveTimer = undefined
  void set(KEY, db)
}

export function getDb(): Db {
  return db
}

export function useDb(): Db {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => db,
  )
}

export function newId(): string {
  return crypto.randomUUID()
}

// --- Alunos

export function addStudent(name: string, avatar: string): Student {
  const now = new Date().toISOString()
  const student: Student = { id: newId(), name: name.trim(), avatar, archived: false, createdAt: now, updatedAt: now }
  update({
    ...db,
    students: [...db.students, student],
    outbox: { ...db.outbox, students: [...db.outbox.students, student.id] },
  })
  return student
}

export function updateStudent(id: string, patch: Partial<Pick<Student, 'name' | 'avatar' | 'archived'>>): void {
  const now = new Date().toISOString()
  update({
    ...db,
    students: db.students.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: now } : s)),
    outbox: { ...db.outbox, students: [...new Set([...db.outbox.students, id])] },
  })
}

// --- Rodadas

export function saveRound(round: Round, attempts: Attempt[]): void {
  update({
    ...db,
    rounds: [...db.rounds, round],
    attempts: [...db.attempts, ...attempts],
    outbox: {
      ...db.outbox,
      rounds: [...db.outbox.rounds, round.id],
      attempts: [...db.outbox.attempts, ...attempts.map((a) => a.id)],
    },
  })
}

// --- Configurações

export function updateSettings(patch: Partial<Settings>): void {
  update({ ...db, settings: { ...db.settings, ...patch } })
}

// --- Sincronização

/** O que falta enviar. */
export function pendingChanges() {
  const students = new Set(db.outbox.students)
  const rounds = new Set(db.outbox.rounds)
  const attempts = new Set(db.outbox.attempts)
  return {
    students: db.students.filter((s) => students.has(s.id)),
    rounds: db.rounds.filter((r) => rounds.has(r.id)),
    attempts: db.attempts.filter((a) => attempts.has(a.id)),
  }
}

/** Junta o que veio da nuvem com o que está no aparelho e tira do outbox o que foi enviado. */
export function applySync(
  sent: { students: string[]; rounds: string[]; attempts: string[] },
  remote: { students: Student[]; rounds: Round[]; className: string },
): void {
  const sentStudents = new Set(sent.students)
  const sentRounds = new Set(sent.rounds)
  const sentAttempts = new Set(sent.attempts)

  // Alunos: vale a versão mais recente de cada um
  const students = new Map(db.students.map((s) => [s.id, s]))
  for (const s of remote.students) {
    const local = students.get(s.id)
    if (!local || local.updatedAt <= s.updatedAt) students.set(s.id, s)
  }
  // Rodadas: só se juntam (nunca mudam depois de gravadas)
  const roundIds = new Set(db.rounds.map((r) => r.id))
  const newRounds = remote.rounds.filter((r) => !roundIds.has(r.id))

  update({
    ...db,
    students: [...students.values()],
    rounds: [...db.rounds, ...newRounds],
    settings: { ...db.settings, className: remote.className, lastSync: new Date().toISOString() },
    outbox: {
      // Mudanças feitas enquanto o envio acontecia continuam pendentes
      students: db.outbox.students.filter((id) => !sentStudents.has(id)),
      rounds: db.outbox.rounds.filter((id) => !sentRounds.has(id)),
      attempts: db.outbox.attempts.filter((id) => !sentAttempts.has(id)),
    },
  })
}

/** Ao ligar o aparelho a uma turma: tudo o que já existe aqui passa a ser enviado. */
export function queueEverything(): void {
  update({
    ...db,
    outbox: {
      students: db.students.map((s) => s.id),
      rounds: db.rounds.map((r) => r.id),
      attempts: db.attempts.map((a) => a.id),
    },
  })
}
