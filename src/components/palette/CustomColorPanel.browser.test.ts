import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountAt, unmountAll } from '../../testUtils/browserFit'
import CustomColorPanel from './CustomColorPanel.vue'

afterEach(unmountAll)

const Host = defineComponent(() => () => h('div', { style: { width: '500px' } }, [h(CustomColorPanel, { addable: true, inline: true })]))

describe('CustomColorPanel in the Add another color popover', () => {
  it('draws the brightness slider and the add row as wide as the wheel', async () => {
    const { root } = await mountAt(Host, {}, { locale: 'en', width: 1280, text: false })
    const width = (selector: string) => root.querySelector<HTMLElement>(selector)!.getBoundingClientRect().width
    const wheel = width('[data-testid="custom-color-wheel"]')

    expect(width('[data-testid="custom-color-brightness"]')).toBe(wheel)
    expect(width('.custom-color-panel__row')).toBe(wheel)
  })
})
