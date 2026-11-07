import { describe, expect, it } from 'vitest'
import { mountAt } from '../testUtils/browserFit'
import CoffeeTile from './CoffeeTile.vue'

// Only the cup, Buy me a coffee and View the source take a click (ticket 0813); the title, the text and the tile's edge don't.
const middle = (element: Element) => {
  const box = element.getBoundingClientRect()
  return [box.left + box.width / 2, box.top + box.height / 2] as const
}
const linkAt = ([x, y]: readonly [number, number]) => document.elementFromPoint(x, y)?.closest('a') ?? null

describe('CoffeeTile, clicked', () => {
  for (const width of [1280, 390]) {
    it(`opens the Coffee link from the cup and the button, the source from its link, and nothing elsewhere at ${width}px`, async () => {
      const { root } = await mountAt(CoffeeTile, {}, { locale: 'en', width })
      const button = root.querySelector('[data-testid="homepage-coffee-button"]')!
      const cupLink = root.querySelector('[data-testid="homepage-coffee-cup-link"]')!
      const cup = root.querySelector('[data-testid="coffee-cup"]')!
      // The big cup (ticket 0811).
      expect(cup.getBoundingClientRect().width).toBeGreaterThanOrEqual(160)
      expect(linkAt(middle(cup))).toBe(cupLink)
      expect(cupLink.getAttribute('href')).toBe(button.getAttribute('href'))
      expect(linkAt(middle(button))).toBe(button)
      const source = root.querySelector('[data-testid="homepage-coffee-source"]')!
      expect(linkAt(middle(source))).toBe(source)
      const tile = root.querySelector('[data-testid="homepage-coffee"]')!.getBoundingClientRect()
      const dead = [middle(root.querySelector('h3')!), middle(root.querySelector('.coffee__text')!), [tile.left + 24, tile.top + 24] as const, [tile.right - 24, tile.bottom - 24] as const]
      for (const point of dead) expect(linkAt(point), `the point ${point.join(', ')}`).toBeNull()
    })
  }
})
