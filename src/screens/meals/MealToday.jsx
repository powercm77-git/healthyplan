// MealToday.jsx — 일 단위 식단 기록 (기존 Meals.jsx 로직 + 3단계: 계획된 식단 미리보기,
// "먹었어요" 원터치 기록, 계획과 다르게 먹었을 때의 담백한 안내).
import { useEffect, useState } from 'react'
import FoodSheet from '../../components/FoodSheet.jsx'
import { useFeedback } from '../../components/Feedback.jsx'
import MealSubTabs from './MealSubTabs.jsx'
import { addMeal, deleteMeal, getMealsByDate, getFrequentFoodNames, getMealPlansByDate } from '../../lib/db.js'
import { addDays, formatDisplay, todayKey } from '../../lib/date.js'

const MEAL_TYPES = [
  { key: '아침', label: '☀️ 아침' },
  { key: '점심', label: '🍚 점심' },
  { key: '저녁', label: '🌙 저녁' },
  { key: '간식', label: '🍎 간식' },
]

function sameFoodSet(a, b) {
  if (a.length !== b.length) return false
  const names = new Set(a.map((x) => x.name))
  return b.every((x) => names.has(x.name))
}

export default function MealToday({ sub, onSubChange }) {
  const { toast } = useFeedback()
  const [date, setDate] = useState(todayKey())
  const [meals, setMeals] = useState([])
  const [plans, setPlans] = useState([])
  const [sheetMeal, setSheetMeal] = useState(null)
  const [recentNames, setRecentNames] = useState([])

  async function load(d) {
    const [m, p] = await Promise.all([getMealsByDate(d), getMealPlansByDate(d)])
    setMeals(m)
    setPlans(p)
  }
  useEffect(() => { load(date) }, [date])
  useEffect(() => { getFrequentFoodNames().then(setRecentNames) }, [])

  async function handleAdd(food) {
    await addMeal({
      date, meal: sheetMeal,
      name: food.name, kcal: food.kcal, carbs: food.carbs, protein: food.protein, fat: food.fat,
    })
    await load(date)
    setSheetMeal(null)
    toast(`${food.name} 기록! 🥗`)
  }

  async function handleDelete(id) {
    await deleteMeal(id)
    await load(date)
  }

  // 계획된 식단을 그대로 먹었을 때 한 번에 기록한다 — 검색해서 하나씩 추가하는 대신
  // 계획된 항목을 그대로 meals에 복사한다.
  async function handleEatAsPlanned(mealKey) {
    const items = plans.filter((p) => p.meal === mealKey)
    for (const item of items) {
      await addMeal({ date, meal: mealKey, name: item.name, kcal: item.kcal, carbs: item.carbs, protein: item.protein, fat: item.fat })
    }
    await load(date)
    toast('계획대로 기록했어요 ✓')
  }

  const isToday = date === todayKey()

  return (
    <section className="screen active">
      <MealSubTabs active={sub} onChange={onSubChange} />
      <p className="eyebrow">오늘의 식단</p>
      <h2 className="ob-title display" style={{ fontSize: '1.5rem', marginBottom: 4 }}>먹은 만큼 <span className="hl">채워져요</span></h2>
      <p className="ob-sub">음식을 추가하면 홈의 에너지 링이 함께 차오릅니다.</p>

      <div className="datebar">
        <button onClick={() => setDate(addDays(date, -1))}>◀</button>
        <span className="dt">{formatDisplay(date)}</span>
        <button disabled={isToday} onClick={() => setDate(addDays(date, 1))}>▶</button>
      </div>

      {MEAL_TYPES.map((mt) => {
        const items = meals.filter((m) => m.meal === mt.key)
        const planItems = plans.filter((p) => p.meal === mt.key)
        const kcal = items.reduce((s, m) => s + m.kcal, 0)
        const planKcal = planItems.reduce((s, m) => s + m.kcal, 0)
        const hasActual = items.length > 0
        const hasPlan = planItems.length > 0
        const differedFromPlan = hasActual && hasPlan && !sameFoodSet(items, planItems)

        return (
          <div className="card" key={mt.key}>
            <div className="mealhead">
              <span className="nm">{mt.label}</span>
              <span className="kc">{hasActual ? kcal : (hasPlan ? planKcal : 0)} kcal{!hasActual && hasPlan ? ' (계획)' : ''}</span>
            </div>

            {differedFromPlan && <div className="historynote" style={{ textAlign: 'left' }}>계획과 달랐네요</div>}

            {!hasActual && hasPlan && (
              <>
                {planItems.map((p) => (
                  <div className="fooditem planned" key={p.id}>
                    <span>{p.name}</span>
                    <span className="fk">{p.kcal} kcal</span>
                  </div>
                ))}
                <button className="donebtn" style={{ marginTop: 9 }} onClick={() => handleEatAsPlanned(mt.key)}>계획대로 먹었어요 ✓</button>
              </>
            )}

            {!hasActual && !hasPlan && <div className="empty">아직 기록이 없어요</div>}

            {hasActual && items.map((m) => (
              <div className="fooditem" key={m.id}>
                <span>{m.name}</span>
                <span className="fk">{m.kcal} kcal</span>
                <button className="fx" aria-label="삭제" onClick={() => handleDelete(m.id)}>✕</button>
              </div>
            ))}

            <button className="addfood" onClick={() => setSheetMeal(mt.key)}>+ 음식 추가</button>
          </div>
        )
      })}

      <FoodSheet
        open={!!sheetMeal}
        mealName={sheetMeal}
        onClose={() => setSheetMeal(null)}
        onAdd={handleAdd}
        recentNames={recentNames}
      />
    </section>
  )
}
