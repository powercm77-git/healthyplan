// groceryList.js — 주간 식단에서 장보기 목록을 뽑는다 (3단계 §2-4, 우선순위 낮음).
//
// 음식 DB(foods.json)엔 재료 정보가 없다. 조리법을 지어내 재료를 잘게 쪼개면 틀릴 위험이
// 크므로(발주자 지시: "추측이 과하지 않게"), 추측 없이 안전한 경우만 그대로 쓰고 나머지는
// "{음식 이름} 재료"로 뭉뚱그린다.
//
// 안전하게 그대로 쓰는 경우:
//  - 과일·유제품·빵간식: 이름 자체가 이미 사는 상품명이다(예: "흰우유", "식빵") — 조리
//    레시피가 아니라 구매 품목이라 추측이 필요 없다.
//  - 맨밥류("흰쌀밥"처럼 국·반찬과 짝짓는 밥): 이름에서 "밥"만 떼면 그대로 곡물 이름이다
//    (예: "현미밥" -> "현미"). 추측이 아니라 이름을 그대로 읽는 것이다.
// 그 외(국찌개·반찬·고기생선·면분식·간편식 등 조리된 복합 음식)는 전부 "{이름} 재료"로 넣는다.

const PASSTHROUGH_CATEGORIES = new Set(['과일', '유제품', '빵간식'])

function toGroceryLabel(food) {
  if (PASSTHROUGH_CATEGORIES.has(food.category)) return food.name
  if (food.category === '밥' && food.name.endsWith('밥') && !/덮밥|비빔밥|김밥|볶음밥|국밥/.test(food.name)) {
    const grain = food.name.slice(0, -1)
    return grain.length > 0 ? grain : '쌀'
  }
  return `${food.name} 재료`
}

// items: mealPlans 원본 배열(그 주 전체, 날짜·끼니 무관하게 섞여 있어도 됨).
// 같은 라벨이 여러 번 나오면 개수를 합쳐 하나로 묶는다(예: "장조림 재료 ×2").
export function buildGroceryList(items) {
  const byLabel = new Map()
  for (const food of items) {
    const label = toGroceryLabel(food)
    const key = `${food.category}::${label}`
    const cur = byLabel.get(key)
    if (cur) cur.count += 1
    else byLabel.set(key, { label, category: food.category, count: 1 })
  }
  return [...byLabel.values()].sort((a, b) => a.category.localeCompare(b.category, 'ko') || a.label.localeCompare(b.label, 'ko'))
}
