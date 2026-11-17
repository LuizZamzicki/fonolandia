// As telas de cada tipo de pergunta. Cada uma avisa as respostas (`onAnswer`) e quando a pergunta
// terminou (`onComplete`). Erros não travam: a criança tenta de novo e aprende com a dica falada.

import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { soundInfo } from '../data/sounds'
import { wordById, type Word } from '../data/words'
import type { Question } from '../game/questions'
import { playSound } from '../lib/sounds'
import { speak, speakWord, stopSpeaking } from '../lib/speech'
import { Figure, SpeakButton } from '../ui/kit'

export interface ViewProps<Q> {
  q: Q
  onAnswer: (target: string, answer: string, correct: boolean) => void
  onComplete: () => void
}

type Caca = Extract<Question, { kind: 'caca' }>
type Falta = Extract<Question, { kind: 'falta' }>
type Monta = Extract<Question, { kind: 'monta' }>
type Rima = Extract<Question, { kind: 'rima' }>

/** "o som do bê" / "o som do á". */
function soundName(key: string): string {
  const info = soundInfo(key)
  return info ? `o som do ${info.spoken}` : 'outro som'
}

function cacaInstruction(target: string): string {
  const info = soundInfo(target)!
  const example = wordById(info.example)!
  return `Toque nas figuras que começam com ${soundName(target)}, de ${example.word.toLowerCase()}.`
}

/** Fala a instrução ao abrir a pergunta e para de falar ao sair. */
function useInstruction(text: string) {
  useEffect(() => {
    // Um respiro antes de falar, para a troca de tela terminar
    const timer = window.setTimeout(() => speak(text), 350)
    return () => {
      window.clearTimeout(timer)
      stopSpeaking()
    }
  }, [text])
}

// --- Caça-Sons -------------------------------------------------------------------

