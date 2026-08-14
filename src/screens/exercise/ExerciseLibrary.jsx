// ExerciseLibrary.jsx — 운동 라이브러리 (3-2): 검색(초성 지원, 1단계 chosung.js 재사용) + 필터
import { useEffect, useMemo, useRef, useState } from 'react'
import exercises from '../../data/exercises.json'
import { matchFoodItem, rankFoodItem } from '../../lib/chosung.js'
import { StickFigure } from '../../components/exercise-animations/index.js'
import { libraryFilterState, resetLibraryFilters } from '../../lib/libraryFilterState.js'

const PLACE_LABEL = { home: '집', gym: '헬스장', 'outdoor-gym': '야외기구', outdoor: '야외', pool: '수영장' }
const LEVEL_LABEL = { 1: '입문', 2: '중급', 3: '고급' }
const PLACES = ['home', 'gym', 'outdoor-gym', 'outdoor', 'pool']
const LEVELS = [1, 2, 3]
const AGE_GROUP_LABEL = { 유아기: '유아', 유소년: '유소년', 청소년: '청소년', 성인: '성인', 어르신: '어르신', 공통: '공통' }
const AGE_GROUPS = ['유아기', '유소년', '청소년', '성인', '어르신', '공통']
const BODY_PART_COUNTS = exercises
  .flatMap((e) => e.bodyParts)
  .reduce((m, bp) => m.set(bp, (m.get(bp) || 0) + 1), new Map())
const ALL_BODY_PARTS = [...BODY_PART_COUNTS.entries()].sort((a, b) => b[1] - a[1]).map(([bp]) => bp)
const EQUIPMENT_COUNTS = exercises
  .reduce((m, e) => m.set(e.equipment, (m.get(e.equipment) || 0) + 1), new Map())
const ALL_EQUIPMENT = [...EQUIPMENT_COUNTS.entries()].sort((a, b) => b[1] - a[1]).map(([eq]) => eq)

const hasNonDefaultFilter = (s) =>
  !!(s.query || s.place || s.bodyPart || s.equipment || s.level || s.ageGroup || s.videoOnly)

