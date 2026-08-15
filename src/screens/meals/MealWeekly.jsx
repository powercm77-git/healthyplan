// MealWeekly.jsx — 주간 식단 편성 (3단계 핵심 기능). 자동으로 짜고, 마음에 안 드는
// 끼니만 다른 조합으로 바꾸거나 직접 음식을 추가한다.
import { useEffect, useMemo, useState } from 'react'
import foods from '../../data/foods.json'
import MealSubTabs from './MealSubTabs.jsx'
import FoodSheet from '../../components/FoodSheet.jsx'
import { useFeedback } from '../../components/Feedback.jsx'
import {
  MEAL_TYPES, DEFAULT_MEAL_SETTINGS, planWeek, getMealAlternatives, editableMealsOf, sumItems,
} from '../../lib/mealPlanner.js'
import { buildGroceryList } from '../../lib/groceryList.js'
import { getMealPlansByDates, replaceMealPlanSlot, addMealPlanItem, deleteMealPlanItem } from '../../lib/db.js'
import { addDays, todayKey, startOfWeek, weekDates, formatWeekRangeLabel, weekdayLabel, isWeekend } from '../../lib/date.js'

function shortLabel(date) {
  const [, m, d] = date.split('-')
  return `${weekdayLabel(date)} ${Number(m)}/${Number(d)}`
}

function statusColor(ratio) {
  if (ratio == null) return 'var(--sub)'
  if (ratio >= 0.9 && ratio <= 1.1) return 'var(--mint)'
  return 'var(--amber)'
}

