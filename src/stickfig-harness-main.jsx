// stickfig-harness-main.jsx — StickFigure 포즈별 실측 viewBox 계산용 전용 렌더 페이지.
// scripts/calibrate-poses.mjs가 이 페이지를 Playwright로 열어 각 포즈(시작/종료 자세)의
// <g class="figure-root"> getBBox()를 읽어 poseViewBox.js를 갱신한다. 앱 번들에는
// 포함되지 않는다(별도 HTML 진입점, index.html에서 참조하지 않음).
import { createRoot } from 'react-dom/client'
import StickFigure, { POSE_KEYS } from './components/exercise-animations/StickFigure.jsx'

function Harness() {
  return (
    <>
      {POSE_KEYS.map((pose) => (
        ['start', 'end'].map((freeze) => (
          <div className="cell" key={`${pose}-${freeze}`} data-pose={pose} data-freeze={freeze}>
            <StickFigure pose={pose} size={200} freeze={freeze} />
          </div>
        ))
      ))}
    </>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)
