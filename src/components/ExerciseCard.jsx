// ExerciseCard.jsx — 오늘의 운동 미리보기 (바꾸기 대안 + 완료 버튼)
import { useState } from 'react'

export default function ExerciseCard({ exercise, byId, done, onSwap, onFinish }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card">
      <p className="eyebrow">오늘의 운동 · 따라만 하세요</p>
      <div className="exo">
        <div className="pic">{exercise.pic}</div>
        <div>
          <div className="nm">{exercise.name}</div>
          <div className="st">{exercise.setDesc}</div>
        </div>
        <button className="swapbtn" onClick={() => setOpen((v) => !v)}>바꾸기 ⇄</button>
      </div>
      <div className="formnote" dangerouslySetInnerHTML={{ __html: exercise.formNote }} />
      <div className={`swap-panel${open ? ' open' : ''}`}>
        <p className="q">이 운동이 어렵다면? 같은 효과의 다른 운동으로 바로 바꿔드려요.</p>
        {exercise.alternatives.map((alt) => {
          const altExo = byId[alt.id]
          if (!altExo) return null
          return (
            <div
              className="alt"
              key={alt.id}
              onClick={() => { onSwap(alt.id); setOpen(false) }}
            >
              <div className="apic">{altExo.pic}</div>
              <div><div className="anm">{altExo.name}</div><div className="why">{alt.why}</div></div>
            </div>
          )
        })}
      </div>
      <button className={`donebtn${done ? ' done' : ''}`} onClick={onFinish}>
        {done ? '오늘 운동 끝! 내일 또 만나요 🏅' : '운동 완료! ✔'}
      </button>
    </div>
  )
}
