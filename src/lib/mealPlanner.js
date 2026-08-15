// mealPlanner.js — 주간 식단 자동 편성 (3단계). 순수 함수로 구성한다: IndexedDB 접근은
// 화면(screens)에서 하고 여기는 이미 로드된 데이터(foods, profile, mealSettings)만 받는다.
//
// 핵심 설계 판단: 칼로리만 맞추면 "흰쌀밥+믹스커피+콜라"처럼 숫자는 맞아도 실제로 먹기
// 힘든 조합이 나올 수 있다. 그래서 745종 중 아무거나 칼로리로만 고르지 않고, 끼니마다
// 한식 식사 구조(밥+국+반찬, 또는 그 자체로 완결되는 한 그릇 음식)를 "템플릿"으로 두고
// 각 자리를 칼로리가 맞는 후보로 채우는 방식으로 조합한다.

import { isWeekend } from './date.js'

export const MEAL_TYPES = ['아침', '점심', '저녁', '간식']

// 끼니별 하루 칼로리 배분 비율(발주자 지시: 아침은 간단히, 저녁은 여유 있게 — 저녁 비중을
// 점심과 비슷하게 두되 반찬 한 자리를 더 준다). "정할 수 없는 끼니"가 있으면 그 끼니를 뺀
// 나머지 끼니끼리 이 비율로 재정규화한다.
export const DEFAULT_MEAL_RATIOS = { 아침: 0.25, 점심: 0.35, 저녁: 0.30, 간식: 0.10 }

// 끼니별 기본 설정: editable=false면 자동 편성 대상에서 빠지고 fixedKcal(급식 평균 등)만
// 하루 총량 계산에 더해진다. 프로필에 저장된 값이 없을 때의 기본값(전부 직접 정함)이다.
export const DEFAULT_MEAL_SETTINGS = {
  아침: { editable: true, fixedKcal: 400 },
  점심: { editable: true, fixedKcal: 650 },
  저녁: { editable: true, fixedKcal: 650 },
  간식: { editable: true, fixedKcal: 200 },
}

// 그 자체로 완결된 한 그릇 밥 요리(덮밥·비빔밥·김밥·볶음밥·초밥·라이스류·죽류 등) — 국·반찬
// 없이도 자연스럽다. "밥" 카테고리(86종)를 이 패턴으로 나눠 "맨밥류"는 국·반찬과 짝짓고
// "한그릇류"는 단독 템플릿에 쓴다. 죽도 여기 포함한다 — 맨밥처럼 국(그것도 무거운 찌개류)과
// 짝지으면 "죽+알탕"처럼 어색한 조합이 나온다(실측으로 확인).
const STANDALONE_RICE = /덮밥|비빔밥|김밥|볶음밥|국밥|라이스|리조또|동$|초밥|나시고랭|카오팟|포케|그라탕|필라프|도시락|마끼|알밥|죽$/
// 이유식·미음은 성인 식단 자동 편성 대상이 아니다(이유식/회복기 유동식).
const NOT_ADULT_MEAL = /^미음$|이유식/
// "면분식" 카테고리 중 실제로 한 끼가 되는 것만 — 부침개(~전)·튀김 단품·순대·꼬치류는
// 곁들이 음식이라 그것만으로 한 끼를 구성하면 부자연스럽다.
const NOODLE_MAIN_EXCLUDE = /전$|튀김|순대|꼬치|소떡소떡/
// "간편식" 카테고리 중 감자튀김·치킨너겟처럼 곁들이 튀김류는 칼로리는 끼니만큼 나와도
// 그것 하나만으로 아침·점심·저녁을 구성하면 부자연스럽다(실측으로 확인) — 도시락·컵밥·
// 즉석밥·샌드위치류처럼 그 자체로 식사가 되는 것만 남긴다.
const CONVENIENCE_MEAL_EXCLUDE = /^감자튀김|^치킨너겟|^핫바$/

