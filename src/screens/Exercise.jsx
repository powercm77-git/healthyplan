// Exercise.jsx — 운동 탭 서브 라우터: 홈 / 라이브러리 / 상세 / 실행
import { useEffect, useState } from 'react'
import exercises from '../data/exercises.json'
import { assignRoutine } from '../lib/exerciseEngine.js'
import { getDay, setDay as dbSetDay, getAllExerciseMeta, bumpExerciseSwapped } from '../lib/db.js'
import { ensureTodayRoutine } from '../lib/ensureRoutine.js'
import { addDays, todayKey } from '../lib/date.js'
import { useFeedback } from '../components/Feedback.jsx'
import ExerciseHome from './exercise/ExerciseHome.jsx'
import ExerciseLibrary from './exercise/ExerciseLibrary.jsx'
import ExerciseDetail from './exercise/ExerciseDetail.jsx'
import ExerciseSession from './exercise/ExerciseSession.jsx'

export const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))

export default function Exercise({ profile, onFullscreenChange }) {
  const { toast } = useFeedback()
  const today = todayKey()
  const [day, setDayState] = useState(null)
  const [meta, setMeta] = useState(new Map())
  const [sub, setSub] = useState('home') // home | library | detail | session
  const [detailId, setDetailId] = useState(null)
  const [detailFrom, setDetailFrom] = useState('library') // library | routine
  const [sessionStartIndex, setSessionStartIndex] = useState(0)
  const [sessionSolo, setSessionSolo] = useState(null) // 단일 운동만 실행할 때의 exercise id

  async function reload() {
    const [dayRowRaw, metaMap] = await Promise.all([getDay(today), getAllExerciseMeta()])
    const dayRow = await ensureTodayRoutine(profile, today, dayRowRaw)
    setDayState(dayRow)
    setMeta(metaMap)
    return dayRow
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function reassign(place, minutes, metaMap = meta) {
    const yesterday = await getDay(addDays(today, -1))
    const { routine, mainBodyParts } = assignRoutine({
      exercises, profile, place, minutes, meta: metaMap, yesterdayBodyParts: yesterday.routineBodyParts,
    })
    const next = await dbSetDay(today, {
      exercisePlace: place, exerciseMinutes: minutes,
      routine: routine.map((e) => e.id), routineDone: [], routineBodyParts: mainBodyParts,
    })
    setDayState(next)
    return next
  }

  function handlePlace(place) { reassign(place, day.exerciseMinutes) }
  function handleMinutes(minutes) { reassign(day.exercisePlace, minutes) }

  function openDetail(id, from = 'library') {
    setDetailId(id); setDetailFrom(from); setSub('detail')
  }
  function backToHome() { setSub('home') }
  function backFromDetail() { setSub(detailFrom === 'routine' ? 'home' : 'library') }

  async function swapInRoutine(oldId, newId, reasonLabel) {
    await bumpExerciseSwapped(oldId)
    const nextRoutine = day.routine.map((id) => (id === oldId ? newId : id))
    const next = await dbSetDay(today, { routine: nextRoutine })
    setDayState(next)
    toast(`바꿨어요! (${reasonLabel}) 다음 배정에도 기억해둘게요 ✓`)
    if (detailId === oldId) setDetailId(newId)
  }

  function startSession(id) {
    if (id && !day.routine.includes(id)) {
      setSessionSolo(id)
      setSessionStartIndex(0)
    } else {
      setSessionSolo(null)
      setSessionStartIndex(id ? day.routine.indexOf(id) : 0)
    }
    setSub('session')
    onFullscreenChange?.(true)
  }

  async function endSession() {
    onFullscreenChange?.(false)
    await reload()
    setSub('home')
  }

  if (!day) return <section className="screen active" />

  const queueIds = sessionSolo ? [sessionSolo] : day.routine

  return (
    <>
      {sub === 'home' && (
        <ExerciseHome
          day={day} byId={byId} profile={profile}
          onPlace={handlePlace} onMinutes={handleMinutes}
          onOpenLibrary={() => setSub('library')}
          onOpenDetail={(id) => openDetail(id, 'routine')}
          onStart={() => startSession(null)}
        />
      )}
      {sub === 'library' && (
        <ExerciseLibrary
          onBack={backToHome}
          onOpenDetail={(id) => openDetail(id, 'library')}
        />
      )}
      {sub === 'detail' && detailId && (
        <ExerciseDetail
          exercise={byId[detailId]} byId={byId}
          inRoutine={day.routine.includes(detailId)}
          onBack={backFromDetail}
          onOpenDetail={(id) => openDetail(id, detailFrom)}
          onSwapInRoutine={(newId, reason) => swapInRoutine(detailId, newId, reason)}
          onStart={() => startSession(detailId)}
        />
      )}
      {sub === 'session' && (
        <ExerciseSession
          exerciseIds={queueIds} startIndex={sessionSolo ? 0 : sessionStartIndex}
          byId={byId} profile={profile} meta={meta} today={today}
          onFinish={endSession}
        />
      )}
    </>
  )
}
