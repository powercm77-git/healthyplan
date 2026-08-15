// MealSubTabs.jsx — 식단 탭 안의 3개 하위 탭(오늘/주간/월간). 기존 .chips/.chip을
// 그대로 재사용해 새 CSS 없이 시안 톤을 유지한다.
const TABS = [
  { key: 'today', label: '오늘' },
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
]

export default function MealSubTabs({ active, onChange }) {
  return (
    <div className="chips" style={{ marginBottom: 18 }}>
      {TABS.map((t) => (
        <span key={t.key} className={`chip${active === t.key ? ' on' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
        </span>
      ))}
    </div>
  )
}
