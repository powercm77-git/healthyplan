// Settings.jsx — 프로필·목표 수정 (재계산) + 의료 조언 아님 면책 문구
import { useState } from 'react'
import { calcTargets } from '../lib/tdee.js'
import { useFeedback } from '../components/Feedback.jsx'

const ACT_OPTIONS = [
  { v: '1.2', label: '🪑 거의 앉아서 지내요' },
  { v: '1.375', label: '🚶 가볍게 움직여요' },
  { v: '1.55', label: '🏃 활동이 많아요' },
]
const GOAL_OPTIONS = [
  { v: 'lose', label: '🔥 가볍게 (감량)' },
  { v: 'keep', label: '🌿 든든하게 (유지)' },
  { v: 'gain', label: '💪 단단하게 (증량)' },
]

function Chip({ label, active, onClick }) {
  return <span className={`chip${active ? ' on' : ''}`} onClick={onClick}>{label}</span>
}

export default function Settings({ profile, onSave, onBack }) {
  const { toast } = useFeedback()
  const [sex, setSex] = useState(profile.sex)
  const [age, setAge] = useState(String(profile.age))
  const [height, setHeight] = useState(String(profile.height))
  const [weight, setWeight] = useState(String(profile.weight))
  const [activity, setActivity] = useState(profile.activity)
  const [goal, setGoal] = useState(profile.goal)

  async function save() {
    if (!sex || !age || !height || !weight || !activity || !goal) {
      toast('모든 항목을 입력해주세요'); return
    }
    const draft = { sex, age: +age, height: +height, weight: +weight, activity, goal }
    const plan = calcTargets(draft)
    await onSave({
      ...profile, ...draft,
      target: plan.target, tCarbs: plan.carbs, tProtein: plan.protein, tFat: plan.fat,
    })
    toast('목표가 다시 계산됐어요 ✓')
    onBack()
  }

  return (
    <section className="screen active">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={onBack} aria-label="뒤로"
          style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 12, width: 38, height: 38, color: 'var(--ink)', fontSize: '1.1rem', cursor: 'pointer' }}
        >←</button>
        <h2 className="ob-title display" style={{ fontSize: '1.5rem', marginBottom: 0 }}>설정</h2>
      </div>

      <label className="f">성별</label>
      <div className="chips">
        <Chip label="남성" active={sex === 'm'} onClick={() => setSex('m')} />
        <Chip label="여성" active={sex === 'f'} onClick={() => setSex('f')} />
      </div>
      <div className="row2">
        <div><label className="f">나이</label><input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></div>
        <div><label className="f">키 (cm)</label><input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
      </div>
      <label className="f">체중 (kg)</label>
      <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />

      <label className="f">하루 활동량</label>
      <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {ACT_OPTIONS.map((o) => (
          <Chip key={o.v} label={o.label} active={activity === o.v} onClick={() => setActivity(o.v)} />
        ))}
      </div>

      <label className="f">목표</label>
      <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {GOAL_OPTIONS.map((o) => (
          <Chip key={o.v} label={o.label} active={goal === o.v} onClick={() => setGoal(o.v)} />
        ))}
      </div>

      <div style={{ minHeight: 20 }} />
      <button className="btn" onClick={save}>목표 다시 계산하고 저장</button>

      <p className="disclaimer">
        본 앱의 운동·식단 정보는 일반 가이드이며 의료 조언이 아닙니다. 통증이 있으면 중단하고 전문가와 상담하세요.
      </p>
    </section>
  )
}