// 아침 단백질 보장(발주자 지시): 우유·과일만으로 아침이 구성되면 안 된다 — 계란·두부·
// 요거트·닭가슴살류 등 실제 단백질원 중 하나가 반드시 들어가야 한다. 다만 아침은 조리
// 시간이 짧아야 하므로, 손이 오래 가는 조리(예: 두부조림처럼 오래 졸이는 것 대신 두부
// 부침처럼 빠른 것)는 제외하고 "빨리 되는 단백질"만 후보로 둔다.
function breakfastProteinPool(foods) {
  return foods.filter((f) => (
    (f.category === '반찬' && /^계란찜$|^계란말이$|^계란후라이$|^두부부침$/.test(f.name)) ||
    (f.category === '유제품' && /^요거트$|그릭요거트/.test(f.name)) ||
    (f.category === '간편식' && /^닭가슴살|^훈제란$|^단백질음료$|^프로틴쿠키$/.test(f.name))
  ))
}

// 간식의 가공 우유(초코·딸기·바나나우유) 반복 억제(발주자 지시: 주 2회 이하) — planWeek에서
// 주간 카운터로 상한을 넘으면 이 목록을 avoidList에 임시로 얹어 그날 간식 후보에서 뺀다.
const PROCESSED_MILK = ['초코우유', '딸기우유', '바나나우유']
const PROCESSED_MILK_WEEKLY_CAP = 2

// 해장국류(발주자 지시: 주 1회 제한) — 국찌개 카테고리 중 "해장국"으로 끝나는 것 전부.
const HAEJANGGUK = ['황태해장국', '콩나물해장국', '선지해장국', '시래기해장국', '뼈해장국']
const HAEJANGGUK_WEEKLY_CAP = 1

// 조리 난이도 추정(발주자 지시): 손이 많이 가는 음식(찜류, 특수 해산물, 스테이크, 훈제,
// 오래 끓이는 보양탕류 등)은 이름으로 추정한다. 확신이 없는 음식은 이 목록에 넣지 않고
// "평일에도 가능"으로 둔다 — 이미 이 목록에 있는 것만 "어렵다"고 보는 화이트리스트 방식이라
// 목록에 없으면 자동으로 "평일 가능"이 되므로, 반대로 "확신 없으면 평일 제외"를 지키려면
// 목록을 넓게 잡아야 한다. 손질·조리 시간이 길다고 널리 알려진 음식 위주로 잡았다.
// "계란찜"은 "찜"이 들어가지만 전자레인지·밥솥으로 10분이면 되는 간단한 아침 단백질원이라
// 제외한다(실측 중 발견 — 아침 단백질 자리에 골랐는데 난이도 필터에 다시 걸러지는 모순이 있었다).
const HARD_DIFFICULTY = /(?<!계란)찜|전복|스테이크|훈제|보쌈|족발|랍스터|킹크랩|대게|삼계탕|설렁탕|곰탕|감자탕|추어탕|매운탕|알탕|사골|장어|샤브샤브/
// 간편식·유제품·과일·빵간식·면분식은 정의상 손이 적게 가는 카테고리라 난이도 필터를
// 적용하지 않는다(예: "훈제란"은 간편식이라 손질 없이 바로 먹는다 — 필터 대상 아님).
const HARD_SCOPED_CATEGORIES = new Set(['고기생선', '국찌개', '반찬', '밥'])
function easyOnly(list, allowHard) {
  if (allowHard) return list
  return list.filter((f) => !HARD_SCOPED_CATEGORIES.has(f.category) || !HARD_DIFFICULTY.test(f.name))
}

function isAvoided(food, avoidList) {
  if (!avoidList?.length) return false
  return avoidList.some((term) => term && (food.name.includes(term) || term.includes(food.name)))
}

function pool(foods, cat, filter) {
  const list = foods.filter((f) => f.category === cat)
  return filter ? list.filter(filter) : list
}

function convenienceMeal(foods) {
  return pool(foods, '간편식', (f) => !CONVENIENCE_MEAL_EXCLUDE.test(f.name))
}

function breakfastTemplates(foods) {
  const protein = breakfastProteinPool(foods)
  const proteinConvenience = protein.filter((f) => f.category === '간편식')
  return [
    [
      { share: 0.45, pool: pool(foods, '빵간식') },
      { share: 0.30, pool: protein },
      { share: 0.25, pool: pool(foods, '과일') },
    ],
    [
      { share: 0.55, pool: protein },
      { share: 0.45, pool: pool(foods, '과일') },
    ],
    // 간편식 단독형도 단백질 보장을 위해 닭가슴살류·훈제란 등 단백질 있는 것만 남긴다.
    [{ share: 1.0, pool: proteinConvenience }],
  ]
}

