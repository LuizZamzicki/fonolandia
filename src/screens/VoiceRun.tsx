// Corrida da Voz: o personagem é uma letra que corre sozinho. Cada parede tem um buraco com a forma de
// uma letra; a criança faz o SOM da letra ("sss", "mmm", "bâ"), o personagem vira essa letra e passa.
// Se bater na parede com a forma errada, só volta um pouquinho e tenta de novo: não se perde nada.
// As paredes formam uma palavra curta (quando os sons ensinados permitem) ou uma sequência de letras.
//
// O som é reconhecido no próprio aparelho, comparando com as gravações que a professora (e, se quiser,
// a criança) fez na área da professora → Vozes. Sem gravações ou sem microfone, joga-se pelos botões.

import { Keyboard, Mic, MicOff, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { recognize, type Template } from '../audio/features'
import { micSupported, openMic, type Mic as MicHandle } from '../audio/mic'
import { ISLANDS, pairOf, soundInfo } from '../data/sounds'
import { wordById, wordsStartingWith, type Word } from '../data/words'
import { bestStars, islandUnlocked } from '../game/progress'
import { pick, shuffle } from '../game/questions'
import { chooseSound, plainLetters, runWords, soundPrompt } from '../game/voiceLetters'
import { celebrate } from '../lib/celebrate'
import { playSound, type Sound } from '../lib/sounds'
import { speak, stopSpeaking } from '../lib/speech'
import { getDb } from '../store/db'
import type { Student } from '../store/types'
import { loadVoices, taughtSounds, templatesFor, useVoices } from '../store/voices'
import { Figure, Mascot } from '../ui/kit'
import { VoiceTeach } from './VoiceTeach'

// Mundo em unidades do SVG (a tela escala tudo junto)
const VIEW_W = 1000
const VIEW_H = 400
const GROUND_Y = 340
const BASELINE = 300
const FONT_SIZE = 210
const CHAR_SCREEN_X = 230
const WALL_W = 190
const WALL_TOP = 50
const SPACING = 560
const SPEED = 100 // unidades por segundo
const BOUNCE_DISTANCE = 170
const BOUNCE_TIME = 0.45
/** O personagem encosta na parede quando o centro dele chega a esta distância do centro da parede. */
const CONTACT = 150

const WALL_COLORS = ['#f97316', '#8b5cf6', '#0ea5e9', '#ec4899', '#22c55e', '#eab308']

/** Palavra-exemplo do som (para a dica e para a tela). */
function exampleOf(letter: string): Word | undefined {
  const info = soundInfo(letter)
  return (info && wordById(info.example)) ?? wordsStartingWith(letter)[0]
}

/** Uma rodada: as letras das paredes e, se formarem uma palavra, qual. */
interface RoundData {
  letters: string[]
  word: Word | null
}

interface Barrier {
  id: number
  x: number
  letter: string
  passed: boolean
  color: string
}

interface Run {
  /** Posição do personagem no mundo. */
  x: number
  barriers: Barrier[]
  /** Segundos de recuo que ainda faltam (depois de bater). */
  bounce: number
  /** Parado até este instante (rodada terminada). */
  pausedUntil: number
  bumps: number
  shakeId: number | null
  nextId: number
  /** Relógio do jogo (segundos), para as animações. */
  time: number
}

const EMPTY_RUN: Run = { x: 0, barriers: [], bounce: 0, pausedUntil: 0, bumps: 0, shakeId: null, nextId: 1, time: 0 }

type Phase = 'intro' | 'teach' | 'running'
type MicState = 'off' | 'opening' | 'listening' | 'denied' | 'error'

export function VoiceRun({ student, onExit }: { student: Student; onExit: () => void }) {
  const voices = useVoices()
  useEffect(() => {
    void loadVoices()
  }, [])
  const templates: Template[] = useMemo(() => templatesFor(voices, student.id), [voices, student.id])
  const taught = useMemo(() => taughtSounds(voices, student.id), [voices, student.id])

  // Sons das ilhas que a criança já abriu
  const unlocked = useMemo(() => {
    const db = getDb()
    const best = bestStars(db.rounds, student.id)
    return ISLANDS.filter((_, i) => islandUnlocked(i, best, db.settings.unlockAll)).flatMap((i) => i.sounds)
  }, [student.id])
  // Com microfone, só entram os sons que têm gravação (da criança ou da turma)
  const available = useMemo(() => unlocked.filter((s) => taught.includes(s)), [unlocked, taught])
  const canListen = micSupported() && available.length >= 2
  const sounds = canListen ? available : unlocked
  const words = useMemo(() => runWords(sounds), [sounds])
  /** Sons que ainda não têm a voz da própria criança (até 8 por vez, na ordem das ilhas). */
  const ownMissing = useMemo(
    () => unlocked.filter((s) => !voices.some((v) => v.owner === student.id && v.sound === s)).slice(0, 8),
    [unlocked, voices, student.id],
  )

  const newRound = (avoid?: string): RoundData => {
    if (words.length >= 3) {
      const options = words.filter((w) => w.id !== avoid)
      const w = pick(options.length > 0 ? options : words, Math.random)
      return { letters: plainLetters(w.word).split(''), word: w }
    }
    // Poucos sons para formar palavras: três letras sorteadas (sem repetir em seguida)
    const letters: string[] = []
    for (let i = 0; i < 3; i++) {
      const options = sounds.filter((s) => s !== letters[i - 1])
      letters.push(pick(options.length > 0 ? options : sounds, Math.random))
    }
    return { letters, word: null }
  }

  const [phase, setPhase] = useState<Phase>('intro')
  /** Sons pedidos no "ensinar minha voz" (fixos enquanto ele acontece: a lista muda a cada gravação). */
  const [teachList, setTeachList] = useState<string[]>([])
  const [letter, setLetter] = useState('?')
  const [round, setRound] = useState<RoundData>(() => newRound())
  const [done, setDone] = useState<RoundData | null>(null)
  const [count, setCount] = useState(0)
  const [mic, setMic] = useState<MicState>('off')
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(!canListen)
  /** Foto do estado do jogo a cada quadro (o laço escreve em `run`, a tela desenha `view`). */
  const [view, setView] = useState<Run | null>(null)

  const run = useRef<Run>({ ...EMPTY_RUN })
  const letterRef = useRef(letter)
  const roundRef = useRef(round)
  const micRef = useRef<MicHandle | null>(null)
  const templatesRef = useRef(templates)
  /** Enquanto o Tuca fala ou toca um efeito, o microfone ignora o que ouve (senão ouviria o aparelho). */
  const deafUntil = useRef(0)

  useEffect(() => {
    templatesRef.current = templates
  }, [templates])

  function deafFor(ms: number) {
    deafUntil.current = Math.max(deafUntil.current, performance.now() + ms)
  }

  function sfx(sound: Sound) {
    playSound(sound)
    deafFor(450)
  }

  /** Fala sem o microfone escutar a si mesmo. */
  function say(text: string, onEnd?: () => void) {
    deafUntil.current = Number.POSITIVE_INFINITY
    speak(text, () => {
      deafUntil.current = performance.now() + 600
      onEnd?.()
    })
  }

  function placeRound(data: RoundData, fromX: number) {
    const r = run.current
    const color = WALL_COLORS[Math.floor(Math.random() * WALL_COLORS.length)]
    const fresh = data.letters.map((l, i) => ({ id: r.nextId++, x: fromX + SPACING * (i + 1), letter: l, passed: false, color }))
    // Guarda só as paredes que ainda aparecem na tela
    r.barriers = [...r.barriers.filter((b) => b.x > r.x - CHAR_SCREEN_X - WALL_W), ...fresh]
  }

  function transform(next: string) {
    if (next === letterRef.current) return
    letterRef.current = next
    setLetter(next)
    sfx('pop')
  }

  // Botões de letra: as letras da rodada, os "pares" (P/B...) e mais algumas, até 8
  const keyOptions = useMemo(() => {
    const set = new Set(round.letters)
    for (const l of [...set]) {
      const p = pairOf(l)
      if (p && sounds.includes(p)) set.add(p)
    }
    for (const l of shuffle(sounds, Math.random)) {
      if (set.size >= 8) break
      set.add(l)
    }
    return [...set].sort()
  }, [round, sounds])

  async function start() {
    // As gravações carregam depois da tela abrir: sorteia a rodada de novo com os sons certos
    const first = newRound()
    roundRef.current = first
    setRound(first)
    setShowKeys(!canListen)
    setPhase('running')
    placeRound(first, run.current.x)
    say(
      canListen
        ? 'Eu vou correr! Para passar pela parede, faça o som da letra que está nela.'
        : 'Eu vou correr! Para passar pela parede, toque na letra que está nela.',
    )
    if (!canListen) return
    // O microfone abre já no toque (o navegador só pede permissão depois de um toque)
    setMic('opening')
    try {
      micRef.current = await openMic({
        onLevel: setLevel,
        onSegment: (samples, rate) => {
          if (performance.now() < deafUntil.current) return
          const wanted = run.current.barriers.find((b) => !b.passed)?.letter ?? null
          const sound = chooseSound(recognize(samples, rate, templatesRef.current), wanted)
          if (!sound) return
          setHeard(sound)
          transform(sound)
        },
      })
      setMic('listening')
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setMic(denied ? 'denied' : 'error')
      setShowKeys(true)
    }
  }

  useEffect(
    () => () => {
      micRef.current?.stop()
      stopSpeaking()
    },
    [],
  )

  function roundDone() {
    const finished = roundRef.current
    run.current.pausedUntil = performance.now() + 3200
    setDone(finished)
    setCount((c) => c + 1)
    celebrate('small')
    sfx('complete')
    say(finished.word ? `Você formou ${finished.word.word.toLowerCase()}!` : 'Muito bem! Que sons bonitos!')
    window.setTimeout(() => {
      setDone(null)
      const next = newRound(finished.word?.id)
      roundRef.current = next
      setRound(next)
      placeRound(next, run.current.x)
    }, 3000)
  }

  // O laço do jogo chama sempre a versão atual
  const roundDoneRef = useRef(roundDone)
  useEffect(() => {
    roundDoneRef.current = roundDone
  })

  // Laço do jogo
  useEffect(() => {
    if (phase !== 'running') return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const r = run.current
      r.time = now / 1000

      if (now >= r.pausedUntil) {
        if (r.bounce > 0) {
          r.x -= (BOUNCE_DISTANCE / BOUNCE_TIME) * dt
          r.bounce = Math.max(0, r.bounce - dt)
          if (r.bounce === 0) r.shakeId = null
        } else {
          r.x += SPEED * dt
          const b = r.barriers.find((w) => !w.passed)
          if (b && r.x >= b.x - CONTACT) {
            if (letterRef.current === b.letter) {
              b.passed = true
              r.bumps = 0
              setHint(null)
              sfx('right')
              if (!r.barriers.some((w) => !w.passed)) roundDoneRef.current()
            } else {
              r.x = b.x - CONTACT
              r.bounce = BOUNCE_TIME
              r.shakeId = b.id
              r.bumps++
              sfx('wrong')
              if (r.bumps === 2 || r.bumps % 4 === 0) {
                const text = soundPrompt(b.letter)
                setHint(text)
                say(text)
              }
            }
          }
        }
      }
      setView({ ...r, barriers: r.barriers.map((b) => ({ ...b })) })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const r: Run = view ?? EMPTY_RUN
  const offset = r.x - CHAR_SCREEN_X
  const t = r.time
  const bob = r.bounce > 0 || done ? 0 : Math.sin(t * 9) * 5
  const unpassed = r.barriers.filter((b) => !b.passed)
  const nextBarrier = unpassed[0]
  const passedCount = round.letters.length - unpassed.length
  const example = nextBarrier ? exampleOf(nextBarrier.letter) : undefined

  return (
    <div className="voice-run">
      <header className="play-top">
        <button type="button" className="btn btn-ghost btn-icon" onClick={onExit} aria-label="Sair da corrida">
          <X size={30} />
        </button>
        <div className="run-word" aria-label={round.word ? `Palavra: ${round.word.word}` : `Letras: ${round.letters.join('')}`}>
          {phase === 'running' && round.word && (
            <button
              type="button"
              className="run-word-emoji"
              onClick={() => say(round.word!.word.toLowerCase())}
              aria-label="Ouvir a palavra"
            >
              {round.word.emoji}
            </button>
          )}
          {phase === 'running' && round.letters.map((l, i) => (
            <span
              key={i}
              className={`run-slot ${phase === 'running' && i < passedCount ? 'run-slot-done' : ''} ${phase === 'running' && i === passedCount ? 'run-slot-next' : ''}`}
            >
              {phase === 'running' && i < passedCount ? l : ''}
            </span>
          ))}
        </div>
        <span className="chip" aria-label={`${count} rodadas`}>
          🏅 {count}
        </span>
      </header>

      <div className="run-stage">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="run-svg" role="img" aria-label="Corrida da voz">
          <defs>
            <linearGradient id="run-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#bae6fd" />
              <stop offset="1" stopColor="#e0f2fe" />
            </linearGradient>
            <linearGradient id="run-hero" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6d5efc" />
              <stop offset="0.6" stopColor="#a855f7" />
              <stop offset="1" stopColor="#ec4899" />
            </linearGradient>
            <pattern id="run-bricks" width="48" height="28" patternUnits="userSpaceOnUse">
              <path d="M0 14H48M24 0V14M0 14V28M48 14V28" stroke="rgb(0 0 0 / 14%)" strokeWidth="2" fill="none" />
            </pattern>
            <pattern
              id="run-grass"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${-offset % 60} 0)`}
            >
              <rect width="60" height="60" fill="#4ade80" />
              <path d="M0 0H30V8H0Z" fill="#22c55e" />
            </pattern>
            {r.barriers.map((b) => (
              <mask key={b.id} id={`hole-${b.id}`}>
                <rect x={b.x - WALL_W / 2} y={WALL_TOP} width={WALL_W} height={GROUND_Y - WALL_TOP} fill="white" />
                <text x={b.x} y={BASELINE} textAnchor="middle" fontSize={FONT_SIZE} className="run-glyph" fill="black">
                  {b.letter}
                </text>
              </mask>
            ))}
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#run-sky)" />
          {/* Nuvens e morros andam mais devagar (profundidade) */}
          {[0, 1, 2].map((i) => {
            const cx = ((((i * 420 - offset * 0.25) % 1260) + 1260) % 1260) - 130
            return (
              <g key={i} transform={`translate(${cx} ${60 + i * 25})`} fill="#fff" opacity="0.9">
                <ellipse cx="0" cy="0" rx="60" ry="22" />
                <ellipse cx="40" cy="-12" rx="40" ry="24" />
                <ellipse cx="-38" cy="-6" rx="32" ry="18" />
              </g>
            )
          })}
          {[0, 1, 2, 3].map((i) => {
            const hx = ((((i * 360 - offset * 0.5) % 1440) + 1440) % 1440) - 200
            return <ellipse key={i} cx={hx} cy={GROUND_Y + 10} rx="220" ry="90" fill="#a7f3d0" />
          })}
          <rect x="0" y={GROUND_Y} width={VIEW_W} height={VIEW_H - GROUND_Y} fill="url(#run-grass)" />

          {/* Paredes */}
          {r.barriers.map((b) => {
            const sx = b.x - offset
            if (sx < -WALL_W || sx > VIEW_W + WALL_W) return null
            const shake = r.shakeId === b.id ? Math.sin(t * 60) * 4 : 0
            return (
              <g key={b.id} transform={`translate(${-offset + shake} 0)`} opacity={b.passed ? 0.55 : 1}>
                <g mask={`url(#hole-${b.id})`}>
                  <rect x={b.x - WALL_W / 2} y={WALL_TOP} width={WALL_W} height={GROUND_Y - WALL_TOP} rx="18" fill={b.color} />
                  <rect x={b.x - WALL_W / 2} y={WALL_TOP} width={WALL_W} height={GROUND_Y - WALL_TOP} rx="18" fill="url(#run-bricks)" />
                </g>
                <text x={b.x} y={BASELINE} textAnchor="middle" fontSize={FONT_SIZE} className="run-glyph run-hole-outline">
                  {b.letter}
                </text>
              </g>
            )
          })}

          {/* Personagem: a letra, com olhinhos */}
          <g transform={`translate(0 ${bob})`}>
            <ellipse cx={CHAR_SCREEN_X} cy={GROUND_Y + 4} rx="60" ry="10" fill="rgb(0 0 0 / 15%)" />
            <g key={letter} className="run-hero-pop">
              <text
                x={CHAR_SCREEN_X}
                y={BASELINE}
                textAnchor="middle"
                fontSize={FONT_SIZE}
                className="run-glyph run-hero"
                fill="url(#run-hero)"
              >
                {letter}
              </text>
              <g>
                <circle cx={CHAR_SCREEN_X - 20} cy={BASELINE - 112} r="14" fill="#fff" stroke="#1e1b4b" strokeWidth="3" />
                <circle cx={CHAR_SCREEN_X + 20} cy={BASELINE - 112} r="14" fill="#fff" stroke="#1e1b4b" strokeWidth="3" />
                <circle cx={CHAR_SCREEN_X - 15} cy={BASELINE - 110} r="6" fill="#1e1b4b" />
                <circle cx={CHAR_SCREEN_X + 25} cy={BASELINE - 110} r="6" fill="#1e1b4b" />
              </g>
            </g>
          </g>
        </svg>

        {phase === 'intro' && (
          <div className="run-overlay">
            <Mascot
              text={canListen ? 'Faça o som da letra da parede para eu me transformar e passar!' : 'Toque na letra da parede para eu me transformar e passar!'}
              mood="idle"
            />
            <div className="btn-row run-intro-actions">
              {micSupported() && (
                <button
                  type="button"
                  className={`btn btn-xl ${ownMissing.length > 0 || !canListen ? 'btn-primary' : 'btn-soft'}`}
                  onClick={() => {
                    setTeachList(ownMissing.length > 0 ? ownMissing : unlocked.slice(0, 8))
                    setPhase('teach')
                  }}
                >
                  🦜 Ensinar minha voz
                </button>
              )}
              <button
                type="button"
                className={`btn btn-xl ${ownMissing.length > 0 || !canListen ? 'btn-soft' : 'btn-primary'}`}
                onClick={() => void start()}
              >
                <Mic size={30} /> Começar
              </button>
            </div>
            {!micSupported() ? (
              <p className="small muted center run-note">
                Este navegador não deixa usar o microfone aqui{window.isSecureContext ? '' : ' (precisa de endereço https)'}.
                Dá para jogar tocando nas letras.
              </p>
            ) : (
              !canListen && (
                <p className="small muted center run-note">
                  Para jogar com a voz, primeiro ensine a sua voz ao Tuca. Sem isso, joga-se tocando nas letras.
                </p>
              )
            )}
          </div>
        )}

        {phase === 'teach' && (
          <div className="run-overlay run-teach">
            <VoiceTeach
              student={student}
              sounds={teachList}
              onDone={() => setPhase('intro')}
            />
          </div>
        )}

        {done && (
          <div className="run-overlay run-formed pop">
            {done.word ? (
              <>
                <Figure word={done.word} size="xl" />
                <p className="run-formed-text">Você formou {done.word.word}!</p>
              </>
            ) : (
              <>
                <span className="run-done-letters">{done.letters.join(' ')}</span>
                <p className="run-formed-text">Muito bem!</p>
              </>
            )}
          </div>
        )}
      </div>

      {phase === 'running' && (
        <div className="run-bottom">
          <div className="run-status">
            {mic === 'opening' && (
              <span className="mic-on">
                <Mic size={22} /> Ligando o microfone…
              </span>
            )}
            {mic === 'listening' && (
              <span className="mic-on">
                <span className="mic-meter" aria-hidden="true">
                  <span style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />
                </span>
                <Mic size={22} /> Estou ouvindo
                {heard && (
                  <>
                    {' · '}ouvi <strong className="mic-heard">{heard}</strong>
                  </>
                )}
              </span>
            )}
            {mic === 'denied' && (
              <span className="mic-off">
                <MicOff size={22} /> O microfone não foi liberado. Use as letras abaixo.
              </span>
            )}
            {mic === 'error' && (
              <span className="mic-off">
                <MicOff size={22} /> Não consegui abrir o microfone. Use as letras abaixo.
              </span>
            )}
            {canListen && mic === 'listening' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowKeys(!showKeys)}>
                <Keyboard size={18} /> {showKeys ? 'Esconder letras' : 'Usar letras'}
              </button>
            )}
          </div>
          {hint && <Mascot text={hint} mood="oops" />}
          {!hint && nextBarrier && !done && example && (
            <p className="run-tip">
              {canListen ? 'Faça o som' : 'Toque na letra'} <strong>{nextBarrier.letter}</strong>, como no começo de{' '}
              <span aria-hidden="true">{example.emoji}</span> <strong>{example.word}</strong>
            </p>
          )}
          {showKeys && (
            <div className="run-keys">
              {keyOptions.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`run-key ${letter === l ? 'run-key-on' : ''}`}
                  onClick={() => transform(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
