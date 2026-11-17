import { ArrowRight, Map as MapIcon, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { celebrate } from '../lib/celebrate'
import { playSound } from '../lib/sounds'
import { speak } from '../lib/speech'
import { stickerForRound } from '../game/rewards'
import type { Round } from '../store/types'
import { Mascot, StarRow } from '../ui/kit'

interface Props {
  round: Round
  /** Primeira vez que a fase ganhou estrela (abre a próxima). */
  firstClear: boolean
  hasNext: boolean
  onAgain: () => void
  onNext: () => void
  onMap: () => void
}

const MESSAGES: Record<number, string> = {
  1: 'Você conseguiu! Jogue de novo para ganhar mais estrelas.',
  2: 'Muito bem! Falta pouco para três estrelas!',
  3: 'Incrível! Três estrelas!',
}

export function Result({ round, firstClear, hasNext, onAgain, onNext, onMap }: Props) {
  const sticker = stickerForRound(round)
  const [chest, setChest] = useState<'closed' | 'open'>('closed')
  const message = MESSAGES[round.stars]

  useEffect(() => {
    if (round.stars >= 2) celebrate(round.stars === 3 ? 'big' : 'small')
    speak(message + (sticker ? ' Toque no baú!' : ''))
  }, [round, message, sticker])

  function openChest() {
    if (chest === 'open' || !sticker) return
    setChest('open')
    playSound('chest')
    celebrate('small')
    speak(`Você ganhou a figurinha ${sticker.name}!`)
  }

  return (
    <div className="result">
      <div className="result-stars">
        <StarRow count={round.stars} size={72} />
      </div>
      <h1 className="result-title">{round.stars === 3 ? 'Incrível!' : round.stars === 2 ? 'Muito bem!' : 'Você conseguiu!'}</h1>
      <p className="result-sub">
        {round.correct} de {round.total} de primeira
        {firstClear && hasNext && <> · Fase nova aberta! 🔓</>}
      </p>

      {sticker ? (
        <button
          type="button"
          className={`chest chest-${chest} ${sticker.rare ? 'chest-rare' : ''}`}
          onClick={openChest}
          aria-label={chest === 'open' ? `Figurinha ${sticker.name}` : 'Abrir o baú'}
        >
          {chest === 'closed' ? (
            <span className="chest-icon" aria-hidden="true">
              🎁
            </span>
          ) : (
            <span className="sticker-reveal pop">
              <span className="sticker-emoji" aria-hidden="true">
                {sticker.emoji}
              </span>
              <span className="sticker-name">
                {sticker.name}
                {sticker.rare && ' ✨ rara!'}
              </span>
            </span>
          )}
        </button>
      ) : (
        <Mascot text="Com 2 estrelas você ganha um baú surpresa!" mood="idle" />
      )}

      <div className="result-actions">
        <button type="button" className="btn btn-soft btn-lg" onClick={onAgain}>
          <RotateCcw size={24} /> De novo
        </button>
        <button type="button" className="btn btn-soft btn-lg" onClick={onMap}>
          <MapIcon size={24} /> Mapa
        </button>
        {hasNext && (
          <button type="button" className="btn btn-primary btn-lg" onClick={onNext}>
            Próxima <ArrowRight size={24} />
          </button>
        )}
      </div>
    </div>
  )
}
