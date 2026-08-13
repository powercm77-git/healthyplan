// scripts/match-exercise-videos.mjs — data-raw/kspo-videos.json(29,664행)을 dedup한 뒤
// exercises.json 96종과 매칭해 src/data/exercise-videos.json을 만든다.
//
// dedup 기준(발주자 확정): file_url+file_nm 전체 경로. 같은 영상의 여러 행 중
// trng_part_nm·tool_nm·aggrp_nm 세 필드가 가장 많이 채워진 행을 대표로 남긴다.
//
// 매칭 우선순위(작업지시서 §2-4 + 발주자 확정):
//   1. 운동명 완전 일치 (공백·괄호 제거 후 비교)
//   2. 운동명 부분 일치 + 부위 일치
//   3. aliases 일치
// 운동당 최대 3개, matchType 좋은 순 정렬. 매칭 없으면 빈 배열(가짜 링크 금지).
//
// ⚠ "부위+기구+난이도 조합"(운동명을 전혀 안 보는) fallback 4단계는 2026-08-14 발주자
// 검수에서 제거했다 — 스모 스쿼트→슈퍼맨자세, 무릎 대고 푸시업→앉아서 옆구리 늘려주기처럼
// 완전히 다른 동작을 붙이는 사례가 다수 발견됨(§8 "매칭 안 된 운동에 아무 영상이나 연결
// 금지" 위반). 앞으로도 이 4단계를 다시 넣지 말 것 — 영상이 적은 것보다 틀린 영상이 훨씬
// 위험하다는 것이 발주자의 명시적 지시다. 매칭 규칙은 운동명(exName/alias) 대조를 반드시
// 포함해야 하고, 부위·기구·난이도만으로 통과시키는 조건은 금지.
//
// 사용법: node scripts/match-exercise-videos.mjs  (사전에 fetch-kspo-videos.mjs 필요)

import fs from 'node:fs'
import path from 'node:path'

const RAW_PATH = path.resolve(process.cwd(), 'data-raw/kspo-videos.json')
const EXERCISES_PATH = path.resolve(process.cwd(), 'src/data/exercises.json')
const OUT_PATH = path.resolve(process.cwd(), 'src/data/exercise-videos.json')

function normalize(s) {
  return (s || '').replace(/[()（）\s]/g, '').trim()
}

