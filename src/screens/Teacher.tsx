// Área da professora: PIN, turma, desempenho por criança e por som, trocas frequentes e evolução.

import { AlertTriangle, AudioLines, Cloud, Download, LogOut, Mic, Plus, RefreshCw, Settings, Users, Grid3x3 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { GAME_INFO, ISLANDS, SOUNDS, levelById, type GameKind } from '../data/sounds'
import { bestStars, totalStars, MAX_STARS } from '../game/progress'
import { AVATARS, FREE_AVATARS, avatarEmoji } from '../game/rewards'
import {
  accuracyByGame,
  accuracyBySound,
  confusions,
  overall,
  pairConfusions,
  rate,
  weeklyEvolution,
  type Score,
} from '../game/stats'
import { readPref, writePref } from '../lib/prefs'
import { SOUNDS_PREF } from '../lib/sounds'
import { VOICE_PREF } from '../lib/speech'
import {
  classAttempts,
  cloudEnabled,
  createClass,
  linkClass,
  myClasses,
  syncNow,
  teacherSession,
  teacherSignIn,
  teacherSignOut,
  unlinkClass,
  type CloudClass,
} from '../store/cloud'
import { addStudent, updateSettings, updateStudent, useDb } from '../store/db'
import type { Attempt, Student } from '../store/types'
import { BackButton, StarRow } from '../ui/kit'
import { TeacherRecordings } from './TeacherRecordings'
import { TeacherVoices } from './TeacherVoices'

export function Teacher({ onExit }: { onExit: () => void }) {
  const db = useDb()
  const [unlocked, setUnlocked] = useState(false)
  if (!unlocked) return <PinGate pin={db.settings.pin} onOk={() => setUnlocked(true)} onExit={onExit} />
  return <Panel onExit={onExit} />
}

// --- PIN -----------------------------------------------------------------------------

function PinGate({ pin, onOk, onExit }: { pin: string | null; onOk: () => void; onExit: () => void }) {
  const creating = pin === null
  const [typed, setTyped] = useState('')
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function press(digit: string) {
    setError(null)
    const next = (typed + digit).slice(0, 4)
    setTyped(next)
    if (next.length < 4) return
    window.setTimeout(() => {
      setTyped('')
      if (!creating) {
        if (next === pin) onOk()
        else setError('PIN errado. Tente de novo.')
      } else if (first === null) {
        setFirst(next)
      } else if (first === next) {
        updateSettings({ pin: next })
        onOk()
      } else {
        setFirst(null)
        setError('Os PINs não batem. Comece de novo.')
      }
    }, 150)
  }

  const title = creating ? (first === null ? 'Crie um PIN de 4 números' : 'Digite o PIN de novo') : 'Área da professora'

  return (
    <div className="page pin-page">
      <header className="page-top">
        <BackButton onClick={onExit} />
      </header>
      <div className="pin-box">
        <span className="pin-icon" aria-hidden="true">
          🍎
        </span>
        <h1>{title}</h1>
        <p className="muted">
          {creating ? 'O PIN protege o painel da professora neste aparelho.' : 'Digite o PIN para entrar.'}
        </p>
        <div className="pin-dots" aria-label={`${typed.length} de 4 números`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${i < typed.length ? 'pin-dot-on' : ''}`} />
          ))}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) =>
            k === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                className="key"
                onClick={() => (k === '⌫' ? setTyped(typed.slice(0, -1)) : press(k))}
                aria-label={k === '⌫' ? 'Apagar' : k}
              >
                {k}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

// --- Painel ---------------------------------------------------------------------------

type Tab = 'turma' | 'sons' | 'minhavoz' | 'vozes' | 'config'

function Panel({ onExit }: { onExit: () => void }) {
  const db = useDb()
  const [tab, setTab] = useState<Tab>('turma')
  const [selected, setSelected] = useState<string | null>(null)
  const [cloud, setCloud] = useState<Attempt[] | null>(null)

  // Com a professora logada e a turma ligada, junta as respostas dos outros aparelhos
  useEffect(() => {
    const code = db.settings.classCode
    if (!cloudEnabled || !code) return
    let alive = true
    teacherSession()
      .then((session) => (session ? classAttempts(code) : null))
      .then((list) => alive && list && setCloud(list))
      .catch(() => {
        // Sem internet: o painel mostra o que está no aparelho
      })
    return () => {
      alive = false
    }
  }, [db.settings.classCode])

  const attempts = useMemo(() => {
    if (!cloud) return db.attempts
    const ids = new Set(cloud.map((a) => a.id))
    return [...cloud, ...db.attempts.filter((a) => !ids.has(a.id))].sort((a, b) => a.at.localeCompare(b.at))
  }, [cloud, db.attempts])

  const students = db.students.filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const student = selected ? db.students.find((s) => s.id === selected) : undefined

  return (
    <div className="page teacher">
      <header className="page-top">
        <BackButton onClick={student ? () => setSelected(null) : onExit} label={student ? 'Voltar à turma' : 'Sair'} />
        <h1>{student ? student.name : 'Painel da professora'}</h1>
        {!student && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
            <LogOut size={18} /> Sair
          </button>
        )}
      </header>

      {student ? (
        <StudentDetail student={student} attempts={attempts.filter((a) => a.studentId === student.id)} />
      ) : (
        <>
          <nav className="tabs" role="tablist">
            <TabButton on={tab === 'turma'} onClick={() => setTab('turma')} icon={<Users size={18} />} label="Turma" />
            <TabButton on={tab === 'sons'} onClick={() => setTab('sons')} icon={<Grid3x3 size={18} />} label="Sons" />
            <TabButton on={tab === 'minhavoz'} onClick={() => setTab('minhavoz')} icon={<Mic size={18} />} label="Minha voz" />
            <TabButton on={tab === 'vozes'} onClick={() => setTab('vozes')} icon={<AudioLines size={18} />} label="Reconhecer" />
            <TabButton on={tab === 'config'} onClick={() => setTab('config')} icon={<Settings size={18} />} label="Ajustes" />
          </nav>
          {tab === 'turma' && <ClassOverview students={students} attempts={attempts} onOpen={setSelected} />}
          {tab === 'sons' && <SoundHeatmap students={students} attempts={attempts} onOpen={setSelected} />}
          {tab === 'minhavoz' && <TeacherRecordings />}
          {tab === 'vozes' && <TeacherVoices />}
          {tab === 'config' && <SettingsTab />}
        </>
      )}
    </div>
  )
}

function TabButton({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" role="tab" aria-selected={on} className={`tab ${on ? 'tab-on' : ''}`} onClick={onClick}>
      {icon} {label}
    </button>
  )
}

function pct(score: Score | undefined): string {
  const r = rate(score)
  return r === null ? '—' : `${Math.round(r * 100)}%`
}

/** Faixa de desempenho: sempre mostrada com o número, nunca só pela cor. */
function band(score: Score | undefined): 'good' | 'warn' | 'bad' | 'none' {
  const r = rate(score)
  if (r === null || !score || score.total < 3) return 'none'
  if (r >= 0.8) return 'good'
  if (r >= 0.6) return 'warn'
  return 'bad'
}

function since(iso: string | undefined): string {
  if (!iso) return 'nunca jogou'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

// --- Turma -----------------------------------------------------------------------------

function ClassOverview({
  students,
  attempts,
  onOpen,
}: {
  students: Student[]
  attempts: Attempt[]
  onOpen: (id: string) => void
}) {
  const db = useDb()
  const [adding, setAdding] = useState(students.length === 0)
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString())
  const weekRounds = db.rounds.filter((r) => r.at >= weekAgo)
  const activeIds = new Set(students.map((s) => s.id))
  const classAttempts = attempts.filter((a) => activeIds.has(a.studentId))
  const pairs = pairConfusions(classAttempts).sort((a, b) => b.count - a.count)

  return (
    <>
      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-value">{students.length}</span>
          <span className="stat-label">crianças</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{weekRounds.length}</span>
          <span className="stat-label">fases jogadas em 7 dias</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{pct(overall(classAttempts))}</span>
          <span className="stat-label">de acerto da turma</span>
        </div>
      </div>

      {pairs.length > 0 && (
        <div className="card">
          <h2 className="card-title">Trocas mais comuns na turma</h2>
          <ul className="pair-list">
            {pairs.map(({ pair, count }) => (
              <li key={pair.join()}>
                <span className="pair-badge">
                  {pair[0]} ⇄ {pair[1]}
                </span>
                <span>
                  {count} {count === 1 ? 'troca' : 'trocas'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Crianças</h2>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(!adding)}>
            <Plus size={18} /> Adicionar
          </button>
        </div>
        {adding && <AddStudent onDone={() => setAdding(false)} />}
        {students.length === 0 && !adding && <p className="muted">Nenhuma criança cadastrada ainda.</p>}
        <ul className="student-list">
          {students.map((s) => {
            const mine = attempts.filter((a) => a.studentId === s.id)
            const stars = totalStars(bestStars(db.rounds, s.id))
            const last = db.rounds.filter((r) => r.studentId === s.id).at(-1)?.at
            const alerts = pairConfusions(mine).filter((c) => c.count >= 3)
            const score = overall(mine)
            return (
              <li key={s.id}>
                <button type="button" className="student-row" onClick={() => onOpen(s.id)}>
                  <span className="student-avatar" aria-hidden="true">
                    {avatarEmoji(s.avatar)}
                  </span>
                  <span className="student-main">
                    <span className="student-name">{s.name}</span>
                    <span className="small muted">
                      ⭐ {stars} · {since(last)}
                    </span>
                  </span>
                  {alerts.length > 0 && (
                    <span className="alert-badge" title="Trocas frequentes">
                      <AlertTriangle size={14} /> {alerts.map((c) => c.pair.join('/')).join(' · ')}
                    </span>
                  )}
                  <span className={`score-pill band-${band(score)}`}>{pct(score)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

function AddStudent({ onDone }: { onDone: () => void }) {
  const db = useDb()
  const [name, setName] = useState('')
  // Sugere um bichinho diferente para cada criança nova
  const [avatar, setAvatar] = useState(() => FREE_AVATARS[db.students.length % FREE_AVATARS.length].id)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    addStudent(name, avatar)
    setName('')
    setAvatar(FREE_AVATARS[(db.students.length + 1) % FREE_AVATARS.length].id)
    void syncNow().catch(() => {})
  }

  return (
    <form className="add-student" onSubmit={submit}>
      <label className="field">
        <span className="field-label">Nome (como a criança é chamada)</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={30} />
      </label>
      <div className="avatar-grid avatar-grid-sm">
        {FREE_AVATARS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`avatar-option ${avatar === a.id ? 'avatar-selected' : ''}`}
            onClick={() => setAvatar(a.id)}
            aria-label={a.name}
          >
            {a.emoji}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Salvar
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Fechar
        </button>
      </div>
    </form>
  )
}

// --- Mapa de calor: crianças × sons ---------------------------------------------------------

function SoundHeatmap({
  students,
  attempts,
  onOpen,
}: {
  students: Student[]
  attempts: Attempt[]
  onOpen: (id: string) => void
}) {
  const rows = students.map((s) => ({ s, scores: accuracyBySound(attempts.filter((a) => a.studentId === s.id)) }))
  const classScores = accuracyBySound(attempts.filter((a) => students.some((s) => s.id === a.studentId)))

  return (
    <div className="card">
      <h2 className="card-title">Acerto por som</h2>
      <p className="small muted">
        Verde: 80% ou mais · Amarelo: 60 a 79% · Vermelho: abaixo de 60% · Cinza: menos de 3 respostas. Toque numa
        criança para ver os detalhes.
      </p>
      <div className="heatmap-wrap">
        <table className="heatmap">
          <thead>
            <tr>
              <th scope="col">Criança</th>
              {SOUNDS.map((s) => (
                <th key={s.key} scope="col">
                  {s.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, scores }) => (
              <tr key={s.id}>
                <th scope="row">
                  <button type="button" className="link-btn" onClick={() => onOpen(s.id)}>
                    {avatarEmoji(s.avatar)} {s.name}
                  </button>
                </th>
                {SOUNDS.map((sound) => {
                  const score = scores.get(sound.key)
                  return (
                    <td
                      key={sound.key}
                      className={`heat band-${band(score)}`}
                      title={score ? `${s.name} · ${sound.key}: ${score.right} de ${score.total} certas` : 'Sem respostas'}
                    >
                      {score ? pct(score) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="heatmap-total">
              <th scope="row">Turma</th>
              {SOUNDS.map((sound) => {
                const score = classScores.get(sound.key)
                return (
                  <td key={sound.key} className={`heat band-${band(score)}`} title={score ? `${score.right} de ${score.total}` : ''}>
                    {score ? pct(score) : ''}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Detalhe de uma criança --------------------------------------------------------------

const PAIR_TIPS: Record<string, string> = {
  'P/B': 'P e B saem dos lábios; no B a garganta vibra. Peça para a criança pôr a mão no pescoço e sentir.',
  'T/D': 'T e D: a língua toca atrás dos dentes; no D a garganta vibra.',
  'F/V': 'F e V: dentes de cima no lábio de baixo; no V a garganta vibra ("vvvv" faz cócegas).',
  'M/N': 'M fecha os lábios; no N os lábios ficam abertos e a língua sobe.',
  'C/G': 'C (CA) e G (GA) saem do fundo da boca; no G a garganta vibra.',
  'S/Z': 'S e Z: o mesmo "assobio"; no Z a garganta vibra (zumbido de abelha).',
  'L/R': 'L: a língua encosta no céu da boca. R de RATO: o som vem da garganta.',
}

function tipFor(a: string, b: string): string | undefined {
  return PAIR_TIPS[`${a}/${b}`] ?? PAIR_TIPS[`${b}/${a}`]
}

function StudentDetail({ student, attempts }: { student: Student; attempts: Attempt[] }) {
  const db = useDb()
  const best = bestStars(db.rounds, student.id)
  const stars = totalStars(best)
  const bySound = accuracyBySound(attempts)
  const byGame = accuracyByGame(attempts)
  const swaps = confusions(attempts)
  const evolution = weeklyEvolution(attempts)
  const rounds = db.rounds.filter((r) => r.studentId === student.id).slice(-8).reverse()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(student.name)

  return (
    <>
      <div className="detail-head card">
        <span className="detail-avatar" aria-hidden="true">
          {avatarEmoji(student.avatar)}
        </span>
        <div className="detail-numbers">
          <span>
            ⭐ <strong>{stars}</strong> de {MAX_STARS} estrelas
          </span>
          <span>
            <strong>{pct(overall(attempts))}</strong> de acerto · {attempts.length} respostas
          </span>
          <span>
            Fases com estrela: <strong>{best.size}</strong> de {ISLANDS.length * 5}
          </span>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Acerto por som</h2>
        <div className="sound-grid">
          {SOUNDS.map((s) => {
            const score = bySound.get(s.key)
            return (
              <div key={s.key} className={`sound-tile band-${band(score)}`} title={score ? `${score.right} de ${score.total} certas` : 'Sem respostas'}>
                <span className="sound-key">{s.key}</span>
                <span className="sound-pct">{pct(score)}</span>
                <span className="sound-n">{score ? `${score.total} resp.` : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Trocas de som</h2>
        {swaps.length === 0 ? (
          <p className="muted">Nenhuma troca registrada. 🎉</p>
        ) : (
          <ul className="swap-list">
            {swaps.slice(0, 8).map((c) => {
              const tip = c.classic ? tipFor(c.target, c.answer) : undefined
              return (
                <li key={`${c.target}${c.answer}`} className={c.classic ? 'swap-classic' : ''}>
                  <div className="swap-line">
                    <span className="pair-badge">
                      {c.target} → {c.answer}
                    </span>
                    <span>
                      Escolheu <strong>{c.answer}</strong> quando o som era <strong>{c.target}</strong> · {c.count}×
                    </span>
                    {c.classic && <span className="classic-tag">troca comum</span>}
                  </div>
                  {tip && <p className="small muted swap-tip">💡 {tip}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Evolução semanal do acerto</h2>
        <EvolutionChart data={evolution} />
      </div>

      <div className="card">
        <h2 className="card-title">Por jogo</h2>
        <div className="game-bars">
          {(['caca', 'falta', 'monta', 'rima'] as GameKind[]).map((g) => {
            const score = byGame.get(g)
            const r = rate(score)
            return (
              <div key={g} className="game-bar">
                <span className="game-bar-label">
                  {GAME_INFO[g].emoji} {GAME_INFO[g].name}
                </span>
                <span className="game-bar-track">
                  <span className="game-bar-fill" style={{ width: `${(r ?? 0) * 100}%` }} />
                </span>
                <span className="game-bar-value">{pct(score)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Últimas fases</h2>
        {rounds.length === 0 ? (
          <p className="muted">Ainda não jogou.</p>
        ) : (
          <ul className="round-list">
            {rounds.map((r) => {
              const level = levelById(r.levelId)
              const island = ISLANDS.find((i) => i.levels.some((l) => l.id === r.levelId))
              return (
                <li key={r.id}>
                  <span>
                    {island?.emoji} {level ? GAME_INFO[level.game].name : r.levelId}
                  </span>
                  <StarRow count={r.stars} size={14} />
                  <span className="small muted">
                    {r.correct}/{r.total} · {new Date(r.at).toLocaleDateString('pt-BR')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Cadastro</h2>
        {editing ? (
          <form
            className="add-student"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) updateStudent(student.id, { name: name.trim() })
              setEditing(false)
            }}
          >
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
            <div className="avatar-grid avatar-grid-sm">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`avatar-option ${student.avatar === a.id ? 'avatar-selected' : ''}`}
                  onClick={() => updateStudent(student.id, { avatar: a.id })}
                  aria-label={a.name}
                >
                  {a.emoji}
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary">
                Salvar
              </button>
            </div>
          </form>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn-soft" onClick={() => setEditing(true)}>
              Editar nome e bichinho
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (confirm(`Tirar ${student.name} da turma? O histórico fica guardado.`)) {
                  updateStudent(student.id, { archived: true })
                }
              }}
            >
              Tirar da turma
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/** Linha única do acerto semanal (0–100%), com o valor em cada ponto ao passar o dedo/mouse. */
function EvolutionChart({ data }: { data: { week: string; score: Score }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.length === 0) return <p className="muted">Ainda sem respostas.</p>
  const points = data.slice(-12)
  const W = 560
  const H = 200
  const pad = { l: 40, r: 16, t: 16, b: 30 }
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1))
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b)
  const values = points.map((p) => rate(p.score) ?? 0)
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const label = (week: string) => {
    const [, m, d] = week.split('-')
    return `${d}/${m}`
  }
  const shown = hover ?? points.length - 1

  return (
    <div className="evolution">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Acerto por semana" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={pad.l - 8} y={y(v) + 4} className="axis-text" textAnchor="end">
              {v * 100}%
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.week} x={x(i)} y={H - 8} className="axis-text" textAnchor="middle">
            {points.length <= 8 || i % 2 === 0 ? label(p.week) : ''}
          </text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="crosshair" />}
        <path d={path} className="evo-line" />
        {values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={i === shown ? 6 : 4} className="evo-dot" />
            {/* Área de toque maior que o ponto */}
            <rect
              x={x(i) - 20}
              y={pad.t}
              width={40}
              height={H - pad.t - pad.b}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
      <p className="evo-readout">
        Semana de {label(points[shown].week)}: <strong>{pct(points[shown].score)}</strong> ({points[shown].score.right} de{' '}
        {points[shown].score.total} certas)
      </p>
    </div>
  )
}

// --- Ajustes e nuvem -------------------------------------------------------------------

function SettingsTab() {
  const db = useDb()
  const [sounds, setSounds] = useState(() => readPref(SOUNDS_PREF, true))
  const [voice, setVoice] = useState(() => readPref(VOICE_PREF, true))

  function exportCsv() {
    const names = new Map(db.students.map((s) => [s.id, s.name]))
    const header = 'crianca,data,jogo,som_esperado,resposta,acertou'
    const lines = db.attempts.map((a) =>
      [names.get(a.studentId) ?? '', a.at, a.game, a.target, a.answer, a.correct ? 'sim' : 'nao']
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(','),
    )
    const blob = new Blob(['﻿' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `fonolandia-respostas-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <>
      <div className="card">
        <h2 className="card-title">Jogo</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={db.settings.unlockAll}
            onChange={(e) => updateSettings({ unlockAll: e.target.checked })}
          />
          Liberar todas as fases (sem seguir a ordem do mapa)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={voice}
            onChange={(e) => {
              setVoice(e.target.checked)
              writePref(VOICE_PREF, e.target.checked)
            }}
          />
          Voz do Tuca (instruções faladas)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={sounds}
            onChange={(e) => {
              setSounds(e.target.checked)
              writePref(SOUNDS_PREF, e.target.checked)
            }}
          />
          Sons de acerto e erro
        </label>
      </div>

      <div className="card">
        <h2 className="card-title">Dados</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-soft" onClick={exportCsv} disabled={db.attempts.length === 0}>
            <Download size={18} /> Exportar respostas (CSV)
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Trocar o PIN? Você vai criar um novo agora.')) updateSettings({ pin: null })
            }}
          >
            Trocar o PIN
          </button>
        </div>
      </div>

      <CloudCard />
    </>
  )
}

