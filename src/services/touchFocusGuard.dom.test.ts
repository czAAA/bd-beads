import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installTouchFocusGuard } from './touchFocusGuard'

function stubPointer(coarse: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: coarse && query === '(pointer: coarse)' }))
}

describe('installTouchFocusGuard', () => {
  let uninstall: () => void
  let input: HTMLInputElement
  let button: HTMLButtonElement

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    input = document.body.appendChild(document.createElement('input'))
    button = document.body.appendChild(document.createElement('button'))
    uninstall = installTouchFocusGuard()
  })

  afterEach(() => {
    uninstall()
    document.body.replaceChildren()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('ignores a programmatic focus of a text field on touch that follows no tap', () => {
    stubPointer(true)
    input.focus()
    expect(document.activeElement).not.toBe(input)
  })

  it('ignores a textarea and a contenteditable too', () => {
    stubPointer(true)
    const area = document.body.appendChild(document.createElement('textarea'))
    const editable = document.body.appendChild(document.createElement('div'))
    editable.setAttribute('contenteditable', 'true')
    editable.tabIndex = 0
    area.focus()
    editable.focus()
    expect(document.activeElement).toBe(document.body)
  })

  it('focuses a text field on touch right after a tap, and not once the tap is old', () => {
    stubPointer(true)
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    input.focus()
    expect(document.activeElement).toBe(input)

    input.blur()
    vi.advanceTimersByTime(2000)
    input.focus()
    expect(document.activeElement).not.toBe(input)
  })

  it('leaves a mouse device alone', () => {
    stubPointer(false)
    input.focus()
    expect(document.activeElement).toBe(input)
  })

  it('leaves a button and a checkbox alone on touch', () => {
    stubPointer(true)
    const box = document.body.appendChild(document.createElement('input'))
    box.type = 'checkbox'
    button.focus()
    expect(document.activeElement).toBe(button)
    box.focus()
    expect(document.activeElement).toBe(box)
  })

  it('stops guarding once taken off', () => {
    stubPointer(true)
    uninstall()
    input.focus()
    expect(document.activeElement).toBe(input)
    uninstall = installTouchFocusGuard()
  })
})
