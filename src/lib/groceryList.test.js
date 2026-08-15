import { describe, it, expect } from 'vitest'
import { buildGroceryList } from './groceryList.js'

describe('buildGroceryList', () => {
  it('과일·유제품·빵간식은 이름 그대로 목록에 넣는다', () => {
    const items = [
      { name: '사과', category: '과일' },
      { name: '흰우유', category: '유제품' },
      { name: '식빵', category: '빵간식' },
    ]
    const list = buildGroceryList(items)
    expect(list.map((i) => i.label)).toEqual(expect.arrayContaining(['사과', '흰우유', '식빵']))
  })

  it('맨밥류는 곡물 이름만 남긴다', () => {
    const items = [{ name: '현미밥', category: '밥' }]
    expect(buildGroceryList(items)[0].label).toBe('현미')
  })

  it('덮밥·비빔밥 등 한그릇 밥 요리는 곡물로 쪼개지 않고 "재료"로 묶는다', () => {
    const items = [{ name: '제육덮밥', category: '밥' }]
    expect(buildGroceryList(items)[0].label).toBe('제육덮밥 재료')
  })

  it('조리된 복합 음식(국찌개·반찬·고기생선 등)은 확신 없이 "{이름} 재료"로 넣는다', () => {
    const items = [
      { name: '김치찌개', category: '국찌개' },
      { name: '장조림', category: '반찬' },
      { name: '삼겹살구이', category: '고기생선' },
    ]
    const labels = buildGroceryList(items).map((i) => i.label)
    expect(labels).toEqual(expect.arrayContaining(['김치찌개 재료', '삼겹살구이 재료', '장조림 재료']))
  })

  it('같은 항목이 여러 번 나오면 개수를 합친다', () => {
    const items = [
      { name: '김치찌개', category: '국찌개' },
      { name: '김치찌개', category: '국찌개' },
    ]
    const list = buildGroceryList(items)
    expect(list).toHaveLength(1)
    expect(list[0].count).toBe(2)
  })
})