export function CacaView({ q, onAnswer, onComplete }: ViewProps<Caca>) {
  const info = soundInfo(q.target)!
  const example = wordById(info.example)!
  const instruction = cacaInstruction(q.target)
  const [found, setFound] = useState<string[]>([])
  const [wrong, setWrong] = useState<string | null>(null)
  useInstruction(instruction)

  function tap(word: Word) {
    if (found.includes(word.id)) return
    if (q.correct.includes(word.id)) {
      const next = [...found, word.id]
      setFound(next)
      playSound('right')
      onAnswer(q.target, word.start, true)
      if (next.length === q.correct.length) {
        speakWord(word.word)
        onComplete()
      } else speakWord(word.word)
    } else {
      setWrong(word.id)
      playSound('wrong')
      onAnswer(q.target, word.start, false)
      // A dica ensina: diz com que som a figura começa de verdade
      speak(`${word.word.toLowerCase()} começa com ${soundName(word.start)}.`)
      window.setTimeout(() => setWrong((w) => (w === word.id ? null : w)), 700)
    }
  }

  return (
    <div className="game game-caca">
      <div className="target-card rise">
        <span className="target-letter">{q.target}</span>
        <span className="target-example" aria-hidden="true">
          {example.emoji}
        </span>
        <SpeakButton text={instruction} label="Ouvir a instrução" />
      </div>
      <p className="game-hint">
        Encontre {q.correct.length} figuras · {found.length}/{q.correct.length}
      </p>
      <div className="figure-grid">
        {q.options.map((w) => (
          <Figure
            key={w.id}
            word={w}
            onTap={() => tap(w)}
            state={found.includes(w.id) ? 'found' : wrong === w.id ? 'wrong' : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// --- Qual som falta? ------------------------------------------------------------

export function FaltaView({ q, onAnswer, onComplete }: ViewProps<Falta>) {
  const word = q.word
  const instruction = `Qual letra está faltando em ${word.word.toLowerCase()}?`
  const [tried, setTried] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [shake, setShake] = useState(false)
  useInstruction(instruction)

  function choose(letter: string) {
    if (done || tried.includes(letter)) return
    if (letter === q.answer) {
      setDone(true)
      playSound('right')
      onAnswer(q.answer, letter, true)
      speakWord(word.word)
      onComplete()
    } else {
      setTried([...tried, letter])
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
      playSound('wrong')
      onAnswer(q.answer, letter, false)
      speak(`Não é ${soundInfo(letter)?.spoken ?? letter}. Escute de novo: ${word.word.toLowerCase()}.`)
    }
  }

  return (
    <div className="game game-falta">
      <div className="falta-figure rise">
        <Figure word={word} size="xl" showWord={false} />
        <SpeakButton text={instruction} label="Ouvir a instrução" />
      </div>
      <div className={`falta-word ${shake ? 'shake' : ''}`} aria-label={done ? word.word : `${word.word.slice(1)} com a primeira letra faltando`}>
        <span className={`falta-blank ${done ? 'falta-filled pop' : ''}`}>{done ? word.word[0] : '?'}</span>
        <span>{word.word.slice(1)}</span>
      </div>
      <div className="letter-options">
        {q.options.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`letter-btn ${tried.includes(letter) ? 'letter-wrong' : ''} ${done && letter === q.answer ? 'letter-right' : ''}`}
            onClick={() => choose(letter)}
            disabled={tried.includes(letter)}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Monta a Palavra -------------------------------------------------------------

export function MontaView({ q, onAnswer, onComplete }: ViewProps<Monta>) {
  const word = q.word
  const instruction = `Monte a palavra ${word.word.toLowerCase()}. Toque nas sílabas na ordem certa.`
  /** Índices das peças já colocadas. */
  const [placed, setPlaced] = useState<number[]>([])
  const [wrong, setWrong] = useState<number | null>(null)
  useInstruction(instruction)
  const done = placed.length === word.syllables.length

  function tap(index: number) {
    if (done || placed.includes(index)) return
    const piece = q.pieces[index]
    const expected = word.syllables[placed.length]
    if (piece === expected) {
      const next = [...placed, index]
      setPlaced(next)
      playSound('pop')
      onAnswer(word.start, piece, true)
      if (next.length === word.syllables.length) {
        playSound('right')
        speakWord(word.word)
        onComplete()
      } else speak(piece.toLowerCase(), undefined, 0.8)
    } else {
      setWrong(index)
      playSound('wrong')
      onAnswer(word.start, piece, false)
      speak(`Escute: ${word.syllables.map((s) => s.toLowerCase()).join('... ')}`, undefined, 0.75)
      window.setTimeout(() => setWrong((w) => (w === index ? null : w)), 600)
    }
  }

  return (
    <div className="game game-monta">
      <div className="falta-figure rise">
        <Figure word={word} size="xl" />
        <SpeakButton text={word.word.toLowerCase()} label="Ouvir a palavra" />
      </div>
      <div className="slots">
        {word.syllables.map((syllable, i) => (
          <span key={i} className={`slot ${i < placed.length ? 'slot-filled pop' : ''}`}>
            {i < placed.length ? syllable : ''}
          </span>
        ))}
      </div>
      <div className="pieces">
        {q.pieces.map((piece, i) => (
          <button
            key={i}
            type="button"
            className={`piece ${placed.includes(i) ? 'piece-used' : ''} ${wrong === i ? 'shake piece-wrong' : ''}`}
            onClick={() => tap(i)}
            disabled={placed.includes(i)}
          >
            {piece}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Rima ou Não Rima? -------------------------------------------------------------

export function RimaView({ q, onAnswer, onComplete }: ViewProps<Rima>) {
  const a = q.a.word.toLowerCase()
  const b = q.b.word.toLowerCase()
  const instruction = `${a}... ${b}. Rima ou não rima?`
  const [result, setResult] = useState<'right' | 'wrong' | null>(null)
  useInstruction(instruction)

  function answer(saysRhymes: boolean) {
    if (result) return
    const correct = saysRhymes === q.rhymes
    setResult(correct ? 'right' : 'wrong')
    onAnswer('rima', saysRhymes ? 'sim' : 'nao', correct)
    playSound(correct ? 'right' : 'wrong')
    const explanation = q.rhymes ? `${a} e ${b} rimam!` : `${a} e ${b} não rimam.`
    speak(correct ? explanation : `Ops! ${explanation}`, () => onComplete())
  }

  return (
    <div className="game game-rima">
      <div className="rima-pair rise">
        <Figure word={q.a} size="lg" />
        <span className="rima-plus" aria-hidden="true">
          +
        </span>
        <Figure word={q.b} size="lg" />
      </div>
      <SpeakButton text={instruction} label="Ouvir de novo" />
      <div className="rima-buttons">
        <button
          type="button"
          className={`btn btn-success btn-xl ${result && q.rhymes ? 'btn-glow' : ''}`}
          onClick={() => answer(true)}
          disabled={result !== null}
        >
          <ThumbsUp size={34} /> Rima
        </button>
        <button
          type="button"
          className={`btn btn-danger btn-xl ${result && !q.rhymes ? 'btn-glow' : ''}`}
          onClick={() => answer(false)}
          disabled={result !== null}
        >
          <ThumbsDown size={34} /> Não rima
        </button>
      </div>
    </div>
  )
}
