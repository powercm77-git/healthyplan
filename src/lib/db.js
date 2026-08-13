// db.js — IndexedDB 래퍼 (idb). localStorage는 사용하지 않는다.
import { openDB } from 'idb'

const DB_NAME = 'healthyplan-db'
const DB_VERSION = 1

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
  water: 0, weight: null, exerciseId: null, exerciseDone: false,
  milestone50: false, milestone90: false,
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
