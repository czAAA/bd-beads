import type { Page } from '@playwright/test'

// What the perf checks that drive a two-finger gesture share (tickets 1187, 1235): a frame-gap watcher and two touches on the surface.

export const MOVES = 60
/** An iPad reports a touch about this often. */
const MOVE_EVERY_MS = 16

interface Watch {
  stamps: number[]
  running: boolean
}

export async function watchFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const watch = { stamps: [performance.now()], running: true }
    ;(window as unknown as { __watch: typeof watch }).__watch = watch
    const tick = (now: number) => {
      watch.stamps.push(now)
      if (watch.running) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

export async function frames(page: Page): Promise<{ frames: number; longest: number; mean: number; over33: number }> {
  return page.evaluate(() => {
    const watch = (window as unknown as { __watch: Watch }).__watch
    watch.running = false
    const stamps = [...watch.stamps, performance.now()]
    const gaps = stamps.slice(1).map((stamp, index) => stamp - stamps[index]!)
    return { frames: gaps.length, longest: Math.max(...gaps), mean: gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length, over33: gaps.filter((gap) => gap > 33).length }
  })
}

/** Two touches on the surface, moved together: each step gives both fingers' points in client px. */
export async function twoFingers(page: Page, path: (step: number) => [{ x: number; y: number }, { x: number; y: number }]): Promise<void> {
  const fire = (type: string, id: number, point: { x: number; y: number }) =>
    page.evaluate(
      ({ type, id, point }) => {
        const surface = document.querySelector('[data-testid="project-surface"]')!
        surface.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }))
      },
      { type, id, point },
    )
  const [a, b] = path(0)
  await fire('pointerdown', 1, a)
  await fire('pointerdown', 2, b)
  for (let step = 1; step <= MOVES; step += 1) {
    const [p, q] = path(step)
    await fire('pointermove', 1, p)
    await fire('pointermove', 2, q)
    await page.waitForTimeout(MOVE_EVERY_MS)
  }
  const [p, q] = path(MOVES)
  await fire('pointerup', 1, p)
  await fire('pointerup', 2, q)
}

