// Settings.jsx — 프로필·목표 수정 (재계산) + 의료 조언 아님 면책 문구
import { useState } from 'react'
import { calcTargets } from '../lib/tdee.js'
import { useFeedback } from '../components/Feedback.jsx'
import { MEAL_TYPES, DEFAULT_MEAL_SETTINGS } from '../lib/mealPlanner.js'

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

export default function Settings({ profile, onSave, onUpdateProfile, onBack }) {
  const { toast } = useFeedback()
  const [sex, setSex] = useState(profile.sex)
  const [age, setAge] = useState(String(profile.age))
  const [height, setHeight] = useState(String(profile.height))
  const [weight, setWeight] = useState(String(profile.weight))
  const [activity, setActivity] = useState(profile.activity)
  const [goal, setGoal] = useState(profile.goal)
  const [preferVideoOnly, setPreferVideoOnly] = useState(profile.preferVideoOnly !== false)
  const [avoidFoods, setAvoidFoods] = useState(profile.avoidFoods || [])
  const [avoidInput, setAvoidInput] = useState('')
  const [mealSettings, setMealSettings] = useState(profile.mealSettings || DEFAULT_MEAL_SETTINGS)

  async function togglePreferVideoOnly() {
    const next = !preferVideoOnly
    setPreferVideoOnly(next)
    await onUpdateProfile?.({ preferVideoOnly: next })
  }

  // 기피 음식(3단계 §2-1): 온보딩 당시엔 받지 않았던 값이라 여기서 나중에 채울 수 있게 했다.
  // 자동 식단 편성에서 이 단어가 이름에 들어간 음식을 뺀다(부분 일치 — "새우"를 넣으면
  // "새우볶음밥"도 함께 빠진다).
  async function addAvoidFood() {
    const term = avoidInput.trim()
    setAvoidInput('')
    if (!term || avoidFoods.includes(term)) return
    const next = [...avoidFoods, term]
    setAvoidFoods(next)
    await onUpdateProfile?.({ avoidFoods: next })
  }
  async function removeAvoidFood(term) {
    const next = avoidFoods.filter((t) => t !== term)
    setAvoidFoods(next)
    await onUpdateProfile?.({ avoidFoods: next })
  }

  // 끼니별 자동 편성 설정(3단계 §1-2): 급식처럼 직접 정할 수 없는 끼니는 자동 편성에서
  // 빼고, 평균 칼로리만 하루 총량 계산에 더한다.
  async function toggleMealEditable(meal) {
    const cur = mealSettings[meal] || DEFAULT_MEAL_SETTINGS[meal]
    const next = { ...mealSettings, [meal]: { ...cur, editable: !cur.editable } }
    setMealSettings(next)
    await onUpdateProfile?.({ mealSettings: next })
  }
  async function setMealFixedKcal(meal, value) {
    const cur = mealSettings[meal] || DEFAULT_MEAL_SETTINGS[meal]
    const next = { ...mealSettings, [meal]: { ...cur, fixedKcal: value } }
    setMealSettings(next)
    await onUpdateProfile?.({ mealSettings: next })
  }

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

      <label className="f">운동 추천</label>
      <div className="chips">
        <span className={`chip${preferVideoOnly ? ' on' : ''}`} onClick={togglePreferVideoOnly}>
          {preferVideoOnly ? '✓ ' : ''}▶ 영상 있는 운동만 추천받기
        </span>
      </div>

      <label className="f">기피 음식 (알레르기 등)</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text" placeholder="예: 새우, 땅콩" value={avoidInput}
          onChange={(e) => setAvoidInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAvoidFood() } }}
        />
        <button type="button" className="swapbtn" style={{ flexShrink: 0 }} onClick={addAvoidFood}>추가</button>
      </div>
      {avoidFoods.length > 0 && (
        <div className="chips" style={{ marginTop: 9 }}>
          {avoidFoods.map((t) => (
            <span key={t} className="chip on" onClick={() => removeAvoidFood(t)}>{t} ✕</span>
          ))}
        </div>
      )}
      <p style={{ fontSize: '.78rem', color: 'var(--sub)', marginTop: 6 }}>자동 식단 편성에서 이 단어가 들어간 음식은 빼드려요.</p>

      <label className="f">끼니별 자동 편성</label>
      <p style={{ fontSize: '.82rem', color: 'var(--sub)', marginBottom: 9, lineHeight: 1.5 }}>
        급식처럼 직접 정할 수 없는 끼니는 꺼두세요. 대략의 칼로리만 하루 총량에 반영돼요.
      </p>
      {MEAL_TYPES.map((meal) => {
        const s = mealSettings[meal] || DEFAULT_MEAL_SETTINGS[meal]
        return (
          <div key={meal} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
            <span className={`chip${s.editable ? ' on' : ''}`} style={{ flexShrink: 0 }} onClick={() => toggleMealEditable(meal)}>
              {s.editable ? '✓ ' : ''}{meal} 직접 정함
            </span>
            {!s.editable && (
              <>
                <input
                  type="number" inputMode="numeric" value={s.fixedKcal}
                  style={{ width: 90, padding: '8px 10px', fontSize: '.92rem' }}
                  onChange={(e) => setMealFixedKcal(meal, +e.target.value)}
                />
                <span style={{ fontSize: '.78rem', color: 'var(--sub)' }}>kcal (평균)</span>
              </>
            )}
          </div>
        )
      })}

      <div style={{ minHeight: 20 }} />
      <button className="btn" onClick={save}>목표 다시 계산하고 저장</button>

      <p className="disclaimer">
        본 앱의 운동·식단 정보는 일반 가이드이며 의료 조언이 아닙니다. 통증이 있으면 중단하고 전문가와 상담하세요.
      </p>
    </section>
  )
}
