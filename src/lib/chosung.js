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
// 예외: 검색어가 2글자 이상이면서 전부 완성된 글자(자모 조합 중이 아닌 실제
//        단어)라면 2단계 자체를 건너뛴다 — 그러지 않으면 이름 어디에도 없는
//        검색어가 초성만 우연히 겹치는 무관한 항목과 매칭돼버린다.

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

// 완성된 한글 음절(자음+모음 결합)인지. 호환용 낱자음(ㄱ,ㅊ 등)은 별도 유니코드
// 블록이라 여기 해당하지 않는다.
function isCompleteSyllable(ch) {
  const code = ch.charCodeAt(0)
  return code >= HANGUL_BASE && code <= HANGUL_LAST
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
  // 검색어가 2글자 이상이고 전부 완성된 글자면(자음 낱자만 있는 게 아니라
  // 실제 단어처럼 보이면) 초성 매칭으로 폴백하지 않는다. 그러지 않으면
  // "생과일" 같은 검색어가 이름에 전혀 등장하지 않는데도 초성이 우연히
  // 겹치는 무관한 항목("삼겹살구이" 등)이 결과로 튀어나온다. 아직 자모가
  // 조합 중인 낱자음 입력("ㄱㅊㅉ")은 여기 해당하지 않으므로 그대로
  // 초성 매칭이 적용된다.
  if (q.length >= 2 && [...q].every(isCompleteSyllable)) return false
  return slidingChosungMatch(name, q)
}

// 음식 이름 또는 별칭(aliases) 중 하나라도 매칭되면 true
export function matchFoodItem(item, query) {
  if (matchFood(item.name, query)) return true
  return (item.aliases || []).some((alias) => matchFood(alias, query))
}

// 검색 결과 관련도: 이름 시작(0) > 이름 포함(1) > 별칭(2) > 초성만 일치(3)
// 숫자가 작을수록 더 관련도가 높다. matchFoodItem이 true인 항목에서만 호출한다.
export function rankFoodItem(item, query) {
  const q = query.trim().normalize('NFC').toLowerCase()
  if (!q) return 0
  const name = item.name.normalize('NFC').toLowerCase()
  if (name.startsWith(q)) return 0
  if (name.includes(q)) return 1
  const aliases = item.aliases || []
  if (aliases.some((a) => a.normalize('NFC').toLowerCase().includes(q))) return 2
  return 3
}
