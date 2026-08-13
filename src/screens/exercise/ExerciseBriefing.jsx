// ExerciseBriefing.jsx — 운동 실행 전 1화면 브리핑(3-5): 오늘 할 운동 전체·예상 시간·칼로리·준비물
import { estimateExerciseSeconds, calcKcal } from '../../lib/exerciseEngine.js'

export default function ExerciseBriefing({ routineIds, byId, profile, onStart, onBack }) {
  const list = routineIds.map((id) => byId[id]).filter(Boolean)
  const totalSec = list.reduce((s, e) => s + estimateExerciseSeconds(e), 0)
  const totalKcal = Math.round(list.reduce((s, e) => s + calcKcal(profile.weight, e.metValue, estimateExerciseSeconds(e)), 0))
  const equipment = [...new Set(list.map((e) => e.equipment).filter((eq) => eq && eq !== '없음'))]

  return (
    <section className="screen active">
      <p className="eyebrow">오늘의 운동</p>
      <h2 className="ob-title display" style={{ fontSize: '1.4rem' }}>이렇게 진행할게요</h2>

      <div className="card">
        <p className="eyebrow">순서 · {list.length}개</p>
        {list.map((e, i) => (
          <div key={`${e.id}-${i}`} className="briefrow">
            <span className="briefidx">{i + 1}</span>
            <span className="briefname">{e.name}</span>
            <span className="briefspec">{e.defaultSets}세트 × {e.defaultReps}{e.repType === 'sec' ? '초' : '회'}</span>
          </div>
        ))}
      </div>

      <div className="macros">
        <div className="macro"><div className="name">예상 시간</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{Math.max(1, Math.round(totalSec / 60))}분</b></div></div>
        <div className="macro"><div className="name">예상 칼로리</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{totalKcal}kcal</b></div></div>
        <div className="macro"><div className="name">운동 수</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{list.length}개</b></div></div>
      </div>

      <div className="formnote">
        <b>준비물</b> — {equipment.length > 0 ? equipment.join(', ') : '맨몸으로 충분해요'}
      </div>

      <div style={{ flex: 1, minHeight: 12 }} />
      <button className="btn" onClick={onStart}>시작하기 ▶</button>
      <button className="swapbtn" style={{ marginTop: 10, width: '100%' }} onClick={onBack}>취소</button>
    </section>
  )
}
