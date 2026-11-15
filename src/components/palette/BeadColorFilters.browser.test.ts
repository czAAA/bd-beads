import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { FINISHES } from '../../domain/colorCatalog'
import { mountAt } from '../../testUtils/browserFit'
import { emulateTouch, hitAreaProblems } from '../../testUtils/hitAreas'
import { tokenPx } from '../../testUtils/tokenPx'
import BeadColorFilters from './BeadColorFilters.vue'

// On touch the Bead colors filters take a finger (ticket 0962): a Finish line and Clear filters answer `touch-target`
// tall, each its own; a Color family is the Palette's chip size, apart from the next (responsive.md). In one column
// beside the rows, and two behind the Filters disclosure under 480px.
const props = {
  families: ['red', 'blue', 'green', 'yellow', 'white', 'black', 'grey', 'brown'].map((family, index) => ({ family, name: family, hex: `hsl(${index * 40} 60% 50%)`, on: index === 1, count: index })),
  finishes: FINISHES.map((finish, index) => ({ finish, name: finish, on: index === 0, count: index * 12 })),
  anyOn: true,
  open: true,
}

const inList = (width: number) => defineComponent({ setup: () => () => h('div', { style: { container: 'bead-list / inline-size', width: `${width}px` } }, [h(BeadColorFilters, props)]) })

const named = (elements: Element[], name: string) => Object.fromEntries(elements.map((element) => [`${name} ${element.getAttribute('data-value')}`, element]))

describe('BeadColorFilters on touch (ticket 0962)', () => {
  for (const width of [600, 360]) {
    it(`gives each Finish line and Clear filters a touch-target hit area and each family the Palette's chip size, ${width}px wide`, async () => {
      await emulateTouch()
      const { root } = await mountAt(inList(width), {}, { locale: 'en', width: 1280 })
      const finishes = { ...named([...root.querySelectorAll('[data-testid="bead-colors-finish"]')], 'finish'), clear: root.querySelector('[data-testid="bead-colors-filters-clear"]')! }
      expect(hitAreaProblems(finishes, tokenPx(document.body, '--touch-target'))).toEqual([])
      const families = named([...root.querySelectorAll('[data-testid="bead-colors-family"]')], 'family')
      expect(hitAreaProblems(families, tokenPx(document.body, '--swatch-touch-min'))).toEqual([])
    })
  }
})