function lunchDinnerTemplates(foods, allowHard) {
  const plainRice = easyOnly(pool(foods, '밥', (f) => !STANDALONE_RICE.test(f.name) && !NOT_ADULT_MEAL.test(f.name)), allowHard)
  const soup = easyOnly(pool(foods, '국찌개'), allowHard)
  const banchan = easyOnly(pool(foods, '반찬'), allowHard)
  const meatFish = easyOnly(pool(foods, '고기생선'), allowHard)
  const standaloneRice = easyOnly(pool(foods, '밥', (f) => STANDALONE_RICE.test(f.name)), allowHard)
  return [
    [
      { share: 0.32, pool: plainRice },
      { share: 0.24, pool: soup },
      { share: 0.16, pool: banchan },
      { share: 0.28, pool: meatFish },
    ],
    [
      { share: 0.45, pool: plainRice },
      { share: 0.30, pool: soup },
      { share: 0.25, pool: banchan },
    ],
    // 밥+국+반찬 2개(발주자 지시: 반찬 2개까지, 총 4가지 이내) — 고기생선 없이 반찬을
    // 두 자리로 늘린 변형. 두 자리 다 같은 반찬 풀에서 고르지만 overlapsName이 겹치는
    // 이름은 걸러내므로 서로 다른 반찬 두 가지가 나온다.
    [
      { share: 0.35, pool: plainRice },
      { share: 0.25, pool: soup },
      { share: 0.20, pool: banchan },
      { share: 0.20, pool: banchan },
    ],
    [{ share: 1.0, pool: pool(foods, '면분식', (f) => !NOODLE_MAIN_EXCLUDE.test(f.name)) }],
    [{ share: 1.0, pool: standaloneRice }],
    [{ share: 1.0, pool: convenienceMeal(foods) }],
  ]
}

function snackTemplates(foods) {
  return [
    [{ share: 1.0, pool: pool(foods, '과일') }],
    [{ share: 1.0, pool: pool(foods, '유제품') }],
    [{ share: 1.0, pool: pool(foods, '빵간식') }],
    [
      { share: 0.5, pool: pool(foods, '과일') },
      { share: 0.5, pool: pool(foods, '유제품') },
    ],
  ]
}

function templatesFor(mealType, foods, allowHard) {
  if (mealType === '아침') return breakfastTemplates(foods)
  if (mealType === '간식') return snackTemplates(foods)
  return lunchDinnerTemplates(foods, allowHard)
}

function scoreCandidate(food, targetKcal, preferProtein, recentNames) {
  const kcalDiff = Math.abs(food.kcal - targetKcal) / Math.max(targetKcal, 1)
  // 감량 목표는 단백질 확보가 중요하다(§2-1) — 칼로리가 비슷하면 단백질 비중이 높은
  // 쪽을 살짝 더 선호한다. 순위를 뒤집을 정도로 크지 않게 작은 가중치만 둔다.
  const proteinBonus = preferProtein ? -(food.protein / Math.max(food.kcal, 1)) * 0.6 : 0
  // 최근 며칠 안에 나온 음식은 3일 연속만 아니면 규칙상 다시 나와도 되지만, 격일로
  // 반복되면 "이번 주 내내 이것만 먹네" 싶어진다(실측으로 확인) — 아예 막지 않고
  // 점수만 살짝 불리하게 둬서, 후보가 넉넉하면 자연히 다른 음식이 뽑히게 한다. 국찌개는
  // "같은 성격의 국이 반복되지 않게"(발주자 지시) 페널티를 더 크게 둬 다양성을 강화한다.
  const recencyWeight = food.category === '국찌개' ? 0.22 : 0.12
  const recencyPenalty = recentNames?.has(food.name) ? recencyWeight : 0
  return kcalDiff + proteinBonus + recencyPenalty
}

