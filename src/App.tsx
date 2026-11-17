import { lazy, Suspense, useEffect, useState } from 'react'
import { ALL_LEVELS, levelById } from './data/sounds'
import { bestStars } from './game/progress'
import { flushDb, getDb, loadDb, useDb } from './store/db'
import { cloudEnabled, syncNow } from './store/cloud'
import type { Round } from './store/types'
import { Album } from './screens/Album'
import { MapScreen } from './screens/MapScreen'
import { Play } from './screens/Play'
import { Result } from './screens/Result'
import { Who } from './screens/Who'
import { stopSpeaking } from './lib/speech'

// Telas que a criança não usa no dia a dia: carregadas só quando abertas
const Teacher = lazy(() => import('./screens/Teacher').then((m) => ({ default: m.Teacher })))
const VoiceRun = lazy(() => import('./screens/VoiceRun').then((m) => ({ default: m.VoiceRun })))

type Screen =
  | { name: 'who' }
  | { name: 'map' }
  | { name: 'play'; levelId: string; attempt: number }
  | { name: 'result'; round: Round; firstClear: boolean }
  | { name: 'album' }
  | { name: 'teacher' }
  | { name: 'voice' }

function quietSync() {
  if (cloudEnabled) syncNow().catch((e) => console.warn('Sincronização:', e))
}

export default function App() {
  const db = useDb()
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState<Screen>({ name: 'who' })
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    loadDb().then(() => {
      setReady(true)
      quietSync()
    })
    const onHide = () => document.visibilityState === 'hidden' && flushDb()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('online', quietSync)
    const timer = window.setInterval(quietSync, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', quietSync)
      window.clearInterval(timer)
    }
  }, [])

  if (!ready) return <div className="splash">🏝️</div>

  const student = studentId ? db.students.find((s) => s.id === studentId) : undefined

  function go(next: Screen) {
    stopSpeaking()
    setScreen(next)
    window.scrollTo({ top: 0 })
  }

  function play(levelId: string) {
    go({ name: 'play', levelId, attempt: Date.now() })
  }

  const fallback = <div className="splash">🏝️</div>

  if (screen.name === 'teacher') {
    return (
      <Suspense fallback={fallback}>
        <Teacher onExit={() => go({ name: 'who' })} />
      </Suspense>
    )
  }

  if (!student || screen.name === 'who') {
    return (
      <Who
        onPick={(id) => {
          setStudentId(id)
          go({ name: 'map' })
        }}
        onTeacher={() => go({ name: 'teacher' })}
      />
    )
  }

  if (screen.name === 'play') {
    const level = levelById(screen.levelId)!
    return (
      <Play
        key={screen.attempt}
        student={student}
        level={level}
        onExit={() => go({ name: 'map' })}
        onFinish={(round) => {
          // Antes desta rodada, a fase ainda não tinha estrela?
          const before = bestStars(
            getDb().rounds.filter((r) => r.id !== round.id),
            student.id,
          )
          go({ name: 'result', round, firstClear: !before.has(round.levelId) })
          quietSync()
        }}
      />
    )
  }

  if (screen.name === 'result') {
    const index = ALL_LEVELS.findIndex((l) => l.id === screen.round.levelId)
    const next = ALL_LEVELS[index + 1]
    return (
      <Result
        round={screen.round}
        firstClear={screen.firstClear}
        hasNext={Boolean(next)}
        onAgain={() => play(screen.round.levelId)}
        onNext={() => next && play(next.id)}
        onMap={() => go({ name: 'map' })}
      />
    )
  }

  if (screen.name === 'voice') {
    return (
      <Suspense fallback={fallback}>
        <VoiceRun student={student} onExit={() => go({ name: 'map' })} />
      </Suspense>
    )
  }

  if (screen.name === 'album') return <Album student={student} onBack={() => go({ name: 'map' })} />

  return (
    <MapScreen
      student={student}
      onPlay={play}
      onAlbum={() => go({ name: 'album' })}
      onAvatar={() => go({ name: 'album' })}
      onVoice={() => go({ name: 'voice' })}
      onExit={() => {
        setStudentId(null)
        go({ name: 'who' })
      }}
    />
  )
}
