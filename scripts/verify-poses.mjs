// scripts/verify-poses.mjs — 새로 계산된 POSE_VIEWBOX가 실제로 20개 포즈 전부를
// 화면 안에(잘림 없이) 중앙 정렬해 담는지 수치로 검증한다(getBBox 기반, 눈으로만 보지 않음).
// 그리고 사용자가 요청한 7개 포즈(기본자세·허리비틀기·스쿼트·런지·플랭크·푸시업·브릿지)의
// start/end 스냅샷을 스크린샷으로 저장한다.
//
// 사용법: node scripts/verify-poses.mjs

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 5184
const BASE = `http://localhost:${PORT}/healthyplan/stickfig-harness.html`
const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, '..', '..', 'stickfig-shots')

const REQUIRED_SHOTS = [
  { pose: 'squat', freeze: 'start', label: 'rest-armsdown' }, // 팔 내린 기본자세(중립 자세)
  { pose: 'stretch-back', freeze: 'start', label: 'waist-twist-start' },
  { pose: 'stretch-back', freeze: 'end', label: 'waist-twist-end' },
  { pose: 'squat', freeze: 'end', label: 'squat' },
  { pose: 'lunge', freeze: 'end', label: 'lunge' },
  { pose: 'plank', freeze: 'start', label: 'plank' },
  { pose: 'pushup', freeze: 'end', label: 'pushup' },
  { pose: 'bridge', freeze: 'end', label: 'bridge' },
  { pose: 'crunch', freeze: 'end', label: 'crunch' },
]

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
  await mkdir(SHOT_DIR, { recursive: true })
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

    // ── 수치 검증: 각 포즈(칸)의 인물 bbox가 자신의 viewBox 안에 완전히 들어오는지,
    // 여백이 음수(=잘림)가 아닌지 계산한다.
    const rows = await page.evaluate(() => {
      const out = []
      for (const cell of document.querySelectorAll('.cell')) {
        const svg = cell.querySelector('svg.stickfig')
        const root = cell.querySelector('.figure-root')
        const bb = root.getBBox()
        const vb = svg.getAttribute('viewBox').split(' ').map(Number)
        const [vx, vy, vw, vh] = vb
        out.push({
          pose: cell.dataset.pose,
          freeze: cell.dataset.freeze,
          vb,
          bboxLeft: bb.x, bboxTop: bb.y, bboxRight: bb.x + bb.width, bboxBottom: bb.y + bb.height,
          marginLeft: bb.x - vx,
          marginTop: bb.y - vy,
          marginRight: (vx + vw) - (bb.x + bb.width),
          marginBottom: (vy + vh) - (bb.y + bb.height),
        })
      }
      return out
    })

    const byPose = new Map()
    for (const r of rows) {
      if (!byPose.has(r.pose)) byPose.set(r.pose, [])
      byPose.get(r.pose).push(r)
    }

    console.log('포즈'.padEnd(20), '여백(좌,상,우,하)'.padEnd(34), '잘림', '중앙정렬 오차(좌우/상하)')
    let anyClip = false
    for (const [pose, frames] of byPose) {
      for (const f of frames) {
        const margins = [f.marginLeft, f.marginTop, f.marginRight, f.marginBottom]
        const clipped = margins.some((m) => m < -0.05)
        if (clipped) anyClip = true
        const lrGap = Math.abs(f.marginLeft - f.marginRight)
        const tbGap = Math.abs(f.marginTop - f.marginBottom)
        const marginStr = margins.map((m) => m.toFixed(1)).join(', ')
        console.log(
          `${pose}(${f.freeze})`.padEnd(20),
          marginStr.padEnd(34),
          clipped ? 'CLIP!' : 'OK',
          `${lrGap.toFixed(1)} / ${tbGap.toFixed(1)}`,
        )
      }
    }
    console.log(anyClip ? '\n잘림 발견됨 — 위 CLIP! 행 확인' : '\n20개 포즈 전부 잘림 없음(모든 여백 >= 0).')

    // ── 스크린샷: 사용자가 지정한 7개 포즈 ──
    for (const { pose, freeze, label } of REQUIRED_SHOTS) {
      const cell = page.locator(`.cell[data-pose="${pose}"][data-freeze="${freeze}"]`)
      await cell.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) })
    }
    console.log(`\n스크린샷 저장 위치: ${SHOT_DIR}`)

    await browser.close()
    if (anyClip) process.exitCode = 1
  } finally {
    server.kill()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
