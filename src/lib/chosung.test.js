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

describe('matchFood — 완성 글자로만 된 2글자 이상 검색어는 초성 매칭으로 폴백하지 않는다', () => {
  // "생과일"이 이름 어디에도 부분 문자열로 없는데 초성이 우연히 겹치는
  // "삼겹살구이" 같은 무관한 항목이 나오던 버그 재발 방지.
  it('"생과일"은 "삼겹살구이"와 매칭되지 않는다', () => {
    expect(matchFood('삼겹살구이', '생과일')).toBe(false)
  })
  it('"생과일"은 이름에 그대로 포함된 항목과는 매칭된다', () => {
    expect(matchFood('생과일주스', '생과일')).toBe(true)
  })
  it('여전히 완전 일치는 매칭된다: "김치찌개"', () => {
    expect(matchFood('김치찌개', '김치찌개')).toBe(true)
  })
  it('여전히 부분 일치는 매칭된다: "돈가스"↔"돈가스김밥"', () => {
    expect(matchFood('돈가스김밥', '돈가스')).toBe(true)
  })
  it('초성 낱자음 검색어("ㄱㅊㅉ")는 여전히 초성 매칭이 적용된다', () => {
    expect(matchFood('김치찌개', 'ㄱㅊㅉ')).toBe(true)
  })
  it('완성 글자 1글자는 여전히 초성 매칭 폴백이 적용된다(기존 IME 동작 유지)', () => {
    expect(matchFood('된장찌개', '도')).toBe(true)
  })
  it('자모가 섞인 2글자 검색어("된ㅈ")는 여전히 초성 매칭이 적용된다', () => {
    expect(matchFood('된장찌개', '된ㅈ')).toBe(true)
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