// slotPool에서 targetKcal에 가까운 후보를 고른다. 기피 음식은 항상 제외하고, 3일 연속
// 반복(blockedNames)과 같은 날 중복(usedTodayNames)은 가능하면 피하되, 그 조건 때문에
// 후보가 아예 없어지면 단계적으로 조건을 완화한다(끼니를 못 채우는 것보다 낫다).
function pickForSlot(slotPool, targetKcal, { avoidList, blockedNames, usedTodayNames, preferProtein, recentNames }) {
  const base = slotPool.filter((f) => !isAvoided(f, avoidList))
  const strict = base.filter((f) => !blockedNames.has(f.name) && !usedTodayNames.has(f.name))
  const relaxed = base.filter((f) => !usedTodayNames.has(f.name))
  const finalPool = strict.length > 0 ? strict : (relaxed.length > 0 ? relaxed : base)
  if (finalPool.length === 0) return null
  const scored = finalPool
    .map((f) => ({ f, score: scoreCandidate(f, targetKcal, preferProtein, recentNames) }))
    .sort((a, b) => a.score - b.score)
  // 매번 1등만 고르면 자동 편성을 반복할 때마다 같은 조합만 나온다 — 근접한 후보
  // 몇 개 중에서 무작위로 골라 주 단위로 봤을 때 다양성이 생기게 한다.
  const top = scored.slice(0, Math.min(4, scored.length))
  return top[Math.floor(Math.random() * top.length)].f
}

// 한쪽 이름이 다른 쪽 이름에 포함되면 사실상 같은 재료다("순두부찌개"↔"순두부",
// "김치찌개"↔"김치") — 한 끼 안에서 이런 조합이 동시에 뽑히면 "찌개도 순두부, 반찬도
// 순두부"처럼 겹치는 조합이 나온다(실측으로 확인). 같은 끼니 안에서만 걸러낸다.
function overlapsName(a, b) {
  return a.includes(b) || b.includes(a)
}

// 끼니 하나(예: 저녁)를 template 후보 중 하나로 채운다. 템플릿 순서를 섞어 시도하고,
// 어떤 자리든 후보가 없으면 그 템플릿은 포기하고 다음 템플릿을 시도한다.
// 한 끼 구성 개수 상한(발주자 지시): 총 4가지, 그중 반찬은 2개까지. 템플릿 자체가 이미
// 이 범위 안에서 짜여 있지만, 안전망으로 한 번 더 확인한다.
const MAX_ITEMS_PER_MEAL = 4
const MAX_BANCHAN_PER_MEAL = 2

export function composeMeal(mealType, targetKcal, ctx) {
  const {
    foods, avoidList = [], blockedNames = new Set(), usedTodayNames = new Set(),
    preferProtein = false, recentNames = new Set(), allowHard = true,
  } = ctx
  const templates = templatesFor(mealType, foods, allowHard)
  const order = templates.map((_, i) => i).sort(() => Math.random() - 0.5)
  for (const idx of order) {
    const template = templates[idx]
    const items = []
    const localUsed = new Set(usedTodayNames)
    let ok = true
    for (const slot of template) {
      const slotPool = slot.pool.filter((f) => !items.some((picked) => overlapsName(f.name, picked.name)))
      if (slotPool.length === 0) { ok = false; break }
      const picked = pickForSlot(slotPool, targetKcal * slot.share, { avoidList, blockedNames, usedTodayNames: localUsed, preferProtein, recentNames })
      if (!picked) { ok = false; break }
      items.push(picked)
      localUsed.add(picked.name)
    }
    if (!ok || items.length === 0) continue
    if (items.length > MAX_ITEMS_PER_MEAL) continue
    if (items.filter((f) => f.category === '반찬').length > MAX_BANCHAN_PER_MEAL) continue
    return { items, totalKcal: items.reduce((s, f) => s + f.kcal, 0) }
  }
  return { items: [], totalKcal: 0 }
}

export function sumItems(items) {
  return items.reduce(
    (s, f) => ({ kcal: s.kcal + f.kcal, carbs: s.carbs + f.carbs, protein: s.protein + f.protein, fat: s.fat + f.fat }),
    { kcal: 0, carbs: 0, protein: 0, fat: 0 },
  )
}

export function editableMealsOf(mealSettings) {
  return MEAL_TYPES.filter((m) => mealSettings[m]?.editable !== false)
}

