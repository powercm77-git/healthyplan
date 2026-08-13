import { describe, it, expect } from 'vitest'
import { matchFood } from './chosung.js'

describe('matchFood — 김치찌개', () => {
  const name = '김치찌개'
  const cases = ['ㄱㅊㅉ', 'ㄱㅊㅉㄱ', '김ㅊ', '김치ㅉ', '김치찌ㄱ', '김치찌', '김치찌개']
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

describe('matchFood — 초성 검색어 뒤에 글자가 더 늘어나도 이전 매칭이 유지되어야 한다', () => {
  // "ㅍㄱ"까지는 맞다가 "ㅍㄱㅊ"로 늘어나는 순간 '파김치'가 사라지던 버그
  // (앞쪽 낱자음이 완성 글자로 오인되어 정확 일치를 요구하게 됨) 재발 방지.
  it('"ㅍㄱ"는 "파김치"와 매칭된다', () => {
    expect(matchFood('파김치', 'ㅍㄱ')).toBe(true)
  })
  it('"ㅍㄱㅊ"는 "파김치"와 매칭된다', () => {
    expect(matchFood('파김치', 'ㅍㄱㅊ')).toBe(true)
  })
  it('"ㅍㄱㅊ"는 "스팸김치볶음밥"과도 매칭된다', () => {
    expect(matchFood('스팸김치볶음밥', 'ㅍㄱㅊ')).toBe(true)
  })
})

describe('matchFood — 분해형(NFD) 유니코드 입력도 매칭되어야 한다', () => {
  // 일부 안드로이드 키보드/브라우저는 완성형(NFC) 대신 자모가 분리된 NFD로
  // input value를 전달한다. 예: '김' -> 'ᄀ'+'ᅵ'+'ᆷ' (3개 코드포인트)
  it('NFD로 정규화된 전체 검색어가 NFC 이름과 매칭된다', () => {
    const nfdQuery = '김치찌개'.normalize('NFD')
    expect(matchFood('김치찌개', nfdQuery)).toBe(true)
  })
  it('NFD로 정규화된 이름도 NFC 검색어와 매칭된다', () => {
    const nfdName = '김치찌개'.normalize('NFD')
    expect(matchFood(nfdName, '김치찌개')).toBe(true)
  })
})

describe('matchFood — 관련 없는 검색어는 매칭되지 않아야 한다', () => {
  it('"김치찌개"는 "된장"과 매칭되지 않는다', () => {
    expect(matchFood('김치찌개', '된장')).toBe(false)
  })
  it('"된장찌개"는 "ㄱㅊㅉ"(김치찌개 초성)와 매칭되지 않는다', () => {
    expect(matchFood('된장찌개', 'ㄱㅊㅉ')).toBe(false)
  })
})
