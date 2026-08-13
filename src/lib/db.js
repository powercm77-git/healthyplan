// db.js — IndexedDB 래퍼 (idb). localStorage는 사용하지 않는다.
import { openDB } from 'idb'

const DB_NAME = 'healthyplan-db'
const DB_VERSION = 2

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

// 식단 기록이 하나라도 있는 날짜 집합 (스트릭 계산용)
export async function getActiveDates() {
  const db = await getDB()
  const dates = await db.getAllKeysFromIndex('meals', 'date')
  return new Set(dates)
}

// 자주 먹은 음식 이름 (많이 기록한 순). 검색창을 비워둔 상태에서 상단 노출용.
export async function getFrequentFoodNames(limit = 8) {
  const db = await getDB()
  const all = await db.getAll('meals')
  const counts = new Map()
  for (const m of all) counts.set(m.name, (counts.get(m.name) || 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name]) => name)
}

// ── 날짜별 기타 기록(물 · 체중 · 운동) ──────────────────
const DAY_DEFAULTS = {
  water: 0, weight: null,
  milestone50: false, milestone90: false,
  // 2단계(운동): 오늘 선택한 장소·시간, 배정된 루틴(운동 id 목록), 완료한 운동 id, 오늘 소모 칼로리
  exercisePlace: 'home', exerciseMinutes: 30,
  routine: [], routineDone: [], exerciseKcal: 0,
  routineBodyParts: [], // 어제 메인 운동 부위(연속 이틀 회피용)
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
