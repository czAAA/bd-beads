import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { BUILT_IN_COLORS, createPalette, defaultPaletteIds } from '../../domain/palette'
import { createDevicePreferences, type PreferenceStorage } from '../../services/devicePreferences'
import { useToolPill } from './useToolPill'

const hexOf = (id: string) => BUILT_IN_COLORS.find((color) => color.id === id)!.hex

/** The pill over a real Palette, painting red at first; a pick changes the paint color as the app's does. */
function setup() {
  const palette = createPalette(defaultPaletteIds())
  const data = new Map<string, string>()
  const storage: PreferenceStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) }
  const selected = ref<string>(hexOf('red'))
  const customPicks: string[] = []
  let pill!: ReturnType<typeof useToolPill>
  mount(
    defineComponent({
      setup() {
        pill = useToolPill({
          preferences: createDevicePreferences(storage),
          selectedColorHex: () => selected.value,
          palette: () => palette,
          onSelectColor: (id) => (selected.value = palette.byId(id)!.hex),
          onSelectCustomColor: (hex) => {
            customPicks.push(hex)
            selected.value = hex
          },
        })
        return () => h('div')
      },
    }),
  )
  const paint = async (hex: string) => {
    selected.value = hex
    await nextTick()
  }
  return { pill, palette, selected, customPicks, paint }
}

describe('useToolPill color keys (ticket 529)', () => {
  it('Shift+1 picks the previous color, and again the one before that: never the same color twice in a row', async () => {
    const { pill, selected, paint } = setup()
    await paint(hexOf('blue'))
    await paint(hexOf('green'))

    pill.pickByKey(0)
    await nextTick()
    expect(selected.value).toBe(hexOf('blue'))
    pill.pickByKey(0)
    expect(selected.value).toBe(hexOf('green'))
  })

  it('Shift+4 picks the first Palette color that is not a chip, and a key with nothing behind it does nothing', async () => {
    const { pill, palette, selected, paint } = setup()
    await paint(hexOf('blue'))
    await paint(hexOf('green')) // chips: blue, then red

    pill.pickByKey(2) // there is no third chip
    pill.pickByKey(palette.colors.length + 3)
    expect(selected.value).toBe(hexOf('green'))

    pill.pickByKey(3)
    expect(selected.value).toBe(palette.colors.find((color) => ![hexOf('blue'), hexOf('red')].includes(color.hex))!.hex)
  })

  it('picks a recent as its Palette swatch, or else as a Custom color', async () => {
    const { pill, selected, customPicks } = setup()
    pill.pickRecent(hexOf('blue').toUpperCase())
    expect(selected.value).toBe(hexOf('blue'))
    expect(customPicks).toEqual([])

    pill.pickRecent('#123456')
    expect(customPicks).toEqual(['#123456'])
  })
})
