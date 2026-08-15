// scripts/calibrate-poses.mjs — StickFigure 포즈별 실측 viewBox 계산.
//
// stickfig-harness.html이 20개 포즈를 DEFAULT_VIEWBOX(넉넉한 세이프박스)로 렌더링한다.
// 각 포즈를 실제로 재생시킨 뒤 Web Animations API로 0~100% 구간을 촘촘히(SAMPLES개) 스크럽하며
// 매 지점의 <g class="figure-root"> getBBox()를 측정해 전체 스윕의 합집합 경계상자를 구한다.
//
// 처음엔 freeze="start"/"end" 두 키프레임만 재서 계산했는데, 재생 중간 프레임(예: press의
// 180도에 가까운 팔 스윙, mountain-climber의 무릎 당기기)에서 두 끝점보다 더 멀리 튀어나오는
// 경우를 놓쳤다 — 실제 화면 밖 이탈로 이어졌다. 애니메이션 전체를 스캔해야 이걸 잡는다.
//
// getBBox()는 stroke 두께를 포함하지 않는(geometry만 재는) 값이라, 가장 굵은 외곽선
// (thigh-outline stroke-width 13, 반두께 6.5)보다 넉넉한 패딩을 더한다.
//
// 사용법: node scripts/calibrate-poses.mjs  (내부에서 `npm run dev`를 띄우고 종료 시 끈다)

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 5183
const BASE = `http://localhost:${PORT}/healthyplan/stickfig-harness.html`
const PAD = 8
const SAMPLES = 25 // 0%, ~4%, ..., 100% — 애니메이션 전체 구간 스캔

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url)
        if (res.ok) return resolve()
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error('server did not start in time'))
      setTimeout(tick, 300)
    }
    tick()
  })
}

async function main() {
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'ignore',
  })
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } })
    await page.goto(BASE)
    await page.waitForSelector('.cell[data-freeze="start"]')

    const sweeps = await page.evaluate((SAMPLES) => {
      const out = []
      for (const cell of document.querySelectorAll('.cell[data-freeze="start"]')) {
        const svg = cell.querySelector('svg.stickfig')
        svg.classList.remove('freeze-paused', 'freeze-start')
        const root = cell.querySelector('.figure-root')
        const anims = svg.getAnimations({ subtree: true })
        anims.forEach((a) => a.pause())
        const durations = anims.map((a) => {
          const t = a.effect.getTiming()
          return (t.duration || 0) * (t.iterations && t.iterations !== Infinity ? t.iterations : 1)
        })
        const maxDur = Math.max(1, ...durations.filter((d) => Number.isFinite(d) && d > 0))
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (let i = 0; i < SAMPLES; i++) {
          const frac = i / (SAMPLES - 1)
          anims.forEach((a) => { a.currentTime = frac * maxDur })
          const bb = root.getBBox()
          minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y)
          maxX = Math.max(maxX, bb.x + bb.width); maxY = Math.max(maxY, bb.y + bb.height)
        }
        anims.forEach((a) => a.cancel())
        out.push({ pose: cell.dataset.pose, x: minX, y: minY, width: maxX - minX, height: maxY - minY })
      }
      return out
    }, SAMPLES)
    await browser.close()

    const poseViewBox = {}
    const report = []
    for (const s of sweeps) {
      const minX = s.x - PAD
      const minY = s.y - PAD
      const maxX = s.x + s.width + PAD
      const maxY = s.y + s.height + PAD
      const w = maxX - minX
      const h = maxY - minY
      const vb = [round1(minX), round1(minY), round1(w), round1(h)]
      poseViewBox[s.pose] = vb
      report.push({ pose: s.pose, vb, sweep: s })
    }

    const lines = [
      "// poseViewBox.js — 포즈별 실측 viewBox. scripts/calibrate-poses.mjs가 자동 생성했다.",
      "// 재계산하려면: node scripts/calibrate-poses.mjs",
      "",
      "export const DEFAULT_VIEWBOX = [-60, -80, 120, 160]",
      "",
      "export const POSE_VIEWBOX = {",
      ...Object.entries(poseViewBox).map(([pose, vb]) => `  '${pose}': [${vb.join(', ')}],`),
      "}",
      "",
    ]
    await writeFile(path.join(__dirname, '..', 'src', 'components', 'exercise-animations', 'poseViewBox.js'), lines.join('\n'))

    console.log(`포즈별 viewBox 산출 결과 (애니메이션 전체 ${SAMPLES}개 샘플 스캔):\n`)
    console.log('pose'.padEnd(20), 'viewBox'.padEnd(28), '스윕 bbox')
    for (const { pose, vb, sweep } of report) {
      const fmt = `x${sweep.x.toFixed(1)},y${sweep.y.toFixed(1)},w${sweep.width.toFixed(1)},h${sweep.height.toFixed(1)}`
      console.log(pose.padEnd(20), `[${vb.join(',')}]`.padEnd(28), fmt)
    }
  } finally {
    server.kill()
  }
}

function round1(n) { return Math.round(n * 10) / 10 }

main().catch((err) => { console.error(err); process.exit(1) })
