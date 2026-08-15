// poseViewBox.js — 포즈별 실측 viewBox. scripts/calibrate-poses.mjs가 자동 생성했다.
// 재계산하려면: node scripts/calibrate-poses.mjs

export const DEFAULT_VIEWBOX = [-60, -80, 120, 160]

export const POSE_VIEWBOX = {
  'squat': [-53.5, -66, 110.4, 136.8],
  'pushup': [-59, -37, 125, 94.1],
  'lunge': [-57.1, -66, 107.3, 137.3],
  'plank': [-60.2, -31, 129.5, 91.7],
  'crunch': [-27.3, -69, 84.1, 128],
  'jumping-jack': [-38.9, -92, 80.6, 151],
  'bridge': [-50, -33.1, 116, 83],
  'deadlift': [-38.9, -73.4, 105.4, 133.9],
  'press': [-54.1, -83.6, 101.6, 142.6],
  'row': [-37, -73.9, 115.5, 132.9],
  'pullup': [-33.9, -98, 60.9, 157],
  'dips': [-45, -82, 82.6, 151],
  'walk': [-43.1, -70, 88.4, 129.5],
  'run': [-42.4, -78.1, 102.6, 126.4],
  'mountain-climber': [-59.6, -45.6, 125.6, 97.4],
  'cycle': [-45.9, -66.4, 102.8, 123.8],
  'stretch-neck': [-27.3, -68.9, 67.7, 127.9],
  'stretch-shoulder': [-27.4, -66, 57.4, 125],
  'stretch-back': [-57.8, -85.5, 88.1, 144.5],
  'stretch-hamstring': [-30.4, -69, 83.8, 129.8],
}