// trng_nm(특정 동작명)과 vdo_ttl_nm(영상 전체 제목)이 서로 무관하면, 그 영상은 여러 운동이
// 이어지는 "프로그램 영상"이고 trng_nm은 그 중 한 장면일 뿐이다(예: trng_nm="무릎 돌리기",
// vdo_ttl_nm="성인기 1주차 운동프로그램"). 이런 영상을 처음부터 재생하면 완전히 다른 내용이
// 나올 수 있어 위험하므로(작업지시서 §8 "틀린 자세를 따라 하면 다친다"), 이름이 서로
// 일치하거나 한쪽이 다른 쪽을 포함하는 "단일 운동 영상"만 매칭 후보로 쓴다.
// 전체 데이터로 검증: TODZ_VDO_ROUTINE_I·TODZ_VDO_STD_FTNS_I는 100%가 이런 프로그램 영상이고,
// 나머지 4개 엔드포인트도 25~43%가 섞여 있어 엔드포인트 단위가 아니라 행 단위로 걸러야 한다.
function isTrustworthy(v) {
  const a = normalize(v.trng_nm)
  const b = normalize(v.vdo_ttl_nm)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

// ── 1) 원본 로드 + 신뢰 가능한 행만 필터 + dedup ──
function loadAndDedup() {
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'))
  const all = Object.values(raw.endpoints).flat().filter(isTrustworthy)
  const byKey = new Map()
  const completeness = (v) => ['trng_part_nm', 'tool_nm', 'aggrp_nm'].filter((f) => v[f] && String(v[f]).trim()).length
  for (const v of all) {
    const key = `${v.file_url || ''}${v.file_nm || ''}`
    if (!key || !v.file_nm) continue
    const prev = byKey.get(key)
    if (!prev || completeness(v) > completeness(prev)) byKey.set(key, v)
  }
  return [...byKey.values()]
}

// ── 2) 부위·기구 동의어 매칭 ──
const BODYPART_KEYWORDS = {
  '하체': ['하체', '다리', '허벅지', '대퇴', '넓적다리', '종아리', '무릎', '하지'],
  '엉덩이': ['엉덩이', '둔근', '볼기'],
  '안쪽허벅지': ['내전근', '안쪽허벅지', '내측'],
  '심폐': ['심폐', '유산소', '전신지구력', '심폐지구력'],
  '가슴': ['가슴', '흉근'],
  '팔': ['팔', '이두', '삼두', '상완', '전완'],
  '코어': ['코어', '복근', '복부', '체간'],
  '어깨': ['어깨', '삼각근'],
  '옆구리': ['옆구리', '복사근'],
  '복근': ['복근', '복부'],
  '하복부': ['하복부', '아랫배'],
  '전신': ['전신'],
  '등': ['등', '광배근', '승모근', '척추기립근'],
  '허리': ['허리', '요추'],
  '골반': ['골반'],
  '목': ['목', '경추'],
  '허벅지뒤': ['허벅지뒤', '뒤쪽넓적다리', '대퇴이두근', '햄스트링'],
  '종아리': ['종아리', '비복근', '가자미근'],
  '고관절': ['고관절', '엉덩관절'],
  '허벅지앞': ['허벅지앞', '앞쪽넓적다리', '대퇴사두근'],
}

function videoBodyText(v) {
  return normalize([v.trng_part_nm, v.trng_mscl_part, v.trng_mscl_zn_nm, v.trng_mscl_class].filter(Boolean).join(','))
}

function bodyPartOverlap(v, exercise) {
  const text = videoBodyText(v)
  if (!text) return false
  return exercise.bodyParts.some((bp) => (BODYPART_KEYWORDS[bp] || [bp]).some((kw) => text.includes(kw)))
}

function videoUrl(v) {
  return `${v.file_url}${v.file_nm}`.replace(/^http:/, 'https:')
}
function thumbUrl(v) {
  if (!v.img_file_url || !v.img_file_nm) return null
  return `${v.img_file_url}${v.img_file_nm}`.replace(/^http:/, 'https:')
}

function toEntry(v, matchType) {
  return {
    title: v.vdo_ttl_nm || v.trng_nm,
    url: videoUrl(v),
    thumbnail: thumbUrl(v),
    source: '국민체력100',
    bodyPart: v.trng_part_nm || v.trng_mscl_part || '',
    level: v.ftns_lvl_nm || '',
    matchType,
  }
}

// partial(부분일치) 단계는 "포함 관계"만 보므로, 방향/변형을 나타내는 수식어가 한쪽에만
// 있으면 실제로는 다른 운동을 붙이게 된다. 2026-08-14 발주자 검수에서 발견된 구체적 사례를
// (운동 id, 잘못 붙은 영상 file_nm) 쌍으로 직접 배제한다 — 이런 사례가 또 나오면 이 목록에
// 추가할 것. 일반 규칙으로 자동화하기엔 "수식어가 있으면 무조건 배제"가 오히려 정상적인
// 부분일치(예: 런지+팔올리기 변형)까지 지워버려 과도하다.
//   - lunge-reverse/lunge-side → "런지"(00139): 방향 수식어(리버스/사이드)가 빠진 일반
//     런지 영상. 리버스 런지와 사이드 런지는 발 딛는 방향 자체가 다른 운동이라 위험하다.
//   - crunch-basic → "크런치 싸이클"(00892): 이름은 "크런치"를 포함하지만 실제로는 바이시클
//     크런치(엘보-니 교차 회전 동작)로, 기본 크런치와 동작 자체가 다르다.
const PARTIAL_EXCLUDE = new Set([
  'lunge-reverse:0AUDLJ08S_00139.mp4',
  'lunge-side:0AUDLJ08S_00139.mp4',
  'crunch-basic:0AUDLJ08S_00892.mp4',
])

// ── 3) 운동 하나에 대해 매칭 ──
function matchExercise(exercise, videos) {
  const exName = normalize(exercise.name)
  const seen = new Set() // file_nm 중복 방지
  const picked = []

  function add(v, matchType) {
    if (picked.length >= 3) return false
    if (seen.has(v.file_nm)) return false
    seen.add(v.file_nm)
    picked.push(toEntry(v, matchType))
    return true
  }

  // 1) 완전 일치
  for (const v of videos) {
    if (picked.length >= 3) break
    if (normalize(v.trng_nm) === exName) add(v, 'exact')
  }
  // 2) 부분 일치 + 부위 일치
  if (picked.length < 3) {
    for (const v of videos) {
      if (picked.length >= 3) break
      const vName = normalize(v.trng_nm)
      if (!vName) continue
      const partial = vName.includes(exName) || exName.includes(vName)
      if (partial && bodyPartOverlap(v, exercise) && !PARTIAL_EXCLUDE.has(`${exercise.id}:${v.file_nm}`)) add(v, 'partial')
    }
  }
  // 3) aliases 일치 — 반드시 완전 일치만 인정한다(부분 포함 금지). 부분 포함을 허용하면
  // "점프"처럼 짧고 일반적인 trng_nm이 "스쿼트점프"/"플랭크점프"류 복합 별칭에 우연히
  // 포함되어 전혀 다른 운동(제자리 점프 영상)이 붙는 사례가 실제로 발생했다(2026-08-14
  // 발주자 검수). "옆플랭크"⊃"플랭크", "뒤로차기"⊂"서서다리뒤로차기"처럼 상위/하위 개념이
  // 다른 운동인 경우도 부분 포함으로는 걸러지지 않는다 — 완전 일치만 안전하다.
  if (picked.length < 3 && exercise.aliases?.length) {
    for (const alias of exercise.aliases) {
      const a = normalize(alias)
      if (!a) continue
      for (const v of videos) {
        if (picked.length >= 3) break
        const vName = normalize(v.trng_nm)
        if (vName === a) add(v, 'alias')
      }
    }
  }
  return picked
}

function main() {
  const videos = loadAndDedup()
  const exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, 'utf-8'))

  const result = {}
  const stats = { exact: 0, partial: 0, alias: 0 }
  const unmatched = []

  for (const ex of exercises) {
    const matches = matchExercise(ex, videos)
    result[ex.id] = matches
    if (matches.length === 0) {
      unmatched.push(`${ex.id} (${ex.name})`)
    } else {
      const best = matches[0].matchType
      stats[best] += 1
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n')

  const matchedCount = exercises.length - unmatched.length
  console.log(`고유 영상 ${videos.length}개 중에서 운동 ${exercises.length}종 매칭 결과 (최우선 matchType 기준):`)
  console.log(`  exact(완전일치): ${stats.exact}`)
  console.log(`  partial(부분일치+부위): ${stats.partial}`)
  console.log(`  alias(별칭일치): ${stats.alias}`)
  console.log(`  매칭됨: ${matchedCount}/${exercises.length}`)
  console.log(`  매칭 실패(빈 배열, 영상 버튼 안 뜸): ${unmatched.length}`)
  if (unmatched.length) {
    console.log('\n매칭 실패 목록:')
    unmatched.forEach((u) => console.log(`  - ${u}`))
  }
  console.log(`\n저장 완료 → ${OUT_PATH}`)
}

main()
