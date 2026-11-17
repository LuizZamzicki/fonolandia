// "Me ensina a sua voz!": antes da Corrida da Voz, a criança faz o som de cada letra uma vez. O jogo
// guarda essas gravações e passa a reconhecer a voz dela (bem melhor do que só com a voz da professora).

import { Mic, SkipForward, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { features } from '../audio/features'
import { openMic, type Mic as MicHandle } from '../audio/mic'
import { soundInfo } from '../data/sounds'
import { soundPrompt, soundPromptParts } from '../game/voiceLetters'
import { wordById } from '../data/words'
import { celebrate } from '../lib/celebrate'
import { playSound } from '../lib/sounds'
import { PHRASES } from '../data/phrases'
import { speak, stopSpeaking, type Line } from '../lib/speech'
import type { Student } from '../store/types'
import { addVoice } from '../store/voices'
import { Figure, Mascot } from '../ui/kit'

interface Props {
  student: Student
  /** Sons a gravar, na ordem. */
  sounds: string[]
  onDone: () => void
}

export function VoiceTeach({ student, sounds, onDone }: Props) {
  const [index, setIndex] = useState(-1) // -1 = ainda não começou
  const [got, setGot] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mic = useRef<MicHandle | null>(null)
  const indexRef = useRef(index)
  const deafUntil = useRef(0)
  const current = sounds[index]
  const example = current ? wordById(soundInfo(current)?.example ?? '') : undefined

  useEffect(
    () => () => {
      mic.current?.stop()
      stopSpeaking()
    },
    [],
  )

  function say(text: Line) {
    deafUntil.current = Number.POSITIVE_INFINITY
    speak(text, () => {
      deafUntil.current = performance.now() + 500
    })
  }

  function goTo(i: number) {
    indexRef.current = i
    setIndex(i)
    setGot(false)
    if (i >= sounds.length) {
      mic.current?.stop()
      mic.current = null
      celebrate('small')
      playSound('complete')
      speak(PHRASES.teachDone, onDone)
      return
    }
    say(soundPromptParts(sounds[i]))
  }

  async function begin() {
    try {
      mic.current = await openMic({
        onLevel: setLevel,
        onSegment: (samples, rate) => {
          const i = indexRef.current
          if (i < 0 || i >= sounds.length || performance.now() < deafUntil.current) return
          const frames = features(samples, rate)
          if (frames.length < 4) return
          addVoice(sounds[i], student.id, frames)
          deafUntil.current = Number.POSITIVE_INFINITY
          setGot(true)
          playSound('right')
          window.setTimeout(() => goTo(i + 1), 900)
        },
      })
      goTo(0)
    } catch {
      setError('Não consegui abrir o microfone. Peça ajuda para a professora.')
    }
  }

  if (index < 0) {
    return (
      <div className="teach">
        <Mascot
          text={
            <>
              Antes de correr, me ensina a <strong>sua voz</strong>? Eu mostro uma letra e você faz o <strong>som</strong> dela.
            </>
          }
          say={PHRASES.teachAsk}
        />
        <button type="button" className="btn btn-primary btn-xl" onClick={() => void begin()}>
          <Mic size={30} /> Vamos!
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    )
  }

  if (!current) return <div className="teach"><Mascot text="Pronto! Agora eu conheço a sua voz! 🎉" mood="party" /></div>

  return (
    <div className="teach">
      <div className="teach-dots" aria-label={`Letra ${index + 1} de ${sounds.length}`}>
        {sounds.map((s, i) => (
          <span key={s} className={`teach-dot ${i < index || (i === index && got) ? 'teach-dot-done' : ''} ${i === index ? 'teach-dot-now' : ''}`}>
            {s}
          </span>
        ))}
      </div>
      <div className={`teach-card ${got ? 'teach-card-got' : ''}`} key={current}>
        <span className="teach-letter pop">{current}</span>
        {example && <Figure word={example} size="lg" />}
      </div>
      <div className="teach-listen">
        <span className="mic-meter mic-meter-lg" aria-hidden="true">
          <span style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />
        </span>
        <span>{got ? 'Aprendi! ✓' : soundPrompt(current)}</span>
      </div>
      <div className="btn-row teach-actions">
        <button type="button" className="btn btn-soft" onClick={() => say(soundPromptParts(current))}>
          <Volume2 size={20} /> Ouvir de novo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => goTo(index + 1)}>
          <SkipForward size={20} /> Pular
        </button>
      </div>
    </div>
  )
}
