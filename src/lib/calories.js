// calories.js — 칼로리 계산 공유 로직 (2.7단계 §3: 실행 화면·요약·홈에서 공유).
// exerciseEngine.js가 이 파일의 calcKcal을 그대로 재노출해 기존 import를 깨지 않는다.

export function calcKcal(weightKg, metValue, seconds) {
  const hours = seconds / 3600
  return Math.round(weightKg * metValue * hours)
}

// 표기 규칙(§2-1): 정밀 수치("182kcal") 대신 10 단위로 반올림해 "약 N0kcal"로 보여준다.
export function roundKcalForDisplay(kcal) {
  return Math.round(kcal / 10) * 10
}

export function formatKcal(kcal) {
  return `약 ${roundKcalForDisplay(kcal)}kcal`
}
