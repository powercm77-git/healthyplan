// scripts/verify-layout.mjs — 실제 브라우저(Chromium)로 시트/검색 결과가
// 뷰포트 안에 실제로 렌더링되는지 getBoundingClientRect로 검증한다.
// 사용법: node scripts/verify-layout.mjs  (사전에 `npm run build` 필요)

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 4300
const BASE = `http://localhost:${PORT}/healthyplan/`

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

async function completeOnboarding(page) {
  await page.goto(BASE)
  await page.getByText('남성').click()
  await page.locator('#age, input[placeholder="52"]').fill('40')
  await page.locator('input[placeholder="172"]').fill('175')
  await page.locator('input[placeholder="74"]').fill('75')
  await page.getByText('다음 →').click()
  await page.getByText('가볍게 움직여요').click()
  await page.getByText('조금 있어요').click()
  await page.getByText('다음 →').click()
  await page.getByText('든든하게').click()
  await page.getByRole('button', { name: /내 플랜으로 시작하기/ }).click()
  await page.waitForSelector('.tabbar.show')
}

function rectWithinViewport(rect, vw, vh) {
  return rect.width > 0 && rect.height > 0 &&
    rect.top >= 0 && rect.left >= 0 && rect.bottom <= vh && rect.right <= vw
}

async function checkSearchVisible(page, label, query, expectSubstring) {
  await page.locator('.tabbar .tab', { hasText: '식단' }).click()
  await page.getByText('+ 음식 추가').first().click()
  const input = page.locator('.sheet input[type="text"]')
  await input.fill('')
  await input.type(query, { delay: 30 })
  await page.waitForTimeout(200)

  const vw = await page.evaluate(() => window.innerWidth)
  const vh = await page.evaluate(() => window.innerHeight)

  const items = page.locator('.fl-item')
  const count = await items.count()
  if (count === 0) {
    throw new Error(`[${label}] "${query}" 검색 결과가 DOM에 없음 (매칭 로직 문제)`)
  }

  let matchFound = false
  let anyVisible = false
  for (let i = 0; i < count; i++) {
    const item = items.nth(i)
    const text = await item.locator('.fn').innerText()
    const box = await item.boundingBox()
    const visible = box && rectWithinViewport(
      { top: box.y, left: box.x, bottom: box.y + box.height, right: box.x + box.width, width: box.width, height: box.height },
      vw, vh,
    )
    if (text.includes(expectSubstring)) {
      matchFound = true
      if (visible) anyVisible = true
      console.log(`  - "${text}" boundingBox=${JSON.stringify(box)} visible=${visible}`)
    }
  }
  if (!matchFound) throw new Error(`[${label}] "${query}" 결과 중 "${expectSubstring}" 항목을 찾지 못함`)
  if (!anyVisible) throw new Error(`[${label}] "${query}" → "${expectSubstring}" 항목이 뷰포트 밖에 렌더링됨`)
  console.log(`[PASS] ${label}: "${query}" → "${expectSubstring}" 뷰포트 안에서 보임`)

  // 시트 닫기 클릭에 의존하지 않고 새로고침으로 확실히 초기 상태로 되돌린다
  // (온보딩 프로필은 IndexedDB에 남아있어 새로고침해도 홈으로 바로 돌아온다)
  await page.reload()
  await page.waitForSelector('.tabbar.show')
}

async function checkPhoneCentered(page, vw) {
  const box = await page.locator('.phone').boundingBox()
  const leftGap = box.x
  const rightGap = vw - (box.x + box.width)
  const diff = Math.abs(leftGap - rightGap)
  console.log(`  .phone leftGap=${leftGap.toFixed(1)} rightGap=${rightGap.toFixed(1)} diff=${diff.toFixed(1)}`)
  if (diff > 4) throw new Error(`.phone이 가운데 정렬되지 않음 (좌우 여백 차이 ${diff.toFixed(1)}px)`)
  console.log('[PASS] 데스크톱: .phone이 화면 가운데 정렬됨')
}

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: process.cwd(), stdio: 'pipe', shell: true,
  })
  server.stdout.on('data', () => {})
  server.stderr.on('data', (d) => console.error(String(d)))

  try {
    await waitForServer(BASE)
    const browser = await chromium.launch()

    // ── 모바일 뷰포트 (390x844) ──
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
      const page = await context.newPage()
      await completeOnboarding(page)
      await checkSearchVisible(page, '모바일 390x844', 'ㄱㅊㅉ', '김치찌개')
      await checkSearchVisible(page, '모바일 390x844', '김치찌개', '김치찌개')
      await context.close()
    }

    // ── 데스크톱 뷰포트 (1280x950) ──
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 950 } })
      const page = await context.newPage()
      await completeOnboarding(page)
      await checkPhoneCentered(page, 1280)
      await checkSearchVisible(page, '데스크톱 1280x950', 'ㄱㅊㅉ', '김치찌개')
      await checkSearchVisible(page, '데스크톱 1280x950', '김치찌개', '김치찌개')
      await context.close()
    }

    await browser.close()
    console.log('\n모든 레이아웃 검증 통과')
  } finally {
    if (process.platform === 'win32' && server.pid) {
      spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      server.kill()
    }
  }
}

main().catch((err) => {
  console.error('\n[FAIL]', err.message)
  process.exit(1)
})
