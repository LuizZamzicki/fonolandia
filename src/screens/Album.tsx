import { useMemo } from 'react'
import { ISLANDS } from '../data/sounds'
import { bestStars, islandDone, totalStars } from '../game/progress'
import { album, AVATARS, STICKERS } from '../game/rewards'
import { speak } from '../lib/speech'
import { updateStudent, useDb } from '../store/db'
import type { Student } from '../store/types'
import { BackButton } from '../ui/kit'

export function Album({ student, onBack }: { student: Student; onBack: () => void }) {
  const db = useDb()
  const counts = useMemo(() => album(db.rounds, student.id), [db.rounds, student.id])
  const best = useMemo(() => bestStars(db.rounds, student.id), [db.rounds, student.id])
  const have = STICKERS.filter((s) => counts.has(s.id)).length

  return (
    <div className="page">
      <header className="page-top">
        <BackButton onClick={onBack} />
        <h1>Meu álbum</h1>
        <span className="chip">
          {have}/{STICKERS.length}
        </span>
      </header>

      <h2 className="section-title">Troféus das ilhas</h2>
      <div className="trophy-row">
        {ISLANDS.map((island, i) => (
          <button
            key={island.id}
            type="button"
            className={`trophy ${islandDone(i, best) ? 'trophy-on' : ''}`}
            onClick={() => speak(island.name)}
            aria-label={island.name}
          >
            <span aria-hidden="true">{islandDone(i, best) ? island.emoji : '❔'}</span>
          </button>
        ))}
      </div>

      <h2 className="section-title">Figurinhas</h2>
      <div className="album-grid">
        {STICKERS.map((s) => {
          const count = counts.get(s.id) ?? 0
          return (
            <button
              key={s.id}
              type="button"
              className={`album-slot ${count > 0 ? 'album-have' : ''} ${s.rare ? 'album-rare' : ''}`}
              onClick={() => count > 0 && speak(s.name)}
              aria-label={count > 0 ? s.name : 'Figurinha ainda não encontrada'}
            >
              <span className="album-emoji" aria-hidden="true">
                {count > 0 ? s.emoji : '?'}
              </span>
              {count > 0 && <span className="album-name">{s.name}</span>}
              {count > 1 && <span className="album-count">×{count}</span>}
            </button>
          )
        })}
      </div>
      <p className="muted center small">Ganhe 2 ou 3 estrelas numa fase para abrir um baú. Com 3, pode sair figurinha rara ✨</p>

      <AvatarChooser student={student} stars={totalStars(best)} />
    </div>
  )
}

export function AvatarChooser({ student, stars }: { student: Student; stars: number }) {
  return (
    <>
      <h2 className="section-title">Meu bichinho</h2>
      <div className="avatar-grid">
        {AVATARS.map((a) => {
          const unlocked = stars >= a.stars
          return (
            <button
              key={a.id}
              type="button"
              className={`avatar-option ${student.avatar === a.id ? 'avatar-selected' : ''} ${unlocked ? '' : 'avatar-locked'}`}
              onClick={() => {
                if (unlocked) {
                  updateStudent(student.id, { avatar: a.id })
                  speak(a.name)
                } else speak(`Junte ${a.stars} estrelas para ganhar o ${a.name}!`)
              }}
              aria-label={unlocked ? a.name : `${a.name}: precisa de ${a.stars} estrelas`}
            >
              <span aria-hidden="true">{a.emoji}</span>
              {unlocked && <span className="avatar-name">{a.name}</span>}
              {!unlocked && <span className="avatar-price">⭐ {a.stars}</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}
