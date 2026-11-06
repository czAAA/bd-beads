import { describe, expect, it } from 'vitest'
import { mountAt } from '../testUtils/browserFit'
import CoffeeTile from './CoffeeTile.vue'

// The cup is the Coffee link (ticket 0811): a click on it lands on the one link, Buy me a coffee.
describe('CoffeeTile, clicked on the cup', () => {
  for (const width of [1280, 390]) {
    it(`opens the Coffee link from the middle of the cup at ${width}px`, async () => {
      const { root } = await mountAt(CoffeeTile, {}, { locale: 'en', width, text: false })
      const link = root.querySelector('[data-testid="homepage-coffee-button"]')
      expect(root.querySelectorAll('a')).toHaveLength(1)
      const cup = root.querySelector('[data-testid="coffee-cup"]')!.getBoundingClientRect()
      const hit = document.elementFromPoint(cup.left + cup.width / 2, cup.top + cup.height / 2)
      expect(hit?.closest('a')).toBe(link)
    })
  }
})
