// chosung.js — 한글 퍼지(IME 입력 중) 검색
//
// 목표: 사용자가 한 글자씩 타이핑하는 도중에도(자모가 아직 완성되지 않은 상태 포함)
// 검색 결과가 사라지지 않게 한다. 예) "김치찌개"를 검색할 때 "ㄱㅊㅉ", "김ㅊ",
// "김치ㅉ", "김치찌ㄱ", "김치찌" 전부 매칭돼야 하고, "된장찌개"는 "도"→"되"→"된ㅈ"로
// 이어지는 IME 조합 중간 상태에서도 계속 보여야 한다.
//
// 규칙:
//  - 검색어의 마지막 글자는 항상 "초성만" 비교한다(완성 글자여도 아직 입력 중일
//    가능성이 높으므로 모음·받침을 무시). 예: "도"(ㄷ+ㅗ)는 "된"(ㄷ+ㅚ+ㄴ)과 초성이
//    같으므로 매칭.
//  - 마지막 글자가 아닌 완성 글자는 정확히 일치해야 한다.
//  - 마지막 글자가 아닌 낱자음(초성만 입력된 상태)은 대상 글자의 초성과 비교한다.
//  - 이 토큰열을 대상 문자열 위에서 슬라이딩하며 어느 위치에서든 전부 일치하면 매칭.

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const CHO_COUNT = 588

function isCompleteSyllable(ch) {
  const code = ch.charCodeAt(0)
  return code >= HANGUL_BASE && code <= HANGUL_LAST
}

// 완성 글자 또는 초성 낱자음이면 그 초성을, 아니면 null을 반환한다.
function chosungOf(ch) {
  if (isCompleteSyllable(ch)) {
    const code = ch.charCodeAt(0)
    return CHOSUNG_LIST[Math.floor((code - HANGUL_BASE) / CHO_COUNT)]
  }
  if (CHOSUNG_LIST.includes(ch)) return ch
  return null
}

export function getChosung(str) {
  return [...str].map((ch) => chosungOf(ch) ?? ch).join('')
}

// 검색어를 위치별 매칭 토큰으로 변환한다.
function buildTokens(query) {
  const chars = [...query]
  return chars.map((ch, i) => {
    const isLast = i === chars.length - 1
    const cho = chosungOf(ch)
    if (cho === null) {
      // 한글 완성글자/자모가 아닌 문자(영문·숫자 등)는 그대로 비교
      return { type: 'exact', ch: ch.toLowerCase() }
    }
    if (!isLast && isCompleteSyllable(ch)) {
      return { type: 'exact', ch }
    }
    return { type: 'cho', cho } // 마지막 글자 또는 낱자음: 초성만 비교
  })
}

function tokenMatches(token, targetCh) {
  if (token.type === 'exact') return targetCh.toLowerCase() === token.ch.toLowerCase()
  return chosungOf(targetCh) === token.cho
}

export function matchFood(text, query) {
  const q = query.trim().normalize('NFC')
  if (!q) return true
  const tokens = buildTokens(q)
  const chars = [...text.normalize('NFC')]
  if (tokens.length > chars.length) return false
  for (let s = 0; s <= chars.length - tokens.length; s++) {
    let ok = true
    for (let j = 0; j < tokens.length; j++) {
      if (!tokenMatches(tokens[j], chars[s + j])) { ok = false; break }
    }
    if (ok) return true
  }
  return false
}

// 음식 이름 또는 별칭(aliases) 중 하나라도 매칭되면 true
export function matchFoodItem(item, query) {
  if (matchFood(item.name, query)) return true
  return (item.aliases || []).some((alias) => matchFood(alias, query))
}
