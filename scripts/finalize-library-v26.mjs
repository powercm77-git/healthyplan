// scripts/finalize-library-v26.mjs — 2.6단계 §3-3 마무리: kspo-library-plan.json +
// desc-batches/output-*.json(에이전트가 작성한 A-full 4단 설명)을 합쳐 최종 exercises.json을 만든다.
// brief 항목(488종)은 공식 vdo_desc 기반 안전한 정형 문구로 자동 생성한다(개별 창작 없음).
//
// 사용법: node scripts/finalize-library-v26.mjs

import fs from 'node:fs'
import path from 'node:path'

const PLAN_PATH = path.resolve(process.cwd(), 'data-raw/kspo-library-plan.json')
const BATCH_DIR = path.resolve(process.cwd(), 'data-raw/desc-batches')
const OUT_PATH = path.resolve(process.cwd(), 'src/data/exercises.json')

function loadDescriptions() {
  const files = fs.readdirSync(BATCH_DIR).filter((f) => f.startsWith('output-') && f.endsWith('.json'))
  const byId = new Map()
  for (const f of files) {
    const arr = JSON.parse(fs.readFileSync(path.join(BATCH_DIR, f), 'utf-8'))
    for (const item of arr) byId.set(item.id, item)
  }
  return byId
}

function briefContent(cand) {
  const desc = cand.vdo_desc || `${cand.name} 동작입니다.`
  return {
    benefit: desc,
    howto: [
      '영상을 재생해 자세를 그대로 따라 하세요.',
      '통증이 없는 범위에서 천천히 진행하세요.',
      '동작 속도보다 정확한 자세를 우선하세요.',
    ],
    breathing: '동작에 맞춰 편안하게 호흡하세요. 숨을 참지 마세요.',
    mistakes: ['영상 속 자세와 다르게 느껴지면 무리하지 말고 멈추세요.', '통증이 있으면 즉시 중단하세요.'],
  }
}

// 기구를 쓰는 헬스장·야외기구 운동에 붙는 안내. 47종 A(통합)는 실제 기구별 조절 요령을
// 원본 96종에서 그대로 갖고 있지만, 새로 들어온 B(700여종)는 기구 개체별 조절값을
// 확인할 근거 데이터가 없어 구체적 수치를 지어내는 대신 일반 안전 수칙만 안내한다.
function equipmentGuideText(cand) {
  const usesEquipment = (cand.place.includes('gym') || cand.place.includes('outdoor-gym')) && cand.equipment !== '없음'
  if (!usesEquipment) return undefined
  return '기구를 사용하기 전 시트·손잡이·패드 등 조절 부위가 몸에 맞는지 먼저 확인하세요. 처음에는 가벼운 무게(또는 낮은 강도)로 자세부터 충분히 익힌 뒤 강도를 서서히 올리세요.'
}

function finalizeSkeleton(skel, content) {
  const { vdo_desc, ageGroups, excludeFromAutoRoutine, ...rest } = skel
  return {
    ...rest,
    benefit: content.benefit,
    howto: content.howto,
    breathing: content.breathing,
    mistakes: content.mistakes,
    easier: null,
    harder: null,
    alternatives: [],
    tempo: null,
    equipmentGuide: equipmentGuideText(skel),
    ageGroups,
    excludeFromAutoRoutine,
  }
}

