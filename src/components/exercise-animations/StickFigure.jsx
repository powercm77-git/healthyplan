// StickFigure.jsx — 저작권 걱정 없는 자체 제작 스틱 피겨 동작 애니메이션.
//
// 관절마다 "고정 위치(translate, SVG 속성)"와 "회전(CSS transform)"을 분리된
// 중첩 <g>로 나눴다. 같은 요소에 SVG 속성 transform과 CSS transform을 함께
// 쓰면 CSS가 속성을 완전히 덮어써 위치가 틀어지므로, 위치는 바깥 <g>(속성),
// 회전은 안쪽 <g class="rot-...">(CSS 애니메이션)이 각각 담당한다.
//
// 2.5단계: 관절 원 + 부위별 두께 구분, 동작 방향 표시, 시작/종료 자세 스냅샷(freeze).
// 2.7단계 재작업: 실측(getBBox) 기반 포즈별 viewBox, 어깨-가슴 폭 분리, 부위별
// 배경색 외곽선, 손/발, 척추선, 인체 각도 재조정 — scripts/calibrate-poses.mjs로
// 산출한 값을 POSE_VIEWBOX에 반영한다.
import './poses.css'
import { POSE_VIEWBOX, DEFAULT_VIEWBOX } from './poseViewBox.js'

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

// 선(팔·팔뚝·허벅지·정강이·발)과 배경색 외곽선을 한 쌍으로 그린다. 외곽선을 먼저(아래)
// 그리고 본체를 그 위에 그리면, 부위가 서로 겹쳐도 경계가 살아 사람 형태로 읽힌다.
function OutlinedLine({ base, hlClass, x1, y1, x2, y2 }) {
  return (
    <>
      <line className={`${base}-outline`} x1={x1} y1={y1} x2={x2} y2={y2} />
      <line className={`${base}${hlClass}`} x1={x1} y1={y1} x2={x2} y2={y2} />
    </>
  )
}

