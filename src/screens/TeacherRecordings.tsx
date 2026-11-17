// Área da professora → Minha voz: gravar as falas do jogo com a voz da professora. O que estiver
// gravado toca no lugar da voz do aparelho; o resto continua com a voz do aparelho.

import { Mic, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { micSupported, startRecording, type Recorder } from '../audio/recorder'
import { clipGroups, type ClipItem } from '../data/phrases'
import { forgetClip, playRecording, stopSpeaking } from '../lib/speech'
import { useDb } from '../store/db'
import { deleteRecording, loadRecordings, phraseKey, saveRecording, soundKey, useRecordings } from '../store/recordings'

/** Gravação mais longa que a professora pode fazer de uma vez (s). */
const MAX_SECONDS = 10

type Status =
  | { kind: 'idle' }
  | { kind: 'recording'; key: string }
  | { kind: 'saving'; key: string }
  | { kind: 'message'; text: string; warn?: boolean }

export function TeacherRecordings() {
  const db = useDb()
  const recorded = useRecordings()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [level, setLevel] = useState(0)
  const [missingOnly, setMissingOnly] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  /** Próxima fala sugerida depois de gravar (fica destacada). */
  const [next, setNext] = useState<string | null>(null)
  const recorder = useRef<Recorder | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const namesKey = db.students
    .filter((s) => !s.archived)
    .map((s) => s.name)
    .join('\n')
  const groups = useMemo(() => clipGroups(phraseKey, soundKey, namesKey ? namesKey.split('\n') : []), [namesKey])
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const done = groups.reduce((n, g) => n + g.items.filter((i) => recorded.has(i.key)).length, 0)

  useEffect(() => {
    void loadRecordings()
    return () => {
      recorder.current?.cancel()
      window.clearTimeout(timer.current)
      stopSpeaking()
    }
  }, [])

  async function start(item: ClipItem) {
    stopSpeaking()
    setPlaying(null)
    recorder.current?.cancel()
    setStatus({ kind: 'recording', key: item.key })
    try {
      recorder.current = await startRecording(setLevel)
      timer.current = window.setTimeout(() => void stop(item), MAX_SECONDS * 1000)
    } catch {
      recorder.current = null
      setStatus({ kind: 'message', warn: true, text: 'Não consegui abrir o microfone. Confira a permissão do navegador.' })
    }
  }

  async function stop(item: ClipItem) {
    window.clearTimeout(timer.current)
    const rec = recorder.current
    recorder.current = null
    setLevel(0)
    if (!rec) return
    setStatus({ kind: 'saving', key: item.key })
    const audio = await rec.stop()
    if (!audio) {
      setStatus({ kind: 'message', warn: true, text: 'Não ouvi nada. Fale um pouco mais perto do aparelho e tente de novo.' })
      return
    }
    try {
      await saveRecording(item.key, audio)
    } catch {
      setStatus({ kind: 'message', warn: true, text: 'Não consegui guardar a gravação (o aparelho pode estar sem espaço).' })
      return
    }
    forgetClip(item.key)
    setStatus({ kind: 'idle' })
    listen(item.key)
    // Sugere a próxima que ainda falta, no mesmo grupo
    const group = groups.find((g) => g.items.some((i) => i.key === item.key))
    const after = group?.items.slice(group.items.findIndex((i) => i.key === item.key) + 1)
    const upcoming = after?.find((i) => !recorded.has(i.key) && i.key !== item.key)
    setNext(upcoming?.key ?? null)
    if (upcoming) {
      window.setTimeout(() => document.getElementById(rowId(upcoming.key))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    }
  }

  function listen(key: string) {
    setPlaying(key)
    playRecording(key, () => setPlaying((p) => (p === key ? null : p)))
  }

  async function remove(item: ClipItem) {
    if (!confirm(`Apagar a gravação de “${item.label}”?`)) return
    stopSpeaking()
    forgetClip(item.key)
    await deleteRecording(item.key)
  }

  if (!micSupported()) {
    return (
      <div className="card">
        <h2 className="card-title">Minha voz</h2>
        <p className="muted">
          Este navegador não deixa usar o microfone aqui{window.isSecureContext ? '' : ' (o endereço precisa ser https)'}.
          Abra a Fonolândia pelo endereço publicado (https) no Chrome, Edge ou Safari.
        </p>
      </div>
    )
  }

  const busy = status.kind === 'recording' || status.kind === 'saving'

  return (
    <>
      <div className="card">
        <h2 className="card-title">Gravar a minha voz</h2>
        <p className="small muted">
          As crianças ouvem a <strong>sua voz</strong> no lugar da voz do aparelho. Toque em <strong>Gravar</strong>, fale
          e toque em <strong>Parar</strong>. O silêncio do começo e do fim é cortado sozinho. O que você não gravar
          continua com a voz do aparelho, então dá para gravar aos poucos. Comece pelos sons das letras.
        </p>
        <div className="rec-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <p className="small">
          <strong>{done}</strong> de {total} falas gravadas
        </p>
        <label className="rec-filter small">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Mostrar só as
          que faltam
        </label>
        <p className="small muted">As gravações ficam guardadas neste aparelho. Grave no aparelho que as crianças usam.</p>
        {status.kind === 'message' && <p className={`cloud-message ${status.warn ? 'warn-text' : ''}`}>{status.text}</p>}
      </div>

      {groups.map((group, gi) => {
        const groupDone = group.items.filter((i) => recorded.has(i.key)).length
        const items = missingOnly ? group.items.filter((i) => !recorded.has(i.key) || i.key === next) : group.items
        return (
          <details key={group.id} className="card rec-group" open={gi === 0}>
            <summary>
              <span className="card-title">{group.title}</span>
              <span className={`rec-count ${groupDone === group.items.length ? 'rec-count-done' : ''}`}>
                {groupDone}/{group.items.length}
              </span>
            </summary>
            <p className="small muted">{group.description}</p>
            {items.length === 0 && <p className="small">Tudo gravado aqui! ✓</p>}
            <ul className="rec-list">
              {items.map((item) => {
                const has = recorded.has(item.key)
                const recordingThis = status.kind === 'recording' && status.key === item.key
                const savingThis = status.kind === 'saving' && status.key === item.key
                return (
                  <li
                    key={item.key}
                    id={rowId(item.key)}
                    className={`rec-row ${has ? 'rec-row-done' : ''} ${recordingThis ? 'rec-row-live' : ''} ${next === item.key && !busy ? 'rec-row-next' : ''}`}
                  >
                    <span className="rec-dot" aria-hidden="true" />
                    <span className="rec-text">
                      <span className={group.id === 'sons' ? 'rec-letter' : 'rec-label'}>{item.label}</span>
                      {item.hint && <span className="rec-hint">{item.hint}</span>}
                    </span>
                    {recordingThis ? (
                      <>
                        <span className="mic-meter" aria-hidden="true">
                          <span style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />
                        </span>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => void stop(item)}>
                          <Square size={14} /> Parar
                        </button>
                      </>
                    ) : savingThis ? (
                      <span className="small muted">Guardando…</span>
                    ) : (
                      <>
                        {has && (
                          <button
                            type="button"
                            className={`btn btn-ghost btn-sm btn-icon ${playing === item.key ? 'rec-playing' : ''}`}
                            onClick={() => listen(item.key)}
                            aria-label={`Ouvir “${item.label}”`}
                            disabled={busy}
                          >
                            <Play size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn btn-sm ${has ? 'btn-soft' : 'btn-primary'}`}
                          onClick={() => void start(item)}
                          disabled={busy}
                          aria-label={`${has ? 'Gravar de novo' : 'Gravar'} “${item.label}”`}
                        >
                          <Mic size={14} /> {has ? 'Regravar' : 'Gravar'}
                        </button>
                        {has && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => void remove(item)}
                            aria-label={`Apagar “${item.label}”`}
                            disabled={busy}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </details>
        )
      })}
    </>
  )
}

function rowId(key: string): string {
  return `rec-${key.replace(/[^a-z0-9à-ú]+/gi, '-')}`
}
