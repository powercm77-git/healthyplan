// scripts/fetch-nutrition.mjs — 식약처 식품영양성분DB(FoodNtrCpntDbInfo02)로 foods.json 745종의
// kcal·탄·단·지를 공인 수치로 교체한다.
//
// 발주자 확정 규칙:
//   1. FOOD_NM_KR이 우리 음식명과 정확히 일치하는 항목이 있으면 그것을 채택
//   2. 없으면 FOOD_REF_NM이 일치하는 변형들 중 열량(AMT_NUM1) 중앙값에 가장 가까운 변형을
//      "통째로" 채택(탄단지를 따로 평균 내지 않는다 — 정합성 유지)
//   3. 가공식품(FOOD_OR_NM에 "가공" 포함, 또는 이름에 영문 브랜드 패턴)보다 일반 요리를 우선
//   4. AMT_NUM1(열량)/3(단백질)/4(지방)/6(탄수화물)만 사용 — 역산 검증 안 된 2·5는 쓰지 않음
//   5. SERVING_SIZE는 100g 기준 → 우리 serving의 g 수에 비례 환산
//
// 매칭 실패 항목은 기존 값 유지 + source:"추정". 매칭 성공은 source:"식약처" + sourceFood 기록.
//
// 사용법: node scripts/fetch-nutrition.mjs

import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

const env = { ...loadEnv(), ...process.env }
const KEY = env.DATA_GO_KR_KEY
if (!KEY) { console.error('[FAIL] DATA_GO_KR_KEY가 없습니다.'); process.exit(1) }

const BASE = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02'
const FOODS_PATH = path.resolve(process.cwd(), 'src/data/foods.json')

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function normalize(s) { return (s || '').replace(/[()（）\s]/g, '').trim() }