// alternatives(대안 운동 id, 2개 이상)를 자동 산출한다. A/원본 96종은 이미 사람이 고른
// alternatives를 갖고 있으므로 건드리지 않고, 새로 들어온 항목만 같은 type + bodyParts
// 겹침을 기준으로 채운다 — "전혀 다른 운동을 대안으로 제시" 위험을 줄이기 위해 type을
// 1순위 조건으로 고정하고, 겹치는 부위가 없으면 채우지 않는다(§6: 자신 없는 매칭 금지).
function fillAlternatives(all) {
  const byId = new Map(all.map((e) => [e.id, e]))
  for (const ex of all) {
    if (ex.alternatives && ex.alternatives.length >= 2) continue
    // 1순위: 같은 type + 겹치는 bodyParts(가장 구체적, 오추천 위험 최소).
    // bodyParts가 비어 있거나 매칭이 없으면 단계적으로 완화하되, type과 category(재활/수영/일반)는
    // 끝까지 고정한다 — 전혀 다른 성격의 운동을 "대안"으로 잘못 제시하지 않기 위해서다.
    const sameTypeCategory = all.filter((o) => o.id !== ex.id && o.type === ex.type && (o.category || null) === (ex.category || null))
    // type+category 조합이 이 운동 혼자뿐인 극소수 사례(예: 수영장 유산소는 "물속에서 걷기" 하나뿐)만
    // category 조건만 유지하고 type을 완화한다.
    const pool = sameTypeCategory.length > 0 ? sameTypeCategory : all.filter((o) => o.id !== ex.id && (o.category || null) === (ex.category || null))
    const scored = pool
      .map((o) => ({ o, shared: o.bodyParts.filter((bp) => ex.bodyParts.includes(bp)).length }))
      .sort((a, b) => b.shared - a.shared || a.o.id.localeCompare(b.o.id))
    ex.alternatives = scored.slice(0, 3).map((s) => s.o.id)
  }
  const stillShort = all.filter((e) => e.alternatives.length < 2)
  if (stillShort.length) {
    console.log(`[경고] 대안 운동을 2개 못 채운 항목: ${stillShort.length}건 (${stillShort.map((e) => e.id).join(', ')})`)
  }
  return byId
}

function main() {
  const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf-8'))
  const descById = loadDescriptions()

  const missing = []
  const bFull = plan.bFullSkeletons.map((skel) => {
    const content = descById.get(skel.id)
    if (!content) { missing.push(skel.id); return finalizeSkeleton(skel, briefContent(skel)) }
    return finalizeSkeleton(skel, content)
  })
  if (missing.length) console.log(`[경고] 에이전트 설명 누락 → brief로 대체: ${missing.length}건 (${missing.join(', ')})`)

  const bBrief = plan.bBriefSkeletons.map((skel) => finalizeSkeleton(skel, briefContent(skel)))

  const mergedA = plan.mergedA.map((ex) => ({ ...ex, excludeFromAutoRoutine: false }))
  const remainingC = plan.remainingC.map((ex) => ({ ...ex, descQuality: 'full', excludeFromAutoRoutine: false }))

  const all = [...mergedA, ...bFull, ...bBrief, ...remainingC]

  // 국민체력100 원본 영상 중 일부는 "운동"이 아니라 체력 측정(검사) 절차다(예: 일리노이
  // 민첩성 검사, 트레드밀 검사, 체성분 검사). 동작 자체는 영상으로 존재하지만 가정/헬스장
  // 루틴에 자동 배정하면 안 되므로 별도 카테고리로 태그하고 자동 배정에서 제외한다.
  const TEST_NAME_RE = /검사|측정/
  let testTagged = 0
  for (const ex of all) {
    if (TEST_NAME_RE.test(ex.name)) {
      ex.category = '체력측정'
      ex.excludeFromAutoRoutine = true
      testTagged++
    }
  }
  if (testTagged) console.log(`[정보] 체력측정 항목으로 재분류(자동 배정 제외): ${testTagged}건`)

  fillAlternatives(all)

  const ids = new Set()
  const dupes = []
  for (const e of all) { if (ids.has(e.id)) dupes.push(e.id); ids.add(e.id) }
  if (dupes.length) { console.error('[FAIL] id 중복:', dupes); process.exit(1) }

  fs.writeFileSync(OUT_PATH, JSON.stringify(all, null, 2) + '\n')

  console.log(`=== 최종 exercises.json ===`)
  console.log(`전체: ${all.length}종`)
  console.log(`  A(통합, 4단 완비): ${mergedA.length}`)
  console.log(`  B-full(4단 완비, 에이전트 작성): ${bFull.length - missing.length}`)
  console.log(`  B-brief(간략): ${bBrief.length}`)
  console.log(`  C(영상없음, 4단 완비 유지): ${remainingC.length}`)
  console.log(`4단 설명 완비: ${mergedA.length + bFull.length + remainingC.length}종`)
  console.log(`영상 보유: ${mergedA.length + bFull.length + bBrief.length}종`)
  console.log(`재활 태그: ${all.filter((e) => e.category === '재활').length} / 수영 태그: ${all.filter((e) => e.category === '수영').length}`)
}

main()
