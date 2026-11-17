import type { GameKind } from '../data/sounds'

export interface Student {
  id: string
  name: string
  /** Id do avatar (ver game/rewards.ts). */
  avatar: string
  archived: boolean
  createdAt: string
  updatedAt: string
}

/** Uma fase jogada até o fim. */
export interface Round {
  id: string
  studentId: string
  levelId: string
  stars: number
  /** Acertos de primeira. */
  correct: number
  total: number
  at: string
}

/** Uma resposta da criança (certa ou errada). */
export interface Attempt {
  id: string
  studentId: string
  roundId: string
  game: GameKind
  /** Som esperado (letra) ou "rima". */
  target: string
  /** O que a criança escolheu: a letra, o som inicial da figura, a sílaba ou "sim"/"nao". */
  answer: string
  correct: boolean
  at: string
}

export interface Settings {
  /** PIN da área da professora (só neste aparelho). */
  pin: string | null
  /** Libera todas as fases do mapa, sem precisar seguir a ordem. */
  unlockAll: boolean
  /** Turma na nuvem ligada a este aparelho. */
  classCode: string | null
  className: string | null
  lastSync: string | null
}

export interface Db {
  students: Student[]
  rounds: Round[]
  attempts: Attempt[]
  settings: Settings
  /** Ids ainda não enviados para a nuvem. */
  outbox: { students: string[]; rounds: string[]; attempts: string[] }
}

export const EMPTY_DB: Db = {
  students: [],
  rounds: [],
  attempts: [],
  settings: { pin: null, unlockAll: false, classCode: null, className: null, lastSync: null },
  outbox: { students: [], rounds: [], attempts: [] },
}
