import { describe, expect, it } from 'vitest'
import { keyMove, keyScroll } from './sectionKeys'

describe('the keys that turn the Homepage (ticket 0801)', () => {
  it('steps with the arrows and pages with Page Up, Page Down and Space, Shift+Space up', () => {
    expect(keyMove({ key: 'ArrowDown', shiftKey: false })).toEqual({ way: 1, by: 'step' })
    expect(keyMove({ key: 'ArrowUp', shiftKey: false })).toEqual({ way: -1, by: 'step' })
    expect(keyMove({ key: 'PageDown', shiftKey: false })).toEqual({ way: 1, by: 'page' })
    expect(keyMove({ key: 'PageUp', shiftKey: false })).toEqual({ way: -1, by: 'page' })
    expect(keyMove({ key: ' ', shiftKey: false })).toEqual({ way: 1, by: 'page' })
    expect(keyMove({ key: ' ', shiftKey: true })).toEqual({ way: -1, by: 'page' })
  })

  it('goes to the first section with Home and the last with End, and leaves every other key alone', () => {
    expect(keyMove({ key: 'Home', shiftKey: false })).toEqual({ to: 'first' })
    expect(keyMove({ key: 'End', shiftKey: false })).toEqual({ to: 'last' })
    expect(keyMove({ key: 'a', shiftKey: false })).toBeUndefined()
    expect(keyMove({ key: 'ArrowLeft', shiftKey: false })).toBeUndefined()
  })

  it('scrolls a tall section 40px a step and most of its room a page', () => {
    expect(keyScroll('step', 500)).toBe(40)
    expect(keyScroll('page', 500)).toBe(425)
  })
})
