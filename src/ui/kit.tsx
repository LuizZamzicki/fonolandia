// Peças visuais usadas em várias telas.

import { ArrowLeft, Star, Volume2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { speak, speakWord } from '../lib/speech'
import type { Word } from '../data/words'

export type Mood = 'idle' | 'happy' | 'oops' | 'party'

/** Tuca, o papagaio que explica cada jogo. Tocar nele repete a fala. */
export function Mascot({ text, mood = 'idle', say }: { text?: ReactNode; mood?: Mood; say?: string }) {
  return (
    <div className={`mascot mascot-${mood}`}>
      <button
        type="button"
        className="mascot-bird"
        onClick={() => say && speak(say)}
        aria-label={say ? 'Ouvir de novo' : 'Tuca, o papagaio'}
      >
        <span aria-hidden="true">🦜</span>
      </button>
      {text && <div className="mascot-bubble">{text}</div>}
    </div>
  )
}

export function SpeakButton({ text, label = 'Ouvir', size = 26 }: { text: string; label?: string; size?: number }) {
  return (
    <button type="button" className="speak-btn" onClick={() => speak(text)} aria-label={label}>
      <Volume2 size={size} />
    </button>
  )
}

/**
 * Uma figura (emoji) grande com o nome embaixo (o emoji sozinho pode confundir: a câmera é "foto").
 * Tocar fala a palavra, a não ser que `onTap` diga outra coisa. `showWord={false}` só quando o nome
 * entregaria a resposta e já aparece de outro jeito na tela.
 */
export function Figure({
  word,
  onTap,
  state,
  showWord = true,
  size = 'md',
  disabled,
}: {
  word: Word
  onTap?: () => void
  state?: 'right' | 'wrong' | 'found'
  showWord?: boolean
  size?: 'md' | 'lg' | 'xl'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`figure figure-${size} ${state ? `figure-${state}` : ''}`}
      onClick={onTap ?? (() => speakWord(word.word))}
      disabled={disabled}
      aria-label={word.word.toLowerCase()}
    >
      <span className="figure-emoji" aria-hidden="true">
        {word.emoji}
      </span>
      {showWord && <span className="figure-word">{word.word}</span>}
      {state === 'found' && (
        <span className="figure-check" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  )
}

export function StarRow({ count, max = 3, size = 18 }: { count: number; max?: number; size?: number }) {
  return (
    <span className="star-row" role="img" aria-label={`${count} de ${max} estrelas`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={size} className={i < count ? 'star on' : 'star'} fill="currentColor" strokeWidth={1.5} />
      ))}
    </span>
  )
}

export function BackButton({ onClick, label = 'Voltar' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-icon back-btn" onClick={onClick} aria-label={label}>
      <ArrowLeft size={28} />
    </button>
  )
}

export function ProgressDots({ total, done, current }: { total: number; done: number; current: number }) {
  return (
    <div className="progress-dots" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`dot ${i < done ? 'dot-done' : ''} ${i === current ? 'dot-current' : ''}`} />
      ))}
    </div>
  )
}
