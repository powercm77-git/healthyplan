// ExerciseHome.jsx — 운동 탭 홈 (3-1): 오늘의 루틴 요약 + 장소/시간 선택 + 최근 7일 기록
import { useEffect, useState } from 'react'
import { StickFigure } from '../../components/exercise-animations/index.js'
import { estimateExerciseSeconds, calcKcal } from '../../lib/exerciseEngine.js'
import { getRecentExerciseSummary } from '../../lib/db.js'
import { addDays, todayKey, formatDisplay } from '../../lib/date.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

const PLACES = [
  { v: 'home', label: '🏠 집' },
  { v: 'gym', label: '🏋️ 헬스장' },
  { v: 'outdoor-gym', label: '🌳 야외기구' },
  { v: 'outdoor', label: '🏃 야외(걷기·달리기)' },
]
const MINUTES = [10, 20, 30, 45, 60]

export default function ExerciseHome({ day, byId, profile, onPlace, onMinutes, onOpenLibrary, onOpenDetail, onStart }) {
  const [recent, setRecent] = useState([])
  const routine = day.routine.map((id) => byId[id]).filter(Boolean)
  const doneCount = day.routineDone.length

  useEffect(() => {
    const today = todayKey()
    const keys = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)))
    getRecentExerciseSummary(keys).then(setRecent)
  }, [day.exerciseKcal])

  const totalSec = routine.reduce((s, e) => s + estimateExerciseSeconds(e), 0)
  const estMinutes = Math.max(1, Math.round(totalSec / 60))
  const estKcal = routine.reduce((s, e) => s + calcKcal(profile.weight, e.metValue, estimateExerciseSeconds(e)), 0)
  const maxKcal = Math.max(1, ...recent.map((r) => r.kcal))

  return (
    <section className="screen active">
      <p className="eyebrow">오늘의 운동</p>
      <h2 className="ob-title display" style={{ fontSize: '1.5rem', marginBottom: 4 }}>
        따라만 하면 <span className="hl">끝나요</span>
      </h2>
      <p className="ob-sub">장소와 시간을 고르면 루틴이 바로 다시 짜여요.</p>

      <div className="card">
        <p className="eyebrow">오늘의 루틴 · {routine.length}개 동작</p>
        <div className="exo">
          <div className="pic"><StickFigure pose={routine[0]?.animation || 'squat'} size={40} /></div>
          <div>
            <div className="nm">약 {estMinutes}분 · {estKcal}kcal 예상</div>
            <div className="st">{doneCount}/{routine.length}개 완료</div>
          </div>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={onStart} disabled={routine.length === 0}>
          {doneCount > 0 && doneCount < routine.length ? '이어서 시작하기 ▶' : '시작하기 ▶'}
        </button>
      </div>

      <label className="f">장소</label>
      <div className="chips">
        {PLACES.map((p) => (
          <span key={p.v} className={`chip${day.exercisePlace === p.v ? ' on' : ''}`} onClick={() => onPlace(p.v)}>{p.label}</span>
        ))}
      </div>
      <label className="f">시간</label>
      <div className="chips">
        {MINUTES.map((m) => (
          <span key={m} className={`chip${day.exerciseMinutes === m ? ' on' : ''}`} onClick={() => onMinutes(m)}>
            {m >= 60 ? '60분 이상' : `${m}분`}
          </span>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="eyebrow">루틴 미리보기</p>
        {routine.length === 0 && <div className="empty">해당 장소·시간에 맞는 운동을 찾지 못했어요.</div>}
        {routine.map((ex) => (
          <div className="alt" key={ex.id} onClick={() => onOpenDetail(ex.id)}>
            <div className="apic"><StickFigure pose={ex.animation} size={30} /></div>
            <div>
              <div className="anm">{ex.name}{day.routineDone.includes(ex.id) ? ' ✔' : ''}</div>
              <div className="why">{ex.bodyParts.join(' · ')}</div>
            </div>
          </div>
        ))}
      </div>

      <button className="addfood" onClick={onOpenLibrary}>+ 운동 찾아보기</button>

      <div className="card" style={{ marginTop: 14 }}>
        <p className="eyebrow">최근 7일</p>
        <div className="recordstrip">
          {recent.map((r) => (
            <div className="recordday" key={r.date} title={`${formatDisplay(r.date)} · ${r.kcal}kcal`}>
              <div className="rbar" style={{ height: `${Math.max(6, (r.kcal / maxKcal) * 48)}px` }} />
              <div className="rlbl">{weekdayOf(r.date)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
