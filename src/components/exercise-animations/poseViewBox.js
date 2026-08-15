// poseViewBox.js — 포즈별 실측 viewBox. scripts/calibrate-poses.mjs가 자동 생성했다.
// 재계산하려면: node scripts/calibrate-poses.mjs

export const DEFAULT_VIEWBOX = [-60, -80, 120, 160]

export const POSE_VIEWBOX = {
  'squat': [-53.6, -66, 112.8, 135.8],
  'pushup': [-59, -37, 125, 98.4],
  'lunge': [-54.8, -66, 112.5, 132],
  'plank': [-60.2, -31, 129.8, 95.6],
  'crunch': [-27.3, -69, 84.1, 128.2],
  'jumping-jack': [-38.7, -91.3, 80.6, 150.3],
  'bridge': [-51.8, -33.8, 117.8, 86.5],
  'deadlift': [-38.7, -73.1, 105.1, 132.8],
  'press': [-48.9, -82.2, 110.1, 141.2],
  'row': [-36.1, -73.8, 116.4, 132.8],
  'pullup': [-27, -97.3, 59.7, 156.3],
  'dips': [-39.7, -80.4, 84.9, 149.4],
  'walk': [-42.6, -70, 88.4, 127.6],
  'run': [-41, -78.1, 103, 125.7],
  'mountain-climber': [-60.7, -30.4, 126.7, 90.6],
  'cycle': [-46.5, -66.4, 103.4, 124.7],
  'stretch-neck': [-27.3, -68.9, 67.7, 127.9],
  'stretch-shoulder': [-27, -66, 60.4, 125],
  'stretch-back': [-51.2, -84.2, 84.7, 143.2],
  'stretch-hamstring': [-30.3, -69, 83.7, 129.6],
}