// 손/발 끝: 배경색 외곽 원을 먼저 깔고 본체 원을 그 위에 그린다.
function OutlinedDot({ base, hlClass, cx = 0, cy = 0, r }) {
  return (
    <>
      <circle className={`${base}-outline`} cx={cx} cy={cy} r={r + 2} />
      <circle className={`${base}${hlClass}`} cx={cx} cy={cy} r={r} />
    </>
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

  // 포즈별 실측 viewBox(scripts/calibrate-poses.mjs 산출). 서 있는 포즈는 세로형,
  // 눕는 포즈는 가로형 — 어느 쪽이든 인물 전체(시작+종료 자세 합)가 중앙에 들어온다.
  const [vx, vy, vw, vh] = POSE_VIEWBOX[safePose] || DEFAULT_VIEWBOX
  const dirX = vx + vw - 6
  const dirY = vy + 14

  return (
    <svg
      className={`stickfig pose-${safePose}${freezeClass} ${className}`}
      width={size} height={size} viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={tempoSec ? { '--tempo-dur': `${tempoSec}s` } : undefined}
      role="img" aria-label={`${safePose} 동작 애니메이션`}
    >
      {/* figure-root는 transform이 없는 순수 측정용 래퍼다 — getBBox()로 이 그룹을 재면
          rot-fig의 회전·이동까지 전부 반영된 실제 렌더 범위를 얻는다(calibrate-poses.mjs). */}
      <g className="figure-root">
        <g className="rot-fig">
          {/* 골반은 회전하지 않는 고정 조각이다 — 몸통 전체가 굽히기/비틀기 포즈에서 회전해도
              다리가 붙는 지점(골반)은 항상 제자리에 있어 다리가 떨어져 보이지 않는다. */}
          <path className={`torso pelvis${hl('torso')}`} d="M -6,-13 L 6,-13 L 9,0 L -9,0 Z" />
          <g className="rot-torso">
            {/* 머리-목-가슴을 끊김 없는 하나의 덩어리로. 가슴 폭(±10)을 어깨 관절(±14)보다
                좁혀, 팔을 내려도 팔이 몸통 실루엣에 묻히지 않고 별도 부위로 보인다. */}
            <path className={`torso chest${hl('torso')}`} d="M -10,-36 L 10,-36 L 5,-11 L -5,-11 Z" />
            {/* 척추선: 가슴 아래~골반 위를 굵게 이어, 몸통이 굽혀지거나 비틀려도
                가슴 조각과 골반 조각 사이가 끊겨 보이지 않게 한다(발주자 제안). */}
            <line className={`spine${hl('torso')}`} x1="0" y1="-30" x2="0" y2="-8" />
            <line className={`neck${hl('head')}`} x1="0" y1="-42" x2="0" y2="-34" />
            <circle className={`head${hl('head')}`} cx="0" cy="-50" r="8" />

            <g className="shoulder-l" transform="translate(-14,-36)">
              <circle className="joint" cx="0" cy="0" r="5" />
              <g className="rot-arm-l">
                <OutlinedLine base="upperarm" hlClass={hl('arms')} x1="0" y1="0" x2="0" y2="19" />
                <g transform="translate(0,19)">
                  <circle className="joint joint-sm" cx="0" cy="0" r="4" />
                  <g className="rot-forearm-l">
                    <OutlinedLine base="forearm" hlClass={hl('arms')} x1="0" y1="0" x2="0" y2="17" />
                    <g transform="translate(0,17)">
                      <OutlinedDot base="hand" hlClass={hl('arms')} r="3.2" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
            <g className="shoulder-r" transform="translate(14,-36)">
              <circle className="joint" cx="0" cy="0" r="5" />
              <g className="rot-arm-r">
                <OutlinedLine base="upperarm" hlClass={hl('arms')} x1="0" y1="0" x2="0" y2="19" />
                <g transform="translate(0,19)">
                  <circle className="joint joint-sm" cx="0" cy="0" r="4" />
                  <g className="rot-forearm-r">
                    <OutlinedLine base="forearm" hlClass={hl('arms')} x1="0" y1="0" x2="0" y2="17" />
                    <g transform="translate(0,17)">
                      <OutlinedDot base="hand" hlClass={hl('arms')} r="3.2" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>

          <g className="hip-l" transform="translate(-9,0)">
            <circle className="joint" cx="0" cy="0" r="6" />
            <g className="rot-thigh-l">
              <OutlinedLine base="thigh" hlClass={hl('legs')} x1="0" y1="0" x2="0" y2="25" />
              <g transform="translate(0,25)">
                <circle className="joint joint-sm" cx="0" cy="0" r="4.5" />
                <g className="rot-shin-l">
                  <OutlinedLine base="shin" hlClass={hl('legs')} x1="0" y1="0" x2="0" y2="23" />
                  <g transform="translate(0,23)">
                    <circle className="joint joint-sm" cx="0" cy="0" r="3" />
                    <OutlinedLine base="foot" hlClass={hl('legs')} x1="0" y1="0" x2="8" y2="0" />
                  </g>
                </g>
              </g>
            </g>
          </g>
          <g className="hip-r" transform="translate(9,0)">
            <circle className="joint" cx="0" cy="0" r="6" />
            <g className="rot-thigh-r">
              <OutlinedLine base="thigh" hlClass={hl('legs')} x1="0" y1="0" x2="0" y2="25" />
              <g transform="translate(0,25)">
                <circle className="joint joint-sm" cx="0" cy="0" r="4.5" />
                <g className="rot-shin-r">
                  <OutlinedLine base="shin" hlClass={hl('legs')} x1="0" y1="0" x2="0" y2="23" />
                  <g transform="translate(0,23)">
                    <circle className="joint joint-sm" cx="0" cy="0" r="3" />
                    <OutlinedLine base="foot" hlClass={hl('legs')} x1="0" y1="0" x2="8" y2="0" />
                  </g>
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      {dirIcon && (
        <text x={dirX} y={dirY} textAnchor="end" className="dirarrow">{dirIcon}</text>
      )}
    </svg>
  )
}
