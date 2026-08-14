import { describe, it, expect } from 'vitest'
import exercisesReal from '../data/exercises.json'
import {
  levelsForExperience, estimateExerciseSeconds, calcKcal,
  assignRoutine, suggestProgress, suggestHarder,
} from './exerciseEngine.js'

describe('levelsForExperience', () => {
  it('처음이에요(0) -> [1]', () => { expect(levelsForExperience('0')).toEqual([1]) })
  it('조금 있어요(1) -> [1,2]', () => { expect(levelsForExperience('1')).toEqual([1, 2]) })
  it('꾸준히 해요(2) -> [2,3]', () => { expect(levelsForExperience('2')).toEqual([2, 3]) })
})

describe('estimateExerciseSeconds / calcKcal', () => {
  it('횟수형 운동은 1회 3초로 추정하고 세트 사이 휴식을 더한다', () => {
    const ex = { repType: 'reps', defaultReps: 10, defaultSets: 3, restSec: 60 }
    // work: 10*3*3=90, rest: 60*2=120
    expect(estimateExerciseSeconds(ex)).toBe(210)
  })
  it('시간형 운동은 defaultReps를 초로 그대로 쓴다', () => {
    const ex = { repType: 'sec', defaultReps: 30, defaultSets: 3, restSec: 45 }
    // work: 30*3=90, rest: 45*2=90
    expect(estimateExerciseSeconds(ex)).toBe(180)
  })
  it('calcKcal은 체중×MET×시간(h) 공식을 따른다', () => {
    expect(calcKcal(70, 5, 3600)).toBe(350) // 70*5*1h
    expect(calcKcal(70, 5, 1800)).toBe(175) // 30분
  })
})

describe('assignRoutine — 합성 데이터로 필터·비율 검증', () => {
  const stretchHome = { id: 's1', place: ['home'], type: 'stretch', bodyParts: ['목'], level: 1, defaultSets: 2, defaultReps: 20, restSec: 15, metValue: 2.5, repType: 'sec' }
  const strengthHomeEasy = { id: 'st1', place: ['home'], type: 'strength', bodyParts: ['하체'], level: 1, defaultSets: 3, defaultReps: 10, restSec: 45, metValue: 5, repType: 'reps' }
  const strengthHomeHard = { id: 'st2', place: ['home'], type: 'strength', bodyParts: ['상체'], level: 3, defaultSets: 3, defaultReps: 10, restSec: 45, metValue: 5, repType: 'reps' }
  const strengthGym = { id: 'stg1', place: ['gym'], type: 'strength', bodyParts: ['하체'], level: 2, defaultSets: 3, defaultReps: 10, restSec: 60, metValue: 5, repType: 'reps' }
  const cardioHome = { id: 'c1', place: ['home'], type: 'cardio', bodyParts: ['심폐'], level: 1, defaultSets: 1, defaultReps: 300, restSec: 0, metValue: 8, repType: 'sec' }
  const excludedItem = { id: 'ex1', place: ['home'], type: 'strength', bodyParts: ['하체'], level: 1, defaultSets: 3, defaultReps: 10, restSec: 45, metValue: 5, repType: 'reps' }
  const fixture = [stretchHome, strengthHomeEasy, strengthHomeHard, strengthGym, cardioHome, excludedItem]
  const profileBeginner = { goal: 'lose', experience: '0', weight: 70 }

  it('선택한 장소에 속한 운동만 배정한다', () => {
    const { routine } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 30, meta: new Map() })
    expect(routine.every((e) => e.place.includes('home'))).toBe(true)
    expect(routine.some((e) => e.id === 'stg1')).toBe(false)
  })

  it('운동경험이 "처음이에요"면 level 1만 배정한다', () => {
    const { routine } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 60, meta: new Map() })
    expect(routine.every((e) => e.level === 1)).toBe(true)
    expect(routine.some((e) => e.id === 'st2')).toBe(false) // level 3
  })

  it('교체 이력이 3회 이상인 운동은 자동 배정에서 제외한다', () => {
    const meta = new Map([['st1', { completedCount: 0, swapCount: 3, firstCompletedAt: null, lastCompletedAt: null }]])
    const { routine } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 60, meta })
    expect(routine.some((e) => e.id === 'st1')).toBe(false)
  })

  it('빈 배열이 아닌 루틴을 만들고 예상 시간·칼로리를 계산한다', () => {
    const { routine, estMinutes, estKcal } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 30, meta: new Map() })
    expect(routine.length).toBeGreaterThan(0)
    expect(estMinutes).toBeGreaterThan(0)
    expect(estKcal).toBeGreaterThan(0)
  })
})

