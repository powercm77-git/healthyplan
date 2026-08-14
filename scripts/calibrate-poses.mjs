// scripts/calibrate-poses.mjs — StickFigure 포즈별 실측 viewBox 계산.
//
// stickfig-harness.html이 20개 포즈 x freeze(start/end) = 40칸을 DEFAULT_VIEWBOX(넉넉한
// 세이프박스)로 렌더링한다. 각 칸의 <g class="figure-root">에 대해 getBBox()를 읽으면
// rot-fig의 회전·이동까지 반영된 실제 렌더 범위가 나온다(figure-root 자신은 transform이
// 없는 순수 측정용 래퍼). start/end 두 자세의 합집합 경계상자에 여백을 더해 중앙 정렬된
// 포즈별 viewBox를 계산해 poseViewBox.js를 새로 쓴다.
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
    await page.waitForSelector('.cell')

    const cells = await page.evaluate(() => {
      const out = []
      for (const cell of document.querySelectorAll('.cell')) {
        const svg = cell.querySelector('svg.stickfig')
        const root = cell.querySelector('.figure-root')
        const bb = root.getBBox()
        out.push({
          pose: cell.dataset.pose,
          freeze: cell.dataset.freeze,
          x: bb.x, y: bb.y, width: bb.width, height: bb.height,
        })
      }
      return out
    })
    await browser.close()

    const byPose = new Map()
    for (const c of cells) {
      if (!byPose.has(c.pose)) byPose.set(c.pose, [])
      byPose.get(c.pose).push(c)
    }

    const poseViewBox = {}
    const report = []
    for (const [pose, frames] of byPose) {
      const minX = Math.min(...frames.map((f) => f.x)) - PAD
      const minY = Math.min(...frames.map((f) => f.y)) - PAD
      const maxX = Math.max(...frames.map((f) => f.x + f.width)) + PAD
      const maxY = Math.max(...frames.map((f) => f.y + f.height)) + PAD
      const w = maxX - minX
      const h = maxY - minY
      const vb = [round1(minX), round1(minY), round1(w), round1(h)]
      poseViewBox[pose] = vb
      report.push({ pose, vb, frames })
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

    console.log('포즈별 viewBox 산출 결과:\n')
    console.log('pose'.padEnd(20), 'viewBox'.padEnd(28), 'start bbox'.padEnd(28), 'end bbox')
    for (const { pose, vb, frames } of report) {
      const s = frames.find((f) => f.freeze === 'start')
      const e = frames.find((f) => f.freeze === 'end')
      const fmt = (f) => `x${f.x.toFixed(1)},y${f.y.toFixed(1)},w${f.width.toFixed(1)},h${f.height.toFixed(1)}`
      console.log(pose.padEnd(20), `[${vb.join(',')}]`.padEnd(28), fmt(s).padEnd(28), fmt(e))
    }
  } finally {
    server.kill()
  }
}

function round1(n) { return Math.round(n * 10) / 10 }

main().catch((err) => { console.error(err); process.exit(1) })
