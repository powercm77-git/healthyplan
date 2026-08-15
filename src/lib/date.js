// date.js — 로컬 타임존 기준 날짜 문자열(YYYY-MM-DD) 유틸

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function dateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey() {
  return dateKey(new Date())
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return dateKey(dt)
}

export function formatDisplay(key) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = todayKey()
  if (key === today) return '오늘'
  if (key === addDays(today, -1)) return '어제'
  if (key === addDays(today, -2)) return '그제'
  return `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`
}

// ── 3단계(식단 편성): 주/월 단위 유틸 ──────────────────

// 그 날이 속한 주의 일요일(주 시작일)을 반환한다.
export function startOfWeek(key) {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return addDays(key, -dt.getDay())
}

// 일요일 시작일 기준 7일치 날짜 배열(일~토).
export function weekDates(weekStartKey) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartKey, i))
}

export function formatWeekRangeLabel(weekStartKey) {
  const endKey = addDays(weekStartKey, 6)
  const [, sm, sd] = weekStartKey.split('-').map(Number)
  const [, em, ed] = endKey.split('-').map(Number)
  return sm === em ? `${sm}월 ${sd}일 ~ ${ed}일` : `${sm}월 ${sd}일 ~ ${em}월 ${ed}일`
}

export function weekdayLabel(key) {
  const [y, m, d] = key.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

export function isWeekend(key) {
  const [y, m, d] = key.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return wd === 0 || wd === 6
}

// YYYY-MM 형태의 월 키(달력 이동용). 날짜 key(YYYY-MM-DD)와 구분한다.
export function monthKeyOf(dateKey) {
  return dateKey.slice(0, 7)
}

export function addMonths(monthKey, n) {
  const [y, m] = monthKey.split('-').map(Number)
  const dt = new Date(y, m - 1 + n, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y}년 ${m}월`
}

// 달력 그리드용: 그 달의 1일이 속한 주의 일요일부터 마지막 날이 속한 주의 토요일까지,
// 항상 7의 배수(5주 또는 6주) 개수의 날짜를 반환한다. 이전/다음 달 날짜도 포함되므로
// 호출부에서 monthKeyOf(date) !== monthKey로 "다른 달" 여부를 가려 옅게 표시한다.
export function monthGridDates(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const firstKey = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const lastKey = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const gridStart = startOfWeek(firstKey)
  const gridEndWeekStart = startOfWeek(lastKey)
  const gridEnd = addDays(gridEndWeekStart, 6)
  const out = []
  let cur = gridStart
  while (cur <= gridEnd) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

// 그 달에 실제로 속한 날짜만(1일~말일).
export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)
}