// 하루 총합(편성 가능한 끼니 + 고정 끼니)이 목표의 ±10% 밖이면, 항목을 빼지 않고 같은
// 카테고리의 다른 후보로 바꿔가며 목표 쪽으로 조금씩 당긴다(운동 루틴의 세트 수 조정과
// 같은 원칙 — 이미 고른 자리를 없애지 않고 강도만 조절한다).
function adjustDayToTarget(dayPlan, editable, targetTotal, fixedSum, { foods, avoidList, usedToday, date, extraAvoid = [] }) {
  const lo = targetTotal * 0.9 - fixedSum
  const hi = targetTotal * 1.1 - fixedSum
  const mid = (lo + hi) / 2
  const currentTotal = () => editable.reduce((s, m) => s + dayPlan[m].reduce((s2, f) => s2 + f.kcal, 0), 0)
  // 아침 단백질 자리는 교정 스왑에서도 지켜야 한다 — 그렇지 않으면 "그릭요거트"가
  // "초코우유"로 바뀌는 식으로 단백질 보장이 깨질 수 있다.
  const proteinNames = new Set(breakfastProteinPool(foods).map((f) => f.name))

  let guard = 0
  while ((currentTotal() < lo || currentTotal() > hi) && guard < 12) {
    guard++
    const over = currentTotal() > hi
    let best = null
    for (const meal of editable) {
      const items = dayPlan[meal]
      // 교정 스왑도 원래 편성과 같은 제약(기피·주간 상한·평일 난이도 제외)을 지켜야
      // 목표 칼로리로 당기는 과정에서 규칙을 다시 어기지 않는다.
      const allowHard = meal === '저녁' && isWeekend(date)
      for (let i = 0; i < items.length; i++) {
        const cur = items[i]
        const isProteinSlot = meal === '아침' && proteinNames.has(cur.name)
        // "밥" 카테고리는 맨밥류와 한그릇류(도시락·덮밥 등)가 섞여 있다 — 교정 스왑이 이
        // 구분을 무시하면 "불고기도시락+순두부찌개+반찬"처럼 이미 완결된 한 그릇 요리가
        // 국·반찬과 다시 짝지어지는 부자연스러운 조합이 나온다(실측으로 확인). 같은
        // 하위 유형끼리만 바꾼다.
        const curIsStandalone = cur.category === '밥' && STANDALONE_RICE.test(cur.name)
        const candidates = foods.filter((f) => (
          f.category === cur.category && f.name !== cur.name
          && !isAvoided(f, avoidList) && !isAvoided(f, extraAvoid)
          && (allowHard || !HARD_SCOPED_CATEGORIES.has(f.category) || !HARD_DIFFICULTY.test(f.name))
          && (!isProteinSlot || proteinNames.has(f.name))
          && (f.category !== '밥' || STANDALONE_RICE.test(f.name) === curIsStandalone)
        ))
        for (const cand of candidates) {
          const delta = cand.kcal - cur.kcal
          if (over && delta >= 0) continue
          if (!over && delta <= 0) continue
          const newTotal = currentTotal() + delta
          const improvement = Math.abs(currentTotal() - mid) - Math.abs(newTotal - mid)
          if (improvement > 0 && (!best || improvement > best.improvement)) {
            best = { meal, i, cand, improvement }
          }
        }
      }
    }
    if (!best) break
    const oldName = dayPlan[best.meal][best.i].name
    dayPlan[best.meal][best.i] = best.cand
    usedToday.delete(oldName)
    usedToday.add(best.cand.name)
  }
}

/**
 * 여러 날짜(보통 7일)의 식단을 자동 편성한다.
 * @param {object} opts
 * @param {Array} opts.foods - foods.json 전체
 * @param {object} opts.profile - { target, goal, ... }
 * @param {object} opts.mealSettings - { 아침:{editable,fixedKcal}, ... } (DEFAULT_MEAL_SETTINGS 형태)
 * @param {string[]} opts.avoidList - 알레르기·기피 음식 키워드
 * @param {string[]} opts.dates - 편성할 날짜(YYYY-MM-DD) 배열
 * @returns {object} date -> { 아침:[foods], 점심:[...], ... } (editable 끼니만 키로 존재)
 */
