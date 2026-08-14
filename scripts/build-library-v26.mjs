// scripts/build-library-v26.mjs — 2.6단계 §3-3: A(47종) 병합 + B(795종 후보) 분류/스키마 생성.
// 콘텐츠(4단 설명) 작성은 하지 않는다 — 이 스크립트는 구조/분류/우선순위만 만들고,
// data-raw/kspo-library-plan.json에 다음 단계(설명 작성)에 필요한 재료를 저장한다.
//
// 사용법: node scripts/build-library-v26.mjs

import fs from 'node:fs'
import path from 'node:path'

const EXERCISES_PATH = path.resolve(process.cwd(), 'src/data/exercises.json')
const CANDIDATES_PATH = path.resolve(process.cwd(), 'data-raw/kspo-exercise-candidates.json')
const PLAN_OUT = path.resolve(process.cwd(), 'data-raw/kspo-library-plan.json')

// ── A. 발주자 검수 완료된 47건 매핑(2026-08-14 확정, correction 반영) ──
const A_MAP = {
  'squat-basic': ['앉았다 일어서기'],
  'chair-squat': ['의자에 앉았다 일어서기', '의자 앞에서 앉았다 일어서기'],
  'squat-sumo': ['다리 넓게 벌려 앉았다 일어서기'],
  'lunge-forward': ['런지'],
  'lunge-reverse': ['리버스 런지 후 다리올리기'],
  'lunge-side': ['사이드 런지 후 제기차기', '사이드 런지 후 점프'],
  'pushup-standard': ['팔 굽혀 펴기'],
  'plank-forearm': ['플랭크'],
  'bridge-glute': ['브릿지 후 뒤꿈치 들기'],
  'crunch-basic': ['윗몸 말아 올리기'],
  'crunch-bicycle': ['크런치 싸이클'],
  'burpee': ['버피 운동', '버피 테스트'],
  'jumping-jack': ['팔 벌려 뛰기'],
  'band-row': ['앉아서 밴드 당기기'],
  'dumbbell-curl': ['고정한 상태에서 덤벨 들고 팔꿈치 굽히기'],
  'dumbbell-row': ['허리 굽혀 덤벨 들기'],
  'chair-tricep-dip': ['의자에서 뒤로 팔 굽혀 펴기'],
  'stretch-neck-side': ['좌/우 굴곡(목 좌/우 굴곡)'],
  'stretch-neck-forward': ['앞 뒤 굴곡(목 앞 뒤 굴곡)'],
  'stretch-waist-side': ['옆구리 스트레칭'],
  'stretch-hip-flexor': ['고관절 스트레칭'],
  'yoga-child-pose': ['아기 자세'],
  'lat-pulldown': ['앉아서 당겨 내리기'],
  'chest-press-machine': ['앉아서 밀기'],
  'leg-press': ['앉아서 다리 밀기'],
  'leg-extension': ['앉아서 다리 펴기'],
  'leg-curl': ['앉아서 다리 굽히기'],
  'seated-row-machine': ['앉아서 뒤로 당기기'],
  'cable-tricep-pushdown': ['서서 팔꿈치 펴기'],
  'shoulder-press-machine': ['앉아서 어깨 위로 밀기'],
  'pec-deck': ['앉아서 가슴 모으기'],
  'hip-abductor-machine': ['앉아서 다리 벌리기'],
  'hip-adductor-machine': ['앉아서 다리 모으기'],
  'ab-crunch-machine': ['앉아서 몸통 움츠리기'],
  'pull-up-outdoor': ['턱걸이'],
  'parallel-bar-dips': ['매달려서 뒤로 팔 굽혀 펴기'],
  'walk': ['걷기'],
  'brisk-walk': ['빠르게 걷기', '빠르게 걷기(3단계)'],
  'jog': ['조깅'],
  'run': ['달리기'],
  'stair-climb': ['계단 오르기'],
  'cycle-outdoor': ['자전거 타기'],
  'jump-rope': ['줄넘기'],
  'treadmill': ['트레드밀에서 걷기', '고정식 트레드밀에서 걷기', '고정식 트레드밀 걷기'],
  'stationary-bike': ['실내 자전거타기'],
  'calf-raise-standing': ['서서 뒤꿈치 들기', '발 뒤꿈치 들어올리기'],
}
// 그룹 내 특정 file_nm 하나만 골라야 하는 경우(발주자 2026-08-14 수정 지시)
const VIDEO_FILE_OVERRIDE = {
  'calf-raise-machine': { group: '뒤꿈치 들기', fileNm: '0AUDLJ08S_00193.mp4' }, // tool=바벨/장소=헬스장 버전만
}
const A_MAP_EXTRA = { 'calf-raise-machine': ['뒤꿈치 들기'] }
Object.assign(A_MAP, A_MAP_EXTRA)

