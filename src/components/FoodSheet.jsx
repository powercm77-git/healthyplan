// FoodSheet.jsx — 음식 검색·추가 바텀시트 (초성 검색 지원)
import { useEffect, useMemo, useRef, useState } from 'react'
import foods from '../data/foods.json'
import { matchFoodItem } from '../lib/chosung.js'

export default function FoodSheet({ open, mealName, onClose, onAdd, recentNames }) {
  const [query, setQuery] = useState('')
  const listRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim()
    let list = foods
    if (q) {
      list = foods.filter((f) => matchFoodItem(f, q))
    } else if (recentNames?.length) {
      const recentSet = new Set(recentNames)
      const recent = foods.filter((f) => recentSet.has(f.name))
      const rest = foods.filter((f) => !recentSet.has(f.name))
      list = [...recent, ...rest]
    }
    return list.slice(0, 60)
  }, [query, recentNames])

  // 검색어가 바뀌면 이전 스크롤 위치 때문에 새 결과가 화면 밖에 가려지지 않게 맨 위로
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [results])

  // 시트를 열 때마다 이전 검색어가 남아있지 않게 초기화
  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="sheet-bg open" onClick={onClose} />
      <div className="sheet open">
        <h3>{mealName}에 먹은 음식</h3>
        <input
          type="text"
          placeholder="음식 이름 검색 (예: 김치찌개, ㄱㅊㅉㄱ)"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="foodlist" ref={listRef}>
          {results.length === 0 && (
            <div className="empty" style={{ padding: '14px 4px' }}>검색 결과가 없어요.</div>
          )}
          {results.map((f) => (
            <div className="fl-item" key={f.name} onClick={() => onAdd(f)}>
              <div>
                <div className="fn">{f.name}</div>
                <div className="fi">{f.serving} · 탄 {f.carbs} · 단 {f.protein} · 지 {f.fat}g</div>
              </div>
              <div className="fc">{f.kcal}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
