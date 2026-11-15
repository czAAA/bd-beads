import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { contrastRatio, type Rgb } from '../../domain/color'
import { mountAt } from '../../testUtils/browserFit'
import AppButton from './AppButton.vue'
import AppSwatch from './AppSwatch.vue'
import AppSwitch from './AppSwitch.vue'

// The focus ring shows on accent and danger fills and on swatches (ticket 0938, UX-021; KeyboardFocus card): on a primary
// button, an on switch and the danger button it takes the fill's label color, 3:1 off the fill; a swatch's ring is
// two-tone, `focus-ring` round a `surface` band, one of the two 3:1 off any fill and 3:1 off each other. WCAG 1.4.11.
const THEMES = ['light', 'dark', 'contrast'] as const
const NON_TEXT_CONTRAST = 3
const SWATCHES = ['#000000', '#ffffff', '#faff69', '#fa520f', '#808080']

const Controls = defineComponent(() => () =>
  h('div', [
    h(AppButton, { variant: 'primary', 'data-testid': 'primary' }, () => 'Row done'),
    h(AppButton, { variant: 'primary', disabled: true, 'data-testid': 'primary-disabled' }, () => 'Send'),
    h(AppButton, { variant: 'danger', 'data-testid': 'danger' }, () => 'Delete'),
    h(AppSwitch, { modelValue: true, label: 'Row highlight', 'data-testid': 'switch' }),
    ...SWATCHES.map((color) => h(AppSwatch, { color, label: color, 'data-testid': `swatch-${color}` })),
    h(AppSwatch, { color: '#000000', label: 'chosen', selected: true, 'data-testid': 'swatch-selected' }),
  ]),
)

afterEach(() => {
  delete document.documentElement.dataset.theme
})

/** The first color in a computed value, `rgb()` or `rgba()`, as 0–255 channels; the colors measured here are opaque. */
function rgb(css: string): Rgb {
  const [r = 0, g = 0, b = 0] = (css.match(/rgba?\(([^)]*)\)/)?.[1] ?? '').split(',').map(Number)
  return { r, g, b }
}

/** Mounts every control once in the theme; `focus(id)` focuses one from the keyboard and returns its computed style. */
async function mountIn(theme: (typeof THEMES)[number]) {
  document.documentElement.dataset.theme = theme
  const { root } = await mountAt(Controls, {}, { locale: 'en', width: 1280 })
  return (id: string) => {
    const el = root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
    el.focus()
    expect(el.matches(':focus-visible')).toBe(true)
    return getComputedStyle(el)
  }
}

describe.each(THEMES)('the focus ring in %s', (theme) => {
  it('stands 3:1 off the fill of a primary button, a disabled one, the danger button and an on switch', async () => {
    const focus = await mountIn(theme)
    for (const id of ['primary', 'primary-disabled', 'danger', 'switch']) {
      const style = focus(id)
      expect(style.outlineStyle, id).toBe('solid')
      expect(contrastRatio(rgb(style.outlineColor), rgb(style.backgroundColor)), id).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
    }
  })

  it('is two-tone on a swatch, the ring 3:1 off its band and one of the two 3:1 off any fill', async () => {
    const focus = await mountIn(theme)
    for (const id of [...SWATCHES.map((color) => `swatch-${color}`), 'swatch-selected']) {
      const style = focus(id)
      const [ring, band, fill] = [rgb(style.outlineColor), rgb(style.boxShadow), rgb(style.backgroundColor)]
      expect(contrastRatio(ring, band), `${id}: ring on its band`).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
      const onFill = Math.max(contrastRatio(ring, fill), contrastRatio(band, fill))
      expect(onFill, `${id}: ring or band on the fill`).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
    }
  })

  it('keeps the selected ring outside a focused chosen swatch', async () => {
    const focus = await mountIn(theme)
    expect(focus('swatch-selected').boxShadow.match(/rgba?\(/g)).toHaveLength(3)
  })
})
