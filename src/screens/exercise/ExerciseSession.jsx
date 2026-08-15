// ExerciseSession.jsx — 운동 실행 화면 (3-4): 세트/휴식 자동 타이머, 음성 안내, Wake Lock, 교체·건너뛰기
import { useEffect, useMemo, useRef, useState } from 'react'
import { StickFigure, POSE_KEYS } from '../../components/exercise-animations/index.js'
import ExerciseVideoPlayer from '../../components/ExerciseVideoPlayer.jsx'
import { suggestProgress, calcKcal, withOverride, estimateExerciseSeconds } from '../../lib/exerciseEngine.js'
import { formatKcal, formatKcalLive } from '../../lib/calories.js'
import { describeKcalAsFood } from '../../lib/foodEquivalent.js'
import { compareExercises } from '../../lib/compareExercises.js'
import { addExerciseLog, bumpExerciseCompleted, bumpExerciseSwapped, getDay, setDay as dbSetDay, getLastExerciseLog } from '../../lib/db.js'
import { useFeedback } from '../../components/Feedback.jsx'
import { useCountUp } from '../../lib/useCountUp.js'

const REASONS = [
  { v: '통증', label: '아파요' },
  { v: '장비없음', label: '장비가 없어요' },
  { v: '소음', label: '소음이 걱정돼요' },
  { v: '기타', label: '그냥 바꿀래요' },
]

function speak(text, muted) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    u.rate = 1.05
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { /* 음성 미지원 환경은 조용히 무시 */ }
}
function vibrate(pattern) { try { navigator.vibrate?.(pattern) } catch { /* 무시 */ } }
const KO_COUNT = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '열하나', '열둘', '열셋', '열넷', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스물']
function koCount(n) { return KO_COUNT[n] || String(n) }
function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
// 지난 기록에서 비교 기준값을 뽑는다: 시간형·유지형은 세트당 평균 시간(초), 횟수형은 세트당 평균 횟수.
// 기록이 없거나 비교할 값이 없으면 null("첫 도전").
function priorMetricFromLog(log, isTimeBased) {
  const sets = log?.sets || []
  if (sets.length === 0) return null
  if (isTimeBased) {
    const avg = sets.reduce((s, v) => s + (v.durationSec || 0), 0) / sets.length
    return Math.round(avg)
  }
  const withReps = sets.filter((v) => v.reps != null)
  if (withReps.length === 0) return null
  return Math.round(withReps.reduce((s, v) => s + v.reps, 0) / withReps.length)
}

function pacerSubPhase(elapsed, tempo) {
  const { down, hold, up, cue } = tempo
  const cycle = down + hold + up
  if (cycle <= 0) return null
  const pos = elapsed % cycle
  if (pos < down) return { label: cue[0], remaining: down - pos, total: down || 1 }
  if (pos < down + hold) return { label: cue[1], remaining: down + hold - pos, total: hold || 1 }
  return { label: cue[2], remaining: cycle - pos, total: up || 1 }
}

