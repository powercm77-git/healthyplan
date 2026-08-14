// StickFigure.jsx — 저작권 걱정 없는 자체 제작 스틱 피겨 동작 애니메이션.
//
// 관절마다 "고정 위치(translate, SVG 속성)"와 "회전(CSS transform)"을 분리된
// 중첩 <g>로 나눴다. 같은 요소에 SVG 속성 transform과 CSS transform을 함께
// 쓰면 CSS가 속성을 완전히 덮어써 위치가 틀어지므로, 위치는 바깥 <g>(속성),
// 회전은 안쪽 <g class="rot-...">(CSS 애니메이션)이 각각 담당한다.
//
// 2.5단계 개선: 관절 원 + 부위별 두께 구분, 동작 방향 표시, 타겟 부위 하이라이트
// (highlightParts), 시작/종료 자세 정지 스냅샷(freeze).
import './poses.css'

export const POSE_KEYS = [
  'squat', 'pushup', 'lunge', 'plank', 'crunch', 'jumping-jack', 'bridge',
  'deadlift', 'press', 'row', 'pullup', 'dips', 'walk', 'run',
  'mountain-climber', 'cycle', 'stretch-neck', 'stretch-shoulder',
  'stretch-back', 'stretch-hamstring',
]

// 우리 exercises.json의 bodyParts 어휘 -> 스틱 피겨의 4개 시각 영역 매핑.
// (실제 근육 단위가 아니라 "머리/몸통/팔/다리" 수준의 큰 영역 강조 — 단순 실루엣의 한계)
const HIGHLIGHT_GROUPS = {
  head: ['목'],
  torso: ['가슴', '등', '허리', '코어', '복근', '옆구리', '하복부', '골반'],
  arms: ['팔', '어깨'],
  legs: ['하체', '엉덩이', '허벅지앞', '허벅지뒤', '종아리', '고관절', '안쪽허벅지'],
}
function partsToGroups(bodyParts) {
  const groups = new Set()
  if (!bodyParts) return groups
  if (bodyParts.includes('전신')) return new Set(['head', 'torso', 'arms', 'legs'])
  for (const bp of bodyParts) {
    for (const [g, list] of Object.entries(HIGHLIGHT_GROUPS)) {
      if (list.includes(bp)) groups.add(g)
    }
  }
  return groups
}

// 포즈별 주된 동작 방향(화살표 아이콘). hold=정지 유지.
const POSE_DIRECTION = {
  squat: '↕', pushup: '↕', lunge: '↕', plank: '‖', crunch: '↕',
  'jumping-jack': '↔', bridge: '↕', deadlift: '↕', press: '↕',
  row: '↔', pullup: '↕', dips: '↕', walk: '↔', run: '↔',
  'mountain-climber': '↔', cycle: '↻',
  'stretch-neck': '‖', 'stretch-shoulder': '‖', 'stretch-back': '‖', 'stretch-hamstring': '‖',
}

// pose가 없거나 우리가 확신하는 20개 포즈에 없으면 절대 다른 포즈로 대신 보여주지 않는다.
// (2.6단계에서 새로 들어온 700여 종 중 자신 있게 매핑되는 것만 pose를 붙였다 — 나머지는
// null. 예전 코드는 이럴 때 'squat'으로 조용히 대체했는데, 이는 §8 "틀린 영상/자세 금지"
// 원칙을 애니메이션에도 적용하지 않은 허점이었다.)
export function NoPosePlaceholder({ size = 96, className = '' }) {
  return (
    <div className={`stickfig-none ${className}`} style={{ width: size, height: size }} role="img" aria-label="안내 그림 없음">
      <span>영상으로<br />확인하세요</span>
    </div>
  )
}