export default function MealWeekly({ sub, onSubChange, profile }) {
  const { toast } = useFeedback()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayKey()))
  const [plansByDate, setPlansByDate] = useState(new Map())
  const [sheet, setSheet] = useState(null) // { date, meal }
  const [alternatives, setAlternatives] = useState([])
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [groceryOpen, setGroceryOpen] = useState(false)
  const [checked, setChecked] = useState(new Set())

  const dates = useMemo(() => weekDates(weekStart), [weekStart])
  const mealSettings = profile.mealSettings || DEFAULT_MEAL_SETTINGS
  const avoidList = profile.avoidFoods || []
  const preferProtein = profile.goal === 'lose'

  async function load() {
    setPlansByDate(await getMealPlansByDates(dates))
  }
  useEffect(() => { load() }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAutoCompose() {
    const plan = planWeek({ foods, profile, mealSettings, avoidList, dates })
    const editable = editableMealsOf(mealSettings)
    for (const date of dates) {
      for (const meal of editable) {
        const items = plan[date][meal].map((f) => ({
          name: f.name, kcal: f.kcal, carbs: f.carbs, protein: f.protein, fat: f.fat, category: f.category, source: 'auto',
        }))
        await replaceMealPlanSlot(date, meal, items)
      }
    }
    await load()
    toast('이번 주 식단을 짰어요 🍱')
  }

  function openSheet(date, meal) {
    setSheet({ date, meal })
    const items = (plansByDate.get(date) || []).filter((p) => p.meal === meal)
    const targetKcal = items.length > 0 ? sumItems(items).kcal : 600
    const allowHard = meal === '저녁' && isWeekend(date)
    setAlternatives(getMealAlternatives(meal, targetKcal, { foods, avoidList, preferProtein, allowHard }, 4))
  }
  function closeSheet() { setSheet(null); setAlternatives([]) }

  async function applyAlternative(alt) {
    if (!sheet) return
    const items = alt.items.map((f) => ({ name: f.name, kcal: f.kcal, carbs: f.carbs, protein: f.protein, fat: f.fat, category: f.category, source: 'auto' }))
    await replaceMealPlanSlot(sheet.date, sheet.meal, items)
    await load()
    toast('이 끼니를 바꿨어요 ✓')
    closeSheet()
  }

  function regenAlternatives() {
    if (!sheet) return
    const items = (plansByDate.get(sheet.date) || []).filter((p) => p.meal === sheet.meal)
    const targetKcal = items.length > 0 ? sumItems(items).kcal : 600
    const allowHard = sheet.meal === '저녁' && isWeekend(sheet.date)
    setAlternatives(getMealAlternatives(sheet.meal, targetKcal, { foods, avoidList, preferProtein, allowHard }, 4))
  }

  async function handleManualAdd(food) {
    if (!sheet) return
    await addMealPlanItem({
      date: sheet.date, meal: sheet.meal,
      name: food.name, kcal: food.kcal, carbs: food.carbs, protein: food.protein, fat: food.fat,
      category: food.category, source: 'manual',
    })
    await load()
    setManualAddOpen(false)
    toast(`${food.name} 추가! ✓`)
  }

  async function removeSheetItem(id) {
    await deleteMealPlanItem(id)
    await load()
  }

  const allWeekItems = dates.flatMap((d) => plansByDate.get(d) || [])
  const weekAvg = useMemo(() => {
    if (allWeekItems.length === 0) return null
    const totalsByDate = dates.map((d) => {
      const editable = editableMealsOf(mealSettings)
      const items = (plansByDate.get(d) || []).filter((p) => editable.includes(p.meal))
      const fixed = MEAL_TYPES.filter((m) => !editable.includes(m)).reduce((s, m) => s + (mealSettings[m]?.fixedKcal || 0), 0)
      const sums = sumItems(items)
      return { ...sums, kcal: sums.kcal + fixed }
    })
    const n = totalsByDate.length
    return {
      kcal: Math.round(totalsByDate.reduce((s, t) => s + t.kcal, 0) / n),
      carbs: Math.round(totalsByDate.reduce((s, t) => s + t.carbs, 0) / n),
      protein: Math.round(totalsByDate.reduce((s, t) => s + t.protein, 0) / n),
      fat: Math.round(totalsByDate.reduce((s, t) => s + t.fat, 0) / n),
    }
  }, [plansByDate, dates, mealSettings]) // eslint-disable-line react-hooks/exhaustive-deps

  const groceryList = useMemo(() => buildGroceryList(allWeekItems), [allWeekItems]) // eslint-disable-line react-hooks/exhaustive-deps

  const sheetItems = sheet ? (plansByDate.get(sheet.date) || []).filter((p) => p.meal === sheet.meal) : []

  return (
    <>
    <section className="screen active">
      <MealSubTabs active={sub} onChange={onSubChange} />
      <p className="eyebrow">주간 식단 편성</p>
      <h2 className="ob-title display" style={{ fontSize: '1.5rem', marginBottom: 4 }}>이번 주,<br /><span className="hl">미리 정해요</span></h2>

      <div className="datebar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}>◀</button>
        <span className="dt">{formatWeekRangeLabel(weekStart)}</span>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}>▶</button>
      </div>

      <button className="btn" style={{ marginBottom: 16 }} onClick={handleAutoCompose}>🪄 자동으로 짜기</button>

      {dates.map((date) => {
        const items = plansByDate.get(date) || []
        const editable = editableMealsOf(mealSettings)
        const fixedSum = MEAL_TYPES.filter((m) => !editable.includes(m)).reduce((s, m) => s + (mealSettings[m]?.fixedKcal || 0), 0)
        const dayTotal = sumItems(items.filter((p) => editable.includes(p.meal))).kcal + fixedSum
        const ratio = profile.target ? dayTotal / profile.target : null
        return (
          <div className="card" key={date}>
            <div className="mealhead">
              <span className="nm">{shortLabel(date)}</span>
              <span className="kc" style={{ color: statusColor(ratio), fontWeight: 700 }}>{dayTotal} / {profile.target} kcal</span>
            </div>
            {MEAL_TYPES.map((meal) => {
              const isEditable = mealSettings[meal]?.editable !== false
              const mealItems = items.filter((p) => p.meal === meal)
              const mealKcal = isEditable ? sumItems(mealItems).kcal : (mealSettings[meal]?.fixedKcal || 0)
              return (
                <div
                  key={meal} className="wd-mealrow"
                  onClick={() => isEditable && openSheet(date, meal)}
                  style={{ cursor: isEditable ? 'pointer' : 'default' }}
                >
                  <span className="wd-mealtype">{meal}</span>
                  <span className="wd-mealnames">
                    {isEditable
                      ? (mealItems.length > 0 ? mealItems.map((i) => i.name).join(' + ') : '탭해서 정하기')
                      : '급식 등 직접 안 정함'}
                  </span>
                  <span className="wd-mealkcal">{mealKcal}kcal</span>
                </div>
              )
            })}
          </div>
        )
      })}

      {weekAvg && (
        <div className="card">
          <p className="eyebrow">주간 요약 (하루 평균)</p>
          <div className="macros">
            <div className="macro"><div className="name">칼로리</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{weekAvg.kcal}</b></div></div>
            <div className="macro"><div className="name">탄수화물</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{weekAvg.carbs}g</b></div></div>
            <div className="macro"><div className="name">단백질</div><div className="val" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}><b>{weekAvg.protein}g</b></div></div>
          </div>
          <button className="addfood" style={{ marginTop: 14 }} onClick={() => setGroceryOpen(true)}>🛒 장보기 목록 보기</button>
        </div>
      )}
    </section>

    {/* 시트들은 .screen(overflow-y:auto) 밖의 형제로 둔다 — 안에 두면 목록을 스크롤한
        상태에서 열었을 때 그 스크롤 오프셋만큼 시트도 함께 밀려 화면 밖으로 나간다
        (실측으로 확인한 버그: position:absolute라도 스크롤 컨테이너의 후손이면 그
        스크롤에 영향을 받는다 — 컨테이닝 블록이 더 위(.phone)여도 마찬가지다). */}
    {/* 끼니 교체 · 직접 추가 시트 */}
      {sheet && (
        <>
          <div className="sheet-bg open" onClick={closeSheet} />
          <div className="sheet open">
            <h3>{shortLabel(sheet.date)} · {sheet.meal}</h3>
            {sheetItems.length === 0
              ? <div className="empty" style={{ padding: '10px 0' }}>아직 정하지 않았어요</div>
              : sheetItems.map((it) => (
                <div className="fooditem" key={it.id}>
                  <span>{it.name}</span>
                  <span className="fk">{it.kcal} kcal</span>
                  <button className="fx" aria-label="삭제" onClick={() => removeSheetItem(it.id)}>✕</button>
                </div>
              ))}
            <button className="addfood" onClick={() => setManualAddOpen(true)}>+ 직접 추가</button>

            <div className="swap-panel open">
              <p className="q">다른 조합으로 바꾸기</p>
              {alternatives.map((alt, i) => (
                <div className="alt" key={i} onClick={() => applyAlternative(alt)}>
                  <div style={{ flex: 1 }}>
                    <div className="anm">{alt.items.map((f) => f.name).join(' + ')}</div>
                    <div className="why">{alt.totalKcal}kcal</div>
                  </div>
                </div>
              ))}
              <button className="filterresetbtn" onClick={regenAlternatives}>다른 조합 더 보기</button>
            </div>
          </div>
        </>
      )}

      <FoodSheet
        open={manualAddOpen}
        mealName={sheet?.meal}
        onClose={() => setManualAddOpen(false)}
        onAdd={handleManualAdd}
        recentNames={[]}
      />

      {/* 장보기 목록 */}
      {groceryOpen && (
        <>
          <div className="sheet-bg open" onClick={() => setGroceryOpen(false)} />
          <div className="sheet open">
            <h3>장보기 목록</h3>
            {groceryList.length === 0
              ? <div className="empty" style={{ padding: '10px 0' }}>이번 주 식단을 먼저 짜주세요</div>
              : (
                <div className="foodlist">
                  {groceryList.map((g) => {
                    const key = `${g.category}::${g.label}`
                    const isChecked = checked.has(key)
                    return (
                      <div
                        className={`grocery-item${isChecked ? ' checked' : ''}`} key={key}
                        onClick={() => {
                          const next = new Set(checked)
                          if (isChecked) next.delete(key); else next.add(key)
                          setChecked(next)
                        }}
                      >
                        <span className="grocery-check">{isChecked ? '✓' : ''}</span>
                        <span className="grocery-label">{g.label}{g.count > 1 ? ` ×${g.count}` : ''}</span>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>
        </>
      )}
    </>
  )
}
