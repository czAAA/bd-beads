import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import BeadQuantities from './BeadQuantities.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { provideBeadColors, type BeadColors } from '../../composables/palette/useBeadColors'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { addedColorId, defaultPaletteIds } from '../../domain/palette'
import { paintAt } from '../../testUtils/layers'
import { beadsOfLayer, withFrameSheet } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

function project(): Project {
  return createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

function mountQuantities(project: Project | undefined) {
  return mount(BeadQuantities, { props: { project } })
}

describe('BeadQuantities', () => {
  it('has three columns: a color swatch, a bead count and its estimated weight', () => {
    const wrapper = mountQuantities(paintAt(project(), [{ row: 0, column: 0 }], '#e63746'))

    expect(wrapper.findAll('thead th')).toHaveLength(3)
    const row = wrapper.find('[data-testid="quantity-row"]')
    expect(row.findAll('td')).toHaveLength(3)
    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
  })

  it('reports how many beads each painted color needs', () => {
    const withTwoColors = paintAt(paintAt(project(), [{ row: 0, column: 0 }], '#e63746'), [{ row: 0, column: 1 }], '#2f6fed')
    const wrapper = mountQuantities(withTwoColors)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="quantity-count-blue"]').text()).toBe('1')
  })

  it('lists only colors painted at least once, most-needed first', () => {
    const wrapper = mountQuantities(project())

    expect(wrapper.findAll('[data-testid="quantity-row"]')).toHaveLength(0)
  })

  it('reports a color painted from outside the Palette, with its swatch and count', () => {
    // Only reachable from an imported file: the app's own painting is Palette-only.
    const wrapper = mountQuantities(paintAt(project(), [{ row: 0, column: 0 }], '#123456'))

    expect(wrapper.find('[data-testid="quantity-count-#123456"]').text()).toBe('1')
  })

  describe('names a color by its code and name, its hex only in a Tooltip (ticket 0760)', () => {
    const catalog: ColorCatalog = { id: 'toho', codes: [{ code: '49', family: ['Black'], finish: 'opaque', wording: 'Opaque', sizes: ['1.5mm'] }] }
    const added = addedColorId('#123456')
    const coded = (codes?: Record<string, string>) => paintAt({ ...project(), palette: [...defaultPaletteIds(), added], ...(codes ? { paletteCodes: codes } : {}) }, [{ row: 0, column: 0 }], '#123456')

    const mountWith = (project: Project, beadColors?: BeadColors) =>
      mount(defineComponent({ setup() { if (beadColors) provideBeadColors(beadColors); return () => h(BeadQuantities, { project }) } }))

    it('shows a catalog color as "code name" with its hex in the Tooltip, and loads the catalog it needs', async () => {
      const beadColors = { catalog: ref(catalog), load: vi.fn() } as unknown as BeadColors
      const wrapper = mountWith(coded({ '#123456': '49' }), beadColors)
      const label = wrapper.get('[data-testid="quantity-row"] .app-tooltip')

      expect(label.get('[data-testid="color-label"]').text()).toBe('49 Opaque Black')
      expect(label.get('[role="tooltip"]').text()).toBe('#123456')
      expect(beadColors.load).toHaveBeenCalled()
    })

    it('shows just the code until the catalog has loaded', () => {
      const wrapper = mountWith(coded({ '#123456': '49' }), { catalog: ref(undefined), load: vi.fn() } as unknown as BeadColors)

      expect(wrapper.get('[data-testid="quantity-row"] [data-testid="color-label"]').text()).toBe('49')
    })

    it('shows a Custom color as its hex with no Tooltip', () => {
      const wrapper = mountWith(coded())

      expect(wrapper.get('[data-testid="quantity-row"] [data-testid="color-label"]').text()).toBe('#123456')
      expect(wrapper.find('[data-testid="quantity-row"] .app-tooltip').exists()).toBe(false)
    })
  })

  it('shows no bead pickers or bead names', () => {
    const wrapper = mountQuantities(paintAt(project(), [{ row: 0, column: 0 }], '#e63746'))

    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('shows the "open a Project" message with no Project open', () => {
    const wrapper = mountQuantities(undefined)

    expect(wrapper.find('[data-testid="quantities-no-project"]').exists()).toBe(true)
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('shows a "nothing painted yet" message for an unpainted Project', () => {
    const wrapper = mountQuantities(project())

    expect(wrapper.find('[data-testid="quantities-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="quantities-no-project"]').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('BeadQuantities estimated weight (ticket 155)', () => {
  const cells = (count: number) => Array.from({ length: count }, (_, column) => ({ row: 0, column }))
  
  function wide(beadId: string, painted: number, color = '#e63746'): Project {
    const base = createProject({ technique: 'loom', beadId, size: { width: 1000, height: 5, unit: 'beads' } })
    return paintAt(base, cells(painted), color)
  }

  it.each([
    ['toho-cube-1.5mm', '1.08 g', 'Cube'],
    ['toho-round-11-0', '0.95 g', 'Round'],
    ['miyuki-delica-11-0', '0.50 g', 'Delica'],
  ])('shows a weight for 100 %s beads: %s (%s)', (beadId, weight) => {
    const wrapper = mountQuantities(wide(beadId, 100))

    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe(weight)
    expect(wrapper.find('[data-testid="quantity-total"]').text()).toBe(`100 · ≈ ${weight}`)
  })

  it('shows the weight per color and a total across colors', () => {
    const two = paintAt(wide('toho-cube-1.5mm', 100), cells(50).map((cell) => ({ ...cell, row: 1 })), '#2f6fed')
    const wrapper = mountQuantities(two)

    expect(wrapper.find('[data-testid="quantity-weight-red"]').text()).toBe('1.08 g')
    expect(wrapper.find('[data-testid="quantity-weight-blue"]').text()).toBe('0.54 g')
    expect(wrapper.find('[data-testid="quantity-total"]').text()).toBe('150 · ≈ 1.62 g')
  })

  it('puts the total and its weight in the header, the same folded or open (ticket 555)', () => {
    const wrapper = mountQuantities(wide('toho-cube-1.5mm', 100))

    expect(wrapper.find('[data-testid="quantity-total"]').text()).toBe('100 · ≈ 1.08 g')
  })

  it('writes the total with the Russian decimal comma too', () => {
    localStorage.setItem('openbeads:locale', 'ru')
    const wrapper = mountQuantities(wide('toho-cube-1.5mm', 100))

    expect(wrapper.find('[data-testid="quantity-total"]').text()).toBe('100 · ≈ 1,08 г')
  })

  it('rounds to one decimal from 10 g up and says "< 0.01 g" for a color too small to weigh', () => {
    // 1000 beads x 0.0108 g = 10.8 g
    const heavy = mountQuantities(wide('toho-cube-1.5mm', 1000))
    expect(heavy.find('[data-testid="quantity-weight-red"]').text()).toBe('10.8 g')

    const tiny = mountQuantities(wide('miyuki-delica-11-0', 1))
    expect(tiny.find('[data-testid="quantity-weight-red"]').text()).toBe('< 0.01 g')
  })

  it('hides the weights, not shows zeros, when the Project\'s Bead has no weight', () => {
    const unknown = withLayers(wide('toho-cube-1.5mm', 10), { beadId: 'a-bead-this-device-never-had', bead: undefined })
    const wrapper = mountQuantities(unknown)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('10')
    expect(wrapper.find('[data-testid="quantity-weight-red"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantity-total-weight"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantities-weight-note"]').exists()).toBe(false)
  })

  it('shows no weight for a Project with no colors painted', () => {
    const wrapper = mountQuantities(project())

    expect(wrapper.find('[data-testid="quantities-weight-note"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="quantity-total"]').exists()).toBe(false)
  })

  it('explains the estimate in an always-visible Note, with the Bead\'s average weight and no (i) button (ticket 328)', () => {
    const wrapper = mountQuantities(wide('toho-round-11-0', 10))
    const note = wrapper.find('[data-testid="quantities-weight-note"]')

    expect(note.text()).toBe(
      'This is bead count × about 0.0095 g per bead. That average comes from seller listings, not confirmed measurements. Real beads vary, so buy a little extra.',
    )
    expect(note.find('button[aria-describedby], [role="tooltip"]').exists()).toBe(false)
  })

  describe('Show all (ticket 555)', () => {
    function withColors(count: number): Project {
      const hexes = ['#e63746', '#2f6fed', '#22aa55', '#f5c518', '#8e44ad', '#ff8800', '#00bcd4']
      return hexes
        .slice(0, count)
        .reduce((p, hex, column) => paintAt(p, [{ row: 0, column }], hex), project())
    }

    it('lists five colors, with no button for five or fewer', () => {
      expect(mountQuantities(withColors(5)).findAll('[data-testid="quantity-row"]')).toHaveLength(5)
      expect(mountQuantities(withColors(5)).find('[data-testid="quantities-toggle"]').exists()).toBe(false)
    })

    it('shows the rest in place on "Show all 7 colors" and folds back on "Show fewer"', async () => {
      const wrapper = mountQuantities(withColors(7))
      const toggle = wrapper.get('[data-testid="quantities-toggle"]')

      expect(wrapper.findAll('[data-testid="quantity-row"]')).toHaveLength(5)
      expect(toggle.text()).toBe('Show all colors (7)')
      await toggle.trigger('click')
      expect(wrapper.findAll('[data-testid="quantity-row"]')).toHaveLength(7)
      expect(toggle.text()).toBe('Show fewer')
      await toggle.trigger('click')
      expect(wrapper.findAll('[data-testid="quantity-row"]')).toHaveLength(5)
    })
  })
})

describe('BeadQuantities and the Frame (ticket 233)', () => {
  it('counts the Frame only, leaving out beads that lie outside it', () => {
    const framed = paintAt(project(), [{ row: 0, column: 0 }], '#e63746')
    const withOutsider = withLayers(framed, { beads: { ...beadsOfLayer(framed, 'canvas'), 40: { 40: '#e63746' } } })
    const wrapper = mountQuantities(withOutsider)

    expect(wrapper.find('[data-testid="quantity-count-red"]').text()).toBe('1')
  })

  it('keeps its header and says "Set Frame to count beads." with no Frame', () => {
    const open = withFrameSheet(paintAt(project(), [{ row: 0, column: 0 }], '#e63746'), undefined)
    const wrapper = mountQuantities(open)

    expect(wrapper.find('[data-testid="quantities-needs-frame"]').text()).toBe('Set Frame to count beads.')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.text()).toContain('Beads needed')
  })
})
