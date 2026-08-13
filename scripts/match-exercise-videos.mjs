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
//   4. 부위 + 기구 + 난이도 조합 일치 → 후보 중 대표 1개만
// 운동당 최대 3개, matchType 좋은 순 정렬. 매칭 없으면 빈 배열(가짜 링크 금지).
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

function equipmentOverlap(v, equipment) {
  if (equipment === '없음') return true // 맨몸 운동은 기구 조건을 걸지 않음(과도한 배제 방지)
  const tool = normalize(v.tool_nm).replace(/머신|기구/g, '')
  const eq = normalize(equipment).replace(/머신|기구/g, '')
  if (!tool || !eq) return false
  return tool.includes(eq) || eq.includes(tool)
}

const LEVEL_MAP = { '초급': 1, '중급': 2, '고급': 3 }
function levelMatches(v, level) {
  const vLevel = LEVEL_MAP[v.ftns_lvl_nm]
  if (!vLevel) return true // 난이도 정보 없는 엔드포인트는 조건에서 제외(과도한 배제 방지)
  return vLevel === level
}

function metadataCompleteness(v) {
  return ['trng_part_nm', 'trng_mscl_part', 'tool_nm', 'aggrp_nm', 'ftns_lvl_nm', 'trng_plc_nm']
    .filter((f) => v[f] && String(v[f]).trim()).length
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
      if (partial && bodyPartOverlap(v, exercise)) add(v, 'partial')
    }
  }
  // 3) aliases 일치
  if (picked.length < 3 && exercise.aliases?.length) {
    for (const alias of exercise.aliases) {
      const a = normalize(alias)
      if (!a) continue
      for (const v of videos) {
        if (picked.length >= 3) break
        const vName = normalize(v.trng_nm)
        if (vName === a || vName.includes(a) || a.includes(vName)) add(v, 'alias')
      }
    }
  }
  // 4) 부위+기구+난이도 조합 → 대표 1개만
  if (picked.length < 3) {
    const candidates = videos.filter((v) =>
      !seen.has(v.file_nm) && bodyPartOverlap(v, exercise) && equipmentOverlap(v, exercise.equipment) && levelMatches(v, exercise.level))
    if (candidates.length > 0) {
      candidates.sort((a, b) => metadataCompleteness(b) - metadataCompleteness(a))
      add(candidates[0], 'fallback')
    }
  }

  return picked
}

function main() {
  const videos = loadAndDedup()
  const exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, 'utf-8'))

  const result = {}
  const stats = { exact: 0, partial: 0, alias: 0, fallback: 0 }
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
  console.log(`  fallback(부위+기구+난이도): ${stats.fallback}`)
  console.log(`  매칭됨: ${matchedCount}/${exercises.length}`)
  console.log(`  매칭 실패(빈 배열, 영상 버튼 안 뜸): ${unmatched.length}`)
  if (unmatched.length) {
    console.log('\n매칭 실패 목록:')
    unmatched.forEach((u) => console.log(`  - ${u}`))
  }
  console.log(`\n저장 완료 → ${OUT_PATH}`)
}

main()
