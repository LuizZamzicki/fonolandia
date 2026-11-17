import { GraduationCap } from 'lucide-react'
import { useEffect } from 'react'
import { avatarEmoji } from '../game/rewards'
import { PHRASES } from '../data/phrases'
import { speak } from '../lib/speech'
import { useDb } from '../store/db'
import { Mascot } from '../ui/kit'

interface Props {
  onPick: (studentId: string) => void
  onTeacher: () => void
}

/** Tela inicial num aparelho da turma: cada criança toca na sua figura. */
export function Who({ onPick, onTeacher }: Props) {
  const db = useDb()
  const students = db.students.filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  useEffect(() => {
    const timer = window.setTimeout(() => speak(students.length > 0 ? PHRASES.helloWho : PHRASES.helloTuca), 400)
    return () => window.clearTimeout(timer)
  }, [students.length])

  return (
    <div className="who">
      <header className="who-head">
        <div className="logo" aria-label="Fonolândia">
          <span className="logo-mark" aria-hidden="true">
            🏝️
          </span>
          <span className="logo-text">Fonolândia</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onTeacher}>
          <GraduationCap size={18} /> Professora
        </button>
      </header>

      {students.length > 0 ? (
        <>
          <Mascot text="Quem vai jogar?" say={PHRASES.who} />
          <div className="who-grid">
            {students.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className="who-card rise"
                style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
                onClick={() => {
                  speak([`${PHRASES.hi},`, `${s.name}!`])
                  onPick(s.id)
                }}
              >
                <span className="who-avatar" aria-hidden="true">
                  {avatarEmoji(s.avatar)}
                </span>
                <span className="who-name">{s.name}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="who-empty rise">
          <Mascot
            text={
              <>
                Olá! Eu sou o <strong>Tuca</strong>. Para começar, a professora cadastra a turma.
              </>
            }
            say={PHRASES.firstTime}
          />
          <button type="button" className="btn btn-primary btn-lg" onClick={onTeacher}>
            <GraduationCap size={22} /> Cadastrar a turma
          </button>
        </div>
      )}
    </div>
  )
}
