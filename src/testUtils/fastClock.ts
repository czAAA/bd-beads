import type {} from '@vitest/browser-playwright'
import { cdp } from 'vitest/browser'

// The page's whole clock run faster, for a test that plays minutes of motion (the whole tour, ticket 1143). Timers,
// `performance.now`, `Date.now`, the frames' stamps and CSS animations move together: one left at its own pace falls out
// of step (a panel still sliding when the hand's wait for it is over). Vitest took its timers earlier and keeps real time.

/** Runs the page's clock `rate` times faster until the function it gives back is called. */
export async function runClockFaster(rate: number): Promise<() => Promise<void>> {
  const real = {
    setTimeout: window.setTimeout,
    setInterval: window.setInterval,
    requestAnimationFrame: window.requestAnimationFrame,
    now: performance.now,
    dateNow: Date.now,
  }
  const realNow = () => real.now.call(performance)
  const started = realNow()
  const startedDate = real.dateNow()

  /** A timer's own function, its wait cut by `rate`. */
  const sooner = (timer: (...all: never[]) => unknown) => (handler: TimerHandler, ms = 0, ...rest: unknown[]) => Reflect.apply(timer, window, [handler, ms / rate, ...rest])
  window.setTimeout = sooner(real.setTimeout) as typeof window.setTimeout
  window.setInterval = sooner(real.setInterval) as typeof window.setInterval
  performance.now = () => started + (realNow() - started) * rate
  Date.now = () => Math.floor(startedDate + (real.dateNow() - startedDate) * rate)
  window.requestAnimationFrame = (callback) => real.requestAnimationFrame.call(window, (stamp) => callback(started + (stamp - started) * rate))
  await cdp().send('Animation.enable')
  await cdp().send('Animation.setPlaybackRate', { playbackRate: rate })

  return async () => {
    window.setTimeout = real.setTimeout
    window.setInterval = real.setInterval
    performance.now = real.now
    Date.now = real.dateNow
    window.requestAnimationFrame = real.requestAnimationFrame
    await cdp().send('Animation.setPlaybackRate', { playbackRate: 1 })
    await cdp().send('Animation.disable')
  }
}
