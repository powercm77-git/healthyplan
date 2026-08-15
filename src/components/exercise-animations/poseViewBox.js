// poseViewBox.js — 포즈별 실측 viewBox + 바닥선 y. scripts/calibrate-poses.mjs가 자동 생성했다.
// 관절 각도(50% 활동 지점 값)는 여기 없다 — poses.css에 손으로 유지한다.
// 재계산하려면: node scripts/calibrate-poses.mjs

export const DEFAULT_VIEWBOX = [-60, -80, 120, 160]

export const POSE_VIEWBOX = {
  'squat': [-53.6, -66, 115.8, 137.6],
  'pushup': [-66, -27, 125, 88.5],
  'lunge': [-52.4, -66, 89.6, 135.2],
  'plank': [-66, -27, 125, 72],
  'crunch': [-76.9, -59.8, 124.9, 111.7],
  'jumping-jack': [-61.3, -81.2, 122.7, 140.8],
  'bridge': [-66.8, -46.8, 107.4, 93.4],
  'deadlift': [-38.6, -66.9, 105.5, 127.6],
  'press': [-61.4, -83.3, 122.8, 142.3],
  'row': [-32.6, -66.8, 98.1, 127.3],
  'pullup': [-35.4, -83.9, 64.8, 145.2],
  'dips': [-37.9, -66, 82, 122.2],
  'walk': [-40.3, -66, 82, 126.9],
  'run': [-50.1, -66, 94, 127.6],
  'mountain-climber': [-66, -36.2, 126.6, 97.4],
  'cycle': [-64.2, -66, 136.7, 117.1],
  'stretch-neck': [-31.4, -67.9, 62.8, 126.9],
  'stretch-shoulder': [-27, -66, 77.8, 125],
  'stretch-back': [-25.9, -75.1, 107.9, 134.6],
  'stretch-hamstring': [-25.9, -49.5, 88.8, 109],
}

export const POSE_FLOOR_Y = {
  'squat': 63.6,
  'pushup': 53.5,
  'lunge': 61.2,
  'plank': 37,
  'crunch': 43.8,
  'jumping-jack': 51.6,
  'bridge': 38.6,
  'deadlift': 52.8,
  'press': 51,
  'row': 52.5,
  'pullup': 53.3,
  'dips': 48.2,
  'walk': 52.9,
  'run': 53.6,
  'mountain-climber': 53.2,
  'cycle': 43.1,
  'stretch-neck': 51,
  'stretch-shoulder': 51,
  'stretch-back': 51.5,
  'stretch-hamstring': 51.5,
}
