// ExerciseVideoPlayer.jsx — 국민체력100 실제 영상 재생(앱 내 <video>). 링크 연결이 아니라
// 인라인 재생. 재생 실패 시 onFail로 알려 호출부가 애니메이션으로 되돌아갈 수 있게 한다.
import { useEffect, useState } from 'react'

function useOnline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

export default function ExerciseVideoPlayer({ videos, size = 'large', onFail, failFallbackText }) {
  const online = useOnline()
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => { setIdx(0); setFailed(false) }, [videos])

  if (!videos || videos.length === 0) return null

  if (!online) {
    return <p className="videooffline">📵 인터넷 연결이 필요해요</p>
  }

  if (failed) {
    onFail?.()
    return <p className="videooffline">{failFallbackText || '영상을 불러오지 못했어요.'}</p>
  }

  const cur = videos[idx]
  return (
    <div className={size === 'large' ? 'videobox' : 'videobox videobox-sm'}>
      <video key={cur.url} controls preload="metadata" poster={cur.thumbnail || undefined} className="exvideo" onError={() => setFailed(true)}>
        <source src={cur.url} type="video/mp4" />
      </video>
      {videos.length > 1 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {videos.map((v, i) => (
            <span key={v.url} className={`chip${i === idx ? ' on' : ''}`} onClick={() => { setIdx(i); setFailed(false) }}>
              {v.ageGroup ? `${v.ageGroup}용` : v.title}
            </span>
          ))}
        </div>
      )}
      <p className="videosrc">출처: 국민체력100(국민체육진흥공단)</p>
    </div>
  )
}
