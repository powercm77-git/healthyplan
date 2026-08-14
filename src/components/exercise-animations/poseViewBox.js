// poseViewBox.js — 포즈별 실측 viewBox. scripts/calibrate-poses.mjs가 자동 생성했다.
// 재계산하려면: node scripts/calibrate-poses.mjs

export const DEFAULT_VIEWBOX = [-60, -80, 120, 160]

export const POSE_VIEWBOX = {
  'squat': [-53.5, -66, 108.3, 136.6],
  'pushup': [-148.4, -76, 137.4, 76.4],
  'lunge': [-52.2, -66, 108.5, 134.2],
  'plank': [-136, -66, 127.7, 61.5],
  'crunch': [-27, -66.4, 83.8, 125.4],
  'jumping-jack': [-38.9, -92, 80.6, 151],
  'bridge': [-133.1, -66, 122.1, 77],
  'deadlift': [-38.9, -72.1, 105.4, 132.3],
  'press': [-54.1, -83.6, 85.6, 142.6],
  'row': [-37, -73.9, 115.5, 132.9],
  'pullup': [-33.9, -98, 60.9, 157],
  'dips': [-44.9, -82, 82.5, 151],
  'walk': [-43.1, -66, 88.4, 125.5],
  'run': [-42.4, -69.8, 102.6, 118.1],
  'mountain-climber': [-154.6, -66, 143, 72.6],
  'cycle': [-45.9, -66.4, 102.8, 122.5],
  'stretch-neck': [-27.2, -68.9, 67.7, 127.9],
  'stretch-shoulder': [-27.4, -66, 56, 125],
  'stretch-back': [-57.8, -85.5, 84.8, 144.5],
  'stretch-hamstring': [-30.4, -67.7, 83.8, 128.4],
}
