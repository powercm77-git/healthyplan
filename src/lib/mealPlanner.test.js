import { describe, it, expect } from 'vitest'
import foodsReal from '../data/foods.json'
import {
  MEAL_TYPES, DEFAULT_MEAL_SETTINGS, composeMeal, sumItems, editableMealsOf,
  planWeek, getMealAlternatives,
} from './mealPlanner.js'
import { isWeekend } from './date.js'

describe('editableMealsOf', () => {
  it('editable이 false인 끼니는 빠진다', () => {
    const settings = { ...DEFAULT_MEAL_SETTINGS, 점심: { editable: false, fixedKcal: 650 } }
    expect(editableMealsOf(settings)).toEqual(['아침', '저녁', '간식'])
  })
  it('기본값은 4끼 전부 편집 가능', () => {
    expect(editableMealsOf(DEFAULT_MEAL_SETTINGS)).toEqual(MEAL_TYPES)
  })
})

describe('composeMeal — 실제 745종 DB로 조합', () => {
  it('점심 조합은 최소 하나 이상의 항목을 채우고 목표 칼로리 근처에 온다', () => {
    const { items, totalKcal } = composeMeal('점심', 700, { foods: foodsReal })
    expect(items.length).toBeGreaterThan(0)
    expect(totalKcal).toBeGreaterThan(0)
    // 템플릿 기반이라 정확히 맞진 않지만 터무니없이 벗어나진 않아야 한다
    expect(Math.abs(totalKcal - 700) / 700).toBeLessThan(0.6)
  })

  it('아침 조합은 조리 시간이 짧은 카테고리(빵간식·유제품·과일·간편식·반찬 중 단백질 소품목)에서만 고른다', () => {
    const { items } = composeMeal('아침', 400, { foods: foodsReal })
    const allowed = new Set(['빵간식', '유제품', '과일', '간편식', '반찬'])
    expect(items.every((f) => allowed.has(f.category))).toBe(true)
  })

  it('아침은 우유·과일만으로 끝나지 않고 항상 단백질원(계란·두부·요거트·닭가슴살류)이 하나 이상 들어간다', () => {
    const proteinNames = new Set([
      '계란찜', '계란말이', '계란후라이', '두부부침', '요거트', '그릭요거트', '그릭요거트볼',
      '닭가슴살구이', '닭가슴살(즉석)', '닭가슴살소시지', '닭가슴살큐브', '닭가슴살샐러드', '닭가슴살바',
      '훈제란', '단백질음료', '프로틴쿠키',
    ])
    for (let i = 0; i < 30; i++) {
      const { items } = composeMeal('아침', 400, { foods: foodsReal })
      expect(items.some((f) => proteinNames.has(f.name))).toBe(true)
    }
  })

  it('평일 저녁에는 손이 많이 가는 음식(아귀찜·전복구이·알탕 등)이 나오지 않는다', () => {
    const hard = /(?<!계란)찜|전복|스테이크|훈제|보쌈|족발|랍스터|킹크랩|대게|삼계탕|설렁탕|곰탕|감자탕|추어탕|매운탕|알탕|사골|장어/
    for (let i = 0; i < 30; i++) {
      const { items } = composeMeal('저녁', 700, { foods: foodsReal, allowHard: false })
      for (const f of items) {
        if (['고기생선', '국찌개', '반찬', '밥'].includes(f.category)) {
          expect(hard.test(f.name)).toBe(false)
        }
      }
    }
  })

  it('한 끼 구성은 반찬 최대 2개, 총 4가지를 넘지 않는다', () => {
    for (const mealType of ['점심', '저녁']) {
      for (let i = 0; i < 30; i++) {
        const { items } = composeMeal(mealType, 700, { foods: foodsReal })
        expect(items.length).toBeLessThanOrEqual(4)
        expect(items.filter((f) => f.category === '반찬').length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('기피 음식은 절대 포함되지 않는다', () => {
    const avoidList = ['새우', '돼지고기']
    for (let i = 0; i < 20; i++) {
      const { items } = composeMeal('점심', 700, { foods: foodsReal, avoidList })
      for (const f of items) {
        expect(f.name.includes('새우')).toBe(false)
        expect(f.name.includes('돼지고기')).toBe(false)
      }
    }
  })

  it('같은 끼니 안에 이름이 겹치는 음식(순두부찌개+순두부처럼)이 동시에 나오지 않는다', () => {
    for (let i = 0; i < 40; i++) {
      const { items } = composeMeal('저녁', 700, { foods: foodsReal })
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          const overlap = items[a].name.includes(items[b].name) || items[b].name.includes(items[a].name)
          expect(overlap).toBe(false)
        }
      }
    }
  })

  it('감자튀김·치킨너겟은 그 자체로 한 끼가 되지 않는다', () => {
    for (const mealType of ['아침', '점심', '저녁']) {
      for (let i = 0; i < 30; i++) {
        const { items } = composeMeal(mealType, 500, { foods: foodsReal })
        if (items.length === 1) {
          expect(items[0].name.startsWith('감자튀김')).toBe(false)
          expect(items[0].name.startsWith('치킨너겟')).toBe(false)
        }
      }
    }
  })

  it('이유식·미음은 성인 자동 편성에 절대 나오지 않는다', () => {
    for (let i = 0; i < 30; i++) {
      const { items } = composeMeal('점심', 700, { foods: foodsReal })
      expect(items.some((f) => f.name === '이유식' || f.name === '미음')).toBe(false)
    }
  })

  it('빈 후보 풀만 남으면(터무니없는 기피 목록) 조합을 포기하고 빈 배열을 반환한다', () => {
    // 모든 카테고리에 걸릴 만큼 넓은 기피 목록을 줘도 예외 없이 안전하게 끝나야 한다
    const wideAvoid = foodsReal.map((f) => f.name)
    const { items } = composeMeal('점심', 700, { foods: foodsReal, avoidList: wideAvoid })
    expect(items).toEqual([])
  })
})

describe('sumItems', () => {
  it('kcal·탄단지를 그대로 합산한다', () => {
    const items = [
      { kcal: 300, carbs: 60, protein: 6, fat: 1 },
      { kcal: 200, carbs: 10, protein: 20, fat: 8 },
    ]
    expect(sumItems(items)).toEqual({ kcal: 500, carbs: 70, protein: 26, fat: 9 })
  })
})

describe('planWeek — 7일 편성 규칙', () => {
  const profile = { target: 1800, goal: 'lose' }
  const dates = ['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22']

  it('편집 가능한 4끼가 전부 채워진다', () => {
    const plan = planWeek({ foods: foodsReal, profile, dates })
    for (const date of dates) {
      for (const meal of MEAL_TYPES) {
        expect(plan[date][meal].length).toBeGreaterThan(0)
      }
    }
  })

  it('하루 총 칼로리(고정 끼니 포함)가 목표의 ±10% 안에 들어온다', () => {
    const plan = planWeek({ foods: foodsReal, profile, dates })
    for (const date of dates) {
      const total = MEAL_TYPES.reduce((s, m) => s + sumItems(plan[date][m]).kcal, 0)
      const ratio = total / profile.target
      expect(ratio).toBeGreaterThanOrEqual(0.9) // 완료 기준 §5-1: 목표의 ±10% 안
      expect(ratio).toBeLessThanOrEqual(1.1)
    }
  })

  it('정할 수 없는 끼니(예: 점심=급식)는 편성에서 빠지고 고정 칼로리로만 총량에 반영된다', () => {
    const mealSettings = { ...DEFAULT_MEAL_SETTINGS, 점심: { editable: false, fixedKcal: 650 } }
    const plan = planWeek({ foods: foodsReal, profile, mealSettings, dates })
    for (const date of dates) {
      expect(plan[date].점심).toBeUndefined()
      expect(plan[date].아침.length).toBeGreaterThan(0)
    }
  })

  it('같은 음식이 3일 연속 나오지 않는다', () => {
    const plan = planWeek({ foods: foodsReal, profile, dates })
    const namesPerDay = dates.map((d) => new Set(MEAL_TYPES.flatMap((m) => plan[d][m].map((f) => f.name))))
    for (let i = 2; i < namesPerDay.length; i++) {
      const threeInARow = [...namesPerDay[i]].filter((n) => namesPerDay[i - 1].has(n) && namesPerDay[i - 2].has(n))
      expect(threeInARow).toEqual([])
    }
  })

  it('기피 음식은 7일 내내 등장하지 않는다', () => {
    const avoidList = ['치킨', '삼겹살']
    const plan = planWeek({ foods: foodsReal, profile, avoidList, dates })
    for (const date of dates) {
      for (const meal of MEAL_TYPES) {
        for (const f of plan[date][meal]) {
          expect(f.name.includes('치킨')).toBe(false)
          expect(f.name.includes('삼겹살')).toBe(false)
        }
      }
    }
  })

  it('가공 우유(초코·딸기·바나나우유)는 일주일에 2회를 넘지 않는다', () => {
    const processed = new Set(['초코우유', '딸기우유', '바나나우유'])
    const plan = planWeek({ foods: foodsReal, profile, dates })
    let count = 0
    for (const date of dates) {
      for (const f of plan[date].간식) {
        if (processed.has(f.name)) count++
      }
    }
    expect(count).toBeLessThanOrEqual(2)
  })

  it('해장국류는 일주일에 1회를 넘지 않는다', () => {
    const haejang = new Set(['황태해장국', '콩나물해장국', '선지해장국', '시래기해장국', '뼈해장국'])
    const plan = planWeek({ foods: foodsReal, profile, dates })
    let count = 0
    for (const date of dates) {
      for (const meal of MEAL_TYPES) {
        for (const f of plan[date][meal]) {
          if (haejang.has(f.name)) count++
        }
      }
    }
    expect(count).toBeLessThanOrEqual(1)
  })

  it('평일에는 손이 많이 가는 음식이 나오지 않고, 주말 저녁에만 나올 수 있다', () => {
    const hard = /(?<!계란)찜|전복|스테이크|훈제|보쌈|족발|랍스터|킹크랩|대게|삼계탕|설렁탕|곰탕|감자탕|추어탕|매운탕|알탕|사골|장어/
    const scoped = new Set(['고기생선', '국찌개', '반찬', '밥'])
    const plan = planWeek({ foods: foodsReal, profile, dates })
    for (const date of dates) {
      const weekend = isWeekend(date)
      for (const meal of MEAL_TYPES) {
        for (const f of plan[date][meal]) {
          if (!scoped.has(f.category) || !hard.test(f.name)) continue
          expect(weekend && meal === '저녁').toBe(true)
        }
      }
    }
  })

  it('도시락·덮밥처럼 그 자체로 완결된 한 그릇 요리는 교정 스왑 이후에도 국·반찬과 같이 나오지 않는다', () => {
    const standalone = /덮밥|비빔밥|김밥|볶음밥|국밥|라이스|리조또|동$|초밥|나시고랭|카오팟|포케|그라탕|필라프|도시락|마끼|알밥|죽$/
    const plan = planWeek({ foods: foodsReal, profile, dates })
    for (const date of dates) {
      for (const meal of MEAL_TYPES) {
        const items = plan[date][meal]
        const hasStandalone = items.some((f) => f.category === '밥' && standalone.test(f.name))
        if (hasStandalone) expect(items.length).toBe(1)
      }
    }
  })
})

describe('getMealAlternatives — 한 끼 교체 대안', () => {
  it('서로 다른 조합을 여러 개 만든다', () => {
    const alts = getMealAlternatives('저녁', 700, { foods: foodsReal }, 4)
    expect(alts.length).toBeGreaterThan(1)
    const keys = alts.map((a) => a.items.map((f) => f.name).sort().join('|'))
    expect(new Set(keys).size).toBe(keys.length) // 중복 없음
  })
})
