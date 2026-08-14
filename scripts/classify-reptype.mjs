// scripts/classify-reptype.mjs — 2.7-2단계: 신규 668종(kspo-*)의 repType을 재분류한다.
// 지금까지는 전부 'reps'(횟수형)로 처리돼 "물속에서 걷기 10회" 같은 잘못된 지시와
// 칼로리 오차가 났다. 원본 96종은 이미 손으로 정확히 분류돼 있어 건드리지 않는다.
//
// 분류 규칙(우선순위):
//   1) category==='수영' 이거나 type==='cardio' → 시간형('sec') — 계속 움직이는 시간
//   2) type==='stretch' → 유지형('hold') — 자세를 버티는 시간
//   3) type==='strength'인데 국민체력100 공식 데이터(trng_hr_nm)가 이 운동을 초 단위로
//      규정하면 → 유지형('hold') (예: 관절가동범위·밸런스·평형 운동 — 이름만 봐선
//      등척성인지 알기 어렵지만 공식 처방 자체가 "10~20초"로 시간을 지정한다)
//   4) 그 외 type==='strength'인데 이름이 버티기/플랭크/브릿지류(등척성) → 유지형('hold')
//   5) 나머지는 횟수형('reps') 그대로 유지
// 값(세트·반복/시간)은 공식 데이터(rptt_tcnt_nm·set_cnt_nm·trng_hr_nm)가 있으면
// 그 값을 우선 적용하고, 없으면 기존 값을 그대로 둔다(임의로 지어내지 않는다).
//
// 사용법: node scripts/classify-reptype.mjs

import fs from 'node:fs'
import path from 'node:path'

const EX_PATH = path.resolve(process.cwd(), 'src/data/exercises.json')
const RAW_PATH = path.resolve(process.cwd(), 'data-raw/kspo-videos.json')

const ISOMETRIC_NAME_RE = /플랭크|브릿지|교각|버티기|월\s?싯|자세\s?유지|고정\s?후|들어\s?올린\s?채/

function parseRangeMid(str) {
  const m = str.match(/(\d+(?:\.\d+)?)\s*~?\s*(\d+(?:\.\d+)?)?/)
  if (!m) return null
  const a = parseFloat(m[1])
  const b = m[2] ? parseFloat(m[2]) : a
  return Math.round((a + b) / 2)
}

function parseTrngHrSeconds(str) {
  const m = str.match(/(\d+(?:\.\d+)?)\s*~?\s*(\d+(?:\.\d+)?)?\s*(초|분)/)
  if (!m) return null
  const a = parseFloat(m[1])
  const b = m[2] ? parseFloat(m[2]) : a
  const mid = (a + b) / 2
  return Math.round(m[3] === '분' ? mid * 60 : mid)
}

function loadRawLookup() {
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'))
  const rows = [].concat(...Object.values(raw.endpoints))
  const byFile = new Map()
  for (const r of rows) {
    if (!r.file_nm) continue
    if (!byFile.has(r.file_nm)) byFile.set(r.file_nm, {})
    const cur = byFile.get(r.file_nm)
    for (const f of ['rptt_tcnt_nm', 'set_cnt_nm', 'trng_hr_nm']) {
      if (!cur[f] && r[f] && String(r[f]).trim()) cur[f] = String(r[f]).trim()
    }
  }
  return byFile
}

function officialFieldsFor(exercise, byFile) {
  const out = {}
  for (const v of exercise.videos || []) {
    const fileNm = v.url?.split('/').pop()
    const d = fileNm && byFile.get(fileNm)
    if (!d) continue
    if (!out.rptt_tcnt_nm && d.rptt_tcnt_nm) out.rptt_tcnt_nm = d.rptt_tcnt_nm
    if (!out.set_cnt_nm && d.set_cnt_nm) out.set_cnt_nm = d.set_cnt_nm
    if (!out.trng_hr_nm && d.trng_hr_nm) out.trng_hr_nm = d.trng_hr_nm
  }
  return out
}

function classify(exercise, official) {
  const isSwim = exercise.category === '수영'
  let repType
  if (isSwim || exercise.type === 'cardio') repType = 'sec'
  else if (exercise.type === 'stretch') repType = 'hold'
  else if (exercise.type === 'strength' && official.trng_hr_nm) repType = 'hold'
  else if (exercise.type === 'strength' && ISOMETRIC_NAME_RE.test(exercise.name)) repType = 'hold'
  else repType = 'reps'

  let defaultReps = exercise.defaultReps
  let defaultSets = exercise.defaultSets

  if (repType === 'sec' || repType === 'hold') {
    if (official.trng_hr_nm) {
      const sec = parseTrngHrSeconds(official.trng_hr_nm)
      if (sec) defaultReps = sec
    }
    if (official.set_cnt_nm) {
      const sets = parseRangeMid(official.set_cnt_nm)
      if (sets) defaultSets = sets
    }
  } else {
    if (official.rptt_tcnt_nm) {
      const reps = parseRangeMid(official.rptt_tcnt_nm)
      if (reps) defaultReps = reps
    }
    if (official.set_cnt_nm) {
      const sets = parseRangeMid(official.set_cnt_nm)
      if (sets) defaultSets = sets
    }
  }

  return { repType, defaultReps, defaultSets }
}

function main() {
  const exercises = JSON.parse(fs.readFileSync(EX_PATH, 'utf-8'))
  const byFile = loadRawLookup()

  const counts = { sec: 0, hold: 0, reps: 0 }
  const officialOverrideCount = { sets: 0, reps: 0 }
  const samples = []

  for (const ex of exercises) {
    if (!ex.id.startsWith('kspo-')) continue // 원본 96종(수동 분류 완료)은 건드리지 않는다
    const official = officialFieldsFor(ex, byFile)
    const { repType, defaultReps, defaultSets } = classify(ex, official)
    if (defaultReps !== ex.defaultReps) officialOverrideCount.reps++
    if (defaultSets !== ex.defaultSets) officialOverrideCount.sets++
    ex.repType = repType
    ex.defaultReps = defaultReps
    ex.defaultSets = defaultSets
    // repType이 시간형/유지형이면 세트 페이서(down/hold/up)가 아니라 카운트다운을
    // 쓴다(기존 규약, exercises.test.js에서 검증) — tempo는 반드시 null.
    if (repType === 'sec' || repType === 'hold') ex.tempo = null
    counts[repType]++
    if (samples.length < 10 && (official.trng_hr_nm || official.rptt_tcnt_nm)) {
      samples.push({ id: ex.id, name: ex.name, type: ex.type, category: ex.category, repType, defaultSets, defaultReps, official })
    }
  }

  fs.writeFileSync(EX_PATH, JSON.stringify(exercises, null, 2) + '\n')

  console.log('=== repType 재분류 결과(신규 668종 대상) ===')
  console.log(counts)
  console.log('공식 데이터로 값을 덮어쓴 항목: sets', officialOverrideCount.sets, '/ reps', officialOverrideCount.reps)
  console.log('--- 표본 10개(공식 데이터 적용분) ---')
  for (const s of samples) console.log(JSON.stringify(s))
}

main()
