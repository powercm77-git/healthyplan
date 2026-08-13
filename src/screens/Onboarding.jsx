// Onboarding.jsx — 첫 실행 3단계 온보딩 → 목표 칼로리 자동 계산 → 프로필 저장
import { useMemo, useState } from 'react'
import { calcTargets } from '../lib/tdee.js'
import { useFeedback } from '../components/Feedback.jsx'
import { useCountUp } from '../lib/useCountUp.js'

const ACT_OPTIONS = [
  { v: '1.2', label: '🪑 거의 앉아서 지내요' },
  { v: '1.375', label: '🚶 가볍게 움직여요 (도보 출퇴근, 가끔 산책)' },
  { v: '1.55', label: '🏃 활동이 많아요 (서서 일하거나 주 3회 운동)' },
]
const EXP_OPTIONS = [
  { v: '0', label: '처음이에요' },
  { v: '1', label: '조금 있어요' },
  { v: '2', label: '꾸준히 해요' },
]
const GOAL_OPTIONS = [
  { v: 'lose', label: '🔥 가볍게 — 천천히, 요요 없이 감량' },
  { v: 'keep', label: '🌿 든든하게 — 지금 몸을 건강하게 유지' },
  { v: 'gain', label: '💪 단단하게 — 근육과 체중을 증량' },
]
const GOAL_DESC = {
  lose: '하루 약 400kcal씩, 한 달에 1~1.5kg. 몸이 눈치채지 못할 만큼 천천히, 그래서 요요 없이.',
  gain: '하루 약 350kcal를 더해 근육과 함께 차곡차곡. 운동과 단백질이 핵심이에요.',
  keep: '지금의 나를 지키는 데 필요한 딱 그만큼의 에너지예요.',
}

function Chip({ label, active, onClick }) {
  return <span className={`chip${active ? ' on' : ''}`} onClick={onClick}>{label}</span>
}

export default function Onboarding({ onComplete }) {
  const { toast, burst } = useFeedback()
  const [step, setStep] = useState(1)
  const [sex, setSex] = useState(null)
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [activity, setActivity] = useState(null)
  const [experience, setExperience] = useState(null)
  const [goal, setGoal] = useState(null)

  const draft = { sex, age: +age, height: +height, weight: +weight, activity, goal }
  const plan = useMemo(() => {
    if (!goal || !sex || !age || !height || !weight) return null
    return calcTargets(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, age, height, weight, activity, goal])
  const kcalDisplay = useCountUp(plan?.target ?? 0)

  function goStep2() {
    if (!sex || !age || !height || !weight) { toast('모든 항목을 입력해주세요'); return }
    setStep(2)
  }
  function goStep3() {
    if (!activity || experience === null) { toast('두 항목을 골라주세요'); return }
    setStep(3)
  }

  async function start() {
    if (!plan) return
    const profile = {
      sex, age: +age, height: +height, weight: +weight,
      activity, experience, goal,
      target: plan.target, tCarbs: plan.carbs, tProtein: plan.protein, tFat: plan.fat,
      createdAt: new Date().toISOString(),
    }
    burst(24)
    toast('플랜 완성! 오늘부터 시작이에요 🎉')
    await onComplete(profile)
  }

  return (
    <section className="screen active">
      {step === 1 && (
        <>
          <div className="ob-progress"><i className="on" /><i /><i /></div>
          <p className="eyebrow">HEALTHY PLAN · 1/3</p>
          <h1 className="ob-title display">건강해질 준비,<br /><span className="hl">1분</span>이면 끝나요</h1>
          <p className="ob-sub">딱 세 화면만 답하면 나만의 플랜이 완성됩니다.<br />정보는 이 기기에만 저장돼요.</p>
          <label className="f">성별</label>
          <div className="chips">
            <Chip label="남성" active={sex === 'm'} onClick={() => setSex('m')} />
            <Chip label="여성" active={sex === 'f'} onClick={() => setSex('f')} />
          </div>
          <div className="row2">
            <div><label className="f">나이</label>
              <input type="number" inputMode="numeric" placeholder="52" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div><label className="f">키 (cm)</label>
              <input type="number" inputMode="numeric" placeholder="172" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
          </div>
          <label className="f">현재 체중 (kg)</label>
          <input type="number" inputMode="decimal" placeholder="74" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <div style={{ flex: 1, minHeight: 26 }} />
          <button className="btn" onClick={goStep2}>다음 →</button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="ob-progress"><i className="on" /><i className="on" /><i /></div>
          <p className="eyebrow">HEALTHY PLAN · 2/3</p>
          <h1 className="ob-title display">평소의 나는<br /><span className="hl">어떤 모습</span>인가요?</h1>
          <p className="ob-sub">가장 가까운 것을 고르면 돼요. 정확하지 않아도 괜찮습니다.</p>
          <label className="f">하루 활동량</label>
          <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {ACT_OPTIONS.map((o) => (
              <Chip key={o.v} label={o.label} active={activity === o.v} onClick={() => setActivity(o.v)} />
            ))}
          </div>
          <label className="f">운동 경험</label>
          <div className="chips">
            {EXP_OPTIONS.map((o) => (
              <Chip key={o.v} label={o.label} active={experience === o.v} onClick={() => setExperience(o.v)} />
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 26 }} />
          <button className="btn" onClick={goStep3}>다음 →</button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="ob-progress"><i className="on" /><i className="on" /><i className="on" /></div>
          <p className="eyebrow">HEALTHY PLAN · 3/3</p>
          <h1 className="ob-title display">어떤 나를<br /><span className="hl">만나고</span> 싶나요?</h1>
          <p className="ob-sub">목표에 맞춰 식단과 운동을 자동으로 맞춰드려요. 언제든 바꿀 수 있습니다.</p>
          <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {GOAL_OPTIONS.map((o) => (
              <Chip key={o.v} label={o.label} active={goal === o.v} onClick={() => setGoal(o.v)} />
            ))}
          </div>
          {plan && (
            <div className="result-card">
              <div className="result-in">
                <p className="eyebrow">나의 하루 에너지 목표</p>
                <div className="result-num display">{kcalDisplay.toLocaleString()} <small>kcal</small></div>
                <p style={{ fontSize: '.88rem', color: 'var(--sub)', marginTop: 7, lineHeight: 1.6 }}>{GOAL_DESC[goal]}</p>
                <div className="macros" style={{ marginTop: 14 }}>
                  <div className="macro"><div className="name">탄수화물</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{plan.carbs}g</b></div></div>
                  <div className="macro"><div className="name">단백질</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{plan.protein}g</b></div></div>
                  <div className="macro"><div className="name">지방</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{plan.fat}g</b></div></div>
                </div>
              </div>
            </div>
          )}
          <div style={{ flex: 1, minHeight: 26 }} />
          <button className="btn" disabled={!plan} onClick={start}>🚀 내 플랜으로 시작하기</button>
        </>
      )}
    </section>
  )
}
