// scripts/classify-exercise-library.mjs — 2.6단계 §3-2: 기존 96종과 kspo-exercise-candidates.json
// (795종)을 대조해 A(통합)/B(신규)/C(영상없음 유지)로 분류하고 보고한다. 데이터는 쓰지 않는다
// (검수 전이므로 §3-3에서 실제로 반영).
//
// A 매핑 표는 스크립트 실행 전 수작업으로 원본(trng_nm) 검색을 통해 직접 확인한 것만 넣었다.
// 확신 없는 항목은 넣지 않았다(B/C로 남김) — 발주자 지시("확신 없는 것은 B로") 준수.
//
// 사용법: node scripts/classify-exercise-library.mjs

import fs from 'node:fs'
import path from 'node:path'

const EXERCISES_PATH = path.resolve(process.cwd(), 'src/data/exercises.json')
const CANDIDATES_PATH = path.resolve(process.cwd(), 'data-raw/kspo-exercise-candidates.json')

// id → [매칭된 후보 name들] + 확인 근거(비고)
const A_MAP = {
  'squat-basic': { names: ['앉았다 일어서기'], note: '공단 표현이 "스쿼트"를 "앉았다 일어서기"로 옮김(작업지시서 §0 표)' },
  'squat-sumo': { names: ['다리 넓게 벌려 앉았다 일어서기'], note: '와이드 스탠스 = 스모 스쿼트' },
  'chair-squat': { names: ['의자에 앉았다 일어서기', '의자 앞에서 앉았다 일어서기'], note: '의자를 이용한 앉았다 일어서기' },
  'lunge-forward': { names: ['런지'], note: '완전일치' },
  'lunge-reverse': { names: ['리버스 런지 후 다리올리기'], note: '방향 수식어(리버스) 유지, 다리올리기는 추가 동작' },
  'lunge-side': { names: ['사이드 런지 후 제기차기', '사이드 런지 후 점프'], note: '방향 수식어(사이드) 유지' },
  'pushup-standard': { names: ['팔 굽혀 펴기'], note: '완전일치("팔 굽혀 펴기" = 푸시업, §0 표)' },
  'plank-forearm': { names: ['플랭크'], note: '완전일치' },
  'bridge-glute': { names: ['브릿지 후 뒤꿈치 들기'], note: '기본 브릿지 동작 + 추가 동작(뒤꿈치 들기)' },
  'crunch-basic': { names: ['윗몸 말아 올리기'], note: '완전일치(§0 표: 크런치 = 윗몸 말아 올리기)' },
  'crunch-bicycle': { names: ['크런치 싸이클'], note: '"크런치 싸이클" = 바이시클 크런치 그대로' },
  'burpee': { names: ['버피 운동', '버피 테스트'], note: '완전일치' },
  'jumping-jack': { names: ['팔 벌려 뛰기'], note: '완전일치(§0 표)' },
  'pull-up-outdoor': { names: ['턱걸이'], note: '완전일치' },
  'parallel-bar-dips': { names: ['매달려서 뒤로 팔 굽혀 펴기'], note: '"매달려서"(행잉) = 평행봉 딥스 자세' },
  'chair-tricep-dip': { names: ['의자에서 뒤로 팔 굽혀 펴기'], note: '2026-08-14 발주자 검수: 벤치/박스/테이블 버전 대신 의자(tool=의자) 버전으로 확정' },
  'calf-raise-standing': { names: ['서서 뒤꿈치 들기', '발 뒤꿈치 들어올리기'], note: '맨몸/의자 보조 스탠딩 카프레이즈' },
  'calf-raise-machine': { names: ['뒤꿈치 들기'], note: '2026-08-14 발주자 검수: 그룹 내 2개 영상 중 tool=바벨/장소=헬스장인 0AUDLJ08S_00193.mp4로 확정(스텝박스 버전 0AUDLJ08S_00477.mp4는 별개 B로 분리)' },
  'stretch-neck-side': { names: ['좌/우 굴곡(목 좌/우 굴곡)'], note: '완전일치(설명 괄호로 "목 좌우 굴곡" 명시)' },
  'stretch-neck-forward': { names: ['앞 뒤 굴곡(목 앞 뒤 굴곡)'], note: '완전일치(설명 괄호로 "목 앞뒤 굴곡" 명시)' },
  'stretch-waist-side': { names: ['옆구리 스트레칭'], note: '완전일치' },
  'stretch-hip-flexor': { names: ['고관절 스트레칭'], note: '완전일치' },
  'yoga-child-pose': { names: ['아기 자세'], note: '완전일치' },
  'band-row': { names: ['앉아서 밴드 당기기'], note: '앉아서 밴드를 당기는 동작 = 밴드 로우' },
  'dumbbell-curl': { names: ['고정한 상태에서 덤벨 들고 팔꿈치 굽히기'], note: '팔꿈치 굽히기(고정) = 덤벨 컬' },
  'dumbbell-row': { names: ['허리 굽혀 덤벨 들기'], note: '허리 굽혀 덤벨 들기 = 벤트오버 덤벨 로우' },
  'shoulder-press-machine': { names: ['앉아서 어깨 위로 밀기'], note: '기구=헬스기구, 앉아서 어깨 위로 밀기 = 숄더프레스' },
  'hip-abductor-machine': { names: ['앉아서 다리 벌리기'], note: '기구=헬스기구, 다리 벌리기 = 힙 어브덕터' },
  'hip-adductor-machine': { names: ['앉아서 다리 모으기'], note: '기구=헬스기구, 다리 모으기 = 힙 어덕터' },
  'pec-deck': { names: ['앉아서 가슴 모으기'], note: '기구=헬스기구, 가슴 모으기 = 펙덱 플라이' },
  'cable-tricep-pushdown': { names: ['서서 팔꿈치 펴기'], note: '기구=헬스기구, 서서 팔꿈치 펴기 = 케이블 푸시다운' },
  'ab-crunch-machine': { names: ['앉아서 몸통 움츠리기'], note: '기구=헬스기구, 몸통 움츠리기 = 복근 크런치 머신' },
  'lat-pulldown': { names: ['앉아서 당겨 내리기'], note: '완전일치(§0 표)' },
  'chest-press-machine': { names: ['앉아서 밀기'], note: '완전일치(§0 표)' },
  'leg-press': { names: ['앉아서 다리 밀기'], note: '완전일치(§0 표)' },
  'leg-extension': { names: ['앉아서 다리 펴기'], note: '완전일치(§0 표)' },
  'leg-curl': { names: ['앉아서 다리 굽히기'], note: '완전일치(§0 표)' },
  'seated-row-machine': { names: ['앉아서 뒤로 당기기'], note: '완전일치(§0 표)' },
  'walk': { names: ['걷기'], note: '완전일치' },
  'brisk-walk': { names: ['빠르게 걷기', '빠르게 걷기(3단계)'], note: '완전일치' },
  'jog': { names: ['조깅'], note: '완전일치' },
  'run': { names: ['달리기'], note: '완전일치' },
  'stair-climb': { names: ['계단 오르기'], note: '완전일치' },
  'cycle-outdoor': { names: ['자전거 타기'], note: '완전일치' },
  'jump-rope': { names: ['줄넘기'], note: '완전일치' },
  'treadmill': { names: ['트레드밀에서 걷기', '고정식 트레드밀에서 걷기', '고정식 트레드밀 걷기'], note: '완전일치' },
  'stationary-bike': { names: ['실내 자전거타기'], note: '"실내"에서 자전거 타기 = 실내 사이클' },
}