function CloudCard() {
  const db = useDb()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [logged, setLogged] = useState<boolean | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [classes, setClasses] = useState<CloudClass[]>([])
  const [newClass, setNewClass] = useState('')

  useEffect(() => {
    if (!cloudEnabled) return
    teacherSession()
      .then((s) => setLogged(Boolean(s)))
      .catch(() => setLogged(false))
  }, [])

  useEffect(() => {
    if (logged) myClasses().then(setClasses).catch(() => {})
  }, [logged])

  async function run(task: () => Promise<string | void>) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await task()
      if (result) setMessage(result)
    } catch (e) {
      setMessage(`Erro: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <div className="card">
        <h2 className="card-title">
          <Cloud size={20} /> Nuvem
        </h2>
        <p className="muted">
          Os dados estão guardados só neste aparelho. Para juntar vários tablets numa turma e ver o painel de qualquer
          lugar, configure o Supabase (veja o README).
        </p>
      </div>
    )
  }

  const pending = db.outbox.rounds.length + db.outbox.attempts.length + db.outbox.students.length

  return (
    <div className="card">
      <h2 className="card-title">
        <Cloud size={20} /> Nuvem
      </h2>

      {db.settings.classCode ? (
        <>
          <p>
            Este aparelho está na turma <strong>{db.settings.className}</strong> (código{' '}
            <code className="class-code">{db.settings.classCode}</code>).
          </p>
          <p className="small muted">
            {db.settings.lastSync
              ? `Última sincronização: ${new Date(db.settings.lastSync).toLocaleString('pt-BR')}`
              : 'Ainda não sincronizou.'}
            {pending > 0 && ` · ${pending} itens esperando envio`}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-soft" disabled={busy} onClick={() => run(async () => { await syncNow(); return 'Sincronizado!' })}>
              <RefreshCw size={18} className={busy ? 'spin' : ''} /> Sincronizar agora
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => confirm('Desligar este aparelho da turma? Os dados ficam no aparelho.') && unlinkClass()}
            >
              Desligar da turma
            </button>
          </div>
        </>
      ) : (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => `Aparelho ligado à turma ${await linkClass(code)}!`)
          }}
        >
          <label className="field">
            <span className="field-label">Código da turma (para ligar este aparelho)</span>
            <input className="input code-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length < 4}>
            Ligar
          </button>
        </form>
      )}

      <hr className="divider" />

      {logged ? (
        <>
          <h3>Minhas turmas</h3>
          <ul className="class-list">
            {classes.map((c) => (
              <li key={c.id}>
                <span>{c.name}</span>
                <code className="class-code">{c.code}</code>
                {db.settings.classCode !== c.code && (
                  <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => run(async () => `Aparelho ligado à turma ${await linkClass(c.code)}!`)}>
                    Usar aqui
                  </button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                const created = await createClass(newClass.trim())
                setClasses([...classes, created])
                setNewClass('')
                return `Turma criada! Código: ${created.code}`
              })
            }}
          >
            <input className="input" placeholder="Nome da nova turma (ex.: 1º ano B)" value={newClass} onChange={(e) => setNewClass(e.target.value)} />
            <button type="submit" className="btn btn-primary" disabled={busy || !newClass.trim()}>
              Criar
            </button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(async () => { await teacherSignOut(); setLogged(false) })}>
            Sair da conta
          </button>
        </>
      ) : (
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await teacherSignIn(email, password, false)
              setLogged(true)
            })
          }}
        >
          <h3>Conta da professora</h3>
          <p className="small muted">Para criar turmas e ver as respostas de todos os aparelhos.</p>
          <input className="input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="input" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={busy || !email || password.length < 6}>
              Entrar
            </button>
            <button
              type="button"
              className="btn btn-soft"
              disabled={busy || !email || password.length < 6}
              onClick={() =>
                run(async () => {
                  await teacherSignIn(email, password, true)
                  const session = await teacherSession()
                  setLogged(Boolean(session))
                  return session ? 'Conta criada!' : 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.'
                })
              }
            >
              Criar conta
            </button>
          </div>
        </form>
      )}

      {message && <p className="cloud-message">{message}</p>}
    </div>
  )
}

