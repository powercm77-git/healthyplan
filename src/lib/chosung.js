// chosung.js — 한글 초성 검색
// "ㄱㅊㅉㄱ" 같은 초성만으로 구성된 검색어를 "김치찌개" 같은 이름과 매칭한다.

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const CHO_COUNT = 588

export function getChosung(str) {
  let result = ''
  for (const ch of str) {
    const code = ch.charCodeAt(0)
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const choIndex = Math.floor((code - HANGUL_BASE) / CHO_COUNT)
      result += CHOSUNG_LIST[choIndex]
    } else {
      result += ch
    }
  }
  return result
}

export function isChosungQuery(query) {
  return query.length > 0 && [...query].every((ch) => CHOSUNG_LIST.includes(ch))
}

export function matchFood(name, query) {
  if (!query) return true
  if (isChosungQuery(query)) {
    return getChosung(name).includes(query)
  }
  return name.toLowerCase().includes(query.toLowerCase())
}
