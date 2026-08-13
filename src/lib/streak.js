// streak.js — 연속 기록(스트릭) 계산
// "활동한 날"은 식단이 1건 이상 기록된 날로 정의한다. 오늘 아직 기록이 없으면
// 어제까지의 연속 기록을 그대로 보여준다(자정이 지났다고 바로 0으로 끊기지 않게).
import { todayKey, addDays } from './date.js'

export function calcStreak(activeDates) {
  const today = todayKey()
  let cursor = activeDates.has(today) ? today : addDays(today, -1)
  let count = 0
  while (activeDates.has(cursor)) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}