export function planWeek({ foods, profile, mealSettings = DEFAULT_MEAL_SETTINGS, avoidList = [], dates }) {
  const targetTotal = profile.target
  const editable = editableMealsOf(mealSettings)
  const fixedSum = MEAL_TYPES.filter((m) => !editable.includes(m))
    .reduce((s, m) => s + (mealSettings[m]?.fixedKcal || 0), 0)
  const editableBudget = Math.max(0, targetTotal - fixedSum)
  const ratioSum = editable.reduce((s, m) => s + (DEFAULT_MEAL_RATIOS[m] || 0), 0) || 1
  const preferProtein = profile.goal === 'lose'

  let prevDay = new Set()
  let prevPrevDay = new Set()
  let history = [] // 최근 최대 3일치 usedToday — "3일 연속"은 아니어도 격일 반복을 줄이는 데 쓴다
  let processedMilkCount = 0 // 주간 가공우유(간식) 카운터 — 2회 넘으면 그 뒤로 제외
  let haejangCount = 0 // 주간 해장국류 카운터 — 1회 넘으면 그 뒤로 제외
  const result = {}

  for (const date of dates) {
    // 3일 연속 반복 방지: 어제·그제 이틀 모두에 나온 음식은 오늘 후보에서 뺀다
    // (오늘까지 고르면 3일 연속이 되는 경우만 정확히 막는다).
    const blockedNames = new Set([...prevDay].filter((n) => prevPrevDay.has(n)))
    // 최근 3일 안에 나온 음식(격일 반복 완화용 소프트 페널티, 하드 차단은 아니다).
    const recentNames = new Set(history.flatMap((s) => [...s]))
    const usedToday = new Set()
    const dayPlan = {}
    for (const meal of editable) {
      const mealTarget = editableBudget * ((DEFAULT_MEAL_RATIOS[meal] || 0) / ratioSum)
      // 조리 난이도(발주자 지시): 손이 많이 가는 음식은 주말 저녁에만 허용한다.
      const allowHard = meal === '저녁' && isWeekend(date)
      const extraAvoid = [
        ...(meal === '간식' && processedMilkCount >= PROCESSED_MILK_WEEKLY_CAP ? PROCESSED_MILK : []),
        ...(haejangCount >= HAEJANGGUK_WEEKLY_CAP ? HAEJANGGUK : []),
      ]
      const { items } = composeMeal(meal, mealTarget, {
        foods, avoidList: [...avoidList, ...extraAvoid], blockedNames, usedTodayNames: usedToday, preferProtein, recentNames, allowHard,
      })
      dayPlan[meal] = items
      items.forEach((f) => {
        usedToday.add(f.name)
        if (meal === '간식' && PROCESSED_MILK.includes(f.name)) processedMilkCount++
        if (HAEJANGGUK.includes(f.name)) haejangCount++
      })
    }
    const dayExtraAvoid = [
      ...(processedMilkCount >= PROCESSED_MILK_WEEKLY_CAP ? PROCESSED_MILK : []),
      ...(haejangCount >= HAEJANGGUK_WEEKLY_CAP ? HAEJANGGUK : []),
    ]
    adjustDayToTarget(dayPlan, editable, targetTotal, fixedSum, { foods, avoidList, usedToday, date, extraAvoid: dayExtraAvoid })

    result[date] = dayPlan
    prevPrevDay = prevDay
    prevDay = usedToday
    history = [...history, usedToday].slice(-3)
  }
  return result
}

// "한 끼 교체": 같은 끼니를 다른 조합으로 다시 짜서 서로 다른 대안 여러 개를 제시한다.
// 3일 연속 반복 규칙은 사용자가 직접 고르는 맥락이라 적용하지 않는다.
export function getMealAlternatives(mealType, targetKcal, ctx, count = 4) {
  const { foods, avoidList = [], preferProtein = false, allowHard = true } = ctx
  const results = []
  const seen = new Set()
  let guard = 0
  while (results.length < count && guard < 30) {
    guard++
    const { items } = composeMeal(mealType, targetKcal, { foods, avoidList, preferProtein, allowHard })
    if (items.length === 0) break
    const key = items.map((f) => f.name).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    results.push({ items, totalKcal: items.reduce((s, f) => s + f.kcal, 0) })
  }
  return results
}
