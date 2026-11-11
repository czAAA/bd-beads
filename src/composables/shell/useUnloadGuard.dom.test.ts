import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { useUnloadGuard } from './useUnloadGuard'

/** A reload or closing the tab, as the browser starts it: true when the page asked first. */
function unload(): boolean {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('useUnloadGuard', () => {
  let scope = effectScope()
  beforeEach(() => void (scope = effectScope()))
  afterEach(() => scope.stop())

  it('lets the page go at once while no reason says something would be lost', () => {
    const guard = scope.run(() => useUnloadGuard())!
    expect(unload()).toBe(false)
    guard.askWhile(() => false)
    expect(unload()).toBe(false)
  })

  it('asks while any reason says so, and no more once that reason is taken back', () => {
    const guard = scope.run(() => useUnloadGuard())!
    let setUp = true
    guard.askWhile(() => false)
    const forget = guard.askWhile(() => setUp)
    expect(unload()).toBe(true)
    setUp = false
    expect(unload()).toBe(false)
    setUp = true
    forget()
    expect(unload()).toBe(false)
  })

  it('stops listening when its shell goes', () => {
    const own = effectScope()
    own.run(() => useUnloadGuard())!.askWhile(() => true)
    own.stop()
    expect(unload()).toBe(false)
  })
})
