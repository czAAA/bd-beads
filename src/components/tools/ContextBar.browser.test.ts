import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { BEAD_CATALOG } from '../../domain/beads'
import { contrastRatio, mix, type Rgb } from '../../domain/color'
import { createProject } from '../../domain/createProject'
import { MIRROR_OFF, type MirrorSetting } from '../../domain/mirror'
import { mountAt } from '../../testUtils/browserFit'
import { paintAt } from '../../testUtils/layers'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import ContextBar from './ContextBar.vue'

// The Selection bar's and the Mirror bar's controls share one set of states (ticket 0753): hovered, pressed or "on", the
// icon or text stays readable on its fill. Measured in the page, where the shared icon button's own hover fill competes.

const empty = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!.id, name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } })
/** With a bead in it, so Copy and Fill are enabled. */
const project = paintAt(empty, [{ row: 0, column: 0 }], '#c0392b')
/** WCAG's contrast for text. */
const READABLE_CONTRAST = 4.5
const anchor = { box: { left: 40, top: 160, width: 100, height: 60 }, viewport: { width: 640, height: 640 } }
const setting: MirrorSetting = { ...MIRROR_OFF, axes: { leftRight: true, topBottom: false, radial: false }, place: { layer: 'canvas', area: { row: 0, column: 0, rows: 10, columns: 12 } } }
const mirrorProps = { project, pasteArmed: false, canRemoveLine: false, mirror: { setting, summary: '12×10', rect: { row: 0, column: 0, rows: 10, columns: 12 } }, mirrorAnchor: anchor }
const selectionProps = { project, pasteArmed: false, canRemoveLine: false, selectionSummary: '2×2', selection: { top: 0, left: 0, rows: 2, columns: 2 }, anchor }

/** A computed color, `rgb()`, `rgba()` or `color(srgb …)`, as 0–255 channels and an alpha. */
function parse(css: string): { rgb: Rgb; alpha: number } {
  const [r = 0, g = 0, b = 0, alpha = 1] = (css.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number)
  const scale = css.startsWith('color(') ? 255 : 1
  return { rgb: { r: r * scale, g: g * scale, b: b * scale }, alpha }
}

const over = (top: { rgb: Rgb; alpha: number }, base: Rgb) => mix(base, top.rgb, top.alpha)

/** The contrast between a control's text and its fill, laid over the bar's. */
function readability(control: Element, bar: Element): number {
  const style = getComputedStyle(control)
  const fill = over(parse(style.backgroundColor), parse(getComputedStyle(bar).backgroundColor).rgb)
  return contrastRatio(over(parse(style.color), fill), fill)
}

type BarProps = InstanceType<typeof ContextBar>['$props']

/** Mounts a bar and waits out the Selection bar's arming delay (ticket 499), while its buttons show disabled. */
async function mountBar(props: BarProps) {
  const mounted = await mountAt(ContextBar, props as unknown as Record<string, unknown>, { locale: 'en', width: 800 })
  if (props.selectionSummary) await vi.waitFor(() => expect(mounted.root.querySelector('[data-testid="context-bar-copy"]')?.getAttribute('aria-disabled')).toBeNull())
  return mounted
}

async function readable(props: BarProps, selectors: string[]) {
  const { root } = await mountBar(props)
  const bar = root.querySelector('.context-bar')!
  for (const selector of selectors) {
    const control = root.querySelector(selector)!
    expect(control, selector).not.toBeNull()
    expect(readability(control, bar), `${selector} at rest`).toBeGreaterThan(READABLE_CONTRAST)
    await userEvent.hover(control)
    await settleForMeasuring()
    expect(readability(control, bar), `${selector} hovered`).toBeGreaterThan(READABLE_CONTRAST)
    await userEvent.unhover(control)
  }
}

/** A hovered control's fill, once the bar is mounted. */
async function hoveredFill(root: HTMLElement, selector: string) {
  const control = root.querySelector(selector)!
  await userEvent.hover(control)
  await settleForMeasuring()
  const background = getComputedStyle(control).backgroundColor
  await userEvent.unhover(control)
  return background
}

describe('ContextBar states', () => {
  it('keeps every Mirror bar control readable at rest and on hover, the chips that are on and the chosen Mode included', async () => {
    await readable(mirrorProps, [
      '[data-testid="mirror-bar-mode-mirror"]',
      '[data-testid="mirror-bar-mode-repeat"]',
      '[data-testid="mirror-bar-axis-leftRight"]',
      '[data-testid="mirror-bar-axis-topBottom"]',
      '[data-testid="mirror-bar-leftRight-more"]',
      '[data-testid="mirror-bar-close"]',
    ])
  })

  it('keeps the Selection bar buttons readable on hover', async () => {
    await readable(selectionProps, ['[data-testid="context-bar-copy"]', '[data-testid="context-bar-fill"]'])
  })

  it('fades a hovered Mirror control the way a Selection button fades', async () => {
    const copy = await mountBar(selectionProps)
    const fade = await hoveredFill(copy.root, '[data-testid="context-bar-copy"]')
    copy.unmount()
    const { root } = await mountBar(mirrorProps)
    for (const testid of ['mirror-bar-close', 'mirror-bar-mode-repeat', 'mirror-bar-axis-topBottom']) {
      expect(await hoveredFill(root, `[data-testid="${testid}"]`), testid).toBe(fade)
    }
  })
})
