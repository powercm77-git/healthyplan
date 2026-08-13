// EnergyRing.jsx — 칼로리 링(시그니처) + 탄단지 바
import { useEffect } from 'react'
import CheerMessage from './CheerMessage.jsx'
import { useCountUp } from '../lib/useCountUp.js'

const CIRCUMFERENCE = 609

function macroBar(name, val, goal, gradient) {
  const pct = goal > 0 ? Math.min((val / goal) * 100, 100) : 0
  return (
    <div className="macro">
      <div className="name">{name}</div>
      <div className="bar"><i style={{ background: gradient, width: `${pct}%` }} /></div>
      <div className="val">{val} / {goal}g</div>
    </div>
  )
}

export default function EnergyRing({ eaten, target, carbs, protein, fat, onMilestone }) {
  const ratio = target > 0 ? Math.min(eaten / target, 1) : 0
  const over = eaten > target
  const displayValue = over ? eaten - target : Math.max(target - eaten, 0)
  const kcalDisplay = useCountUp(displayValue)

  useEffect(() => {
    if (target <= 0) return
    const pct = (eaten / target) * 100
    if (pct >= 50) onMilestone?.('milestone50')
    if (pct >= 90) onMilestone?.('milestone90')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eaten, target])

  return (
    <div className="ringwrap">
      <div className="ring">
        <svg width="225" height="225" viewBox="0 0 225 225">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF9F45" /><stop offset="55%" stopColor="#FF4E7B" /><stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <circle className="track" cx="112.5" cy="112.5" r="97" fill="none" strokeWidth="17" />
          <circle
            className="fill" cx="112.5" cy="112.5" r="97" fill="none" strokeWidth="17"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          />
        </svg>
        <div className="center">
          <div className="kcal display">{over ? '+' : ''}{kcalDisplay.toLocaleString()}</div>
          <div className="lbl">{over ? 'kcal — 목표보다 조금 더' : 'kcal 더 채울 수 있어요'}</div>
        </div>
      </div>
      <CheerMessage eaten={eaten} target={target} />
      <div className="macros">
        {macroBar('탄수화물', carbs.val, carbs.goal, 'linear-gradient(90deg,#FFC53D,#FF9F45)')}
        {macroBar('단백질', protein.val, protein.goal, 'linear-gradient(90deg,#3EE9A4,#5AC8FA)')}
        {macroBar('지방', fat.val, fat.goal, 'linear-gradient(90deg,#8B5CF6,#FF4E7B)')}
      </div>
    </div>
  )
}