describe('assignRoutine — preferVideo(영상 있는 운동만 추천받기)', () => {
  const vid = [{ title: 't', url: 'u', thumbnail: null, len: 60, ageGroup: '공통' }]
  const stretchVid = { id: 'sv1', place: ['home'], type: 'stretch', bodyParts: ['목'], level: 1, defaultSets: 2, defaultReps: 20, restSec: 15, metValue: 2.5, repType: 'sec', videos: vid }
  const strengthVid = { id: 'stv1', place: ['home'], type: 'strength', bodyParts: ['하체'], level: 1, defaultSets: 3, defaultReps: 10, restSec: 45, metValue: 5, repType: 'reps', videos: vid }
  const strengthNoVid = { id: 'stn1', place: ['home'], type: 'strength', bodyParts: ['상체'], level: 1, defaultSets: 3, defaultReps: 10, restSec: 45, metValue: 5, repType: 'reps' }
  const cardioNoVid = { id: 'cn1', place: ['home'], type: 'cardio', bodyParts: ['심폐'], level: 1, defaultSets: 1, defaultReps: 300, restSec: 0, metValue: 8, repType: 'sec' }
  const profileBeginner = { goal: 'lose', experience: '0', weight: 70 }

  it('영상 있는 운동만으로 채울 수 있으면 nonVideoCount는 0이다', () => {
    const fixture = [stretchVid, strengthVid]
    const { routine, nonVideoCount } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 20, meta: new Map(), preferVideo: true })
    expect(nonVideoCount).toBe(0)
    expect(routine.every((e) => e.videos?.length > 0)).toBe(true)
  })

  it('영상 있는 운동만으로 부족하면 부족분만 영상 없는 운동으로 채우고 개수를 알려준다', () => {
    const fixture = [stretchVid, strengthVid, strengthNoVid, cardioNoVid]
    const { routine, nonVideoCount } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 45, meta: new Map(), preferVideo: true })
    expect(routine.length).toBeGreaterThan(0)
    expect(nonVideoCount).toBe(routine.filter((e) => !(e.videos?.length > 0)).length)
  })

  it('preferVideo가 꺼져 있으면 nonVideoCount를 항상 0으로 보고한다(끔=신경 안 씀)', () => {
    const fixture = [stretchVid, strengthVid, strengthNoVid, cardioNoVid]
    const { nonVideoCount } = assignRoutine({ exercises: fixture, profile: profileBeginner, place: 'home', minutes: 45, meta: new Map(), preferVideo: false })
    expect(nonVideoCount).toBe(0)
  })
})

describe('assignRoutine — 실제 exercises.json으로 4개 장소 전부 정상 동작 확인', () => {
  const profile = { goal: 'keep', experience: '1', weight: 68 }
  for (const place of ['home', 'gym', 'outdoor-gym', 'outdoor']) {
    it(`place="${place}"에서 예외 없이 루틴을 만든다`, () => {
      const { routine } = assignRoutine({ exercises: exercisesReal, profile, place, minutes: 30, meta: new Map() })
      expect(routine.length).toBeGreaterThan(0)
      expect(routine.every((e) => e.place.includes(place))).toBe(true)
    })
  }
})

describe('assignRoutine — 실제 데이터, preferVideo 켜짐으로 45분 루틴이 4개 장소 전부 채워지는지', () => {
  const profile = { goal: 'keep', experience: '1', weight: 68 }
  for (const place of ['home', 'gym', 'outdoor-gym', 'outdoor']) {
    it(`place="${place}"에서 45분 루틴을 만들고 부족분(nonVideoCount)을 보고한다`, () => {
      const { routine, estMinutes, nonVideoCount } = assignRoutine({
        exercises: exercisesReal, profile, place, minutes: 45, meta: new Map(), preferVideo: true,
      })
      expect(routine.length).toBeGreaterThan(0)
      expect(estMinutes).toBeGreaterThan(0)
      expect(nonVideoCount).toBe(routine.filter((e) => !(e.videos?.length > 0)).length)
    })
  }
})

describe('suggestProgress — 4회 완료마다 강도 상향 제안', () => {
  const ex = { name: '테스트 운동', repType: 'reps', defaultReps: 10 }
  it('완료 0회면 제안하지 않는다', () => { expect(suggestProgress(ex, { completedCount: 0 })).toBeNull() })
  it('완료 3회면 제안하지 않는다', () => { expect(suggestProgress(ex, { completedCount: 3 })).toBeNull() })
  it('완료 4회면 제안한다(횟수+2)', () => {
    const s = suggestProgress(ex, { completedCount: 4 })
    expect(s).not.toBeNull()
    expect(s.reps).toBe(12)
  })
  it('완료 8회에도 다시 제안한다', () => { expect(suggestProgress(ex, { completedCount: 8 })).not.toBeNull() })
  it('시간형 운동은 초를 10 늘려 제안한다', () => {
    const secEx = { name: '플랭크', repType: 'sec', defaultReps: 20 }
    expect(suggestProgress(secEx, { completedCount: 4 }).reps).toBe(30)
  })
})

describe('suggestHarder — 2주 후 상위 동작 제안', () => {
  const ex = { harder: 'harder-id' }
  it('첫 완료 후 14일 미만이면 제안하지 않는다', () => {
    expect(suggestHarder(ex, { firstCompletedAt: '2026-08-01' }, '2026-08-10')).toBeNull()
  })
  it('첫 완료 후 14일 이상이면 harder id를 제안한다', () => {
    expect(suggestHarder(ex, { firstCompletedAt: '2026-08-01' }, '2026-08-15')).toBe('harder-id')
  })
  it('harder가 없으면 제안하지 않는다', () => {
    expect(suggestHarder({ harder: null }, { firstCompletedAt: '2026-08-01' }, '2026-09-01')).toBeNull()
  })
})
