import type { CDPSession, Page } from '@playwright/test'

// What the hand-run performance check (ticket 103, ADR 0018) measures with: the CPU slowdown, the main thread's own
// clocks over the DevTools protocol, a frame counter, and the long animation frames Chromium reports (ticket 0673).

/** Slows the page's CPU this many times and turns on the main-thread clocks `metricMs` reads. */
export async function throttle(page: Page, slowdown: number): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown })
  await cdp.send('Performance.enable')
  return cdp
}

/** A main-thread clock so far, in ms: `TaskDuration` is every task's time, `ScriptDuration` JavaScript's alone. */
export async function metricMs(cdp: CDPSession, name: 'TaskDuration' | 'ScriptDuration'): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return (metrics.find((metric) => metric.name === name)?.value ?? 0) * 1000
}

/** The main thread's busy time so far, in ms. */
export function busyMs(cdp: CDPSession): Promise<number> {
  return metricMs(cdp, 'TaskDuration')
}

/** Counts frames in the page until stopped. */
export async function startFrameCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counter = { frames: 0, running: true }
    ;(window as unknown as { __frames: typeof counter }).__frames = counter
    const tick = () => {
      counter.frames += 1
      if (counter.running) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
}

/** Stops the frame counter and says how many frames it saw. */
export async function stopFrameCounter(page: Page): Promise<number> {
  return page.evaluate(() => {
    const counter = (window as unknown as { __frames: { frames: number; running: boolean } }).__frames
    counter.running = false
    return counter.frames
  })
}

/** One script a long animation frame ran, as Chromium attributes it. */
interface FrameScript {
  invoker: string
  sourceFunctionName: string
  duration: number
}

/** A frame whose rendering update was held up past 50 ms (the Long Animation Frames API, Chromium only). */
export interface LongFrame {
  startTime: number
  duration: number
  blockingDuration: number
  scripts: FrameScript[]
}

/** Records every long animation frame from the page's first load on; call before the page is opened. Where the API
 * is missing (not Chromium) nothing is recorded and `longFramesSince` says so. */
export async function watchLongFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) return
    const frames: unknown[] = []
    ;(window as unknown as { __longFrames?: unknown[] }).__longFrames = frames
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) frames.push(entry.toJSON())
    }).observe({ type: 'long-animation-frame', buffered: true })
  })
}

/** The page's own clock, to mark where a measured stretch begins. */
export function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => performance.now())
}

/** The long animation frames still running at `since` (the page's clock) or begun after it: the mark is taken inside a
 * frame, which the measured input often joins. Read once two more frames have gone by, so the last one is reported;
 * undefined where the API is missing. */
export async function longFramesSince(page: Page, since: number): Promise<LongFrame[] | undefined> {
  return page.evaluate(async (from) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))))
    const frames = (window as unknown as { __longFrames?: LongFrame[] }).__longFrames
    return frames?.filter((frame) => frame.startTime + frame.duration > from)
  }, since)
}

/** The two scripts that took the most of the long frames' time, totalled by what ran them: "where the time went". */
export function attribution(frames: LongFrame[]): string {
  const totals = new Map<string, number>()
  for (const script of frames.flatMap((frame) => frame.scripts)) {
    const name = [script.invoker, script.sourceFunctionName].filter(Boolean).join(' ') || 'unattributed'
    totals.set(name, (totals.get(name) ?? 0) + script.duration)
  }
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name, ms]) => `${name} ${Math.round(ms)} ms`)
    .join(', ')
}
