// Home.jsx — 홈 대시보드: 에너지 링, 오늘의 운동 요약, 물·체중 위젯
import { useEffect, useRef, useState } from 'react'
import EnergyRing from '../components/EnergyRing.jsx'
import WaterWidget from '../components/WaterWidget.jsx'
import { StickFigure } from '../components/exercise-animations/index.js'
import { useFeedback } from '../components/Feedback.jsx'
import { getMealsByDate, getDay, setDay as dbSetDay, getActiveDates } from '../lib/db.js'
import { calcStreak } from '../lib/streak.js'
import { todayKey } from '../lib/date.js'
import { ensureTodayRoutine } from '../lib/ensureRoutine.js'
import exercises from '../data/exercises.json'

const byId = Object.fromEntries(exercises.map((e) => [e.id, e]))
const GREETING = {
  lose: <>가볍게, <span className="hl">꾸준히!</span></>,
  gain: <>단단하게 <span className="hl">차곡차곡!</span></>,
  keep: <>오늘도 <span className="hl">건강하게!</span></>,
}

export default function Home({ profile, onOpenSettings, onOpenExercise }) {
  const { toast, burst } = useFeedback()
  const today = todayKey()
  const [totals, setTotals] = useState({ eaten: 0, c: 0, p: 0, f: 0 })
  const [day, setDayState] = useState(null)
  const [streak, setStreak] = useState(0)
  const [weightInput, setWeightInput] = useState(false)
  const firedRef = useRef({ milestone50: false, milestone90: false })

  async function load() {
    const [meals, dayRowRaw, activeDates] = await Promise.all([
      getMealsByDate(today), getDay(today), getActiveDates(),
    ])
    const dayRow = await ensureTodayRoutine(profile, today, dayRowRaw)
    const totalsNext = meals.reduce(
      (acc, m) => ({ eaten: acc.eaten + m.kcal, c: acc.c + m.carbs, p: acc.p + m.protein, f: acc.f + m.fat }),
      { eaten: 0, c: 0, p: 0, f: 0 },
    )
    setTotals(totalsNext)
    setDayState(dayRow)
    firedRef.current = { milestone50: dayRow.milestone50, milestone90: dayRow.milestone90 }
    setStreak(calcStreak(activeDates))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!day) return <section className="screen active" />

  const routine = day.routine.map((id) => byId[id]).filter(Boolean)
  const doneCount = day.routineDone.length
  const target = profile.target + day.exerciseKcal

  async function handleMilestone(key) {
    if (firedRef.current[key]) return
    firedRef.current[key] = true
    await dbSetDay(today, { [key]: true })
    burst(18)
  }

  async function handleWater(n) {
    const next = await dbSetDay(today, { water: n })
    setDayState(next)
  }

  async function handleWeight(e) {
    e.preventDefault()
    const v = +new FormData(e.target).get('weight')
    if (!v) return
    const next = await dbSetDay(today, { weight: v })
    setDayState(next)
    setWeightInput(false)
    toast('체중 기록 완료!')
  }

  return (
    <section className="screen active">
      <div className="hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="hi display">{GREETING[profile.goal]}</div>
          <span className="streak">🔥 <span>{streak}</span>일째 이어가는 중</span>
        </div>
        <button
          onClick={onOpenSettings}
          aria-label="설정"
          style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 12, width: 38, height: 38, color: 'var(--sub)', fontSize: '1.1rem', cursor: 'pointer' }}
        >⚙️</button>
      </div>

      <div className="card">
        <EnergyRing
          eaten={totals.eaten}
          target={target}
          carbs={{ val: totals.c, goal: profile.tCarbs }}
          protein={{ val: totals.p, goal: profile.tProtein }}
          fat={{ val: totals.f, goal: profile.tFat }}
          onMilestone={handleMilestone}
        />
      </div>

      <div className="card" onClick={onOpenExercise} style={{ cursor: 'pointer' }}>
        <p className="eyebrow">오늘의 운동 · 따라만 하세요</p>
        <div className="exo">
          <div className="pic"><StickFigure pose={routine[0]?.animation || 'squat'} size={40} /></div>
          <div>
            <div className="nm">{routine.length > 0 ? `${routine.length}개 동작` : '운동을 준비하고 있어요'}</div>
            <div className="st">{doneCount}/{routine.length} 완료{day.exerciseKcal > 0 ? ` · ${day.exerciseKcal}kcal 소모` : ''}</div>
          </div>
          <button className="swapbtn" onClick={(e) => { e.stopPropagation(); onOpenExercise() }}>
            {doneCount > 0 ? '이어하기 ▶' : '시작하기 ▶'}
          </button>
        </div>
      </div>

      <div className="widgets">
        <WaterWidget value={day.water} onChange={handleWater} />
        <div className="widget">
          <div className="t">⚖️ 체중</div>
          {weightInput ? (
            <form onSubmit={handleWeight}>
              <input
                name="weight" type="number" inputMode="decimal" autoFocus placeholder={String(profile.weight)}
                style={{ marginTop: 6, padding: 8, fontSize: '.95rem' }}
                onBlur={(e) => e.target.form.requestSubmit()}
              />
            </form>
          ) : (
            <div className="v display" onClick={() => setWeightInput(true)} style={{ cursor: 'pointer' }}>
              {day.weight ?? '—'}{day.weight ? ' kg' : ''}
            </div>
          )}
          <div style={{ fontSize: '.78rem', color: 'var(--sub)', marginTop: 10 }}>
            {weightInput ? '입력 후 엔터' : '탭해서 오늘 체중 기록'}
          </div>
        </div>
      </div>
    </section>
  )
}
