// Área da professora → Vozes: gravar cada som para a Corrida da Voz e testar o reconhecimento.

import { Mic, Square, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { features, rank, recognize, type Ranked } from '../audio/features'
import { micSupported, openMic, type Mic as MicHandle } from '../audio/mic'
import { SOUNDS } from '../data/sounds'
import { wordById } from '../data/words'
import { avatarEmoji } from '../game/rewards'
import { useDb } from '../store/db'
import { addVoice, CLASS_OWNER, clearVoices, loadVoices, MAX_PER_SOUND, templatesFor, useVoices } from '../store/voices'

/** Como fazer cada som (o som, não o nome da letra). */
const HOW: Record<string, string> = {
  A: 'á',
  E: 'é',
  I: 'i',
  O: 'ó',
  U: 'u',
  P: 'pâ (curtinho)',
  B: 'bâ (curtinho)',
  T: 'tâ (curtinho)',
  D: 'dâ (curtinho)',
  C: 'câ, como em casa',
  G: 'gâ, como em gato',
  F: 'ffff (segure)',
  V: 'vvvv (segure)',
  M: 'mmmm (boca fechada)',
  N: 'nnnn',
  S: 'ssss (cobrinha)',
  Z: 'zzzz (abelha)',
  L: 'llll',
  R: 'rrrr, como em rato',
}

type Status = { kind: 'idle' } | { kind: 'recording'; sound: string } | { kind: 'testing' } | { kind: 'message'; text: string; warn?: boolean }

export function TeacherVoices() {
  const db = useDb()
  const voices = useVoices()
  const [owner, setOwner] = useState(CLASS_OWNER)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [level, setLevel] = useState(0)
  const [test, setTest] = useState<Ranked[] | null>(null)
  const mic = useRef<MicHandle | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const students = db.students.filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  useEffect(() => {
    void loadVoices()
    return () => {
      mic.current?.stop()
      window.clearTimeout(timer.current)
    }
  }, [])

  function stopMic() {
    mic.current?.stop()
    mic.current = null
    window.clearTimeout(timer.current)
    setLevel(0)
  }

  async function record(sound: string) {
    stopMic()
    setStatus({ kind: 'recording', sound })
    try {
      mic.current = await openMic({
        onLevel: setLevel,
        onSegment: (samples, rate) => {
          const frames = features(samples, rate)
          if (frames.length < 4) return
          stopMic()
          // Confere se a gravação nova não ficou parecida demais com outro som
          const others = templatesFor(voices, owner === CLASS_OWNER ? null : owner)
          const ranked = others.length > 0 ? rank(frames, others) : []
          addVoice(sound, owner, frames)
          const closest = ranked[0]
          if (closest && closest.sound !== sound && ranked.some((r) => r.sound === sound)) {
            setStatus({
              kind: 'message',
              warn: true,
              text: `Gravei o ${sound}, mas ele ficou parecido com o ${closest.sound}. Vale gravar de novo, com o som mais claro.`,
            })
          } else setStatus({ kind: 'message', text: `Som ${sound} gravado! ✓` })
        },
      })
      // Sem som em 6 segundos: desiste
      timer.current = window.setTimeout(() => {
        stopMic()
        setStatus({ kind: 'message', warn: true, text: 'Não ouvi nada. Fale um pouco mais perto do aparelho.' })
      }, 6000)
    } catch {
      setStatus({ kind: 'message', warn: true, text: 'Não consegui abrir o microfone. Confira a permissão do navegador.' })
    }
  }

  async function startTest() {
    stopMic()
    setTest(null)
    setStatus({ kind: 'testing' })
    try {
      mic.current = await openMic({
        onLevel: setLevel,
        onSegment: (samples, rate) => {
          const templates = templatesFor(voices, owner === CLASS_OWNER ? null : owner)
          if (templates.length === 0) return
          const ranked = recognize(samples, rate, templates)
          if (ranked.length > 0) setTest(ranked.slice(0, 3))
        },
      })
    } catch {
      setStatus({ kind: 'message', warn: true, text: 'Não consegui abrir o microfone. Confira a permissão do navegador.' })
    }
  }

  if (!micSupported()) {
    return (
      <div className="card">
        <h2 className="card-title">Vozes</h2>
        <p className="muted">
          Este navegador não deixa usar o microfone aqui{window.isSecureContext ? '' : ' (o endereço precisa ser https)'}.
          Abra a Fonolândia pelo endereço publicado (https) no Chrome, Edge ou Safari.
        </p>
      </div>
    )
  }

  const mine = voices.filter((v) => v.owner === owner)
  const busy = status.kind === 'recording' || status.kind === 'testing'

  return (
    <>
      <div className="card">
        <h2 className="card-title">Ensinar os sons para a Corrida da Voz</h2>
        <p className="small muted">
          Grave o <strong>som</strong> de cada letra (não o nome): “ssss”, “mmmm”, “bâ”. O jogo compara o som da criança
          com estas gravações, no próprio aparelho. Grave em um lugar calmo, a um palmo do aparelho. Duas ou três
          gravações de cada som já ajudam bastante.
        </p>
        <p className="small muted">
          A voz da <strong>turma</strong> vale para todas as crianças. Gravar a voz de uma criança deixa o
          reconhecimento bem melhor para ela: nos testes, reconhecer a própria voz acertou 93%, e a voz de outra pessoa bem menos. Na Corrida da Voz, a própria criança também pode ensinar a voz dela.
        </p>

        <div className="owner-chips" role="radiogroup" aria-label="De quem é a voz">
          <button
            type="button"
            role="radio"
            aria-checked={owner === CLASS_OWNER}
            className={`owner-chip ${owner === CLASS_OWNER ? 'owner-chip-on' : ''}`}
            onClick={() => setOwner(CLASS_OWNER)}
            disabled={busy}
          >
            🍎 Turma (professora)
          </button>
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={owner === s.id}
              className={`owner-chip ${owner === s.id ? 'owner-chip-on' : ''}`}
              onClick={() => setOwner(s.id)}
              disabled={busy}
            >
              {avatarEmoji(s.avatar)} {s.name}
            </button>
          ))}
        </div>

        <div className="voice-grid">
          {SOUNDS.map((s) => {
            const n = mine.filter((v) => v.sound === s.key).length
            const example = wordById(s.example)
            const recordingThis = status.kind === 'recording' && status.sound === s.key
            return (
              <div key={s.key} className={`voice-tile ${n > 0 ? 'voice-tile-done' : ''} ${recordingThis ? 'voice-tile-rec' : ''}`}>
                <div className="voice-tile-head">
                  <span className="voice-letter">{s.key}</span>
                  <span className="voice-example">
                    {example?.emoji} {example?.word}
                  </span>
                </div>
                <span className="voice-how">{HOW[s.key]}</span>
                <span className="voice-dots" aria-label={`${n} de ${MAX_PER_SOUND} gravações`}>
                  {Array.from({ length: MAX_PER_SOUND }, (_, i) => (
                    <span key={i} className={i < n ? 'on' : ''} />
                  ))}
                </span>
                <div className="voice-actions">
                  {recordingThis ? (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => { stopMic(); setStatus({ kind: 'idle' }) }}>
                      <Square size={14} /> Parar
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void record(s.key)} disabled={busy}>
                      <Mic size={14} /> Gravar
                    </button>
                  )}
                  {n > 0 && !busy && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      onClick={() => confirm(`Apagar as gravações do ${s.key}?`) && clearVoices(s.key, owner)}
                      aria-label={`Apagar as gravações do ${s.key}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {(status.kind === 'recording' || status.kind === 'testing') && (
          <div className="rec-banner">
            <span className="mic-meter mic-meter-lg" aria-hidden="true">
              <span style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />
            </span>
            {status.kind === 'recording' ? (
              <span>
                Faça agora o som do <strong>{status.sound}</strong>: {HOW[status.sound]}
              </span>
            ) : (
              <span>Faça qualquer som para testar…</span>
            )}
          </div>
        )}
        {status.kind === 'message' && <p className={`cloud-message ${status.warn ? 'warn-text' : ''}`}>{status.text}</p>}
      </div>

      <div className="card">
        <h2 className="card-title">Testar o reconhecimento</h2>
        <p className="small muted">
          Faça um som e veja qual o jogo entendeu. Se ele confundir dois sons (P e B, por exemplo), grave mais vezes
          esses dois.
        </p>
        {status.kind === 'testing' ? (
          <button type="button" className="btn btn-danger" onClick={() => { stopMic(); setStatus({ kind: 'idle' }) }}>
            <Square size={18} /> Parar o teste
          </button>
        ) : (
          <button type="button" className="btn btn-soft" onClick={() => void startTest()} disabled={busy || templatesFor(voices, owner === CLASS_OWNER ? null : owner).length === 0}>
            <Mic size={18} /> Testar
          </button>
        )}
        {test && (
          <div className="test-result pop" key={test.map((t) => t.distance).join()}>
            <span className="test-letter">{test[0].sound}</span>
            <span className="small muted">
              Depois: {test.slice(1).map((t) => t.sound).join(', ')}
            </span>
          </div>
        )}
      </div>
    </>
  )
}