export default function StickFigure({
  pose, size = 96, className = '', tempoSec, freeze, highlightParts, showDirection = false,
}) {
  if (!POSE_KEYS.includes(pose)) return <NoPosePlaceholder size={size} className={className} />
  const safePose = pose
  const groups = partsToGroups(highlightParts)
  const hl = (group) => (groups.has(group) ? ' hl' : '')
  const freezeClass = freeze ? ` freeze-paused freeze-${freeze}` : ''
  const dirIcon = showDirection ? POSE_DIRECTION[safePose] : null

  return (
    <svg
      className={`stickfig pose-${safePose}${freezeClass} ${className}`}
      width={size} height={size} viewBox="0 0 100 130"
      style={tempoSec ? { '--tempo-dur': `${tempoSec}s` } : undefined}
      role="img" aria-label={`${safePose} 동작 애니메이션`}
    >
      <g transform="translate(50,74)">
        <g className="rot-fig">
          {/* 골반은 회전하지 않는 고정 조각이다 — 몸통 전체가 굽히기/비틀기 포즈에서 회전해도
              다리가 붙는 지점(골반)은 항상 제자리에 있어 다리가 떨어져 보이지 않는다. */}
          <path className={`torso pelvis${hl('torso')}`} d="M -6,-13 L 6,-13 L 9,0 L -9,0 Z" />
          <g className="rot-torso">
            {/* 머리-목-가슴을 끊김 없는 하나의 덩어리로. 가슴 아랫변은 골반 조각과 겹치도록
                피벗(어깨 아래 몸통 중심)에 가깝고 좁게 그려, 굽히기 포즈에서도 골반과 계속 겹친다. */}
            <path className={`torso chest${hl('torso')}`} d="M -12,-36 L 12,-36 L 5,-11 L -5,-11 Z" />
            <line className={`neck${hl('head')}`} x1="0" y1="-42" x2="0" y2="-34" />
            <circle className={`head${hl('head')}`} cx="0" cy="-50" r="8" />

            <g className="shoulder-l" transform="translate(-12,-36)">
              <circle className="joint" cx="0" cy="0" r="5" />
              <g className="rot-arm-l">
                <line className={`upperarm${hl('arms')}`} x1="0" y1="0" x2="0" y2="19" />
                <g transform="translate(0,19)">
                  <circle className="joint joint-sm" cx="0" cy="0" r="4" />
                  <g className="rot-forearm-l"><line className={`forearm${hl('arms')}`} x1="0" y1="0" x2="0" y2="17" /></g>
                </g>
              </g>
            </g>
            <g className="shoulder-r" transform="translate(12,-36)">
              <circle className="joint" cx="0" cy="0" r="5" />
              <g className="rot-arm-r">
                <line className={`upperarm${hl('arms')}`} x1="0" y1="0" x2="0" y2="19" />
                <g transform="translate(0,19)">
                  <circle className="joint joint-sm" cx="0" cy="0" r="4" />
                  <g className="rot-forearm-r"><line className={`forearm${hl('arms')}`} x1="0" y1="0" x2="0" y2="17" /></g>
                </g>
              </g>
            </g>
          </g>

          <g className="hip-l" transform="translate(-9,0)">
            <circle className="joint" cx="0" cy="0" r="6" />
            <g className="rot-thigh-l">
              <line className={`thigh${hl('legs')}`} x1="0" y1="0" x2="0" y2="25" />
              <g transform="translate(0,25)">
                <circle className="joint joint-sm" cx="0" cy="0" r="4.5" />
                <g className="rot-shin-l"><line className={`shin${hl('legs')}`} x1="0" y1="0" x2="0" y2="23" /></g>
              </g>
            </g>
          </g>
          <g className="hip-r" transform="translate(9,0)">
            <circle className="joint" cx="0" cy="0" r="6" />
            <g className="rot-thigh-r">
              <line className={`thigh${hl('legs')}`} x1="0" y1="0" x2="0" y2="25" />
              <g transform="translate(0,25)">
                <circle className="joint joint-sm" cx="0" cy="0" r="4.5" />
                <g className="rot-shin-r"><line className={`shin${hl('legs')}`} x1="0" y1="0" x2="0" y2="23" /></g>
              </g>
            </g>
          </g>
        </g>
      </g>

      {dirIcon && (
        <text x="94" y="14" textAnchor="end" className="dirarrow">{dirIcon}</text>
      )}
    </svg>
  )
}
