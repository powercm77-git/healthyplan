import { describe, it, expect } from 'vitest'
import foods from './foods.json'
import { matchFoodItem } from '../lib/chosung.js'

describe('foods.json — 데이터 무결성', () => {
  it('400종 이상이어야 한다', () => {
    expect(foods.length).toBeGreaterThanOrEqual(400)
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
