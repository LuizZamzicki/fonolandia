// Nuvem (Supabase), opcional. Sem VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY o app funciona só no
// aparelho. Com elas, um aparelho ligado a uma turma (pelo código) envia as rodadas e recebe os alunos
// e as estrelas; a professora, logada, lê as respostas de todos os aparelhos.

import type { SupabaseClient } from '@supabase/supabase-js'
import { applySync, getDb, pendingChanges, queueEverything, updateSettings } from './db'
import type { Attempt, Round, Student } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudEnabled = Boolean(url && anonKey)

let client: Promise<SupabaseClient> | null = null

/** O cliente só é baixado quando a nuvem está configurada. */
export function supabase(): Promise<SupabaseClient> {
  if (!cloudEnabled) throw new Error('Nuvem não configurada')
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, anonKey))
  return client
}

interface ClassPayload {
  id: string
  name: string
  students: Student[]
  rounds: Round[]
}

let syncing: Promise<void> | null = null

/** Envia o que falta e traz a turma. Sem turma ligada ou sem internet, não faz nada. */
export function syncNow(): Promise<void> {
  syncing ??= doSync().finally(() => {
    syncing = null
  })
  return syncing
}

async function doSync(): Promise<void> {
  const code = getDb().settings.classCode
  if (!cloudEnabled || !code || !navigator.onLine) return
  const pending = pendingChanges()
  // Em lotes, para não mandar um pacote gigante depois de muito tempo sem internet
  const attempts = pending.attempts.slice(0, 2000)
  const sb = await supabase()
  const { data, error } = await sb.rpc('sincronizar_turma', {
    p_code: code,
    p_students: pending.students,
    p_rounds: pending.rounds,
    p_attempts: attempts,
  })
  if (error) throw new Error(error.message)
  const payload = data as ClassPayload | null
  if (!payload) throw new Error('Turma não encontrada')
  applySync(
    {
      students: pending.students.map((s) => s.id),
      rounds: pending.rounds.map((r) => r.id),
      attempts: attempts.map((a) => a.id),
    },
    { students: payload.students, rounds: payload.rounds, className: payload.name },
  )
  if (pending.attempts.length > attempts.length) await doSync()
}

/** Liga este aparelho a uma turma: o que já existe aqui vai para a turma. */
export async function linkClass(code: string): Promise<string> {
  const clean = code.trim().toUpperCase()
  const sb = await supabase()
  const { data, error } = await sb.rpc('turma_por_codigo', { p_code: clean })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Não achei nenhuma turma com esse código.')
  const payload = data as ClassPayload
  updateSettings({ classCode: clean, className: payload.name })
  queueEverything()
  await syncNow()
  return payload.name
}

export function unlinkClass(): void {
  updateSettings({ classCode: null, className: null, lastSync: null })
}

// --- Professora (login)

export async function teacherSession() {
  const sb = await supabase()
  const { data } = await sb.auth.getSession()
  return data.session
}

export async function teacherSignIn(email: string, password: string, create: boolean): Promise<void> {
  const sb = await supabase()
  const { error } = create
    ? await sb.auth.signUp({ email, password })
    : await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
}

export async function teacherSignOut(): Promise<void> {
  const sb = await supabase()
  await sb.auth.signOut()
}

export interface CloudClass {
  id: string
  name: string
  code: string
}

export async function myClasses(): Promise<CloudClass[]> {
  const sb = await supabase()
  const { data, error } = await sb.from('classes').select('id, name, code').order('created_at')
  if (error) throw new Error(error.message)
  return data as CloudClass[]
}

export async function createClass(name: string): Promise<CloudClass> {
  const sb = await supabase()
  const { data, error } = await sb.from('classes').insert({ name }).select('id, name, code').single()
  if (error) throw new Error(error.message)
  return data as CloudClass
}

/** Respostas de todos os aparelhos da turma (só com a professora logada). */
export async function classAttempts(code: string): Promise<Attempt[]> {
  const sb = await supabase()
  const { data: cls, error: e1 } = await sb.from('classes').select('id').eq('code', code).maybeSingle()
  if (e1) throw new Error(e1.message)
  if (!cls) return []
  const { data: students, error: e2 } = await sb.from('students').select('id').eq('class_id', cls.id)
  if (e2) throw new Error(e2.message)
  const ids = (students ?? []).map((s: { id: string }) => s.id)
  if (ids.length === 0) return []

  const all: Attempt[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('attempts')
      .select('id, student_id, round_id, game, target, answer, correct, played_at')
      .in('student_id', ids)
      .order('played_at')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    for (const a of data ?? []) {
      all.push({
        id: a.id,
        studentId: a.student_id,
        roundId: a.round_id,
        game: a.game,
        target: a.target,
        answer: a.answer,
        correct: a.correct,
        at: a.played_at,
      })
    }
    if (!data || data.length < pageSize) break
  }
  return all
}
