// WaterWidget.jsx — 물 6잔 위젯 (날짜별 저장은 상위에서 처리)
import { useFeedback } from './Feedback.jsx'

export default function WaterWidget({ value, onChange }) {
  const { toast, burst } = useFeedback()

  function tapCup(i) {
    const next = i + 1
    onChange(next)
    if (next === 6) {
      burst(14)
      toast('수분 목표 달성! 💧')
    }
  }

  return (
    <div className="widget">
      <div className="t">💧 물 마시기</div>
      <div className="v display">{value}<span style={{ fontSize: '.9rem', color: 'var(--sub)' }}> / 6잔</span></div>
      <div className="cups">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className={`cup${i < value ? ' full' : ''}`}
            onClick={() => tapCup(i)}
          />
        ))}
      </div>
    </div>
  )
}
