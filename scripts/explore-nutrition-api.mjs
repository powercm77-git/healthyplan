// scripts/explore-nutrition-api.mjs — 식약처 식품영양성분DB(FoodNtrCpntDbInfo02) 응답 구조 탐색
// 목적: getFoodNtrCpntDbInq02 응답의 실제 필드명(kcal·탄·단·지·1회제공량 등)을 확인한다.
// 여기서 확인한 구조를 기반으로 fetch-nutrition.mjs를 작성한다. 필드명을 추측해 넘어가지 않는다.
//
// 사용법: DATA_GO_KR_KEY를 .env에 넣고 실행
//   node scripts/explore-nutrition-api.mjs

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
if (!KEY) {
  console.error('[FAIL] DATA_GO_KR_KEY가 없습니다. 프로젝트 루트에 .env를 만들고 DATA_GO_KR_KEY=발급받은키 를 넣어주세요.')
  process.exit(1)
}

const URL_BASE = 'https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02'

async function fetchTrying(params) {
  const qs1 = new URLSearchParams({ ...params, serviceKey: KEY })
  const url1 = `${URL_BASE}?${qs1.toString()}`
  const otherParams = new URLSearchParams(params)
  const url2 = `${URL_BASE}?serviceKey=${KEY}&${otherParams.toString()}`

  for (const [label, u] of [['URLSearchParams(자동 인코딩)', url1], ['원문 그대로 붙이기', url2]]) {
    try {
      const res = await fetch(u)
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch { /* JSON이 아닐 수 있음 */ }
      if (res.ok && json) return { ok: true, label, status: res.status, json, raw: text.slice(0, 300) }
      console.log(`  [${label}] 실패 status=${res.status} body(앞부분)=${text.slice(0, 200)}`)
    } catch (err) {
      console.log(`  [${label}] 네트워크 오류: ${err.message}`)
    }
  }
  return { ok: false }
}

function summarizeShape(obj, depth = 0, maxDepth = 8) {
  const pad = '  '.repeat(depth)
  if (depth > maxDepth) { console.log(`${pad}...(생략)`); return }
  if (Array.isArray(obj)) {
    console.log(`${pad}[Array] length=${obj.length}`)
    if (obj.length > 0) summarizeShape(obj[0], depth + 1, maxDepth)
    return
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') {
        console.log(`${pad}${k}:`)
        summarizeShape(v, depth + 1, maxDepth)
      } else {
        const preview = typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v
        console.log(`${pad}${k}: ${JSON.stringify(preview)}`)
      }
    }
    return
  }
  console.log(`${pad}${JSON.stringify(obj)}`)
}

async function main() {
  console.log('식약처 식품영양성분DB API 탐색 (numOfRows=5, 필터 없이 상위 5건 + "김치찌개" 검색 1회)\n')

  console.log(`${'='.repeat(70)}\n[필터 없음] 상위 5건\n${'='.repeat(70)}`)
  const r1 = await fetchTrying({ pageNo: '1', numOfRows: '5', type: 'json' })
  if (r1.ok) {
    console.log(`  성공 방식: ${r1.label} (HTTP ${r1.status})`)
    summarizeShape(r1.json)
  } else {
    console.log('  -> 두 방식 모두 실패. DATA_GO_KR_KEY와 활용신청 승인 상태를 확인하세요.')
  }

  await new Promise((r) => setTimeout(r, 200))

  // 음식명 검색 파라미터명을 모르므로 흔한 후보 여러 개를 한 번에 실어 보낸다.
  // 응답에 실제로 필터링이 걸렸는지는 사람이 눈으로 확인해야 한다(추측 금지 원칙).
  console.log(`\n${'='.repeat(70)}\n["김치찌개" 검색 시도 — 파라미터명 후보 다중 시도]\n${'='.repeat(70)}`)
  const candidateParams = ['FOOD_NM_KR', 'foodNmKr', 'DESC_KOR', 'searchFoodNm']
  for (const p of candidateParams) {
    console.log(`\n-- 후보 파라미터: ${p}=김치찌개 --`)
    const r = await fetchTrying({ pageNo: '1', numOfRows: '5', type: 'json', [p]: '김치찌개' })
    if (r.ok) {
      console.log(`  성공 방식: ${r.label} (HTTP ${r.status})`)
      summarizeShape(r.json, 0, 3)
    } else {
      console.log('  -> 실패')
    }
    await new Promise((r2) => setTimeout(r2, 200))
  }

  console.log('\n\n탐색 완료. 실제 필터링이 걸린 파라미터명과 kcal/탄/단/지/1회제공량 필드명을 위 출력에서 직접 확인한 뒤 fetch-nutrition.mjs를 작성하세요.')
}

main().catch((err) => { console.error('[FAIL]', err); process.exit(1) })
