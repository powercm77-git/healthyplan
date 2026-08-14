// scripts/build-exercise-library.mjs — 2.6단계 §3-1: data-raw/kspo-videos.json(29,664행)을
// 정규화해 고유 운동 후보 목록을 만든다. API 재호출 없음(이미 수집된 원본만 사용).
//
// 출력:
//   data-raw/kspo-programs.json         — vdo_len>300 "프로그램 통짜 영상"(별도 보관, 3단계 이후 사용)
//   data-raw/kspo-exercise-candidates.json — 정규화·그룹핑된 운동 후보 목록(§3-2 대조용 중간 산출물)
//
// 사용법: node scripts/build-exercise-library.mjs

import fs from 'node:fs'
import path from 'node:path'

const RAW_PATH = path.resolve(process.cwd(), 'data-raw/kspo-videos.json')
const PROGRAMS_OUT = path.resolve(process.cwd(), 'data-raw/kspo-programs.json')
const CANDIDATES_OUT = path.resolve(process.cwd(), 'data-raw/kspo-exercise-candidates.json')

function normSpace(s) {
  return (s || '').replace(/\s+/g, ' ').trim()
}
function normalizeTight(s) {
  // trng_nm/vdo_ttl_nm 비교용 — 슬래시(/) 유무만 다른 표기(예: "좌/우 굴곡" vs "좌 우 굴곡")
  // 때문에 실제로는 같은 제목인데 다르다고 오판하는 사례가 있어 슬래시도 제거한다.
  return (s || '').replace(/[()（）/\s]/g, '').trim()
}

// trng_nm(개별 동작명)과 vdo_ttl_nm(영상 전체 제목)이 무관하면, 그 영상은 여러 동작이 이어지는
// "루틴 프로그램" 영상이고 trng_nm은 그중 한 장면일 뿐이다(예: trng_nm="목 스트레칭(매트)-1",
// vdo_ttl_nm="유연성운동 루틴프로그램-3" — 재생하면 4분 넘는 여러 동작 모음이 나온다).
// vdo_len<=300초 필터만으로는 이런 영상을 걸러내지 못한다(전수 조사 결과 20,906개 중 4,258개,
// 약 20%가 이 패턴 — 2025-08-14 2.6단계 §3-1에서 재발견, 2.5단계 match-exercise-videos.mjs의
// isTrustworthy()와 동일한 원칙을 여기도 적용해야 한다).
// vdo_ttl_nm에도 trng_nm과 무관하게 자체적으로 "-1"/"-2" 촬영본 번호가 붙는 경우가 있어
// (예: trng_nm="목 스트레칭(매트)", vdo_ttl_nm="목 스트레칭-1") 번호를 떼지 않으면 같은
// 영상인데도 무관하다고 오판한다. 비교 전 양쪽 다 끝의 -N을 제거한다.
function stripSeq(s) { return (s || '').replace(/-\d+$/, '') }
function isTrustworthy(v) {
  const a = normalizeTight(stripSeq(v.trng_nm))
  const b = normalizeTight(stripSeq(v.vdo_ttl_nm))
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

// ── 1) 원본 로드 + file_url+file_nm 키로 필드 병합(빈 값은 다른 행의 값으로 채움) ──
function loadAndMerge() {
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'))
  const byKey = new Map()
  for (const v of Object.values(raw.endpoints).flat()) {
    const key = `${v.file_url || ''}${v.file_nm || ''}`
    if (!key || !v.file_nm) continue
    if (!byKey.has(key)) byKey.set(key, {})
    const merged = byKey.get(key)
    for (const [field, value] of Object.entries(v)) {
      if (field === '_endpoint') continue
      const has = merged[field] !== undefined && merged[field] !== null && String(merged[field]).trim() !== ''
      const incoming = value !== undefined && value !== null && String(value).trim() !== ''
      if (!has && incoming) merged[field] = value
    }
  }
  return [...byKey.values()]
}

// ── 2) 이름 정규화: 끝의 -N 일련번호는 항상 분리(같은 영상의 다른 촬영본일 뿐).
// 괄호는 "장비/소품"으로 확실한 단어일 때만 분리한다 — 방향(바깥돌림/안쪽돌림), 수영 영법
// (자유형/배영/평영/접영), 좌우/내외측처럼 실제로 다른 동작을 가리키는 괄호까지 벗겨내면
// 서로 다른 운동이 하나로 합쳐지는 위험한 오분류가 된다(예: "등척성 운동(바깥돌림)"과
// "등척성 운동(안쪽돌림)"은 다른 운동). 확신 없는 괄호는 이름에 그대로 남겨 별개로 취급한다.
const EQUIPMENT_WHITELIST = new Set([
  '매트', '짐볼', '밴드', '덤벨', '바벨', '폼롤러', '박스', '의자', '소파', '테이블',
  '공', '봉', '자전거', '스텝레더', '준비', '보조', 'T-Wall', '막대기/배트', '코어',
])

function isEquipmentParen(content) {
  return content.split('/').every((tok) => EQUIPMENT_WHITELIST.has(tok.trim()))
}

function splitName(trngNm) {
  let name = (trngNm || '').trim()
  let seq = null
  const seqMatch = name.match(/^(.*?)-(\d+)$/)
  if (seqMatch) { name = seqMatch[1].trim(); seq = Number(seqMatch[2]) }

  const equipmentTags = []
  name = name.replace(/\(([^)]*)\)/g, (whole, content) => {
    if (isEquipmentParen(content)) {
      content.split('/').forEach((t) => equipmentTags.push(t.trim()))
      return ''
    }
    return whole // 장비 아니면 원문 그대로 유지(이름의 일부로 남김)
  })
  name = normSpace(name)
  return { baseName: name, seq, equipmentTags }
}

