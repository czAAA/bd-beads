import { afterEach, describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import ToolPill from './ToolPill.vue'

// A tile's hotkey digit sits in a notch on the tile's top-right corner (ToolPill card): a round patch of the pill's own
// fill, centred where a pressed tile's outline turns, so the outline stops short of the digit and never runs against it.
// The notch is drawn only: it adds nothing to what the pill's tools scroll, at any edge the pill is docked to.
const THEMES = ['light', 'dark', 'contrast'] as const
const POSITIONS = ['bottom', 'top', 'left', 'right'] as const
/** The card's sizes: a notch 14px across on a 40px tile. */
const NOTCH_OF_TILE = 14 / 40
/** The digits of Paint to Paste, each in its tile. */
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8']

const props = { activeTool: 'paint', position: 'bottom', recentsInPill: [], popoverOpen: false, hasClipboard: true, pasteArmed: true, mirrorOn: true, colorHex: '#e63746', colorName: 'Red' }

afterEach(() => {
  delete document.documentElement.dataset.theme
})

/** A digit's notch as drawn: the chip's round box and the ring of the same fill round it. */
function notchOf(chip: HTMLElement) {
  const box = chip.getBoundingClientRect()
  const style = getComputedStyle(chip)
  const [ringColor = '', ring = '0'] = style.boxShadow.match(/^(rgba?\([^)]*\)) 0px 0px 0px ([\d.]+)px$/)?.slice(1) ?? []
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    across: box.width + 2 * Number(ring),
    round: box.width === box.height && parseFloat(style.borderTopRightRadius) >= box.width / 2,
    fills: [style.backgroundColor, ringColor],
    box,
  }
}

/** Where a tile's edge turns its top-right corner: the middle of the corner's arc. */
function cornerTurn(tile: HTMLElement) {
  const box = tile.getBoundingClientRect()
  const inset = parseFloat(getComputedStyle(tile).borderTopRightRadius) * (1 - Math.SQRT1_2)
  return { x: box.right - inset, y: box.top + inset }
}

/** The digits drawn on tiles; a tile's Tooltip holds its key too, as text. */
const chips = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-testid="tool-pill"] button > kbd')]

describe.each(THEMES)('the hotkey digits of the Tool pill in %s', (theme) => {
  it('sit each in a round notch of the pill\'s fill, centred on the turn of the tile\'s top-right corner', async () => {
    document.documentElement.dataset.theme = theme
    const { root } = await mountAt(ToolPill, props, { locale: 'en', width: 1280, text: false })
    const pillFill = getComputedStyle(root.querySelector('[data-testid="tool-pill"]')!).backgroundColor
    expect(chips(root).map((chip) => chip.dataset.key)).toEqual(DIGITS)
    for (const chip of chips(root)) {
      const notch = notchOf(chip)
      const tile = chip.closest('button')!
      const turn = cornerTurn(tile)
      const key = `digit ${chip.dataset.key}`
      expect(notch.round, `${key} round`).toBe(true)
      expect(notch.fills, `${key} fill`).toEqual([pillFill, pillFill])
      expect(Math.hypot(notch.x - turn.x, notch.y - turn.y), `${key} off the corner's turn`).toBeLessThan(1)
      expect(notch.across / tile.getBoundingClientRect().width, `${key} notch across, of its tile`).toBeCloseTo(NOTCH_OF_TILE, 2)
    }
  })
})

describe.each(POSITIONS)('the hotkey digits of the Tool pill docked to the %s', (position) => {
  it('keep inside their tiles, so the tools neither scroll nor fade for them', async () => {
    const { root } = await mountAt(ToolPill, { ...props, position }, { locale: 'en', width: 1280, text: false })
    for (const chip of chips(root)) {
      const { box } = notchOf(chip)
      const tile = chip.closest('button')!.getBoundingClientRect()
      const inside = box.left >= tile.left && box.right <= tile.right && box.top >= tile.top && box.bottom <= tile.bottom
      expect(inside, `digit ${chip.dataset.key} inside its tile`).toBe(true)
    }
    const tools = root.querySelector<HTMLElement>('[data-testid="tool-pill-tools"]')!
    expect(tools.scrollWidth - tools.clientWidth, 'scrolls across').toBeLessThanOrEqual(1)
    expect(tools.scrollHeight - tools.clientHeight, 'scrolls down').toBeLessThanOrEqual(1)
    expect(getComputedStyle(tools).maskImage, 'faded').toBe('none')
  })
})