export default function ExerciseLibrary({ onBack, onOpenDetail }) {
  // 필터·스크롤 상태는 libraryFilterState(모듈 스코프)에서 초기값을 읽어온다 — 상세로
  // 들어갔다 뒤로가기는 물론, 운동 탭을 완전히 벗어났다 돌아와도(부모가 통째로 unmount)
  // 직전 상태가 그대로 남아 있게 하기 위해서다.
  const [query, setQuery] = useState(libraryFilterState.query)
  const [place, setPlace] = useState(libraryFilterState.place)
  const [bodyPart, setBodyPart] = useState(libraryFilterState.bodyPart)
  const [equipment, setEquipment] = useState(libraryFilterState.equipment)
  const [level, setLevel] = useState(libraryFilterState.level)
  const [ageGroup, setAgeGroup] = useState(libraryFilterState.ageGroup)
  const [videoOnly, setVideoOnly] = useState(libraryFilterState.videoOnly)

  const sectionRef = useRef(null)
  const restoredScroll = useRef(false)

  // 필터가 바뀔 때마다 모듈 스코프 상태에 그대로 반영한다(다음 마운트 때 다시 읽음).
  useEffect(() => {
    libraryFilterState.query = query
    libraryFilterState.place = place
    libraryFilterState.bodyPart = bodyPart
    libraryFilterState.equipment = equipment
    libraryFilterState.level = level
    libraryFilterState.ageGroup = ageGroup
    libraryFilterState.videoOnly = videoOnly
  }, [query, place, bodyPart, equipment, level, ageGroup, videoOnly])

  const results = useMemo(() => {
    let list = exercises
    if (place) list = list.filter((e) => e.place.includes(place))
    if (bodyPart) list = list.filter((e) => e.bodyParts.includes(bodyPart))
    if (equipment) list = list.filter((e) => e.equipment === equipment)
    if (level) list = list.filter((e) => e.level === level)
    if (ageGroup) list = list.filter((e) => !e.ageGroups?.length || e.ageGroups.includes(ageGroup))
    if (videoOnly) list = list.filter((e) => e.videos?.length > 0)
    const q = query.trim()
    if (q) {
      list = list
        .filter((e) => matchFoodItem(e, q))
        .map((e) => ({ e, rank: rankFoodItem(e, q) }))
        .sort((a, b) => a.rank - b.rank)
        .map(({ e }) => e)
    }
    return list.slice(0, 60)
  }, [query, place, bodyPart, equipment, level, ageGroup, videoOnly])

  // 결과 목록이 그려진 뒤 저장해둔 스크롤 위치로 한 번만 복원한다.
  useEffect(() => {
    if (restoredScroll.current) return
    if (sectionRef.current && libraryFilterState.scrollTop > 0) {
      sectionRef.current.scrollTop = libraryFilterState.scrollTop
    }
    restoredScroll.current = true
  }, [results])

  function handleScroll(e) {
    libraryFilterState.scrollTop = e.currentTarget.scrollTop
  }

  function handleReset() {
    resetLibraryFilters()
    setQuery(''); setPlace(null); setBodyPart(null); setEquipment(null)
    setLevel(null); setAgeGroup(null); setVideoOnly(false)
  }

  return (
    <section className="screen active" ref={sectionRef} onScroll={handleScroll}>
      <div className="datebar" style={{ marginBottom: 10 }}>
        <button onClick={onBack}>◀</button>
        <span className="dt">운동 찾아보기</span>
        <span style={{ width: 38 }} />
      </div>

      <input
        type="text" placeholder="운동 이름 검색 (예: 스쿼트, ㅅㅋㅌ)"
        value={query} onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div className="filterbar">
        <div className="chips">
          {PLACES.map((p) => (
            <span key={p} className={`chip${place === p ? ' on' : ''}`} onClick={() => setPlace(place === p ? null : p)}>{PLACE_LABEL[p]}</span>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {LEVELS.map((l) => (
            <span key={l} className={`chip${level === l ? ' on' : ''}`} onClick={() => setLevel(level === l ? null : l)}>{LEVEL_LABEL[l]}</span>
          ))}
          <span className={`chip${videoOnly ? ' on' : ''}`} onClick={() => setVideoOnly((v) => !v)}>▶ 영상 있는 것만</span>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {AGE_GROUPS.map((ag) => (
            <span key={ag} className={`chip${ageGroup === ag ? ' on' : ''}`} onClick={() => setAgeGroup(ageGroup === ag ? null : ag)}>{AGE_GROUP_LABEL[ag]}</span>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {ALL_BODY_PARTS.slice(0, 16).map((bp) => (
            <span key={bp} className={`chip${bodyPart === bp ? ' on' : ''}`} onClick={() => setBodyPart(bodyPart === bp ? null : bp)}>{bp}</span>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {ALL_EQUIPMENT.slice(0, 10).map((eq) => (
            <span key={eq} className={`chip${equipment === eq ? ' on' : ''}`} onClick={() => setEquipment(equipment === eq ? null : eq)}>{eq}</span>
          ))}
        </div>
        {hasNonDefaultFilter({ query, place, bodyPart, equipment, level, ageGroup, videoOnly }) && (
          <button type="button" className="filterresetbtn" onClick={handleReset}>✕ 필터 초기화</button>
        )}
      </div>

      <div className="exlist">
        {results.length === 0 && <div className="empty" style={{ padding: '14px 4px' }}>검색 결과가 없어요.</div>}
        {results.map((e) => (
          <div className="exitem" key={e.id} onClick={() => onOpenDetail(e.id)}>
            <div className="exipic"><StickFigure pose={e.animation} size={44} /></div>
            <div className="exiinfo">
              <div className="exiname">
                {e.name}
                {e.videos?.length > 0
                  ? <span className="exi-video-badge">▶ 영상</span>
                  : <span className="exi-pic-badge">🖼 그림</span>}
                {e.category && <span className="exi-cat-badge">{e.category}</span>}
              </div>
              <div className="exisub">{e.bodyParts.join(' · ')} · {LEVEL_LABEL[e.level]} · {PLACE_LABEL[e.place[0]]}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