function normalize(s) { return (s || '').replace(/[()（）\s]/g, '').trim() }

function main() {
  const exercises = JSON.parse(fs.readFileSync(EXERCISES_PATH, 'utf-8'))
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf-8'))
  const candByName = new Map(candidates.map((c) => [c.name, c]))

  const consumedCandidateNames = new Set()
  const A = []
  const C = []

  for (const ex of exercises) {
    const mapping = A_MAP[ex.id]
    if (!mapping) { C.push(ex); continue }
    const matchedCands = mapping.names.map((n) => candByName.get(n)).filter(Boolean)
    if (matchedCands.length === 0) { C.push(ex); continue } // 후보 이름이 바뀌었거나 못 찾음 → 안전하게 C
    matchedCands.forEach((c) => consumedCandidateNames.add(c.name))
    const totalVideos = matchedCands.reduce((s, c) => s + c.videoCount, 0)
    A.push({ ex, candidates: matchedCands, note: mapping.note, totalVideos })
  }

  const B = candidates.filter((c) => !consumedCandidateNames.has(c.name))

  console.log(`=== A. 통합 대상 (${A.length}건) — 기존 운동에 영상+공식 메타데이터 결합 ===`)
  A.forEach(({ ex, candidates: cands, note, totalVideos }) => {
    console.log(`  [${ex.id}] ${ex.name}  ←  ${cands.map((c) => c.name).join(' / ')}  (영상 ${totalVideos}개)`)
    console.log(`    근거: ${note}`)
  })

  console.log(`\n=== B. 신규 편입 후보 (${B.length}건 중 상위 40건만 표시, 전체는 data-raw/kspo-exercise-candidates.json) ===`)
  B.slice(0, 40).forEach((c) => console.log(`  ${c.name} (영상 ${c.videoCount}개, 기구=${c.tool_nm || '-'}, 부위=${c.trng_mscl_part || c.trng_part_nm || '-'})`))

  console.log(`\n=== C. 영상 없음 유지 (${C.length}건) — 그림 설명만 ===`)
  C.forEach((ex) => console.log(`  [${ex.id}] ${ex.name}`))

  console.log(`\n=== 요약 ===`)
  console.log(`기존 96종 중 A(통합): ${A.length} / C(영상없음): ${C.length}`)
  console.log(`후보 795종 중 A로 소비: ${consumedCandidateNames.size} / B(신규 남음): ${B.length}`)
  console.log(`영상 보유 예상 운동 수(A + B): ${A.length + B.length}`)
}

main()
