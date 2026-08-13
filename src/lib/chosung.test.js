import { describe, it, expect } from 'vitest'
import { matchFood } from './chosung.js'

describe('matchFood — 김치찌개', () => {
  const name = '김치찌개'
  const cases = ['ㄱㅊㅉ', 'ㄱㅊㅉㄱ', '김ㅊ', '김치ㅉ', '김치찌ㄱ', '김치찌']
  for (const q of cases) {
    it(`"${q}" 입력 시 매칭되어야 한다`, () => {
      expect(matchFood(name, q)).toBe(true)
    })
  }
})

describe('matchFood — 된장찌개 (IME 조합 중간 상태)', () => {
  const name = '된장찌개'
  const cases = ['도', '되', '된ㅈ']
  for (const q of cases) {
    it(`"${q}" 입력 시 매칭되어야 한다`, () => {
      expect(matchFood(name, q)).toBe(true)
    })
  }
})

describe('matchFood — 관련 없는 검색어는 매칭되지 않아야 한다', () => {
  it('"김치찌개"는 "된장"과 매칭되지 않는다', () => {
    expect(matchFood('김치찌개', '된장')).toBe(false)
  })
  it('"된장찌개"는 "ㄱㅊㅉ"(김치찌개 초성)와 매칭되지 않는다', () => {
    expect(matchFood('된장찌개', 'ㄱㅊㅉ')).toBe(false)
  })
})
