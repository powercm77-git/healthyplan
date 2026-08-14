// exerciseEngine.js — 자동 루틴 배정, 점진적 증가/난이도 제안, 칼로리 계산.
// 순수 함수로 구성한다: IndexedDB 접근은 화면(screens)에서 하고 여기는
// 이미 로드된 데이터(exercises, meta, yesterdayBodyParts)만 받아 계산한다.

// 목표별 강도(근력)·유산소·스트레칭 비율
export const GOAL_RATIOS = {
  lose: { cardio: 0.6, strength: 0.3, stretch: 0.1 },
  keep: { strength: 0.4, cardio: 0.4, stretch: 0.2 },
  gain: { strength: 0.7, cardio: 0.2, stretch: 0.1 },
}

// 운동경험('0'=처음,'1'=조금,'2'=꾸준히) → 허용 난이도
export function levelsForExperience(experience) {
  if (experience === '2') return [2, 3]
  if (experience === '1') return [1, 2]
  return [1]
}

// 시간형(repType:'sec') 운동은 defaultReps가 "초", 횟수형은 "회"다.
function estimateSetSeconds(exercise) {
  if (exercise.repType === 'sec') return exercise.defaultReps
  return exercise.defaultReps * 3 // 1회 약 3초로 추정
}

export function estimateExerciseSeconds(exercise, sets = exercise.defaultSets) {
  const workSec = estimateSetSeconds(exercise) * sets
  const restSec = exercise.restSec * Math.max(sets - 1, 0)
  return workSec + restSec
}

export function calcKcal(weightKg, metValue, seconds) {
  const hours = seconds / 3600
  return Math.round(weightKg * metValue * hours)
}

function pickUntilBudget(pool, budgetSec, exclude, maxCount = 6, preferVideo = true) {
  const picked = []
  const used = new Set()
  let remaining = budgetSec
  // preferVideo(기본 켜짐, 2.7단계): 영상 보유 운동을 다 쓸 때까지는 영상 없는 운동을
  // 전혀 섞지 않는다 — 영상 없는 운동은 시간을 못 채울 때만 부족분을 메우는 용도로만
  // 등장한다. preferVideo가 꺼지면 영상 유무를 구분하지 않고 무작위로 섞는다.
  let candidates
  if (preferVideo) {
    const withVideo = pool.filter((e) => e.videos?.length > 0).sort(() => Math.random() - 0.5)
    const withoutVideo = pool.filter((e) => !(e.videos?.length > 0)).sort(() => Math.random() - 0.5)
    candidates = [...withVideo, ...withoutVideo]
  } else {
    candidates = [...pool].sort(() => Math.random() - 0.5)
  }
  for (const ex of candidates) {
    if (picked.length >= maxCount) break
    if (used.has(ex.id) || exclude.has(ex.id)) continue
    const sec = estimateExerciseSeconds(ex)
    if (remaining - sec < -budgetSec * 0.3 && picked.length > 0) continue
    picked.push(ex)
    used.add(ex.id)
    remaining -= sec
    if (remaining <= 0) break
  }
  return picked
}

/**
 * 오늘의 루틴을 배정한다.
 * @param {object} opts
 * @param {Array} opts.exercises - exercises.json 전체
 * @param {object} opts.profile - { goal, experience, weight }
 * @param {string} opts.place - 'home' | 'gym' | 'outdoor-gym' | 'outdoor'
 * @param {number} opts.minutes - 선택한 총 운동 시간(분)
 * @param {Map} opts.meta - exerciseId -> { completedCount, swapCount, firstCompletedAt, lastCompletedAt }
 * @param {string[]} opts.yesterdayBodyParts - 어제 메인 운동 부위 목록(연속 이틀 회피용)
 * @param {boolean} opts.preferVideo - 영상 있는 운동만 추천받기(기본 true). 부족하면 영상
 *   없는 운동으로 자동 보충하고, 몇 개 보충됐는지 nonVideoCount로 알려준다.
 */
