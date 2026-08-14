import { describe, it, expect } from 'vitest'
import exercises from './exercises.json'
import { POSE_KEYS } from '../components/exercise-animations/StickFigure.jsx'
import { matchFoodItem, rankFoodItem } from '../lib/chosung.js'

const byId = new Map(exercises.map((e) => [e.id, e]))

describe('exercises.json — 데이터 무결성', () => {
  it('80종 이상이어야 한다', () => {
    expect(exercises.length).toBeGreaterThanOrEqual(80)
  })

  it('id가 전부 고유해야 한다', () => {
    const ids = exercises.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  const REQUIRED_FIELDS = [
    'id', 'name', 'aliases', 'place', 'type', 'bodyParts', 'level', 'equipment',
    'benefit', 'howto', 'breathing', 'mistakes', 'easier', 'harder', 'alternatives',
    'defaultSets', 'defaultReps', 'restSec', 'metValue', 'animation',
  ]
  it('모든 항목이 필수 필드를 갖춰야 한다(benefit·howto·breathing·mistakes 포함)', () => {
    const missing = exercises.filter((e) => REQUIRED_FIELDS.some((f) => !(f in e)))
    expect(missing.map((e) => e.id)).toEqual([])
  })

  it('howto는 3~6단계여야 한다', () => {
    const bad = exercises.filter((e) => e.howto.length < 3 || e.howto.length > 6)
    expect(bad.map((e) => e.id)).toEqual([])
  })

  it('mistakes·alternatives는 2개 이상이어야 한다', () => {
    const bad = exercises.filter((e) => e.mistakes.length < 2 || e.alternatives.length < 2)
    expect(bad.map((e) => e.id)).toEqual([])
  })

  it('easier·harder·alternatives는 실제 존재하는 id를 가리켜야 한다', () => {
    const bad = []
    for (const e of exercises) {
      for (const ref of ['easier', 'harder']) if (e[ref] && !byId.has(e[ref])) bad.push(`${e.id}.${ref}`)
      for (const alt of e.alternatives) if (!byId.has(alt)) bad.push(`${e.id}.alternatives`)
    }
    expect(bad).toEqual([])
  })

  // 2.6단계: animation은 20종 캐노니컬 포즈 또는 null만 허용한다. 예전엔 확신 없는 동작도
  // 'squat' 등으로 조용히 대체했는데, 이는 §8 "틀린 영상/자세 금지" 원칙을 애니메이션에는
  // 적용하지 않은 허점이었다(StickFigure.jsx 참고). null인 항목은 UI에서 NoPosePlaceholder로
  // 대체되고 영상으로 안내한다 — 틀린 그림보다 그림 없음이 낫다는 판단.
  it('animation 필드는 20종 캐노니컬 포즈 또는 null(확신 없으면 억지로 맞추지 않음)이어야 한다', () => {
    const bad = exercises.filter((e) => e.animation !== null && !POSE_KEYS.includes(e.animation))
    expect(bad.map((e) => e.id)).toEqual([])
    expect(POSE_KEYS.length).toBe(20)
  })
  it('animation이 null인 항목은 영상을 최소 1개는 갖는다(그림도 영상도 없는 항목 금지)', () => {
    const bad = exercises.filter((e) => e.animation === null && !(e.videos?.length > 0))
    expect(bad.map((e) => e.id)).toEqual([])
  })
})

describe('exercises.json — 장소별 최소 개수 (완료 기준 1)', () => {
  it('집(맨몸, 기구 없음) 30종 이상', () => {
    const list = exercises.filter((e) => e.place.includes('home') && e.equipment === '없음' && e.type === 'strength')
    expect(list.length).toBeGreaterThanOrEqual(30)
  })
  it('집(소도구) 10종 이상', () => {
    const list = exercises.filter((e) => e.place.includes('home') && e.equipment !== '없음')
    expect(list.length).toBeGreaterThanOrEqual(10)
  })
  it('스트레칭·요가 15종 이상', () => {
    expect(exercises.filter((e) => e.type === 'stretch').length).toBeGreaterThanOrEqual(15)
  })
  it('헬스장 기구 20종 이상', () => {
    const list = exercises.filter((e) => e.place.includes('gym') && !e.place.includes('outdoor-gym'))
    expect(list.length).toBeGreaterThanOrEqual(20)
  })
  it('야외 운동기구 8종 이상', () => {
    expect(exercises.filter((e) => e.place.includes('outdoor-gym')).length).toBeGreaterThanOrEqual(8)
  })
  it('유산소 10종 이상', () => {
    expect(exercises.filter((e) => e.type === 'cardio').length).toBeGreaterThanOrEqual(10)
  })
})

describe('exercises.json — 1단계 chosung.js 검색 재사용', () => {
  it('초성 검색 "ㅅㅋㅌ"로 "기본 스쿼트"를 찾는다', () => {
    const results = exercises.filter((e) => matchFoodItem(e, 'ㅅㅋㅌ'))
    expect(results.some((e) => e.id === 'squat-basic')).toBe(true)
  })
  it('완성 단어 "런지" 검색은 이름에 포함된 운동만 찾는다', () => {
    const results = exercises.filter((e) => matchFoodItem(e, '런지'))
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((e) => e.name.includes('런지') || (e.aliases || []).some((a) => a.includes('런지')))).toBe(true)
  })
  it('별칭 검색 "풀업"이 "철봉 턱걸이"를 관련도 1순위로 찾는다', () => {
    const results = exercises
      .filter((e) => matchFoodItem(e, '풀업'))
      .map((e) => ({ e, rank: rankFoodItem(e, '풀업') }))
      .sort((a, b) => a.rank - b.rank)
    expect(results[0]?.e.id).toBe('pull-up-outdoor')
  })
})

describe('exercises.json — 2.5단계 §3-1: tempo 필드', () => {
  it('모든 운동이 tempo 키를 가진다(값은 null 가능 — 정적/시간형은 null)', () => {
    expect(exercises.every((e) => 'tempo' in e)).toBe(true)
  })
  it('tempo가 있으면 down·hold·up·cue(3단계)를 갖춘다', () => {
    const withTempo = exercises.filter((e) => e.tempo)
    expect(withTempo.length).toBeGreaterThan(0)
    const bad = withTempo.filter((e) => !('down' in e.tempo && 'hold' in e.tempo && 'up' in e.tempo) || e.tempo.cue?.length !== 3)
    expect(bad.map((e) => e.id)).toEqual([])
  })
  it('시간형(repType=sec) 운동은 tempo가 null이다(페이서 대신 카운트다운 사용)', () => {
    const bad = exercises.filter((e) => e.repType === 'sec' && e.tempo !== null)
    expect(bad.map((e) => e.id)).toEqual([])
  })
})

describe('exercises.json — 완료 기준 2: 헬스장·야외기구 운동 전부에 equipmentGuide 존재', () => {
  it('기구를 쓰는 헬스장·야외기구 운동은 모두 equipmentGuide를 갖는다', () => {
    const targets = exercises.filter((e) =>
      (e.place.includes('gym') || e.place.includes('outdoor-gym')) && e.equipment !== '없음')
    expect(targets.length).toBeGreaterThan(0)
    const missing = targets.filter((e) => !e.equipmentGuide)
    expect(missing.map((e) => e.id)).toEqual([])
  })
})
