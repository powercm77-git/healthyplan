// Meals.jsx — 일 단위 식단 기록 (날짜 이동, 끼니별 추가·삭제)
import { useEffect, useState } from 'react'
import FoodSheet from '../components/FoodSheet.jsx'
import { useFeedback } from '../components/Feedback.jsx'
import { addMeal, deleteMeal, getMealsByDate, getFrequentFoodNames } from '../lib/db.js'
import { addDays, formatDisplay, todayKey } from '../lib/date.js'

const MEAL_TYPES = [
  { key: '아침', label: '☀️ 아침' },
  { key: '점심', label: '🍚 점심' },
  { key: '저녁', label: '🌙 저녁' },
  { key: '간식', label: '🍎 간식' },
]

export default function Meals() {
  const { toast } = useFeedback()
  const [date, setDate] = useState(todayKey())
  const [meals, setMeals] = useState([])
  const [sheetMeal, setSheetMeal] = useState(null)
  const [recentNames, setRecentNames] = useState([])

  async function load(d) {
    setMeals(await getMealsByDate(d))
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

  const isToday = date === todayKey()

  return (
    <section className="screen active">
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
        const kcal = items.reduce((s, m) => s + m.kcal, 0)
        return (
          <div className="card" key={mt.key}>
            <div className="mealhead"><span className="nm">{mt.label}</span><span className="kc">{kcal} kcal</span></div>
            {items.length === 0
              ? <div className="empty">아직 기록이 없어요</div>
              : items.map((m) => (
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
