// Meals.jsx — 식단 탭 서브 라우터: 오늘 / 주간 / 월간 (3단계 §3)
import { useState } from 'react'
import MealToday from './meals/MealToday.jsx'
import MealWeekly from './meals/MealWeekly.jsx'
import MealMonthly from './meals/MealMonthly.jsx'

export default function Meals({ profile, onUpdateProfile }) {
  const [sub, setSub] = useState('today')

  if (sub === 'weekly') return <MealWeekly sub={sub} onSubChange={setSub} profile={profile} />
  if (sub === 'monthly') return <MealMonthly sub={sub} onSubChange={setSub} profile={profile} />
  return <MealToday sub={sub} onSubChange={setSub} profile={profile} onUpdateProfile={onUpdateProfile} />
}
