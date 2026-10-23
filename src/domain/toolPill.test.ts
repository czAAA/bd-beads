import { describe, expect, it } from 'vitest'
import { nearestPillEdge, pillPositionForKey, popoverPlacement, pushRecentColor, recentsBeside } from './toolPill'

describe('pushRecentColor (ticket 439)', () => {
  it('puts a colour at the front, moves a repeat to the front and keeps eight', () => {
    expect(pushRecentColor(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111'])
    const full = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#000008']
    expect(pushRecentColor(full, '#ffffff')).toEqual(['#ffffff', ...full.slice(0, 7)])
  })

  it('keeps colours as lowercase #rrggbb and ignores anything else', () => {
    expect(pushRecentColor([], '#ABCDEF')).toEqual(['#abcdef'])
    expect(pushRecentColor(['#111111'], 'red')).toEqual(['#111111'])
  })
})

describe('recentsBeside', () => {
  it('lists the colours used before the chosen one, at most `count`', () => {
    const recents = ['#111111', '#222222', '#333333', '#444444', '#555555']
    expect(recentsBeside(recents, '#111111', 3)).toEqual(['#222222', '#333333', '#444444'])
    expect(recentsBeside(recents, null, 2)).toEqual(['#111111', '#222222'])
  })
})

describe('nearestPillEdge', () => {
  const area = { left: 10, top: 20, width: 400, height: 300 }

  it('is the edge of the drawing area closest to the pointer', () => {
    expect(nearestPillEdge({ x: 20, y: 150 }, area)).toBe('left')
    expect(nearestPillEdge({ x: 400, y: 150 }, area)).toBe('right')
    expect(nearestPillEdge({ x: 200, y: 30 }, area)).toBe('top')
    expect(nearestPillEdge({ x: 200, y: 310 }, area)).toBe('bottom')
  })
})

describe('pillPositionForKey', () => {
  it('maps the arrow keys to their edge and nothing else', () => {
    expect(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Enter'].map(pillPositionForKey)).toEqual(['left', 'top', 'right', 'bottom', undefined])
  })
})

describe('popoverPlacement', () => {
  const screen = { width: 800, height: 600 }
  const size = { width: 288, height: 400 }

  it('sits above a bottom pill, centred on the tile, pill-gap away', () => {
    const pill = { left: 300, top: 540, width: 200, height: 48 }
    const tile = { left: 400, top: 544, width: 40, height: 40 }
    expect(popoverPlacement(tile, pill, size, 'bottom', screen, 6, 6)).toEqual({ left: 420 - 144, top: 540 - 6 - 400 })
  })

  it('sits beside a side pill, toward the canvas', () => {
    const left = { left: 6, top: 200, width: 48, height: 200 }
    const tile = { left: 10, top: 300, width: 40, height: 40 }
    expect(popoverPlacement(tile, left, size, 'left', screen, 6, 6).left).toBe(60)
    const right = { left: 746, top: 200, width: 48, height: 200 }
    expect(popoverPlacement(tile, right, size, 'right', screen, 6, 6).left).toBe(746 - 6 - 288)
  })

  it('is clamped float-edge inside the screen along the pill', () => {
    const pill = { left: 0, top: 540, width: 100, height: 48 }
    const tile = { left: 0, top: 544, width: 40, height: 40 }
    expect(popoverPlacement(tile, pill, size, 'bottom', screen, 6, 6).left).toBe(6)
    expect(popoverPlacement({ ...tile, left: 790 }, pill, size, 'top', screen, 6, 6).left).toBe(800 - 288 - 6)
  })

  it('stays inside the screen across the pill when the popover grows tall (Custom color picker open)', () => {
    const tall = { width: 288, height: 580 }
    const bottom = { left: 300, top: 540, width: 200, height: 48 }
    const tile = { left: 400, top: 544, width: 40, height: 40 }
    expect(popoverPlacement(tile, bottom, tall, 'bottom', screen, 6, 6).top).toBe(6)
    const top = { left: 300, top: 6, width: 200, height: 48 }
    expect(popoverPlacement({ ...tile, top: 10 }, top, tall, 'top', screen, 6, 6).top).toBe(600 - 580 - 6)
  })
})