export function assignRoutine({
  exercises, profile, place, minutes, meta = new Map(), yesterdayBodyParts = [], preferVideo = true,
}) {
  const allowedLevels = levelsForExperience(profile.experience)
  const excluded = new Set(
    [...meta.entries()].filter(([, m]) => (m.swapCount || 0) >= 3).map(([id]) => id),
  )

  // 재활(질환자 표준운동)·수영장 운동은 라이브러리 검색으로는 찾을 수 있지만 자동 루틴
  // 배정에서는 제외한다(2.6단계 발주자 지시) — 일반 사용자에게 의학적 맥락 없이
  // 재활 단계별 운동이 섞여 나가면 위험할 수 있다.
  const inPlace = exercises.filter((e) => e.place.includes(place) && allowedLevels.includes(e.level) && !e.excludeFromAutoRoutine)
  const stretchPool = inPlace.filter((e) => e.type === 'stretch')
  const strengthPoolAll = inPlace.filter((e) => e.type === 'strength')
  const cardioPoolAll = inPlace.filter((e) => e.type === 'cardio')

  // 연속 이틀 같은 부위 회피: 후보가 충분할 때만 적용(너무 좁은 장소에서는 무시)
  const rotate = (pool) => {
    if (!yesterdayBodyParts.length) return pool
    const filtered = pool.filter((e) => !e.bodyParts.some((bp) => yesterdayBodyParts.includes(bp)))
    return filtered.length >= 2 ? filtered : pool
  }
  const strengthPool = rotate(strengthPoolAll)
  const cardioPool = rotate(cardioPoolAll)

  const totalSec = minutes * 60
  const warmupSec = totalSec * 0.1
  const cooldownSec = totalSec * 0.1
  const mainSec = totalSec * 0.8

  const ratio = GOAL_RATIOS[profile.goal] || GOAL_RATIOS.keep
  const mainRatioSum = ratio.strength + ratio.cardio || 1
  const strengthSec = mainSec * (ratio.strength / mainRatioSum)
  const cardioSec = mainSec * (ratio.cardio / mainRatioSum)

  const used = new Set()
  const warmup = pickUntilBudget(stretchPool, warmupSec, excluded, 2, preferVideo)
  warmup.forEach((e) => used.add(e.id))
  const mainStrength = pickUntilBudget(strengthPool, strengthSec, new Set([...excluded, ...used]), 5, preferVideo)
  mainStrength.forEach((e) => used.add(e.id))
  const mainCardio = pickUntilBudget(cardioPool, cardioSec, new Set([...excluded, ...used]), 3, preferVideo)
  mainCardio.forEach((e) => used.add(e.id))
  const cooldown = pickUntilBudget(stretchPool, cooldownSec, new Set([...excluded, ...used]), 2, preferVideo)

  const main = [...mainStrength, ...mainCardio].sort(() => Math.random() - 0.5)
  const routine = [...warmup, ...main, ...cooldown]

  const mainBodyParts = [...new Set(main.flatMap((e) => e.bodyParts))]
  const estKcal = routine.reduce(
    (sum, e) => sum + calcKcal(profile.weight, e.metValue, estimateExerciseSeconds(e)), 0,
  )
  const estMinutes = Math.round(routine.reduce((s, e) => s + estimateExerciseSeconds(e), 0) / 60)
  // preferVideo가 켜진 상태에서도 장소·시간 조합에 따라 영상 있는 운동만으로는 못 채울 수
  // 있다 — 그럴 때만 의미 있는 값이라 preferVideo가 꺼져 있으면 항상 0으로 둔다.
  const nonVideoCount = preferVideo ? routine.filter((e) => !(e.videos?.length > 0)).length : 0

  return { routine, mainBodyParts, estKcal, estMinutes, nonVideoCount }
}

// 같은 운동 4회 이상 완료 시 강도(횟수/세트) 상향 제안
export function suggestProgress(exercise, meta) {
  const count = meta?.completedCount || 0
  if (count > 0 && count % 4 === 0) {
    return exercise.repType === 'sec'
      ? { type: 'reps', message: `${exercise.name}, 이제 익숙하시죠? 시간을 조금 늘려볼까요?`, reps: exercise.defaultReps + 10 }
      : { type: 'reps', message: `${exercise.name}, 이제 익숙하시죠? 횟수를 늘려볼까요?`, reps: exercise.defaultReps + 2 }
  }
  return null
}

// 첫 완료 후 2주 이상 지났고 상위 동작(harder)이 있으면 승급 제안
export function suggestHarder(exercise, meta, today) {
  if (!exercise.harder || !meta?.firstCompletedAt) return null
  const first = new Date(meta.firstCompletedAt)
  const now = new Date(today)
  const days = Math.floor((now - first) / (1000 * 60 * 60 * 24))
  if (days >= 14) return exercise.harder
  return null
}
