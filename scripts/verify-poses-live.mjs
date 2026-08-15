// scripts/verify-poses-live.mjs — freeze="start"/"end" 스냅샷만으로는 애니메이션이
// 실제로 재생되는 중간 프레임에서 인물이 박스를 벗어나는지 잡아내지 못한다(발주자 지적:
// "getBBox 수치 검증만으로는 이 문제를 못 잡았다"). 이 스크립트는 포즈를 얼리지 않고 실제로
// 재생한 뒤, Web Animations API로 각 애니메이션의 currentTime을 0~100%까지 촘촘히 스크럽하며
// 매 지점에서 <g class="figure-root">의 getBBox()를 측정해, 스윕 전체가 그 포즈의 최종
// viewBox 안에 들어오는지 확인한다. rot-fig가 90도 회전하는 눕는 포즈(푸시업·플랭크·
// 마운틴클라이머·브릿지)가 대상이지만, 회귀 방지를 위해 20개 포즈 전부를 스캔한다.
//
// 사용법: node scripts/verify-poses-live.mjs

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 5185
const BASE = `http://localhost:${PORT}/healthyplan/stickfig-harness.html`
const SAMPLES = 21 // 0%, 5%, ..., 100%
const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, '..', '..', 'stickfig-shots')

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try { const res = await fetch(url); if (res.ok) return resolve() } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'))
      setTimeout(tick, 300)
    }
    tick()
  })
}

async function main() {
  await mkdir(SHOT_DIR, { recursive: true })
  const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: path.join(__dirname, '..'), shell: true, stdio: 'ignore',
  })
  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } })
    await page.goto(BASE)
    await page.waitForSelector('.cell[data-freeze="start"]')

    const results = await page.evaluate((SAMPLES) => {
      const out = []
      // freeze 없는 재생용 인스턴스가 없으니, freeze="start" 셀에서 freeze 클래스를 떼
      // 실제 애니메이션이 돌게 만든 뒤 currentTime을 스크럽한다.
      for (const cell of document.querySelectorAll('.cell[data-freeze="start"]')) {
        const svg = cell.querySelector('svg.stickfig')
        svg.classList.remove('freeze-paused', 'freeze-start')
        const root = cell.querySelector('.figure-root')
        const vb = svg.getAttribute('viewBox').split(' ').map(Number)
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
        out.push({ pose: cell.dataset.pose, vb, sweptMinX: minX, sweptMinY: minY, sweptMaxX: maxX, sweptMaxY: maxY })
      }
      return out
    }, SAMPLES)

    console.log('포즈'.padEnd(20), '스윕 전체 여백(좌,상,우,하)'.padEnd(34), '상태')
    let anyClip = false
    for (const r of results) {
      const [vx, vy, vw, vh] = r.vb
      const marginLeft = r.sweptMinX - vx
      const marginTop = r.sweptMinY - vy
      const marginRight = (vx + vw) - r.sweptMaxX
      const marginBottom = (vy + vh) - r.sweptMaxY
      const margins = [marginLeft, marginTop, marginRight, marginBottom]
      const clipped = margins.some((m) => m < -0.05)
      if (clipped) anyClip = true
      console.log(r.pose.padEnd(20), margins.map((m) => m.toFixed(1)).join(', ').padEnd(34), clipped ? 'CLIP!(재생 중 이탈)' : 'OK')
    }
    console.log(anyClip ? '\n재생 중 이탈 발견됨' : `\n20개 포즈 전부 재생 전체 구간(${SAMPLES}개 샘플)에서 박스 이탈 없음.`)

    await browser.close()

    // 중간 프레임 스크린샷은 sweep 측정에서 이미 취소(cancel)한 애니메이션과 다른, 새
    // 페이지 로드로 다시 재생시켜 남긴다(취소된 애니메이션은 currentTime을 줘도 재생되지 않는다).
    const browser2 = await chromium.launch()
    const page2 = await browser2.newPage({ viewport: { width: 1400, height: 1400 } })
    await page2.goto(BASE)
    await page2.waitForSelector('.cell[data-freeze="start"]')
    for (const pose of ['pushup', 'plank', 'mountain-climber', 'bridge']) {
      const cell = page2.locator(`.cell[data-pose="${pose}"][data-freeze="start"]`)
      const svg = cell.locator('svg.stickfig')
      await svg.evaluate((el) => {
        el.classList.remove('freeze-paused', 'freeze-start')
        const anims = el.getAnimations({ subtree: true })
        anims.forEach((a) => a.pause())
        const maxDur = Math.max(1, ...anims.map((a) => a.effect.getTiming().duration || 0))
        anims.forEach((a) => { a.currentTime = maxDur * 0.3 })
      })
      await cell.screenshot({ path: path.join(SHOT_DIR, `${pose}-mid30pct.png`) })
    }
    console.log(`중간 프레임 스크린샷 저장: ${SHOT_DIR}`)
    await browser2.close()
    if (anyClip) process.exitCode = 1
  } finally {
    server.kill()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