export default function ExerciseSession({ exerciseIds: initialIds, startIndex, byId, profile, meta, today, routineOverrides, onFinish }) {
  const { toast, burst } = useFeedback()
  const [ids, setIds] = useState(initialIds)
  const [idx, setIdx] = useState(startIndex)
  const [curSet, setCurSet] = useState(1)
  const [phase, setPhase] = useState('work') // work | rest | summary
  const [phaseStart, setPhaseStart] = useState(Date.now())
  const [pauseAccum, setPauseAccum] = useState(0)
  const [pausedAt, setPausedAt] = useState(null)
  const [muted, setMuted] = useState(false)
  const [tick, setTick] = useState(0)
  const [swapOpen, setSwapOpen] = useState(false)
  const [wakeLockOk, setWakeLockOk] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState(null)
  const [repCount, setRepCount] = useState(0)
  const [repOffset, setRepOffset] = useState(0) // 페이서 자동 카운트에 대한 수동 보정(+/-)
  const [showVideo, setShowVideo] = useState(false)
  const [pacerOn, setPacerOn] = useState(true)
  const [kcalTick, setKcalTick] = useState(0) // 실시간 칼로리 갱신용 — 1초 간격으로만 재계산(§3: 매 프레임 금지)
  const [historyNote, setHistoryNote] = useState('')
  const [priorMetric, setPriorMetric] = useState(null)
  const [stepsExpanded, setStepsExpanded] = useState(false) // 운동방법 단계 카드를 눌러 전체 순서 펼치기

  const sessionStartRef = useRef(Date.now())
  const logRef = useRef([]) // 완료된 운동별 기록
  const currentSetsRef = useRef([]) // 이번 운동에서 세트별 소요 시간(초)
  const announcedRef = useRef(new Set()) // 이번 phase에서 이미 안내한 문구(10초 남음 등) 중복 방지
  const lastAnnouncedRepRef = useRef(0) // 음성 카운트 중복 방지

  const ex = withOverride(byId[ids[idx]], routineOverrides?.[ids[idx]])
  const exMeta = meta?.get(ex?.id)
  const progress = useMemo(() => (ex ? suggestProgress(ex, exMeta) : null), [ex, exMeta])
  const totalSets = ex?.defaultSets || 1
  const videos = ex ? (ex.videos || []) : []
  const hasVideo = videos.length > 0
  const hasAnim = ex ? POSE_KEYS.includes(ex.animation) : false
  const workTarget = ex ? (progress?.type === 'reps' ? progress.reps : ex.defaultReps) : null
  const isTimeBased = ex && (ex.repType === 'sec' || ex.repType === 'hold')
  const workTargetSec = isTimeBased ? workTarget : null
  const workTargetReps = ex && !isTimeBased ? workTarget : null
  const cycleLen = ex?.tempo ? ex.tempo.down + ex.tempo.hold + ex.tempo.up : 0

  // 1-1/1-2/1-3: 실시간 칼로리·음식 환산·남은 시간. kcalTick(1초)과 phase/curSet/idx 같은
  // 이산적 변화에만 반응해 재계산한다 — 매 프레임(250ms 틱) 재계산은 §3에서 금지.
  const perSetSec = ex ? (isTimeBased ? (workTargetSec ?? ex.defaultReps) : (workTargetReps || ex.defaultReps) * 3) : 0
  const { liveKcal, remainingMinutes, progressPct } = useMemo(() => {
    if (!ex) return { liveKcal: 0, remainingMinutes: 0, progressPct: 0 }
    const nowEl = elapsedInPhase()
    const curExerciseSec =
      currentSetsRef.current.reduce((s, v) => s + v.durationSec, 0) +
      ex.restSec * Math.max(currentSetsRef.current.length - 1, 0) +
      (phase === 'work' ? nowEl : 0) +
      (phase === 'rest' && currentSetsRef.current.length > 0 && currentSetsRef.current.length < totalSets ? Math.min(nowEl, ex.restSec) : 0)
    const completedKcal = logRef.current.reduce((s, e) => s + e.kcal, 0)
    const kcalNow = completedKcal + calcKcal(profile.weight, ex.metValue, curExerciseSec)

    const setsLeftInCurrent = Math.max(totalSets - curSet, 0)
    const curPhaseRemaining = phase === 'work'
      ? Math.max(0, (workTargetSec != null ? workTargetSec - nowEl : perSetSec))
      : Math.max(0, ex.restSec - nowEl)
    let remainingSec = setsLeftInCurrent * (perSetSec + ex.restSec) + curPhaseRemaining
    for (let i = idx + 1; i < ids.length; i++) {
      const nextEx = withOverride(byId[ids[i]], routineOverrides?.[ids[i]])
      if (nextEx) remainingSec += estimateExerciseSeconds(nextEx)
    }
    return {
      liveKcal: kcalNow,
      remainingMinutes: Math.max(1, Math.round(remainingSec / 60)),
      progressPct: Math.min(100, Math.round(((idx + Math.min(curSet / totalSets, 1)) / ids.length) * 100)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kcalTick, idx, curSet, phase, ex?.id, totalSets])
  // useCountUp은 훅이라 summary 화면의 이른 return보다 앞에서 조건 없이 호출해야 한다
  // (Rules of Hooks) — summary에서는 값만 안 쓰일 뿐 호출 자체는 항상 일어난다.
  const liveKcalDisplay = useCountUp(liveKcal)
  const foodLine = describeKcalAsFood(liveKcalDisplay)

  // ── Wake Lock ──
  useEffect(() => {
    let lock = null
    if (!('wakeLock' in navigator)) { setWakeLockOk(false); return }
    navigator.wakeLock.request('screen').then((l) => { lock = l }).catch(() => setWakeLockOk(false))
    return () => { lock?.release().catch(() => {}) }
  }, [])

  // ── 타이머 틱(Date.now() 기준 재계산 — setInterval 누적오차 없음) ──
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [])

  // 실시간 칼로리는 1초 간격으로만 재계산한다(§3 성능 요건). 세트 완료 등 상태 변화는
  // idx/curSet/phase가 바뀌므로 liveKcal 계산에서 그 값들을 함께 참조해 즉시 반영된다.
  useEffect(() => {
    const id = setInterval(() => setKcalTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // 운동이 바뀔 때마다 지난 기록을 조회한다(§1-4). 과거보다 못해도 비난하지 않는다 — 조회 결과는
  // "지난번엔 N이었어요" 같은 중립적 사실만 보여주고, 나쁘다는 판단은 하지 않는다.
  useEffect(() => {
    let cancelled = false
    setHistoryNote('')
    setPriorMetric(null)
    if (!ex) return undefined
    getLastExerciseLog(ex.id, today).then((log) => {
      if (cancelled) return
      const metric = priorMetricFromLog(log, isTimeBased)
      setPriorMetric(metric)
      const doneBefore = exMeta?.completedCount || 0
      if (!log) {
        setHistoryNote(doneBefore > 0 ? `이 운동 ${doneBefore + 1}번째예요` : '첫 도전이에요!')
      } else {
        const unit = isTimeBased ? '초' : '회'
        const ordinal = doneBefore > 0 ? ` · 이 운동 ${doneBefore + 1}번째예요` : ''
        setHistoryNote(`지난번엔 세트당 ${metric}${unit}였어요${ordinal}`)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex?.id])

  useEffect(() => {
    announcedRef.current = new Set()
    setRepCount(0)
    setRepOffset(0)
    setShowVideo(false)
    setStepsExpanded(false)
  }, [phase, idx, curSet])

  function elapsedInPhase() {
    if (pausedAt) return (pausedAt - phaseStart - pauseAccum) / 1000
    return (Date.now() - phaseStart - pauseAccum) / 1000
  }

  function goPhase(next, opts = {}) {
    setPhase(next)
    setPhaseStart(Date.now())
    setPauseAccum(0)
    setPausedAt(null)
    if (opts.announce) speak(opts.announce, muted)
    if (opts.vibrate) vibrate(opts.vibrate)
  }

  function finishExerciseLog() {
    if (currentSetsRef.current.length === 0) return
    const sets = currentSetsRef.current
    const totalSec = sets.reduce((s, v) => s + v.durationSec, 0) + ex.restSec * Math.max(sets.length - 1, 0)
    const kcal = calcKcal(profile.weight, ex.metValue, totalSec)
    logRef.current.push({
      exerciseId: ex.id, exerciseName: ex.name, sets,
      restSec: ex.restSec, totalSec, kcal, fullyCompleted: sets.length >= totalSets,
    })
    currentSetsRef.current = []
  }

  // 지난 기록과 비교해 알려준다(§1-4). 나아졌을 때만 말하고, 못했을 때는 조용히 넘어간다 — 비난 금지(§2-3).
  function announceGrowth(todayValue) {
    if (todayValue == null || priorMetric == null) return
    const unit = isTimeBased ? '초' : '회'
    const diff = todayValue - priorMetric
    if (diff > 0) toast(`지난번보다 ${diff}${unit} 더 하고 계세요!`)
    else if (diff === 0) toast('지난번만큼 하고 있어요, 좋아요!')
  }

  function handleSetComplete() {
    const setSec = elapsedInPhase()
    const reps = workTargetReps != null ? repCount : null
    currentSetsRef.current.push({ durationSec: Math.round(setSec), reps })
    announceGrowth(isTimeBased ? Math.round(setSec) : reps)
    if (curSet < totalSets) {
      goPhase('rest', { announce: `잘하셨어요. ${ex.restSec}초 쉬겠습니다`, vibrate: 150 })
    } else {
      finishExerciseLog()
      advanceExercise()
    }
  }

  function advanceExercise() {
    if (idx < ids.length - 1) {
      goPhase('rest', { announce: '다음 운동까지 휴식', vibrate: 150 })
    } else {
      goToSummary()
    }
  }

  function handleRestComplete() {
    if (phase !== 'rest') return
    if (currentSetsRef.current.length > 0 && currentSetsRef.current.length < totalSets) {
      // 같은 운동의 다음 세트
      setCurSet((c) => c + 1)
      goPhase('work', { announce: '3, 2, 1, 시작', vibrate: 100 })
    } else {
      const nextIdx = idx + 1
      setIdx(nextIdx)
      setCurSet(1)
      currentSetsRef.current = []
      const nextEx = byId[ids[nextIdx]]
      goPhase('work', { announce: `${nextEx.name}. 3, 2, 1, 시작`, vibrate: 100 })
    }
  }

  // 자동 타이머: 시간형 세트/휴식은 0초가 되면 자동 진행 + 10초 남음 음성 안내
  useEffect(() => {
    if (pausedAt || phase === 'summary' || !ex) return
    const el = elapsedInPhase()
    if (phase === 'work' && workTargetSec != null) {
      const remaining = workTargetSec - el
      if (remaining <= 10 && remaining > 9 && !announcedRef.current.has('warn')) {
        announcedRef.current.add('warn'); speak('10초 남았습니다', muted)
      }
      if (remaining <= 0) handleSetComplete()
    } else if (phase === 'rest') {
      const remaining = ex.restSec - el
      if (remaining <= 10 && remaining > 9 && ex.restSec > 15 && !announcedRef.current.has('warn')) {
        announcedRef.current.add('warn'); speak('10초 후 시작합니다', muted)
      }
      if (remaining <= 0) handleRestComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pausedAt, phase])

  // 템포 페이서: 켜져 있으면 동작 주기(down+hold+up)가 끝날 때마다 자동으로 횟수를 센다
  useEffect(() => {
    if (pausedAt || phase !== 'work' || !pacerOn || cycleLen <= 0 || workTargetReps == null) return
    const autoCount = Math.max(0, Math.floor(elapsedInPhase() / cycleLen) + repOffset)
    setRepCount((c) => (c === autoCount ? c : autoCount))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pausedAt, phase, pacerOn, cycleLen, repOffset])

  // 음성 카운트: 자동(페이서)이든 탭이든 repCount가 바뀌면 하나·둘·셋… 안내
  useEffect(() => {
    if (phase !== 'work' || workTargetReps == null) { lastAnnouncedRepRef.current = 0; return }
    if (repCount === 0 || repCount === lastAnnouncedRepRef.current) return
    lastAnnouncedRepRef.current = repCount
    const remaining = workTargetReps - repCount
    if (remaining === 1) speak('마지막 하나!', muted)
    else if (remaining === 2) speak('두 개 남았습니다', muted)
    else speak(koCount(repCount), muted)
  }, [repCount, phase, workTargetReps, muted])

  function togglePause() {
    if (pausedAt) {
      setPauseAccum((p) => p + (Date.now() - pausedAt))
      setPausedAt(null)
    } else {
      setPausedAt(Date.now())
    }
  }

  function handleSkip() {
    finishExerciseLog()
    advanceExercise()
  }

  async function goToSummary() {
    finishExerciseLog()
    setPhase('summary')
    setSaving(true)
    const entries = logRef.current
    const totalSessionSec = Math.round((Date.now() - sessionStartRef.current) / 1000)
    const totalKcal = entries.reduce((s, e) => s + e.kcal, 0)
    const totalSetsCount = entries.reduce((s, e) => s + e.sets.length, 0)
    try {
      for (const entry of entries) {
        await addExerciseLog({ date: today, ...entry })
        if (entry.fullyCompleted) await bumpExerciseCompleted(entry.exerciseId, today)
      }
      const cur = await getDay(today)
      const fullyCompletedIds = entries.filter((e) => e.fullyCompleted).map((e) => e.exerciseId)
      await dbSetDay(today, {
        routineDone: [...new Set([...cur.routineDone, ...fullyCompletedIds])],
        exerciseKcal: cur.exerciseKcal + totalKcal,
      })
    } finally {
      setSaving(false)
    }
    setSummary({ totalSessionSec, totalKcal, totalSetsCount, exerciseCount: entries.length })
    burst(28)
    speak('수고하셨습니다!', muted)
  }

  async function handleEndEarly() {
    if (phase === 'summary') return
    await goToSummary()
  }

  async function handleSwap(newId, reasonLabel) {
    await bumpExerciseSwapped(ex.id)
    setIds((prev) => prev.map((id, i) => (i === idx ? newId : id)))
    const cur = await getDay(today)
    if (cur.routine.includes(ex.id)) {
      await dbSetDay(today, { routine: cur.routine.map((id) => (id === ex.id ? newId : id)) })
    }
    setSwapOpen(false)
    toast(`잘 골랐어요! ${byId[newId].name}(으)로 바꿨어요 (${reasonLabel})`)
    currentSetsRef.current = []
    setCurSet(1)
    goPhase('work', { announce: `${byId[newId].name} 시작` })
  }

  if (!ex && phase !== 'summary') return null

  if (phase === 'summary') {
    return (
      <section className="screen active">
        <p className="eyebrow">운동 완료</p>
        <h2 className="ob-title display" style={{ fontSize: '1.6rem' }}>오늘도 <span className="hl">해냈어요!</span> 🏅</h2>
        <div className="result-card">
          <div className="result-in">
            {summary ? (
              <>
                <p className="eyebrow">총 운동 시간</p>
                <div className="result-num display">{fmtTime(summary.totalSessionSec)}</div>
                <div className="macros" style={{ marginTop: 16 }}>
                  <div className="macro"><div className="name">완료 세트</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{summary.totalSetsCount}세트</b></div></div>
                  <div className="macro"><div className="name">완료 운동</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{summary.exerciseCount}개</b></div></div>
                  <div className="macro"><div className="name">소모 칼로리</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{formatKcal(summary.totalKcal)}</b></div></div>
                </div>
                {summary.totalKcal > 0 && describeKcalAsFood(summary.totalKcal) && (
                  <p className="foodline" style={{ marginTop: 10 }}>{describeKcalAsFood(summary.totalKcal)}</p>
                )}
              </>
            ) : <p style={{ padding: 20, textAlign: 'center', color: 'var(--sub)' }}>{saving ? '저장하는 중...' : ''}</p>}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 20 }} />
        <button className="btn" disabled={saving} onClick={onFinish}>홈으로 돌아가기</button>
      </section>
    )
  }

  const el = elapsedInPhase()
  const workRemaining = workTargetSec != null ? Math.max(0, workTargetSec - el) : null
  const restRemaining = phase === 'rest' ? Math.max(0, ex.restSec - el) : null
  const nextUpLabel = phase === 'rest'
    ? (currentSetsRef.current.length < totalSets ? `${curSet + 1}세트` : (idx < ids.length - 1 ? byId[ids[idx + 1]]?.name : '운동 완료'))
    : null
  const pacerActive = phase === 'work' && pacerOn && ex.tempo && workTargetReps != null
  const pacerSub = pacerActive ? pacerSubPhase(el, ex.tempo) : null

  // 운동방법: 목록을 전부 펼쳐 스크롤하던 방식 대신 현재 단계 하나만 크게 보여주고, 경과
  // 시간에 맞춰 자동으로 다음 단계로 넘어간다(§1). 시간형은 목표 시간을 단계 수만큼 나누고,
  // 횟수형은 목표 시간을 몰라 4초 간격으로 순환한다 — 마지막 단계에서 멈춰 있는다.
  const stepList = ex.howto?.length > 0 ? [...ex.howto, ex.breathing].filter(Boolean) : []
  const stepDurationSec = workTargetSec != null ? Math.max(2, workTargetSec / stepList.length) : 4
  const stepIndex = stepList.length > 0 ? Math.min(stepList.length - 1, Math.floor(el / stepDurationSec)) : 0

  return (
    <section className="screen active sessionscreen">
      <div className="sessionprogress">
        <div className="toprow">
          <span>오늘 운동 {idx + 1}/{ids.length} · 남은 시간 약 {remainingMinutes}분</span>
        </div>
        <div className="bar"><i style={{ width: `${progressPct}%` }} /></div>
      </div>

      <div className="sessionhead">
        <span>총 {fmtTime((Date.now() - sessionStartRef.current - 0) / 1000)}</span>
        <button className="mutebtn" onClick={() => setMuted((m) => !m)} aria-label="음소거">{muted ? '🔇' : '🔊'}</button>
      </div>

      <div className="livekcal">
        <div className="num">현재까지 <b>{formatKcalLive(liveKcalDisplay)}</b></div>
      </div>
      {foodLine && <p className="foodline">{foodLine}</p>}

      {hasVideo && (showVideo || !hasAnim) ? (
        <ExerciseVideoPlayer
          videos={videos} size="small"
          onFail={() => setShowVideo(false)}
          failFallbackText={hasAnim ? '영상을 불러오지 못했어요. 애니메이션으로 볼게요.' : '영상을 불러오지 못했어요. 아래 글 설명을 참고해주세요.'}
        />
      ) : hasAnim ? (
        <div className="detail-anim">
          <StickFigure pose={ex.animation} size={120} tempoSec={pacerActive ? cycleLen : undefined} highlightParts={ex.bodyParts} showDirection />
        </div>
      ) : null}
      {hasVideo && hasAnim ? (
        <div style={{ textAlign: 'center', marginTop: -4, marginBottom: 6 }}>
          <button type="button" className="videotogglebtn" onClick={() => setShowVideo((v) => !v)}>
            {showVideo ? '애니메이션 보기' : '▶ 영상'}
          </button>
        </div>
      ) : !hasVideo && !hasAnim ? (
        <p className="novideo-hint">그림과 영상이 없는 운동이에요. 아래 글 설명을 참고하세요</p>
      ) : null}

      {pacerSub && (
        <div className="pacerbox">
          <div className="pacerlabel">{pacerSub.label} <span>({Math.ceil(pacerSub.remaining)}초)</span></div>
          <div className="pacerbar"><i style={{ width: `${Math.min(100, ((pacerSub.total - pacerSub.remaining) / pacerSub.total) * 100)}%` }} /></div>
          <button type="button" className="pacertoggle" onClick={() => setPacerOn(false)}>자기 속도로 하기</button>
        </div>
      )}
      {phase === 'work' && ex.tempo && workTargetReps != null && !pacerOn && (
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <button type="button" className="pacertoggle" onClick={() => setPacerOn(true)}>페이서 켜기</button>
        </div>
      )}

      <p style={{ textAlign: 'center', fontWeight: 900, fontSize: '1rem', marginTop: 2 }}>{ex.name}</p>
      {historyNote && <p className="historynote">{historyNote}</p>}

      {phase === 'work' && ex.mistakes?.length > 0 && (
        <div className={`worknotice${el < 3 ? ' worknotice-big' : ''}`}>
          {el < 3 ? ex.mistakes[0] : ex.mistakes[Math.floor(el / 5) % ex.mistakes.length]}
        </div>
      )}

      {phase === 'work' && stepList.length > 0 && (
        <div className="stepcard" onClick={() => setStepsExpanded((v) => !v)} role="button" tabIndex={0}>
          {!stepsExpanded ? (
            <>
              <div className="stepline cur">
                <span className={`stepnum${stepIndex === stepList.length - 1 && ex.breathing ? ' breath' : ''}`}>
                  {stepIndex === stepList.length - 1 && ex.breathing ? '♦' : stepIndex + 1}
                </span>
                <span>{stepList[stepIndex]}</span>
              </div>
              {stepList.length > 1 && (
                <div className="stepdots">
                  {stepList.map((_, i) => <i key={i} className={i === stepIndex ? 'on' : ''} />)}
                </div>
              )}
              <div className="stepcard-hint">전체 순서 보기 ▾</div>
            </>
          ) : (
            <>
              <div className="stepcard-full">
                {stepList.map((step, i) => {
                  const isBreath = i === stepList.length - 1 && ex.breathing
                  return (
                    <div className={`stepline${i === stepIndex ? ' cur' : ''}`} key={i}>
                      <span className={`stepnum${isBreath ? ' breath' : ''}`}>{isBreath ? '♦' : i + 1}</span>
                      <span>{step}</span>
                    </div>
                  )
                })}
              </div>
              <div className="stepcard-hint">접기 ▴</div>
            </>
          )}
        </div>
      )}

      <div className="counter">
        {curSet} / {totalSets}세트
        {phase === 'work' && workTargetReps != null && <> · 목표 <b>{workTargetReps}회</b></>}
        {phase === 'rest' && <> · 다음: {nextUpLabel}</>}
      </div>

      {phase === 'work' && workTargetReps != null && (
        <div className="repcounter">
          <button type="button" onClick={() => (pacerOn ? setRepOffset((o) => o - 1) : setRepCount((c) => Math.max(0, c - 1)))} aria-label="횟수 줄이기">−</button>
          <div className={`repnum${repCount >= workTargetReps ? ' reached' : ''}`}>
            {repCount}<span> / {workTargetReps}회</span>
          </div>
          <button type="button" onClick={() => (pacerOn ? setRepOffset((o) => o + 1) : setRepCount((c) => c + 1))} aria-label="횟수 늘리기">+</button>
        </div>
      )}

      <div className="timerbig display">
        {phase === 'rest' ? fmtTime(restRemaining) : (workTargetSec != null ? fmtTime(workRemaining) : fmtTime(el))}
      </div>
      <div className="lbl" style={{ textAlign: 'center', color: 'var(--sub)', marginTop: -4, marginBottom: 4 }}>
        {phase === 'rest' ? '휴식 중' : (workTargetSec != null ? '남은 시간' : '경과 시간')}
      </div>

      {!wakeLockOk && (
        <p style={{ fontSize: '.75rem', color: 'var(--sub)', textAlign: 'center', marginBottom: 8 }}>
          이 기기는 화면 자동 꺼짐 방지가 지원되지 않아요. 설정에서 화면 시간을 늘려두면 편해요.
        </p>
      )}

      {phase === 'work' && workTargetSec == null && (
        <button className="btn" onClick={handleSetComplete}>
          {workTargetReps != null ? `${workTargetReps}회를 마쳤으면 눌러주세요 ✔` : '세트 완료 ✔'}
        </button>
      )}

      <div className="row2" style={{ marginTop: 8 }}>
        <button className="swapbtn" onClick={togglePause}>{pausedAt ? '▶ 계속' : '⏸ 일시정지'}</button>
        <button className="swapbtn" onClick={handleSkip}>건너뛰기 ⏭</button>
      </div>
      <div className="row2" style={{ marginTop: 6 }}>
        <button className="swapbtn" onClick={() => setSwapOpen((v) => !v)}>바꾸기 ⇄</button>
        <button className="swapbtn" onClick={handleEndEarly}>종료</button>
      </div>

      {swapOpen && (
        <div className="swap-panel open">
          <p className="q">이 운동이 어렵거나 불편하다면, 이유를 알려주시면 같은 효과의 다른 운동으로 바꿔드려요.</p>
          {(ex.alternatives || []).map((altId) => {
            const alt = byId[altId]
            if (!alt) return null
            const why = compareExercises(ex, alt)
            return (
              <div key={altId}>
                <div className="alt" onClick={() => handleSwap(altId, '기타')}>
                  <div className="apic"><StickFigure pose={alt.animation} size={30} /></div>
                  <div>
                    <div className="anm">{alt.name}</div>
                    {why.length > 0 && <div className="why">{why.join(' · ')}</div>}
                  </div>
                </div>
              </div>
            )
          })}
          <div className="chips" style={{ marginTop: 10 }}>
            {REASONS.map((r) => (
              <span key={r.v} className="chip" onClick={() => ex.alternatives?.[0] && handleSwap(ex.alternatives[0], r.label)}>{r.label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