function normSpace(s) { return (s || '').replace(/\s+/g, ' ').trim() }

function toVideoEntry(v) {
  return { title: v.title, url: v.url, thumbnail: v.thumbnail, len: v.lenSec, ageGroup: v.ageGroup }
}

function mapPlace(plcNm) {
  if (!plcNm) return []
  const out = new Set()
  if (plcNm.includes('실내')) out.add('home')
  if (plcNm.includes('헬스장')) out.add('gym')
  if (plcNm.includes('실외') || plcNm.includes('운동장')) out.add('outdoor')
  if (plcNm.includes('수영장')) out.add('pool')
  return [...out]
}

function mapLevel(lvlNm) {
  if (!lvlNm) return null
  if (lvlNm.includes('초급')) return 1
  if (lvlNm.includes('중급')) return 2
  const m = lvlNm.match(/^(\d+)/)
  if (m) {
    const n = Number(m[1])
    if (n <= 2) return 1
    if (n === 3) return 2
    return 3
  }
  return null
}

function parseRange(s) {
  if (!s) return null
  const m = s.match(/(\d+)\s*~?\s*(\d+)?/)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return Math.round((a + b) / 2)
}

// 이름/근육부위 키워드로 애니메이션 폴백 포즈를 "확신 있는 경우만" 배정한다.
// 확신 없으면 null로 둔다 — 틀린 애니메이션도 틀린 영상과 같은 위험이다(오프라인 시
// 엉뚱한 자세를 보여주게 됨). null인 경우 오프라인일 때는 안내 문구로 대체한다(§3-4).
const ANIM_RULES = [
  [/앉았다 일어서|스쿼트/, 'squat'],
  [/런지/, 'lunge'],
  [/플랭크/, 'plank'],
  [/브릿지/, 'bridge'],
  [/말아 올리기|크런치|윗몸/, 'crunch'],
  [/턱걸이|당겨 내리기|풀업/, 'pullup'],
  [/뒤로 팔 굽혀 펴기|딥스/, 'dips'],
  [/팔 굽혀 펴기|푸시업/, 'pushup'],
  [/뒤로 당기기|로우|당기기/, 'row'],
  [/위로 밀기|숄더|프레스/, 'press'],
  [/^걷기|걷기$|걷기\(/, 'walk'],
  [/달리기|뛰기|런닝/, 'run'],
  [/자전거|사이클/, 'cycle'],
  [/마운틴클라이머|마운틴 클라이머/, 'mountain-climber'],
  [/목.*스트레칭|목 (좌|앞|굽|돌)/, 'stretch-neck'],
  [/어깨.*스트레칭|어깨.*(돌림|벌림)/, 'stretch-shoulder'],
  [/허리|등.*스트레칭|허리.*스트레칭/, 'stretch-back'],
  [/햄스트링|다리 뒤|허벅지 뒤/, 'stretch-hamstring'],
  [/덤벨 들기|데드리프트|들어올리기/, 'deadlift'],
]
function guessAnimation(name) {
  for (const [re, pose] of ANIM_RULES) if (re.test(name)) return pose
  return null
}

function guessType(cand) {
  if ((cand.ftns_lvl_nm || '').includes('유연') || /스트레칭|늘리기|이완|돌리기|굽히기\/펴기/.test(cand.name)) {
    if (!/굽혔다 펴기|밀기|당기기|들어올리기/.test(cand.name)) return 'stretch'
  }
  if (/걷기|달리기|뛰기|자전거|줄넘기|사이클|계단/.test(cand.name)) return 'cardio'
  return 'strength'
}

function slug(i) { return `kspo-${String(i).padStart(4, '0')}` }

function main() {
  const exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, 'utf-8'))
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf-8'))
  const candByName = new Map(candidates.map((c) => [c.name, c]))
  const exById = new Map(exercises.map((e) => [e.id, e]))

  const consumed = new Set()
  const mergedA = []
  for (const [id, names] of Object.entries(A_MAP)) {
    const ex = exById.get(id)
    if (!ex) { console.error(`[경고] ${id}가 exercises.json에 없음`); continue }
    const cands = names.map((n) => candByName.get(n)).filter(Boolean)
    if (cands.length === 0) { console.error(`[경고] ${id}의 후보를 못 찾음: ${names}`); continue }
    cands.forEach((c) => consumed.add(c.name))

    let videos = cands.flatMap((c) => c.videos)
    const override = VIDEO_FILE_OVERRIDE[id]
    if (override) videos = cands.find((c) => c.name === override.group).videos.filter((v) => v.fileNm === override.fileNm)

    const rep = cands[0]
    const aliasSet = new Set(ex.aliases || [])
    names.forEach((n) => aliasSet.add(n))

    const musclesKr = [...new Set(cands.map((c) => c.trng_mscl_part).filter(Boolean))].join(', ') || null
    const officialReps = parseRange(rep.rptt_tcnt_nm)
    const officialSets = parseRange(rep.set_cnt_nm)

    mergedA.push({
      ...ex,
      aliases: [...aliasSet],
      source: '국민체력100',
      musclesKr,
      defaultReps: officialReps || ex.defaultReps,
      defaultSets: officialSets || ex.defaultSets,
      videos: videos.map(toVideoEntry),
      descQuality: 'full',
    })
  }

  const remainingC = exercises.filter((e) => !mergedA.some((m) => m.id === e.id))

  const bAll = candidates.filter((c) => !consumed.has(c.name))
  function isHomeGym(c) { const p = c.trng_plc_nm || ''; return p.includes('실내') || p.includes('헬스장') }
  function isAdultCommon(c) { return c.ageGroups.length === 0 || c.ageGroups.includes('성인') || c.ageGroups.includes('공통') }

  const bNormal = bAll.filter((c) => !c.isRehab && !c.isPool)
  const bRehab = bAll.filter((c) => c.isRehab)
  const bPool = bAll.filter((c) => c.isPool && !c.isRehab)

  const tier2 = bNormal.filter((c) => isHomeGym(c) && isAdultCommon(c))
  const tier3 = bNormal.filter((c) => !(isHomeGym(c) && isAdultCommon(c)))
  const completeness = (c) => ['trng_mscl_part', 'tool_nm', 'trng_plc_nm', 'ftns_lvl_nm', 'vdo_desc'].filter((f) => c[f]).length
  tier3.sort((a, b) => completeness(b) - completeness(a))

  const targetFull = Math.max(0, 300 - mergedA.length)
  const fullPool = [...tier2, ...tier3.slice(0, Math.max(0, targetFull - tier2.length))]
  const briefPool = bAll.filter((c) => !fullPool.includes(c))

  let idx = 1
  function buildSkeleton(cand, descQuality) {
    const place = mapPlace(cand.trng_plc_nm)
    const level = mapLevel(cand.ftns_lvl_nm) || (cand.tool_nm && cand.tool_nm !== '없음' ? 2 : 1)
    const type = guessType(cand)
    const category = cand.isRehab ? '재활' : cand.isPool ? '수영' : null
    return {
      id: slug(idx++),
      name: cand.name,
      aliases: [],
      source: '국민체력100',
      category,
      place: place.length ? place : ['home'],
      type,
      bodyParts: cand.trng_mscl_part ? [...new Set(cand.trng_mscl_part.split(','))] : [],
      musclesKr: cand.trng_mscl_nm || null,
      level,
      equipment: cand.tool_nm || '없음',
      ageGroups: cand.ageGroups,
      vdo_desc: cand.vdo_desc,
      defaultReps: parseRange(cand.rptt_tcnt_nm) || 10,
      defaultSets: parseRange(cand.set_cnt_nm) || 3,
      restSec: 60,
      metValue: type === 'cardio' ? 6 : type === 'stretch' ? 2.5 : 5,
      animation: guessAnimation(cand.name),
      videos: cand.videos.map(toVideoEntry),
      descQuality,
      excludeFromAutoRoutine: cand.isRehab || cand.isPool,
    }
  }

  const bFullSkeletons = fullPool.map((c) => buildSkeleton(c, 'full'))
  const bBriefSkeletons = briefPool.map((c) => buildSkeleton(c, 'brief'))

  fs.writeFileSync(PLAN_OUT, JSON.stringify({
    mergedA, remainingC, bFullSkeletons, bBriefSkeletons,
  }, null, 2) + '\n')

  console.log(`A(통합): ${mergedA.length}`)
  console.log(`C(영상없음 유지): ${remainingC.length}`)
  console.log(`B-full(4단 설명 작성 대상): ${bFullSkeletons.length}`)
  console.log(`B-brief(간략): ${bBriefSkeletons.length}`)
  console.log(`  중 재활: ${bAll.filter((c) => c.isRehab).length}, 수영: ${bAll.filter((c) => c.isPool && !c.isRehab).length}`)
  console.log(`총 라이브러리 크기(A+B): ${mergedA.length + bFullSkeletons.length + bBriefSkeletons.length}`)
  console.log(`4단 설명 완비 목표: ${mergedA.length + bFullSkeletons.length}종`)
  console.log(`저장 완료 → ${PLAN_OUT}`)
}

main()
