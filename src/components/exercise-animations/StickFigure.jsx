// StickFigure.jsx — 저작권 걱정 없는 자체 제작 스틱 피겨 동작 애니메이션.
//
// 관절마다 "고정 위치(translate, SVG 속성)"와 "회전(CSS transform)"을 분리된
// 중첩 <g>로 나눴다. 같은 요소에 SVG 속성 transform과 CSS transform을 함께
// 쓰면 CSS가 속성을 완전히 덮어써 위치가 틀어지므로, 위치는 바깥 <g>(속성),
// 회전은 안쪽 <g class="rot-...">(CSS 애니메이션)이 각각 담당한다.
import './poses.css'

export const POSE_KEYS = [
  'squat', 'pushup', 'lunge', 'plank', 'crunch', 'jumping-jack', 'bridge',
  'deadlift', 'press', 'row', 'pullup', 'dips', 'walk', 'run',
  'mountain-climber', 'cycle', 'stretch-neck', 'stretch-shoulder',
  'stretch-back', 'stretch-hamstring',
]

export default function StickFigure({ pose, size = 96, className = '' }) {
  const safePose = POSE_KEYS.includes(pose) ? pose : 'squat'
  return (
    <svg
      className={`stickfig pose-${safePose} ${className}`}
      width={size} height={size} viewBox="0 0 100 130"
      role="img" aria-label={`${safePose} 동작 애니메이션`}
    >
      <g transform="translate(50,72)">
        <g className="rot-fig">
          <g className="rot-torso">
            <circle className="head" cx="0" cy="-51" r="11" />
            <line className="torso" x1="0" y1="-40" x2="0" y2="-1" />

            <g className="shoulder-l" transform="translate(0,-33)">
              <g className="rot-arm-l">
                <line x1="0" y1="0" x2="0" y2="19" />
                <g transform="translate(0,19)">
                  <g className="rot-forearm-l"><line x1="0" y1="0" x2="0" y2="17" /></g>
                </g>
              </g>
            </g>
            <g className="shoulder-r" transform="translate(0,-33)">
              <g className="rot-arm-r">
                <line x1="0" y1="0" x2="0" y2="19" />
                <g transform="translate(0,19)">
                  <g className="rot-forearm-r"><line x1="0" y1="0" x2="0" y2="17" /></g>
                </g>
              </g>
            </g>
          </g>

          <g className="hip-l" transform="translate(0,0)">
            <g className="rot-thigh-l">
              <line x1="0" y1="0" x2="0" y2="24" />
              <g transform="translate(0,24)">
                <g className="rot-shin-l"><line x1="0" y1="0" x2="0" y2="22" /></g>
              </g>
            </g>
          </g>
          <g className="hip-r" transform="translate(0,0)">
            <g className="rot-thigh-r">
              <line x1="0" y1="0" x2="0" y2="24" />
              <g transform="translate(0,24)">
                <g className="rot-shin-r"><line x1="0" y1="0" x2="0" y2="22" /></g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
