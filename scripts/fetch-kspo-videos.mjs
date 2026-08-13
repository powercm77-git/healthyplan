// scripts/fetch-kspo-videos.mjs — 국민체력100(SRVC_TODZ_VDO_PKG) 6개 엔드포인트 전체 수집
// (TODZ_VDO_FTNS_CERT_I 체력인증 측정방법은 작업지시서 §2 표에 따라 매칭에 쓰지 않으므로 제외)
// 결과를 data-raw/kspo-videos.json에 저장한다. 재수집 없이도 이 파일만으로 매칭 스크립트를
// 재현할 수 있도록 이 폴더는 커밋 대상이다(.gitignore에 넣지 않음).
//
// 사용법: node scripts/fetch-kspo-videos.mjs

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
  console.error('[FAIL] DATA_GO_KR_KEY가 없습니다.')
  process.exit(1)
}

const BASE = 'https://apis.data.go.kr/B551014/SRVC_TODZ_VDO_PKG'
// 탐색(explore-kspo-api.mjs)에서 실제 numOfRows 상한이 1000임을 확인함(9999 요청해도 1000만 반환)
const PAGE_SIZE = 1000
const ENDPOINTS = [
  ['TODZ_VDO_VIEW_ALL_LIST_I', '동영상 전체 목록'],
  ['TODZ_VDO_MSCL_TRNG_I', '근골격계 운동'],
  ['TODZ_VDO_TRNG_VIDEO_I', '운동처방 동영상'],
  ['TODZ_VDO_ROUTINE_I', '목적별 루틴운동'],
  ['TODZ_VDO_STD_FTNS_I', '생애주기별 표준운동'],
  ['TODZ_VDO_TRNG_GUIDE_I', '운동처방 가이드'],
]

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchPage(endpoint, pageNo) {
  const qs = new URLSearchParams({ pageNo: String(pageNo), numOfRows: String(PAGE_SIZE), resultType: 'json', serviceKey: KEY })
  const url = `${BASE}/${endpoint}?${qs.toString()}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url)
      const text = await res.text()
      const json = JSON.parse(text) // 탐색 단계에서 정상 응답은 항상 JSON임을 확인함
      const header = json.response?.header
      if (header?.resultCode !== '00') throw new Error(`API 오류: ${header?.resultCode} ${header?.resultMsg}`)
      const body = json.response?.body
      const totalCount = Number(body?.totalCount || 0)
      const raw = body?.items?.item
      const items = Array.isArray(raw) ? raw : (raw ? [raw] : [])
      return { items, totalCount }
    } catch (err) {
      console.log(`  [재시도 ${attempt}/3] ${endpoint} pageNo=${pageNo} 실패: ${err.message}`)
      if (attempt === 3) throw err
      await sleep(500 * attempt)
    }
  }
}

async function fetchAll(endpoint, label) {
  console.log(`\n[${endpoint}] ${label} 수집 시작`)
  const all = []
  let pageNo = 1
  let totalCount = Infinity
  while (all.length < totalCount) {
    const { items, totalCount: tc } = await fetchPage(endpoint, pageNo)
    totalCount = tc
    if (items.length === 0) break
    for (const item of items) all.push({ ...item, _endpoint: endpoint })
    console.log(`  page ${pageNo}: +${items.length} (누적 ${all.length}/${totalCount})`)
    pageNo += 1
    await sleep(200)
  }
  console.log(`  완료: ${all.length}건`)
  return all
}

async function main() {
  const result = {}
  let grandTotal = 0
  for (const [endpoint, label] of ENDPOINTS) {
    const items = await fetchAll(endpoint, label)
    result[endpoint] = items
    grandTotal += items.length
  }

  const outDir = path.resolve(process.cwd(), 'data-raw')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'kspo-videos.json')
  fs.writeFileSync(outPath, JSON.stringify({ collectedAt: new Date().toISOString(), endpoints: result }, null, 2))

  console.log(`\n\n총 ${grandTotal}행 수집 완료 → ${outPath}`)
  for (const [endpoint, label] of ENDPOINTS) {
    console.log(`  ${label}: ${result[endpoint].length}건`)
  }
}

main().catch((err) => { console.error('[FAIL]', err); process.exit(1) })
