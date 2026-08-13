// scripts/explore-kspo-api.mjs — 국민체력100 운동영상 API(SRVC_TODZ_VDO_PKG) 응답 구조 탐색
// 목적: 실제 필드명·값 예시를 사람이 읽을 수 있게 출력한다. 여기서 확인한 구조를 기반으로
// fetch-kspo-videos.mjs / match-exercise-videos.mjs를 작성한다. 절대 필드명을 추측해 다음 단계로
// 넘어가지 않는다.
//
// 사용법: DATA_GO_KR_KEY를 .env에 넣고 실행
//   node scripts/explore-kspo-api.mjs

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

const BASE = 'https://apis.data.go.kr/B551014/SRVC_TODZ_VDO_PKG'
const ENDPOINTS = [
  ['/TODZ_VDO_VIEW_ALL_LIST_I', '동영상 전체 목록'],
  ['/TODZ_VDO_MSCL_TRNG_I', '근골격계 운동'],
  ['/TODZ_VDO_TRNG_VIDEO_I', '운동처방 동영상'],
  ['/TODZ_VDO_ROUTINE_I', '목적별 루틴운동'],
  ['/TODZ_VDO_STD_FTNS_I', '생애주기별 표준운동'],
  ['/TODZ_VDO_TRNG_GUIDE_I', '운동처방 가이드'],
  ['/TODZ_VDO_FTNS_CERT_I', '체력인증 측정방법'],
]

// data.go.kr 서비스키는 "인코딩"(이미 %인코딩됨)과 "디코딩"(원문) 두 형태로 발급된다.
// 어느 쪽인지 모르므로 두 방식을 순서대로 시도한다.
async function fetchTrying(url, params) {
  // 시도 1: URLSearchParams로 넣기 (키가 "디코딩"형이면 정상, "인코딩"형이면 이중인코딩됨)
  const qs1 = new URLSearchParams({ ...params, serviceKey: KEY })
  const url1 = `${url}?${qs1.toString()}`
  // 시도 2: 키를 인코딩하지 않고 그대로 붙이기 (키가 "인코딩"형이면 정상)
  const otherParams = new URLSearchParams(params)
  const url2 = `${url}?serviceKey=${KEY}&${otherParams.toString()}`

  for (const [label, u] of [['URLSearchParams(자동 인코딩)', url1], ['원문 그대로 붙이기', url2]]) {
    try {
      const res = await fetch(u)
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch { /* JSON이 아닐 수 있음(XML 에러 응답 등) */ }
      const looksLikeAuthError = /SERVICE_KEY|INVALID|등록되지|해지|사용할 수 없는/i.test(text) && !json
      if (res.ok && json && !looksLikeAuthError) {
        return { ok: true, label, status: res.status, json, raw: text.slice(0, 300) }
      }
      if (res.ok && json) {
        // JSON은 파싱됐지만 내부 에러 코드일 수 있음 — 호출부에서 판단하도록 그대로 반환
        return { ok: true, label, status: res.status, json, raw: text.slice(0, 300) }
      }
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
  console.log(`총 ${ENDPOINTS.length}개 엔드포인트를 numOfRows=5로 탐색합니다.\n`)
  for (const [ep, desc] of ENDPOINTS) {
    console.log(`\n${'='.repeat(70)}\n[${ep}] ${desc}\n${'='.repeat(70)}`)
    const result = await fetchTrying(`${BASE}${ep}`, { pageNo: '1', numOfRows: '5', resultType: 'json' })
    if (!result.ok) {
      console.log('  -> 두 방식 모두 실패. 아래 확인:')
      console.log('     1) DATA_GO_KR_KEY 값이 정확한지 (공백/줄바꿈 포함 여부)')
      console.log('     2) data.go.kr에서 이 API(SRVC_TODZ_VDO_PKG) 활용신청이 "승인"됐는지')
      console.log('     3) type=json 대신 다른 파라미터가 필요한지 (raw 응답 참고)')
      continue
    }
    console.log(`  성공 방식: ${result.label} (HTTP ${result.status})`)
    console.log('  --- 응답 구조 ---')
    summarizeShape(result.json)
    await new Promise((r) => setTimeout(r, 200))
  }
  console.log('\n\n탐색 완료. 위 구조를 근거로 fetch-kspo-videos.mjs / match-exercise-videos.mjs를 작성하세요.')
}

main().catch((err) => { console.error('[FAIL]', err); process.exit(1) })
