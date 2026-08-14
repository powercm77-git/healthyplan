// foodEquivalent.js — 소모 칼로리를 익숙한 음식 단위로 환산 (2.7단계 §1-2).
// kcal 수치는 항상 745종 음식 DB(foods.json)에서 정확한 이름으로 조회한 실제 값만 쓴다.
// 절대 죄책감 프레이밍에 쓰지 않는다 — 성취의 단위로만 표현한다(§2-3, §6).
import foods from '../data/foods.json'

const REFERENCE_DEFS = [
  { name: '흰쌀밥 반공기', display: '밥', unit: '공기', counts: [1], unitLabelAt1: '반 공기' },
  { name: '흰쌀밥', display: '밥', unit: '공기' },
  { name: '바나나', display: '바나나', unit: '개' },
  { name: '믹스커피', display: '믹스커피', unit: '잔' },
  { name: '계란후라이', display: '계란후라이', unit: '개' },
  { name: '콜라', display: '콜라', unit: '캔' },
  { name: '김밥', display: '김밥', unit: '줄' },
  { name: '라면', display: '라면', unit: '개' },
  { name: '맥주', display: '맥주', unit: '캔' },
]

const REFERENCE_FOODS = REFERENCE_DEFS.map((def) => {
  const food = foods.find((f) => f.name === def.name)
  return food ? { ...def, kcal: food.kcal } : null
}).filter(Boolean)

const DEFAULT_COUNTS = [1, 0.5, 1.5, 2, 3]
const NON_UNIT_PENALTY = 0.08
const APPROX_THRESHOLD = 0.12 // 이 이상 벗어나면 "쯤"을 붙여 근사치임을 밝힌다

function countPhrase(count, unit) {
  if (count === 0.5) return `반 ${unit}`
  if (count === 1) return `한 ${unit}`
  if (count === 1.5) return `한 ${unit} 반`
  if (count === 2) return `두 ${unit}`
  if (count === 3) return `세 ${unit}`
  return `${count} ${unit}`
}

// kcal을 가장 자연스럽게 설명하는 기준 음식 하나를 골라 문구를 반환한다.
// 정확히 안 맞아도 죄책감이 아니라 성취로 읽히게 "~만큼/쯤 태웠어요" 형태로 고정한다.
export function describeKcalAsFood(kcal) {
  if (!kcal || kcal <= 0 || REFERENCE_FOODS.length === 0) return null

  let best = null
  for (const food of REFERENCE_FOODS) {
    const counts = food.counts || DEFAULT_COUNTS
    for (const count of counts) {
      const value = food.kcal * count
      const error = Math.abs(value - kcal) / kcal
      const score = error + (count === 1 ? 0 : NON_UNIT_PENALTY)
      if (!best || score < best.score) best = { food, count, error }
    }
  }
  // 가장 가까운 기준 음식조차 오차가 너무 크면(세션 초반 몇 kcal 등) 차라리 아무 말도 하지
  // 않는다 — "쯤"을 붙여도 실제보다 부풀려 보이면 §2-4(과장 금지)를 어기는 셈이다.
  if (!best || best.error > 0.5) return null

  const { food, count, error } = best
  const unitPhrase = count === 1 && food.unitLabelAt1 ? food.unitLabelAt1 : countPhrase(count, food.unit)
  const tail = error > APPROX_THRESHOLD ? '쯤' : '만큼'
  return `${food.display} ${unitPhrase}${tail} 태웠어요`
}
