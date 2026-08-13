// TabBar.jsx — 하단 탭바 (운동·리포트는 다음 단계까지 잠금)
import { useFeedback } from './Feedback.jsx'

const TABS = [
  { id: 'home', label: '홈', icon: '🏠', locked: false },
  { id: 'meals', label: '식단', icon: '🥗', locked: false },
  { id: 'exercise', label: '운동', icon: '🏃', locked: false },
  { id: 'report', label: '리포트', icon: '📈', locked: true, lockMsg: '리포트는 3단계에서 열려요' },
]

export default function TabBar({ active, onNavigate }) {
  const { toast } = useFeedback()

  return (
    <nav className="tabbar show">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab${active === t.id ? ' on' : ''}${t.locked ? ' lock' : ''}`}
          onClick={() => (t.locked ? toast(t.lockMsg) : onNavigate(t.id))}
        >
          <span className="ic">{t.icon}</span>{t.label}
        </button>
      ))}
    </nav>
  )
}
