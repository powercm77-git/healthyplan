// db.js — IndexedDB 래퍼 (idb). localStorage는 사용하지 않는다.
import { openDB } from 'idb'

const DB_NAME = 'healthyplan-db'
const DB_VERSION = 3

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile')
        }
        if (!db.objectStoreNames.contains('meals')) {
          const store = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true })
          store.createIndex('date', 'date')
        }
        if (!db.objectStoreNames.contains('days')) {
          db.createObjectStore('days', { keyPath: 'date' })
        }
        // 운동 세션 기록 (2단계): 하루에 여러 번 저장될 수 있어 meals와 동일하게 date 인덱스를 둔다
        if (!db.objectStoreNames.contains('exerciseLogs')) {
          const store = db.createObjectStore('exerciseLogs', { keyPath: 'id', autoIncrement: true })
          store.createIndex('date', 'date')
        }
        // 운동별 누적 통계 (2단계): 완료 횟수·최근 완료일·교체 횟수 — 자동 루틴 배정의 점진적 증가·제외 규칙에 사용
        if (!db.objectStoreNames.contains('exerciseMeta')) {
          db.createObjectStore('exerciseMeta', { keyPath: 'id' })
        }
        // 식단 "계획"(3단계): 실제 기록인 meals와 분리한다. 자동 편성·직접 추가로 미리
        // 짜둔 끼니이며, 그 날이 되면 화면에 미리 표시되고 "먹었어요"로 meals에 복사된다.
        if (!db.objectStoreNames.contains('mealPlans')) {
          const store = db.createObjectStore('mealPlans', { keyPath: 'id', autoIncrement: true })
          store.createIndex('date', 'date')
        }
      },
    })
  }
  return dbPromise
}

// ── 프로필 ──────────────────────────────────────────
export async function getProfile() {
  const db = await getDB()
  return db.get('profile', 'main')
}

export async function saveProfile(profile) {
  const db = await getDB()
  await db.put('profile', profile, 'main')
}

// ── 식단 기록 ────────────────────────────────────────
export async function addMeal(entry) {
  const db = await getDB()
  return db.add('meals', entry)
}

export async function deleteMeal(id) {
  const db = await getDB()
  await db.delete('meals', id)
}

export async function getMealsByDate(date) {
  const db = await getDB()
  return db.getAllFromIndex('meals', 'date', date)
}

// 식단 또는 운동 기록이 하나라도 있는 날짜 집합 (스트릭 계산용).
// 2.7단계 §1-6: 운동도 스트릭에 포함되도록 exerciseLogs 날짜를 합친다.
// getAllKeysFromIndex는 인덱스 값(date 문자열)이 아니라 오브젝트스토어의 기본 키(자동증가 id)를
// 반환한다 — 여기선 실제 레코드를 읽어 date 필드를 직접 뽑아야 한다.
export async function getActiveDates() {
  const db = await getDB()
  const [meals, exerciseLogs] = await Promise.all([db.getAll('meals'), db.getAll('exerciseLogs')])
  return new Set([...meals.map((m) => m.date), ...exerciseLogs.map((e) => e.date)])
}

