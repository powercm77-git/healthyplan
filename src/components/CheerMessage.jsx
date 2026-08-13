// CheerMessage.jsx — 진행률별 응원 메시지 (초과해도 경고·빨간색 없이 행동 제안)
export function cheerText(eaten, target) {
  if (eaten === 0) {
    return <>오늘의 에너지를 채워볼까요? <span className="hl">첫 끼를 기록해보세요!</span></>
  }
  if (eaten > target) {
    return <>괜찮아요! <span className="hl">저녁 산책 20분</span>이면 다시 균형이에요 🚶</>
  }
  const pct = Math.round((eaten / target) * 100)
  if (pct >= 90) {
    return <><span className="hl">완벽한 하루!</span> 목표에 딱 맞게 채웠어요 🎯</>
  }
  if (pct >= 50) {
    return <>절반 넘었어요! <span className="hl">이 페이스 그대로</span> 가요 💪</>
  }
  return <>좋은 출발! 오늘 에너지의 <span className="hl">{pct}%</span>를 채웠어요</>
}

export default function CheerMessage({ eaten, target }) {
  return <div className="cheer">{cheerText(eaten, target)}</div>
}
