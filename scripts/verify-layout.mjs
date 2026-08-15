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

async function elementWithinViewport(page, locator, label) {
  // .screen은 overflow-y:auto라 긴 콘텐츠는 스크롤해서 봐야 정상이다(버그 아님).
  // 스크롤해도 안 보이거나(0 사이즈) 화면 폭 밖으로 넘치면 그건 진짜 레이아웃 버그다.
  await locator.scrollIntoViewIfNeeded()
  const vw = await page.evaluate(() => window.innerWidth)
  const vh = await page.evaluate(() => window.innerHeight)
  const box = await locator.boundingBox()
  if (!box) throw new Error(`[${label}] 요소가 DOM에 없음`)
  const visible = rectWithinViewport(
    { top: box.y, left: box.x, bottom: box.y + box.height, right: box.x + box.width, width: box.width, height: box.height },
    vw, vh,
  )
  console.log(`  - [${label}] boundingBox=${JSON.stringify(box)} visible=${visible}`)
  if (!visible) throw new Error(`[${label}] 요소가 뷰포트 밖에 렌더링됨`)
}

// 2단계(운동 모듈): 홈 → 라이브러리 → 상세 → 실행 화면 각 요소가 뷰포트 안에 있는지 확인
async function checkExerciseFlow(page, label) {
  await page.locator('.tabbar .tab', { hasText: '운동' }).click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.exo').first(), `${label} 운동홈 오늘의루틴카드`)
  await elementWithinViewport(page, page.locator('.tabbar'), `${label} 운동홈 탭바`)

  await page.getByText('+ 운동 찾아보기').click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.exitem').first(), `${label} 라이브러리 첫항목`)

  await page.locator('.exitem').first().click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.detail-anim'), `${label} 상세 애니메이션`)
  await elementWithinViewport(page, page.locator('.mistakebox'), `${label} 상세 주의사항박스`)
  await elementWithinViewport(page, page.locator('.diffbtns'), `${label} 상세 난이도버튼`)

  await page.getByText('이 운동 바로 하기').click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.timerbig'), `${label} 실행 타이머`)
  await elementWithinViewport(page, page.locator('.counter'), `${label} 실행 세트카운터`)
  console.log(`[PASS] ${label}: 운동 홈/라이브러리/상세/실행 화면 전부 뷰포트 안에서 보임`)

  await page.reload()
  await page.waitForSelector('.tabbar.show')
}

// 3단계(식단 편성): 식단 탭의 오늘/주간/월간 서브탭과 주간 편성의 시트(끼니 교체·장보기)가
// 뷰포트 안에 있는지 확인한다. 주간 화면은 카드가 많아 스크롤이 필요한데, 시트는 그
// 스크롤 오프셋에 영향받지 않고 항상 화면 하단에 고정돼야 한다(실측으로 잡은 버그 —
// .screen 밖으로 시트를 옮겨 고쳤다).
async function checkMealPlanFlow(page, label) {
  await page.locator('.tabbar .tab', { hasText: '식단' }).click()
  await page.waitForTimeout(800)

  await page.locator('.chip', { hasText: '주간' }).click()
  await page.waitForTimeout(800)
  await elementWithinViewport(page, page.locator('.btn', { hasText: '자동으로 짜기' }), `${label} 주간 자동편성버튼`)

  await page.getByText('🪄 자동으로 짜기').click()
  await page.waitForTimeout(800)
  await elementWithinViewport(page, page.locator('.wd-mealrow').first(), `${label} 주간 첫끼니행`)
  // .phone은 body(flex)의 flex item이라 min-width:0이 없으면 긴 조합 텍스트가 내용
  // 기준 최소폭을 밀어올려 화면 밖으로 넘친다(실측으로 잡은 버그) — 폭 자체가
  // 뷰포트 안에 있는지 여기서 같이 확인한다.
  await elementWithinViewport(page, page.locator('.phone'), `${label} 주간 편성 후 .phone 폭`)

  // 목록을 끝까지 스크롤한 뒤 마지막 끼니 행을 눌러 시트를 연다 — 스크롤된 상태에서도
  // 시트가 뷰포트 안에 있어야 한다(실측으로 잡은 버그 — .screen 밖으로 시트를 옮겨 고쳤다).
  const lastRow = page.locator('.wd-mealrow').last()
  await lastRow.scrollIntoViewIfNeeded()
  await lastRow.click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.sheet.open').first(), `${label} 주간 끼니교체시트(스크롤 후)`)
  await elementWithinViewport(page, page.locator('.swap-panel').first(), `${label} 주간 대안목록`)
  await page.locator('.sheet-bg').first().click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(300)

  const groceryBtn = page.getByText('🛒 장보기 목록 보기')
  await groceryBtn.scrollIntoViewIfNeeded()
  await groceryBtn.click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.sheet.open').first(), `${label} 주간 장보기시트(스크롤 후)`)
  await page.locator('.sheet-bg').first().click({ position: { x: 10, y: 10 } })
  await page.waitForTimeout(300)

  await page.locator('.chip', { hasText: '월간' }).click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.monthgrid').last(), `${label} 월간 달력`)

  await page.locator('.chip', { hasText: '오늘' }).click()
  await page.waitForTimeout(300)
  await elementWithinViewport(page, page.locator('.card').first(), `${label} 오늘 첫끼니카드(계획 미리보기)`)
  console.log(`[PASS] ${label}: 식단 오늘/주간/월간 + 끼니교체·장보기 시트 전부 뷰포트 안에서 보임`)

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
      await checkExerciseFlow(page, '모바일 390x844')
      await checkMealPlanFlow(page, '모바일 390x844')
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
      await checkExerciseFlow(page, '데스크톱 1280x950')
      await checkMealPlanFlow(page, '데스크톱 1280x950')
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
