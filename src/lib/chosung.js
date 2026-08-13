// chosung.js — 한글 퍼지(IME 입력 중) 검색
//
// 목표: 사용자가 한 글자씩 타이핑하는 도중에도(자모가 아직 완성되지 않은 상태 포함)
// 검색 결과가 사라지지 않게 한다.
//
// 1단계: 정규화(NFC)한 검색어가 이름에 그대로 포함되면 매칭(가장 정확).
// 2단계: 1단계가 실패하면 위치 상관없이 전부 "초성"만 비교하는 슬라이딩 매칭으로
//        폴백한다. "완성된 글자인지 낱자음인지"는 구분하지 않는다 — 일부
//        브라우저/키보드는 낱자음(예: 방금 입력한 'ㄱ')을 겉보기엔 자음 하나인데
//        내부적으로는 완성형 코드포인트(채움 모음 포함)로 표현해서 넘겨주기도
//        하는데, 여기서 "완성 글자면 정확 일치"로 분기하면 그 경우 절대 매칭되지
//        않는 실제 버그가 생겼다. 위치와 무관하게 전부 초성만 비교하면 이런
//        표현 차이에 영향받지 않는다.

const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const HANGUL_BASE = 0xac00
const HANGUL_LAST = 0xd7a3
const CHO_COUNT = 588

// 완성 글자 또는 초성 낱자음이면 그 초성을, 아니면 null을 반환한다.
function chosungOf(ch) {
  const code = ch.charCodeAt(0)
  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    return CHOSUNG_LIST[Math.floor((code - HANGUL_BASE) / CHO_COUNT)]
  }
  if (CHOSUNG_LIST.includes(ch)) return ch
  return null
}

export function getChosung(str) {
  return [...str].map((ch) => chosungOf(ch) ?? ch).join('')
}

function slidingChosungMatch(name, query) {
  const tokens = [...query].map((ch) => {
    const cho = chosungOf(ch)
    return cho !== null ? { type: 'cho', cho } : { type: 'exact', ch: ch.toLowerCase() }
  })
  const chars = [...name]
  if (tokens.length > chars.length) return false
  for (let s = 0; s <= chars.length - tokens.length; s++) {
    let ok = true
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      const c = chars[s + j]
      const hit = t.type === 'exact' ? c.toLowerCase() === t.ch : chosungOf(c) === t.cho
      if (!hit) { ok = false; break }
    }
    if (ok) return true
  }
  return false
}

export function matchFood(text, query) {
  const q = query.trim().normalize('NFC')
  if (!q) return true
  const name = text.normalize('NFC')
  if (name.toLowerCase().includes(q.toLowerCase())) return true
  return slidingChosungMatch(name, q)
}

// 음식 이름 또는 별칭(aliases) 중 하나라도 매칭되면 true
export function matchFoodItem(item, query) {
  if (matchFood(item.name, query)) return true
  return (item.aliases || []).some((alias) => matchFood(alias, query))
}
