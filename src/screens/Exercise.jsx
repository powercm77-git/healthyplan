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
import ExerciseBriefing from './exercise/ExerciseBriefing.jsx'
import ExerciseSession from './exercise/ExerciseSession.jsx'

export const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))

export default function Exercise({ profile, onFullscreenChange, onUpdateProfile }) {
  const { toast } = useFeedback()
  const today = todayKey()
  const [day, setDayState] = useState(null)
  const [meta, setMeta] = useState(new Map())
  const [sub, setSub] = useState('home') // home | library | detail | briefing | session
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

  const preferVideo = profile.preferVideoOnly !== false // 기본값 켜짐

  // preferVideoOverride: 토글 직후처럼 profile state가 아직 리렌더에 반영되기 전에
  // 새 값으로 바로 재배정해야 할 때만 넘긴다.
  async function reassign(place, minutes, preferVideoOverride = preferVideo) {
    const yesterday = await getDay(addDays(today, -1))
    const { routine, mainBodyParts, nonVideoCount } = assignRoutine({
      exercises, profile, place, minutes, meta, yesterdayBodyParts: yesterday.routineBodyParts,
      preferVideo: preferVideoOverride,
    })
    const next = await dbSetDay(today, {
      exercisePlace: place, exerciseMinutes: minutes,
      routine: routine.map((e) => e.id), routineDone: [], routineBodyParts: mainBodyParts,
    })
    setDayState(next)
    if (nonVideoCount > 0) toast(`영상이 없는 운동 ${nonVideoCount}개가 포함됐어요`)
    return next
  }

  function handlePlace(place) { reassign(place, day.exerciseMinutes) }
  function handleMinutes(minutes) { reassign(day.exercisePlace, minutes) }
  async function handlePreferVideoOnly(next) {
    await onUpdateProfile?.({ preferVideoOnly: next })
    reassign(day.exercisePlace, day.exerciseMinutes, next)
  }

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
          preferVideoOnly={preferVideo} onPreferVideoOnly={handlePreferVideoOnly}
          onOpenLibrary={() => setSub('library')}
          onOpenDetail={(id) => openDetail(id, 'routine')}
          onStart={() => setSub('briefing')}
        />
      )}
      {sub === 'briefing' && (
        <ExerciseBriefing
          routineIds={day.routine} byId={byId} profile={profile}
          onStart={() => startSession(null)}
          onBack={backToHome}
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