// ── 3) 대표 영상 선정: 성인/공통 > 60~180초 > 메타데이터 최다 ──
function metadataCompleteness(v) {
  return [
    'trng_mscl_nm', 'trng_mscl_part', 'trng_part_nm', 'tool_nm', 'trng_plc_nm',
    'ftns_lvl_nm', 'rptt_tcnt_nm', 'set_cnt_nm', 'trng_hr_nm', 'aggrp_nm', 'vdo_desc',
  ].filter((f) => v[f] && String(v[f]).trim()).length
}
function isAdultOrCommon(v) {
  return v.aggrp_nm === '성인' || v.aggrp_nm === '공통'
}
function isGoodLength(v) {
  const len = Number(v.vdo_len)
  return !Number.isNaN(len) && len >= 60 && len <= 180
}
function pickRepresentative(videos) {
  const sorted = [...videos].sort((a, b) => {
    const adultDiff = (isAdultOrCommon(b) ? 1 : 0) - (isAdultOrCommon(a) ? 1 : 0)
    if (adultDiff) return adultDiff
    const lenDiff = (isGoodLength(b) ? 1 : 0) - (isGoodLength(a) ? 1 : 0)
    if (lenDiff) return lenDiff
    return metadataCompleteness(b) - metadataCompleteness(a)
  })
  return sorted[0]
}

function videoUrl(v) { return `${v.file_url}${v.file_nm}`.replace(/^http:/, 'https:') }
function thumbUrl(v) {
  if (!v.img_file_url || !v.img_file_nm) return null
  return `${v.img_file_url}${v.img_file_nm}`.replace(/^http:/, 'https:')
}

function main() {
  const all = loadAndMerge()
  console.log(`고유 영상(file_url+file_nm 병합): ${all.length}개`)

  const programs = all.filter((v) => Number(v.vdo_len) > 300)
  const rest = all.filter((v) => Number(v.vdo_len) <= 300)
  console.log(`  프로그램 통짜 영상(>300초, 별도 보관): ${programs.length}개`)

  const withName = rest.filter((v) => v.trng_nm && v.trng_nm.trim())
  console.log(`  trng_nm 없음(제외): ${rest.length - withName.length}개`)

  const trustworthy = withName.filter(isTrustworthy)
  console.log(`  trng_nm≠vdo_ttl_nm(루틴 프로그램 조각, 제외): ${withName.length - trustworthy.length}개`)
  console.log(`  개별 동작 영상(그룹핑 대상): ${trustworthy.length}개`)

  fs.writeFileSync(PROGRAMS_OUT, JSON.stringify(programs.map((v) => ({
    title: v.vdo_ttl_nm || v.trng_nm,
    url: videoUrl(v),
    thumbnail: thumbUrl(v),
    lenSec: Number(v.vdo_len) || null,
    aggrpNm: v.aggrp_nm || null,
    desc: v.vdo_desc || null,
  })), null, 2) + '\n')

  const groups = new Map()
  for (const v of trustworthy) {
    const { baseName, seq, equipmentTags } = splitName(v.trng_nm)
    if (!baseName) continue
    if (!groups.has(baseName)) groups.set(baseName, [])
    groups.get(baseName).push({ ...v, _seq: seq, _equipmentTags: equipmentTags })
  }

  const candidates = []
  for (const [name, videos] of groups) {
    const rep = pickRepresentative(videos)
    const ageGroups = [...new Set(videos.map((v) => v.aggrp_nm).filter(Boolean))]
    // 근골격계운동(TODZ_VDO_MSCL_TRNG_I) 출처 영상이 하나라도 있으면 "재활" 계열로 태그한다.
    // 이 엔드포인트는 무릎/어깨/허리 질환자 대상 단계별 표준운동을 다루므로 일반 루틴에
    // 자동 배정하면 안 된다(발주자 지시). 수영장 장소도 마찬가지로 별도 태그.
    const isRehab = videos.some((v) => v.oper_nm === '근골격계운동')
    const isPool = videos.some((v) => v.trng_plc_nm === '수영장')
    candidates.push({
      name,
      videoCount: videos.length,
      ageGroups,
      isRehab,
      isPool,
      trng_mscl_nm: rep.trng_mscl_nm || null,
      trng_mscl_part: rep.trng_mscl_part || null,
      trng_part_nm: rep.trng_part_nm || null,
      tool_nm: rep.tool_nm || null,
      trng_plc_nm: rep.trng_plc_nm || null,
      ftns_lvl_nm: rep.ftns_lvl_nm || null,
      rptt_tcnt_nm: rep.rptt_tcnt_nm || null,
      set_cnt_nm: rep.set_cnt_nm || null,
      trng_hr_nm: rep.trng_hr_nm || null,
      vdo_desc: rep.vdo_desc || null,
      videos: videos.map((v) => ({
        title: v.vdo_ttl_nm || v.trng_nm,
        url: videoUrl(v),
        thumbnail: thumbUrl(v),
        lenSec: Number(v.vdo_len) || null,
        ageGroup: v.aggrp_nm || null,
        toolNm: v.tool_nm || null,
        placeNm: v.trng_plc_nm || null,
        levelNm: v.ftns_lvl_nm || null,
        fileNm: v.file_nm,
        equipmentTags: v._equipmentTags,
      })),
    })
  }
  candidates.sort((a, b) => b.videoCount - a.videoCount)

  fs.writeFileSync(CANDIDATES_OUT, JSON.stringify(candidates, null, 2) + '\n')

  console.log(`\n고유 운동 후보(그룹핑 후): ${candidates.length}종`)
  console.log(`저장 완료 → ${CANDIDATES_OUT}`)
  console.log(`저장 완료 → ${PROGRAMS_OUT}`)
}

main()
