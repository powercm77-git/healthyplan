// ExerciseLibrary.jsx — 운동 라이브러리 (3-2): 검색(초성 지원, 1단계 chosung.js 재사용) + 필터
import { useMemo, useState } from 'react'
import exercises from '../../data/exercises.json'
import { matchFoodItem, rankFoodItem } from '../../lib/chosung.js'
import { StickFigure } from '../../components/exercise-animations/index.js'

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

export default function ExerciseLibrary({ onBack, onOpenDetail }) {
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState(null)
  const [bodyPart, setBodyPart] = useState(null)
  const [level, setLevel] = useState(null)
  const [ageGroup, setAgeGroup] = useState(null)
  const [videoOnly, setVideoOnly] = useState(false)

  const results = useMemo(() => {
    let list = exercises
    if (place) list = list.filter((e) => e.place.includes(place))
    if (bodyPart) list = list.filter((e) => e.bodyParts.includes(bodyPart))
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
  }, [query, place, bodyPart, level, ageGroup, videoOnly])

  return (
    <section className="screen active">
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
      </div>

      <div className="exlist">
        {results.length === 0 && <div className="empty" style={{ padding: '14px 4px' }}>검색 결과가 없어요.</div>}
        {results.map((e) => (
          <div className="exitem" key={e.id} onClick={() => onOpenDetail(e.id)}>
            <div className="exipic"><StickFigure pose={e.animation} size={44} /></div>
            <div className="exiinfo">
              <div className="exiname">
                {e.name}
                {e.videos?.length > 0 && <span className="exi-video-badge">▶</span>}
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
