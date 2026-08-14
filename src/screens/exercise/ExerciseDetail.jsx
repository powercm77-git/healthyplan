// ExerciseDetail.jsx — 운동 상세 (3-3): 효과 → 방법 → 호흡법 → 주의점 → 기구 사용법 → 난이도 조절 → 바로 하기
import { useState } from 'react'
import { StickFigure, POSE_KEYS } from '../../components/exercise-animations/index.js'
import ExerciseVideoPlayer from '../../components/ExerciseVideoPlayer.jsx'

const REASONS = [
  { v: '통증', label: '아파요' },
  { v: '장비없음', label: '장비가 없어요' },
  { v: '소음', label: '소음이 걱정돼요' },
  { v: '기타', label: '그냥 바꿀래요' },
]

export default function ExerciseDetail({ exercise: ex, byId, inRoutine, onBack, onOpenDetail, onSwapInRoutine, onStart }) {
  const [swapTarget, setSwapTarget] = useState(null) // 'easier' | 'harder' | null

  if (!ex) return null

  // 영상은 exercises.json에 직접 실린 ex.videos가 유일한 출처다(2.6단계부터). 영상 유무·
  // 애니메이션 유무 4가지 조합을 명확히 나눠, 빈 상자나 서로 모순되는 안내 문구가 동시에
  // 뜨는 일이 없게 한다.
  const videos = ex.videos || []
  const hasVideo = videos.length > 0
  const hasAnim = POSE_KEYS.includes(ex.animation)

  function chooseReason(reasonLabel) {
    const newId = swapTarget === 'easier' ? ex.easier : ex.harder
    onSwapInRoutine(newId, reasonLabel)
    setSwapTarget(null)
  }

  return (
    <section className="screen active">
      <div className="datebar" style={{ marginBottom: 6 }}>
        <button onClick={onBack}>◀</button>
        <span className="dt">{ex.name}</span>
        <span style={{ width: 38 }} />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        {hasVideo
          ? <span className="exi-video-badge">▶ 영상 있음</span>
          : <span className="exi-pic-badge">🖼 그림 설명</span>}
      </div>

      {hasAnim && (
        <>
          <div className="detail-anim">
            <StickFigure pose={ex.animation} size={160} highlightParts={ex.bodyParts} showDirection />
          </div>
          <div className="startend">
            <div className="startend-cut">
              <StickFigure pose={ex.animation} size={80} freeze="start" />
              <span>시작 자세</span>
            </div>
            <div className="startend-cut">
              <StickFigure pose={ex.animation} size={80} freeze="end" />
              <span>최종 자세</span>
            </div>
          </div>
        </>
      )}
      {hasVideo ? (
        <div className="card">
          <p className="eyebrow">▶ 실제 영상으로 보기</p>
          <ExerciseVideoPlayer
            videos={videos} size="large"
            failFallbackText={hasAnim ? '영상을 불러오지 못했어요. 위 그림을 참고해주세요.' : '영상을 불러오지 못했어요. 아래 글 설명을 참고해주세요.'}
          />
        </div>
      ) : hasAnim ? (
        <p className="novideo-hint">이 운동은 위 그림 설명을 참고하세요</p>
      ) : (
        <p className="novideo-hint">그림과 영상이 없는 운동이에요. 아래 글 설명을 참고하세요</p>
      )}
      <div className="chips" style={{ justifyContent: 'center', marginBottom: 16 }}>
        <span className="chip on" style={{ cursor: 'default' }}>{ex.bodyParts.join(' · ')}</span>
      </div>

      <div className="card">
        <p className="eyebrow">이 운동의 효과</p>
        <p style={{ lineHeight: 1.7, fontSize: '.95rem' }}>{ex.benefit}</p>
      </div>

      <div className="card">
        <p className="eyebrow">운동 방법</p>
        {ex.howto.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginTop: i ? 10 : 0 }}>
            <span style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 999, background: 'var(--grad)',
              color: '#fff', fontSize: '.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{ fontSize: '.92rem', lineHeight: 1.6 }}>{step}</span>
          </div>
        ))}
      </div>

      <div className="formnote">
        <b>호흡법</b> — {ex.breathing}
      </div>

      <div className="mistakebox">
        <p className="eyebrow" style={{ marginBottom: 8 }}>이것만 주의하세요</p>
        {ex.mistakes.map((m, i) => (
          <div key={i} style={{ fontSize: '.88rem', lineHeight: 1.6, marginTop: i ? 6 : 0 }}>· {m}</div>
        ))}
        <p style={{ fontSize: '.78rem', color: 'var(--sub)', marginTop: 10 }}>통증이 있으면 즉시 중단하고 전문가와 상담하세요.</p>
      </div>

      {ex.equipmentGuide && (
        <div className="formnote" style={{ background: 'rgba(255,197,61,.1)', borderColor: 'rgba(255,197,61,.3)' }}>
          <b style={{ color: 'var(--amber)' }}>기구 사용법</b> — {ex.equipmentGuide}
        </div>
      )}

      <div className="diffbtns">
        <button className="swapbtn" style={{ flex: 1 }} disabled={!ex.easier} onClick={() => setSwapTarget('easier')}>😮‍💨 너무 힘들어요</button>
        <button className="swapbtn" style={{ flex: 1 }} disabled={!ex.harder} onClick={() => setSwapTarget('harder')}>💪 쉬워요</button>
      </div>

      {swapTarget && (
        <div className="swap-panel open">
          <p className="q">
            {inRoutine
              ? `오늘 루틴의 이 운동을 "${byId[swapTarget === 'easier' ? ex.easier : ex.harder]?.name}"(으)로 바꿀까요? 이유를 알려주시면 다음에도 참고할게요.`
              : `"${byId[swapTarget === 'easier' ? ex.easier : ex.harder]?.name}" 상세로 이동합니다.`}
          </p>
          {inRoutine ? (
            <div className="chips">
              {REASONS.map((r) => (
                <span key={r.v} className="chip" onClick={() => chooseReason(r.v)}>{r.label}</span>
              ))}
            </div>
          ) : (
            <div className="alt" onClick={() => onOpenDetail(swapTarget === 'easier' ? ex.easier : ex.harder)}>
              <div className="apic">
                <StickFigure pose={byId[swapTarget === 'easier' ? ex.easier : ex.harder]?.animation} size={30} />
              </div>
              <div><div className="anm">{byId[swapTarget === 'easier' ? ex.easier : ex.harder]?.name}</div></div>
            </div>
          )}
        </div>
      )}

      <button className="btn" style={{ marginTop: 18 }} onClick={onStart}>이 운동 바로 하기 ▶</button>

      {ex.alternatives?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="eyebrow">비슷한 효과의 다른 운동</p>
          {ex.alternatives.map((id) => {
            const alt = byId[id]
            if (!alt) return null
            return (
              <div className="alt" key={id} onClick={() => onOpenDetail(id)}>
                <div className="apic"><StickFigure pose={alt.animation} size={30} /></div>
                <div><div className="anm">{alt.name}</div><div className="why">{alt.bodyParts.join(' · ')}</div></div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
