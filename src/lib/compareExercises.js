// compareExercises.js — 대안 운동 효과 비교 (2.7단계 §1-5).
// metValue 비율·bodyParts 겹침·level 차이·equipment 유무만으로, 검증 못 할 신체 부위별
// 부담 같은 문구는 지어내지 않고 사람 말로 풀어 설명한다.

function effortLabel(base, alt) {
  if (!base.metValue || !alt.metValue) return null
  const ratio = alt.metValue / base.metValue
  if (ratio >= 0.85 && ratio <= 1.15) return '효과는 비슷해요'
  const pct = Math.round((ratio * 100) / 5) * 5
  return ratio > 1 ? `소모량 약 ${pct}%로 더 커요` : `소모량 약 ${pct}%예요`
}

function bodyPartsLabel(base, alt) {
  const baseParts = base.bodyParts || []
  const altParts = alt.bodyParts || []
  if (baseParts.length === 0 || altParts.length === 0) return null
  const shared = altParts.filter((p) => baseParts.includes(p))
  return shared.length > 0 ? '같은 부위 자극' : '다른 부위를 자극해요'
}

function levelLabel(base, alt) {
  if (base.level == null || alt.level == null) return null
  if (alt.level < base.level) return '조금 더 쉬워요'
  if (alt.level > base.level) return '조금 더 도전적이에요'
  return '난이도는 비슷해요'
}

function equipmentLabel(base, alt) {
  const baseNeeds = base.equipment && base.equipment !== '없음'
  const altNeeds = alt.equipment && alt.equipment !== '없음'
  if (baseNeeds && !altNeeds) return '장비 없이 할 수 있어요'
  return null
}

// 사람이 읽는 짧은 문구 목록(최대 3개)을 반환한다. 자극 부위 → 난이도 → 소모량 순으로,
// 장비 없이 가능하면 가장 먼저 보여준다(장비 문제로 바꾸려는 사용자에게 제일 중요한 정보).
export function compareExercises(base, alt) {
  if (!base || !alt) return []
  const equipment = equipmentLabel(base, alt)
  const parts = [equipment, bodyPartsLabel(base, alt), levelLabel(base, alt), effortLabel(base, alt)].filter(Boolean)
  return parts.slice(0, 3)
}