// 자주 먹은 음식 이름 (많이 기록한 순). 검색창을 비워둔 상태에서 상단 노출용.
export async function getFrequentFoodNames(limit = 8) {
  const db = await getDB()
  const all = await db.getAll('meals')
  const counts = new Map()
  for (const m of all) counts.set(m.name, (counts.get(m.name) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name)
}

// 최근 n일간의 날짜별 실제 섭취 칼로리 합계(월간 현황 달력용). getRecentExerciseSummary와
// 같은 패턴: meals 전체를 한 번 읽어 날짜 집합으로 걸러 합산한다.
export async function getMealsSummaryForDates(dateKeys) {
  const db = await getDB()
  const all = await db.getAll('meals')
  const set = new Set(dateKeys)
  const byDate = new Map(dateKeys.map((d) => [d, { date: d, kcal: 0, count: 0 }]))
  for (const m of all) {
    if (!set.has(m.date)) continue
    const row = byDate.get(m.date)
    row.kcal += m.kcal
    row.count += 1
  }
  return dateKeys.map((d) => byDate.get(d))
}

// ── 식단 계획(3단계 주간 편성) ───────────────────────
export async function addMealPlanItem(entry) {
  const db = await getDB()
  return db.add('mealPlans', entry)
}

export async function deleteMealPlanItem(id) {
  const db = await getDB()
  await db.delete('mealPlans', id)
}

export async function getMealPlansByDate(date) {
  const db = await getDB()
  return db.getAllFromIndex('mealPlans', 'date', date)
}

// 여러 날짜(주간)를 한 번에 읽어 date -> 항목 배열로 묶는다.
export async function getMealPlansByDates(dateKeys) {
  const lists = await Promise.all(dateKeys.map((d) => getMealPlansByDate(d)))
  return new Map(dateKeys.map((d, i) => [d, lists[i]]))
}

// 특정 날짜·끼니의 계획을 통째로 교체한다(자동 편성·끼니 교체에서 사용) —
// 기존 항목을 지우고 새 항목들을 추가한다.
export async function replaceMealPlanSlot(date, meal, items) {
  const db = await getDB()
  const tx = db.transaction('mealPlans', 'readwrite')
  const existing = await tx.store.index('date').getAll(date)
  await Promise.all(existing.filter((e) => e.meal === meal).map((e) => tx.store.delete(e.id)))
  await Promise.all(items.map((item) => tx.store.add({ ...item, date, meal })))
  await tx.done
}

// ── 날짜별 기타 기록(물 · 체중 · 운동) ──────────────────
const DAY_DEFAULTS = {
  water: 0, weight: null,
  steps: 0, sleepHours: null,
  milestone50: false, milestone90: false,
  // 2단계(운동): 오늘 선택한 장소·시간, 배정된 루틴(운동 id 목록), 완료한 운동 id, 오늘 소모 칼로리
  exercisePlace: 'home', exerciseMinutes: 30,
  routine: [], routineDone: [], exerciseKcal: 0,
  routineBodyParts: [], // 어제 메인 운동 부위(연속 이틀 회피용)
  routineOverrides: {}, // 2.7단계: 이번 세션에 늘린 세트/유산소 시간({id:{sets,reps}})
}

export async function getDay(date) {
  const db = await getDB()
  const row = await db.get('days', date)
  return { date, ...DAY_DEFAULTS, ...row }
}

export async function setDay(date, partial) {
  const db = await getDB()
  const current = await db.get('days', date)
  const next = { date, ...DAY_DEFAULTS, ...current, ...partial }
  await db.put('days', next)
  return next
}

// ── 운동 세션 기록 ───────────────────────────────────
export async function addExerciseLog(entry) {
  const db = await getDB()
  return db.add('exerciseLogs', entry)
}

export async function getExerciseLogsByDate(date) {
  const db = await getDB()
  return db.getAllFromIndex('exerciseLogs', 'date', date)
}

// 최근 n일(오늘 포함) 운동 기록. 날짜별 소모 칼로리 합계를 함께 반환한다.
export async function getRecentExerciseSummary(dateKeys) {
  const db = await getDB()
  const all = await db.getAll('exerciseLogs')
  const set = new Set(dateKeys)
  const byDate = new Map(dateKeys.map((d) => [d, { date: d, kcal: 0, count: 0 }]))
  for (const log of all) {
    if (!set.has(log.date)) continue
    const row = byDate.get(log.date)
    row.kcal += log.kcal
    row.count += 1
  }
  return dateKeys.map((d) => byDate.get(d))
}

// 같은 운동의 가장 최근 기록(오늘 이전)을 반환한다 — 없으면 null("첫 도전").
// 2.7단계 §1-4: "지난번엔 8회였어요 — 오늘은 10회!" 비교의 근거 데이터.
export async function getLastExerciseLog(exerciseId, beforeDate) {
  const db = await getDB()
  const all = await db.getAll('exerciseLogs')
  const prior = all.filter((log) => log.exerciseId === exerciseId && log.date < beforeDate)
  if (prior.length === 0) return null
  prior.sort((a, b) => (a.date < b.date ? 1 : -1))
  return prior[0]
}

// ── 운동별 누적 통계(점진적 증가 · 3회 이상 교체 제외 규칙용) ──
const EXERCISE_META_DEFAULTS = {
  completedCount: 0, firstCompletedAt: null, lastCompletedAt: null, swapCount: 0,
}

export async function getAllExerciseMeta() {
  const db = await getDB()
  const rows = await db.getAll('exerciseMeta')
  return new Map(rows.map((r) => [r.id, { ...EXERCISE_META_DEFAULTS, ...r }]))
}

export async function bumpExerciseCompleted(id, date) {
  const db = await getDB()
  const current = await db.get('exerciseMeta', id)
  const next = {
    ...EXERCISE_META_DEFAULTS,
    ...current,
    id,
    completedCount: (current?.completedCount || 0) + 1,
    firstCompletedAt: current?.firstCompletedAt || date,
    lastCompletedAt: date,
  }
  await db.put('exerciseMeta', next)
  return next
}

export async function bumpExerciseSwapped(id) {
  const db = await getDB()
  const current = await db.get('exerciseMeta', id)
  const next = { ...EXERCISE_META_DEFAULTS, ...current, id, swapCount: (current?.swapCount || 0) + 1 }
  await db.put('exerciseMeta', next)
  return next
}
