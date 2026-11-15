import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cdp } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { contrastRatio, type Rgb } from '../../domain/color'
import { mountAt } from '../../testUtils/browserFit'
import AppSwitch from './AppSwitch.vue'

// Windows high contrast (ticket 0990, UX-074; accessibility card, "outlines and borders stay"): the system's colors
// replace the switch's fills, so without its own rule its track and knob both went Canvas and it vanished. Under
// forced colors the track has a ButtonText border, the knob is the system's text color, and an on track is Highlight.
const NON_TEXT_CONTRAST = 3

const Switches = defineComponent(() => () =>
  h('div', [
    h('span', 'Row highlight'),
    h(AppSwitch, { modelValue: false, label: 'Off', 'data-testid': 'off' }),
    h(AppSwitch, { modelValue: true, label: 'On', 'data-testid': 'on' }),
    h('span', { 'data-testid': 'highlight', style: 'forced-color-adjust: none; background: Highlight' }),
  ]),
)

beforeAll(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
})

afterAll(async () => {
  await cdp().send('Emulation.setEmulatedMedia', { features: [] })
})

afterEach(() => {
  delete document.documentElement.dataset.theme
})

function rgb(css: string): Rgb {
  const [r = 0, g = 0, b = 0] = (css.match(/rgba?\(([^)]*)\)/)?.[1] ?? '').split(',').map(Number)
  return { r, g, b }
}

describe.each(['light', 'dark'])('a switch under forced colors, the app in %s', (theme) => {
  it('is drawn: a bordered track and a knob that stands off it, on and off; the on track is Highlight', async () => {
    expect(matchMedia('(forced-colors: active)').matches).toBe(true)
    document.documentElement.dataset.theme = theme
    const { root } = await mountAt(Switches, {}, { locale: 'en', width: 1280 })
    const page = rgb(getComputedStyle(document.body).backgroundColor)
    const highlight = getComputedStyle(root.querySelector('[data-testid="highlight"]')!).backgroundColor
    for (const id of ['off', 'on']) {
      const track = root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
      const trackStyle = getComputedStyle(track)
      const knob = rgb(getComputedStyle(track.querySelector('.app-switch__knob')!).backgroundColor)
      expect(parseFloat(trackStyle.borderTopWidth), `${id}: track border`).toBeGreaterThanOrEqual(1)
      expect(trackStyle.borderTopStyle, id).toBe('solid')
      expect(contrastRatio(rgb(trackStyle.borderTopColor), page), `${id}: border on the page`).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
      expect(contrastRatio(knob, rgb(trackStyle.backgroundColor)), `${id}: knob on the track`).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
    }
    const on = root.querySelector<HTMLElement>('[data-testid="on"]')!
    expect(getComputedStyle(on).backgroundColor).toBe(highlight)
  })
})
