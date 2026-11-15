import { afterEach, describe, expect, it } from 'vitest'
import { contrastRatio, type Rgb } from '../../domain/color'
import { mountAt } from '../../testUtils/browserFit'
import ToolPill from './ToolPill.vue'

// The tool that is on and the grip can be seen (ticket 0926, UX-007 and UX-009; ToolPill card): a pressed tile, Mirror and
// Paste included, carries an inset `ink` outline (2px in High contrast) that stands 3:1 off the pill, its lit icon stands
// 3:1 on its tile, and the grip bar, drawn in `muted`, stands 3:1 off the pill. WCAG 1.4.1 and 1.4.11.
const THEMES = ['light', 'dark', 'contrast'] as const
/** WCAG 1.4.11: a control's visible part against what is beside it. */
const NON_TEXT_CONTRAST = 3
const OUTLINE_WIDTH = { light: '1.5px', dark: '1.5px', contrast: '2px' }

const props = { activeTool: 'paint', position: 'bottom', recentsInPill: [], popoverOpen: false, hasClipboard: true, pasteArmed: true, mirrorOn: true, colorHex: '#e63746', colorName: 'Red' }

afterEach(() => {
  delete document.documentElement.dataset.theme
})

/** The first color in a computed value, `rgb()` or `rgba()`, as 0–255 channels; alpha is dropped, as the pill, its tiles
 * and the colors measured here are opaque in every theme. */
function rgb(css: string): Rgb {
  const [r = 0, g = 0, b = 0] = (css.match(/rgba?\(([^)]*)\)/)?.[1] ?? '').split(',').map(Number)
  return { r, g, b }
}

async function mountIn(theme: (typeof THEMES)[number]) {
  document.documentElement.dataset.theme = theme
  const { root } = await mountAt(ToolPill, props, { locale: 'en', width: 1280, text: false })
  const get = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  return { get, pill: rgb(getComputedStyle(get('tool-pill')).backgroundColor) }
}

describe.each(THEMES)('the Tool pill in %s', (theme) => {
  it.each(['pill-tool-paint', 'pill-tool-mirror', 'pill-tool-paste'])('outlines the pressed tile %s, 3:1 off the pill, its icon 3:1 on the tile', async (id) => {
    const { get, pill } = await mountIn(theme)
    const tile = getComputedStyle(get(id))
    expect(get(id).getAttribute('aria-pressed')).toBe('true')
    expect(tile.boxShadow).toMatch(new RegExp(`^rgb\\([^)]*\\) 0px 0px 0px ${OUTLINE_WIDTH[theme]} inset$`))
    expect(contrastRatio(rgb(tile.boxShadow), pill), 'outline on the pill').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
    expect(contrastRatio(rgb(tile.color), rgb(tile.backgroundColor)), 'lit icon on its tile').toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
  })

  it('leaves an idle tile without the outline', async () => {
    const { get } = await mountIn(theme)
    expect(getComputedStyle(get('pill-tool-fill')).boxShadow).toBe('none')
  })

  it('draws the grip bar 3:1 off the pill', async () => {
    const { get, pill } = await mountIn(theme)
    const bar = get('tool-pill-grip').querySelector('.tool-pill__grip-bar')!
    expect(contrastRatio(rgb(getComputedStyle(bar).backgroundColor), pill)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
  })
})
