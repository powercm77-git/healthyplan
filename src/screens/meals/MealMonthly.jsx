// MealMonthly.jsx — 월 단위 현황(3단계 §2-3). 편성이 아니라 보기 전용 달력.
import { useEffect, useMemo, useState } from 'react'
import MealSubTabs from './MealSubTabs.jsx'
import { getMealsSummaryForDates } from '../../lib/db.js'
import { monthKeyOf, todayKey, addMonths, formatMonthLabel, monthGridDates, daysInMonth } from '../../lib/date.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function classify(kcal, target) {
  if (kcal == null || kcal === 0) return 'none'
  const ratio = kcal / target
  if (ratio >= 0.9 && ratio <= 1.1) return 'hit'
  if (ratio > 1.1) return 'over'
  return 'under'
}

const STATUS_LABEL = { hit: '목표 달성', over: '목표 초과', under: '목표 미달', none: '기록 없음' }

export default function MealMonthly({ sub, onSubChange, profile }) {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(todayKey()))
  const [summaryByDate, setSummaryByDate] = useState(new Map())

  const gridDates = useMemo(() => monthGridDates(monthKey), [monthKey])
  const monthDates = useMemo(() => daysInMonth(monthKey), [monthKey])

  useEffect(() => {
    getMealsSummaryForDates(gridDates).then((rows) => {
      setSummaryByDate(new Map(rows.map((r) => [r.date, r])))
    })
  }, [gridDates])

  const monthSummary = useMemo(() => {
    const rows = monthDates.map((d) => summaryByDate.get(d)).filter((r) => r && r.count > 0)
    if (rows.length === 0) return { avgKcal: 0, hitRate: 0, recordedDays: 0 }
    const avgKcal = Math.round(rows.reduce((s, r) => s + r.kcal, 0) / rows.length)
    const hit = rows.filter((r) => classify(r.kcal, profile.target) === 'hit').length
    return { avgKcal, hitRate: Math.round((hit / rows.length) * 100), recordedDays: rows.length }
  }, [summaryByDate, monthDates, profile.target])

  const todayK = todayKey()

  return (
    <section className="screen active">
      <MealSubTabs active={sub} onChange={onSubChange} />
      <p className="eyebrow">월간 현황</p>
      <h2 className="ob-title display" style={{ fontSize: '1.5rem', marginBottom: 4 }}>이번 달,<br /><span className="hl">어떻게 가고 있나요</span></h2>

      <div className="datebar">
        <button onClick={() => setMonthKey(addMonths(monthKey, -1))}>◀</button>
        <span className="dt">{formatMonthLabel(monthKey)}</span>
        <button onClick={() => setMonthKey(addMonths(monthKey, 1))}>▶</button>
      </div>

      <div className="card">
        <div className="macros">
          <div className="macro"><div className="name">평균 섭취</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{monthSummary.avgKcal}</b>kcal</div></div>
          <div className="macro"><div className="name">목표 달성률</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{monthSummary.hitRate}%</b></div></div>
          <div className="macro"><div className="name">기록한 날</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{monthSummary.recordedDays}</b>일</div></div>
        </div>
      </div>

      <div className="card">
        <div className="monthgrid monthgrid-head">
          {WEEKDAYS.map((w) => <div key={w} className="monthcell-label">{w}</div>)}
        </div>
        <div className="monthgrid">
          {gridDates.map((date) => {
            const inMonth = monthKeyOf(date) === monthKey
            const row = summaryByDate.get(date)
            const status = inMonth ? classify(row?.kcal, profile.target) : 'none'
            const day = Number(date.slice(8, 10))
            return (
              <div key={date} className={`monthcell${inMonth ? '' : ' dim'}${date === todayK ? ' today' : ''}`} title={STATUS_LABEL[status]}>
                <span className="monthcell-day">{day}</span>
                {inMonth && status !== 'none' && <span className={`monthcell-dot dot-${status}`} />}
              </div>
            )
          })}
        </div>
        <div className="monthlegend">
          <span><i className="dot-hit" /> 목표 달성</span>
          <span><i className="dot-over" /> 초과</span>
          <span><i className="dot-under" /> 미달</span>
        </div>
      </div>
    </section>
  )
}
