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
