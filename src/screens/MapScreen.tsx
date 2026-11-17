import { BookOpen, Flame, Lock, LogOut, Mic, Star } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { GAME_INFO, ISLANDS } from '../data/sounds'
import { bestStars, isUnlocked, islandDone, islandUnlocked, nextLevel, streakDays, totalStars } from '../game/progress'
import { avatarEmoji } from '../game/rewards'
import { speak } from '../lib/speech'
import { useDb } from '../store/db'
import type { Student } from '../store/types'
import { StarRow } from '../ui/kit'

interface Props {
  student: Student
  onPlay: (levelId: string) => void
  onAlbum: () => void
  onAvatar: () => void
  onVoice: () => void
  onExit: () => void
}

// Deslocamento horizontal dos círculos, para o caminho fazer curvas
const OFFSETS = [0, 34, 52, 34, 0, -34, -52, -34]

export function MapScreen({ student, onPlay, onAlbum, onAvatar, onVoice, onExit }: Props) {
  const db = useDb()
  const best = useMemo(() => bestStars(db.rounds, student.id), [db.rounds, student.id])
  const stars = totalStars(best)
  const streak = streakDays(db.rounds, student.id)
  const next = nextLevel(best, db.settings.unlockAll)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Leva o mapa até a próxima fase
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [])

  return (
    <div className="map-screen">
      <header className="map-top">
        <button type="button" className="map-avatar" onClick={onAvatar} aria-label="Trocar meu bichinho">
          <span aria-hidden="true">{avatarEmoji(student.avatar)}</span>
        </button>
        <span className="map-name">{student.name}</span>
        <span className="chip chip-star" aria-label={`${stars} estrelas`}>
          <Star size={18} fill="currentColor" /> {stars}
        </span>
        {streak > 0 && (
          <span className="chip chip-flame" aria-label={`${streak} dias seguidos`}>
            <Flame size={18} fill="currentColor" /> {streak}
          </span>
        )}
        <button type="button" className="btn btn-soft btn-icon" onClick={onAlbum} aria-label="Meu álbum de figurinhas">
          <BookOpen size={22} />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onExit} aria-label="Trocar de jogador">
          <LogOut size={22} />
        </button>
      </header>

      <div className="map-path">
        <button type="button" className="voice-entry rise" onClick={onVoice}>
          <span className="voice-entry-icon" aria-hidden="true">
            🎤
          </span>
          <span className="voice-entry-text">
            <strong>Corrida da Voz</strong>
            <span>Fale a letra para passar pela parede!</span>
          </span>
          <Mic size={26} />
        </button>
        {ISLANDS.map((island, islandIndex) => {
          const open = islandUnlocked(islandIndex, best, db.settings.unlockAll)
          const done = islandDone(islandIndex, best)
          return (
            <section
              key={island.id}
              className={`island ${open ? '' : 'island-locked'}`}
              style={{ '--island': island.color } as React.CSSProperties}
            >
              <button
                type="button"
                className="island-head"
                onClick={() => speak(island.name)}
                aria-label={island.name}
              >
                <span className="island-emoji" aria-hidden="true">
                  {island.emoji}
                </span>
                <span className="island-title">
                  <span className="island-name">{island.name}</span>
                  <span className="island-sounds">
                    {island.sounds.map((s) => (
                      <span key={s} className="island-letter">
                        {s}
                      </span>
                    ))}
                  </span>
                </span>
                {done && (
                  <span className="island-trophy" aria-label="Ilha completa">
                    🏆
                  </span>
                )}
                {!open && <Lock size={22} />}
              </button>

              <div className="level-trail">
                {island.levels.map((level, levelIndex) => {
                  const unlocked = isUnlocked(level.id, best, db.settings.unlockAll)
                  const levelStars = best.get(level.id) ?? 0
                  const isNext = level.id === next
                  const info = GAME_INFO[level.game]
                  const offset = OFFSETS[(islandIndex * island.levels.length + levelIndex) % OFFSETS.length]
                  return (
                    <div key={level.id} className="level-slot" style={{ transform: `translateX(${offset}px)` }}>
                      {isNext && (
                        <span className="level-me" aria-hidden="true">
                          {avatarEmoji(student.avatar)}
                        </span>
                      )}
                      <button
                        ref={isNext ? nextRef : undefined}
                        type="button"
                        className={`level-node ${unlocked ? '' : 'level-locked'} ${isNext ? 'level-next' : ''} ${level.game === 'chefao' ? 'level-boss' : ''} ${levelStars > 0 ? 'level-done' : ''}`}
                        style={{ '--game': info.gradient } as React.CSSProperties}
                        onClick={() => {
                          if (unlocked) onPlay(level.id)
                          else speak('Essa fase ainda está trancada. Termine a anterior!')
                        }}
                        aria-label={`${info.name}${unlocked ? '' : ' (trancada)'}, ${levelStars} estrelas`}
                      >
                        <span aria-hidden="true">{unlocked ? info.emoji : '🔒'}</span>
                      </button>
                      <span className="level-name">{info.name}</span>
                      {unlocked && <StarRow count={levelStars} size={16} />}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
        <div className="map-end" aria-hidden="true">
          🌈
        </div>
      </div>
    </div>
  )
}
