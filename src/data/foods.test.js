import { describe, it, expect } from 'vitest'
import foods from './foods.json'
import { matchFoodItem } from '../lib/chosung.js'

describe('foods.json — 데이터 무결성', () => {
  it('400종 이상이어야 한다', () => {
    expect(foods.length).toBeGreaterThanOrEqual(400)
  })

  it('460종 이상이어야 한다 (음료·대용식 보강 이후)', () => {
    expect(foods.length).toBeGreaterThanOrEqual(460)
  })

  it('name·aliases를 통틀어 중복이 없어야 한다', () => {
    const seen = new Map()
    const dupes = []
    for (const item of foods) {
      const strings = [item.name, ...(item.aliases || [])]
      for (const s of strings) {
        if (seen.has(s)) dupes.push({ string: s, with: seen.get(s) })
        seen.set(s, item.name)
      }
    }
    expect(dupes).toEqual([])
  })

  it('모든 항목이 필수 필드를 갖춰야 한다', () => {
    const fields = ['name', 'serving', 'kcal', 'carbs', 'protein', 'fat', 'category']
    const missing = foods.filter((item) => fields.some((f) => !(f in item)))
    expect(missing).toEqual([])
  })
})

describe('foods.json — 요청된 23종 존재 확인', () => {
  const required = [
    '계란후라이', '삶은계란', '스크램블에그', '버터', '주먹밥', '누룽지', '돈까스',
    '족발', '보쌈', '햄', '바지락조개', '깻잎', '상추쌈', '그린샐러드', '토스트',
    '샌드위치', '햄버거', '피자 1조각', '크로와상', '군고구마', '송편', '방울토마토', '치즈돈까스',
  ]
  const names = new Set(foods.map((f) => f.name))
  for (const name of required) {
    it(`"${name}"이 존재해야 한다`, () => {
      expect(names.has(name)).toBe(true)
    })
  }
})

describe('foods.json — 별칭 검색이 실제로 결과를 찾아야 한다', () => {
  const cases = ['달걀후라이', '계란후라이', '돈가스', '삶은계란']
  for (const q of cases) {
    it(`"${q}" 검색 시 결과가 1개 이상이어야 한다`, () => {
      const results = foods.filter((f) => matchFoodItem(f, q))
      expect(results.length).toBeGreaterThan(0)
    })
  }
})

describe('foods.json — "달걀"로 검색하면 계란 요리 전반이 나와야 한다', () => {
  it('"달걀" 검색 결과가 "계란후라이" 하나만이 아니라 여러 개여야 한다', () => {
    const results = foods.filter((f) => matchFoodItem(f, '달걀'))
    expect(results.length).toBeGreaterThanOrEqual(5)
  })
  it('"삶은달걀" 검색 시 결과가 1개 이상이어야 한다', () => {
    expect(foods.some((f) => matchFoodItem(f, '삶은달걀'))).toBe(true)
  })
})

describe('foods.json — 음료·간편식 보강: 요청된 항목이 존재해야 한다', () => {
  const required = [
    // ① 곡물·대용식
    '미숫가루(물)', '미숫가루(우유)', '선식', '그린주스', '프로틴쉐이크', '흑임자죽', '아사이볼',
    // ② 생과일주스
    '딸기생주스', '수박생주스', '키위생주스', '바나나생주스', '토마토생주스',
    '당근생주스', '케일생주스', '자몽생주스', '오렌지생주스',
    // ③ 유음료
    '마시는요구르트', '야쿠르트', '그릭요거트', '밀크쉐이크', '버블티', '핫초코',
    // ④ 차·건강음료
    '생강차', '대추차', '옥수수수염차', '결명자차', '둥굴레차', '헛개차', '비타민음료', '자양강장드링크',
    // ⑤ 커피
    '캔커피', '카페라떼톨', '카페라떼라지', '디카페인아메리카노',
  ]
  const names = new Set(foods.map((f) => f.name))
  for (const name of required) {
    it(`"${name}"이 존재해야 한다`, () => {
      expect(names.has(name)).toBe(true)
    })
  }

  it('생과일주스는 기존 병주스(오렌지주스 등)와 별도 항목이어야 한다', () => {
    expect(names.has('오렌지주스')).toBe(true)
    expect(names.has('오렌지생주스')).toBe(true)
  })
})

describe('foods.json — 별칭 매핑이 실제로 검색되어야 한다', () => {
  const cases = [
    ['미시가루', '미숫가루(물)'],
    ['미싯가루', '미숫가루(물)'],
    ['요쿠르트', '요거트'],
    ['요구르트', '요거트'],
    ['야쿠르트', '야쿠르트'],
    ['카라멜마끼아또', '카라멜마키아토'],
    ['밀크셰이크', '밀크쉐이크'],
    ['프로틴셰이크', '프로틴쉐이크'],
  ]
  for (const [query, expected] of cases) {
    it(`"${query}" 검색 시 "${expected}"를 찾아야 한다`, () => {
      const results = foods.filter((f) => matchFoodItem(f, query))
      expect(results.some((f) => f.name === expected)).toBe(true)
    })
  }
})
