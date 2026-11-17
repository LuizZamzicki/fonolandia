import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { GAME_INFO, type GameKind, type Level } from '../data/sounds'
import { buildRound, starsFor, type Question } from '../game/questions'
import { adaptiveWeights } from '../game/stats'
import { CacaView, FaltaView, MontaView, RimaView } from '../games/views'
import { playSound } from '../lib/sounds'
import { stopSpeaking } from '../lib/speech'
import { getDb, newId, saveRound } from '../store/db'
import type { Attempt, Round, Student } from '../store/types'
import { Mascot, ProgressDots, type Mood } from '../ui/kit'

interface Props {
  student: Student
  level: Level
  onFinish: (round: Round) => void
  onExit: () => void
}

const CHEERS = ['Muito bem!', 'Isso aí!', 'Arrasou!', 'Que ouvido bom!', 'Mandou bem!', 'Perfeito!']

const GAME_OF: Record<Question['kind'], GameKind> = { caca: 'caca', falta: 'falta', monta: 'monta', rima: 'rima' }

export function Play({ student, level, onFinish, onExit }: Props) {
  const [questions] = useState(() => {
    const mine = getDb().attempts.filter((a) => a.studentId === student.id)
    return buildRound(level, adaptiveWeights(mine), Math.random)
  })
  const roundId = useRef(newId())
  const attempts = useRef<Attempt[]>([])
  const firstTry = useRef(0)
  const missed = useRef(false)
  const [index, setIndex] = useState(0)
  const [mood, setMood] = useState<Mood>('idle')
  const [bubble, setBubble] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const q = questions[index]
  const info = GAME_INFO[level.game]

  function onAnswer(target: string, answer: string, correct: boolean) {
    attempts.current.push({
      id: newId(),
      studentId: student.id,
      roundId: roundId.current,
      game: GAME_OF[q.kind],
      target,
      answer,
      correct,
      at: new Date().toISOString(),
    })
    if (!correct) {
      missed.current = true
      setMood('oops')
      setBubble('Tente de novo!')
    } else setMood('happy')
  }

  function onComplete() {
    if (!missed.current) firstTry.current++
    setMood('party')
    setBubble(missed.current ? 'Conseguiu!' : CHEERS[Math.floor(Math.random() * CHEERS.length)])
    setLocked(true)
    window.setTimeout(() => {
      missed.current = false
      setLocked(false)
      setMood('idle')
      setBubble(null)
      if (index + 1 < questions.length) {
        setIndex(index + 1)
        return
      }
      const round: Round = {
        id: roundId.current,
        studentId: student.id,
        levelId: level.id,
        stars: starsFor(firstTry.current, questions.length),
        correct: firstTry.current,
        total: questions.length,
        at: new Date().toISOString(),
      }
      saveRound(round, attempts.current)
      playSound('complete')
      onFinish(round)
    }, 1300)
  }

  function exit() {
    stopSpeaking()
    onExit()
  }

  const props = { onAnswer, onComplete }

  return (
    <div className="play">
      <header className="play-top">
        <button type="button" className="btn btn-ghost btn-icon" onClick={exit} aria-label="Sair da fase">
          <X size={30} />
        </button>
        <ProgressDots total={questions.length} done={index + (locked ? 1 : 0)} current={index} />
        <span className="play-game" title={info.name} aria-hidden="true">
          {info.emoji}
        </span>
      </header>

      <div className={`play-body ${locked ? 'play-locked' : ''}`} key={index}>
        {q.kind === 'caca' && <CacaView q={q} {...props} />}
        {q.kind === 'falta' && <FaltaView q={q} {...props} />}
        {q.kind === 'monta' && <MontaView q={q} {...props} />}
        {q.kind === 'rima' && <RimaView q={q} {...props} />}
      </div>

      <div className="play-mascot">
        <Mascot mood={mood} text={bubble ?? undefined} />
      </div>
    </div>
  )
}
