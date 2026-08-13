// tdee.js — 미플린-세인트 조르 공식 기반 목표 칼로리·탄단지 계산
// 감량 -400kcal, 증량 +350kcal, 유지 +0. 탄·단 4kcal/g, 지방 9kcal/g.

const RATIOS = {
  lose: [0.40, 0.30, 0.30],
  keep: [0.50, 0.25, 0.25],
  gain: [0.45, 0.30, 0.25],
}
const OFFSETS = { lose: -400, keep: 0, gain: 350 }

export function calcBMR({ sex, age, height, weight }) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return sex === 'm' ? base + 5 : base - 161
}

export function calcTDEE({ sex, age, height, weight, activity }) {
  return calcBMR({ sex, age, height, weight }) * Number(activity)
}

export function calcTargets(profile) {
  const tdee = calcTDEE(profile)
  const target = Math.round((tdee + OFFSETS[profile.goal]) / 10) * 10
  const [rc, rp, rf] = RATIOS[profile.goal]
  return {
    target,
    carbs: Math.round((target * rc) / 4),
    protein: Math.round((target * rp) / 4),
    fat: Math.round((target * rf) / 9),
  }
}