// data.go.kr 응답이 KSPO API와 달리 response{} 래핑 없이 header/body가 최상위에 바로 온다.
// numOfRows 상한은 500(그 이상 요청하면 에러). "사과"처럼 부분일치 후보가 수천 건인 흔한
// 이름은 정확일치/FOOD_REF_NM 그룹이 뒤 페이지에 있을 수 있어, 찾을 때까지 최대 4페이지(2000건)
// 까지만 점진적으로 더 가져온다(대부분은 1페이지에서 끝나 호출 비용이 낮다).
async function fetchPage(name, pageNo) {
  const qs = new URLSearchParams({ FOOD_NM_KR: name, pageNo: String(pageNo), numOfRows: '500', type: 'json', serviceKey: KEY })
  const url = `${BASE}?${qs.toString()}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url)
      const text = await res.text()
      const json = JSON.parse(text)
      if (json.header?.resultCode !== '00') throw new Error(`API 오류: ${json.header?.resultCode} ${json.header?.resultMsg}`)
      const raw = json.body?.items
      const items = Array.isArray(raw) ? raw : (raw ? [raw] : [])
      return { items, totalCount: Number(json.body?.totalCount || 0) }
    } catch (err) {
      console.log(`  [재시도 ${attempt}/3] "${name}" 검색 실패(page ${pageNo}): ${err.message}`)
      if (attempt === 3) return { items: [], totalCount: 0 }
      await sleep(500 * attempt)
    }
  }
  return { items: [], totalCount: 0 }
}

async function searchByName(name) {
  const targetNorm = normalize(name)
  let all = []
  for (let pageNo = 1; pageNo <= 6; pageNo++) {
    const { items, totalCount } = await fetchPage(name, pageNo)
    all = all.concat(items)
    // 브랜드/가공식품이거나 지방·탄수화물 칸이 빈 완전일치는 "찾은 것"으로 치지 않는다 —
    // 그런 히트에서 바로 멈추면(실사례: "사과"라는 이름의 아이스크림 제품, 지방/탄수화물
    // 미기재인 "외식 프랜차이즈" 행) 뒤 페이지의 진짜 후보를 못 보고 지나칠 수 있다.
    const hasGoodExact = all.some((it) => normalize(it.FOOD_NM_KR) === targetNorm && !isBranded(it) && hasCompleteMacros(it))
    const hasRef = all.some((it) => normalize(it.FOOD_REF_NM) === targetNorm && hasCompleteMacros(it))
    if (hasGoodExact || hasRef) break
    if (all.length >= totalCount) break // 이미 전부 받음
    await sleep(200)
  }
  return all
}

// 일부 "외식(프랜차이즈 등 업체 제공 영양정보)" 행은 열량/단백질만 보고하고 지방·탄수화물
// 칸을 아예 비워둔다(빈 문자열). Number('')는 0이 되어 "지방 0g" 같은 거짓 값을 만들어내므로
// (실사례: "그라탕_콘치즈그라탕 (L)" — kcal=387인데 fat/carbs 칸이 비어 0으로 둔갑),
// 4개 필드가 전부 실제 숫자로 채워진 행만 후보로 인정한다.
function hasCompleteMacros(item) {
  return ['AMT_NUM1', 'AMT_NUM3', 'AMT_NUM4', 'AMT_NUM6'].every((f) => {
    const v = item[f]
    return v !== undefined && v !== null && String(v).trim() !== '' && !Number.isNaN(Number(v))
  })
}

function isBranded(item) {
  if (item.FOOD_OR_NM && item.FOOD_OR_NM.includes('가공')) return true
  if (/[A-Za-z]{2,}/.test(item.FOOD_NM_KR || '')) return true // 영문 브랜드명 섞인 제품명 방어적 배제
  return false
}

// 완전일치인데도 실제로는 다른 음식인 동명이의어. 자동 규칙으로는 걸러지지 않으므로 수동 확인 후 배제.
//   아몬드유: 우리 앱은 "아몬드밀크"(저칼로리 음료, 190ml당 60kcal)를 의미하지만(별칭: 아몬드브리즈/아몬드밀크),
//   식약처 DB의 비가공 완전일치 "아몬드유"는 압착 아몬드오일(100g당 884kcal, 지방 100g당 ~98g)이다.
//   그대로 적용하면 190ml 한 팩이 지방 190g(=1680kcal)이 되는 물리적으로 불가능한 값이 나온다.
const EXCLUDE_EXACT_MATCH = new Set(['아몬드유'])

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function unitOf(servingSize) {
  if (!servingSize) return null
  if (/ml/i.test(servingSize)) return 'ml'
  if (/g/i.test(servingSize)) return 'g'
  return null
}

// 열량 중앙값에 가장 가까운 변형을 고르되(발주자 확정 규칙), 근소한 차이(동률 포함)로
// 갈릴 때는 우리 serving의 단위(g/ml)와 SERVING_SIZE 단위가 같은 쪽을 우선한다.
// (실사례: "결명자차" 그룹이 말린 씨앗(100g, 390kcal)과 추출액(100mL, 0kcal) 단 둘뿐이라
//  중앙값이 정확히 그 사이(195)에 걸려 동률이 남 — 우리는 500ml 음료이므로 추출액이 맞다)
function pickByMedianKcal(candidates, preferredUnit) {
  const nonBranded = candidates.filter((c) => !isBranded(c))
  const pool = nonBranded.length > 0 ? nonBranded : candidates
  const scored = pool.map((c) => ({ c, k: Number(c.AMT_NUM1) })).filter((x) => !Number.isNaN(x.k))
  if (scored.length === 0) return null
  const med = median(scored.map((x) => x.k))
  scored.sort((a, b) => {
    const da = Math.abs(a.k - med), db = Math.abs(b.k - med)
    if (Math.abs(da - db) > 0.5) return da - db
    const aMatch = preferredUnit && unitOf(a.c.SERVING_SIZE) === preferredUnit ? 0 : 1
    const bMatch = preferredUnit && unitOf(b.c.SERVING_SIZE) === preferredUnit ? 0 : 1
    return aMatch - bMatch
  })
  return scored[0].c
}

async function matchFood(food, preferredUnit) {
  if (EXCLUDE_EXACT_MATCH.has(food.name)) return null
  const items = (await searchByName(food.name)).filter(hasCompleteMacros)
  if (items.length === 0) return null
  const targetNorm = normalize(food.name)

  // 규칙1(완전일치)도 가공식품/브랜드품은 제외한다 — 실사례: 우리 "딸기"(신선과일)가
  // 우연히 FOOD_NM_KR="딸기"인 가공식품(기타 빵, FOOD_REF_NM="기타 빵")과 문자열만 같아서
  // 원래 로직이 그걸 그대로 채택해버림. 브랜드 배제 필터를 완전일치에도 반드시 적용해야 한다.
  const exactMatches = items.filter((it) => normalize(it.FOOD_NM_KR) === targetNorm)
  const exactNonBranded = exactMatches.filter((it) => !isBranded(it))
  if (exactNonBranded.length > 0) {
    const picked = pickByMedianKcal(exactNonBranded, preferredUnit) || exactNonBranded[0]
    return { item: picked, rule: 'exact' }
  }

  const sameRef = items.filter((it) => normalize(it.FOOD_REF_NM) === targetNorm)
  if (sameRef.length === 0) return null // FOOD_REF_NM 그룹도 없으면 근거 부족 -> 매칭 실패 처리(추정 유지)

  const picked = pickByMedianKcal(sameRef, preferredUnit)
  if (!picked) return null
  return { item: picked, rule: 'ref-median' }
}

function extractGrams(serving) {
  let m = serving.match(/(\d+(?:\.\d+)?)\s*g/)
  if (m) return parseFloat(m[1])
  m = serving.match(/(\d+(?:\.\d+)?)\s*ml/i)
  if (m) return parseFloat(m[1])
  return null
}
function extractUnit(serving) {
  if (/\d+\s*ml/i.test(serving)) return 'ml'
  if (/\d+\s*g/i.test(serving)) return 'g'
  return null
}

async function main() {
  const foods = JSON.parse(fs.readFileSync(FOODS_PATH, 'utf-8'))
  const stats = { exact: 0, refMedian: 0, unmatched: 0, noGrams: 0, inconsistent: 0 }
  const bigDiffs = []
  const unmatchedNames = []
  const inconsistentNames = []

  for (let i = 0; i < foods.length; i++) {
    const food = foods[i]
    const grams = extractGrams(food.serving)
    if (grams == null) { stats.noGrams++; food.source = '추정'; continue }
    const preferredUnit = extractUnit(food.serving)

    const result = await matchFood(food, preferredUnit)
    if (!result) {
      stats.unmatched++
      unmatchedNames.push(food.name)
      food.source = '추정'
      await sleep(200)
      continue
    }

    const { item, rule } = result
    const factor = grams / 100
    const newKcal = Math.round(Number(item.AMT_NUM1) * factor)
    const newProtein = Math.round(Number(item.AMT_NUM3) * factor)
    const newFat = Math.round(Number(item.AMT_NUM4) * factor)
    const newCarbs = Math.round(Number(item.AMT_NUM6) * factor)

    // 프로젝트 자체 무결성 테스트(foods.test.js)와 동일한 기준: 술 제외 전 항목은
    // 4×단백질+4×탄수화물+9×지방이 kcal의 ±40% 이내여야 한다. "제로" 음료처럼 대체
    // 감미료를 탄수화물로 표기하면서 실제 kcal은 훨씬 낮게 신고하는 행이 실제로 존재해서
    // (실사례: "아이스티_제로 복숭아 아이스티" kcal=4/100mL인데 탄수화물만으로도 12.7kcal
    //  상당 — 공식 수치이지만 4/4/9 공식과 안 맞는 값), 이런 행은 신뢰할 수 없으므로 매칭
    // 실패(추정 유지) 처리한다.
    if (food.category !== '술' && newKcal > 0) {
      const computed = newCarbs * 4 + newProtein * 4 + newFat * 9
      const diff = Math.abs(computed - newKcal) / newKcal
      if (diff > 0.4) {
        stats.inconsistent++
        inconsistentNames.push({ name: food.name, sourceFood: item.FOOD_NM_KR, kcal: newKcal, computed })
        stats.unmatched++
        unmatchedNames.push(food.name)
        food.source = '추정'
        await sleep(200)
        continue
      }
    }

    const diffPct = food.kcal > 0 ? Math.abs(newKcal - food.kcal) / food.kcal * 100 : 0
    if (diffPct >= 30) {
      bigDiffs.push({ name: food.name, before: food.kcal, after: newKcal, diffPct: Math.round(diffPct), sourceFood: item.FOOD_NM_KR })
    }

    food.kcal = newKcal
    food.protein = newProtein
    food.fat = newFat
    food.carbs = newCarbs
    food.source = '식약처'
    food.sourceFood = item.FOOD_NM_KR

    if (rule === 'exact') stats.exact++
    else stats.refMedian++

    if (i % 50 === 0) console.log(`  진행 ${i}/${foods.length}...`)
    await sleep(200)
  }

  fs.writeFileSync(FOODS_PATH, JSON.stringify(foods, null, 2) + '\n')

  console.log(`\n\n=== 식약처 매칭 결과 ===`)
  console.log(`전체: ${foods.length}종`)
  console.log(`  완전일치(exact): ${stats.exact}`)
  console.log(`  대표변형(ref-median): ${stats.refMedian}`)
  console.log(`  매칭 성공 합계: ${stats.exact + stats.refMedian}`)
  console.log(`  매칭 실패(추정 유지): ${stats.unmatched}`)
  console.log(`    (그중 4/4/9 공식 불일치로 배제: ${stats.inconsistent})`)
  console.log(`  g 파싱 실패(추정 유지): ${stats.noGrams}`)

  console.log(`\n±30% 이상 차이난 항목 (${bigDiffs.length}건):`)
  bigDiffs.sort((a, b) => b.diffPct - a.diffPct)
  bigDiffs.forEach((d) => console.log(`  - ${d.name}: ${d.before}kcal → ${d.after}kcal (${d.diffPct}% 차이, 식약처="${d.sourceFood}")`))

  console.log(`\n4/4/9 공식 불일치로 배제된 항목 (${inconsistentNames.length}건):`)
  inconsistentNames.forEach((d) => console.log(`  - ${d.name}: 식약처="${d.sourceFood}" kcal=${d.kcal} vs 공식계산=${Math.round(d.computed)}`))

  console.log(`\n매칭 실패 목록 (${unmatchedNames.length}건):`)
  unmatchedNames.forEach((n) => console.log(`  - ${n}`))
}

main().catch((err) => { console.error('[FAIL]', err); process.exit(1) })
