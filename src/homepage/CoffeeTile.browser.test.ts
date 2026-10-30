import { describe, expect, it } from 'vitest'
import { mountAt } from '../testUtils/browserFit'
import CoffeeTile from './CoffeeTile.vue'

// The whole tile is the Coffee link (ticket 0718): a click anywhere on it lands on the one link, Buy me a coffee.
const middle = (element: Element) => {
  const box = element.getBoundingClientRect()
  return [box.left + box.width / 2, box.top + box.height / 2] as const
}

describe('CoffeeTile, clicked anywhere', () => {
  for (const width of [1280, 390]) {
    it(`opens the Coffee link from the cup, the title, the text and the tile's edge at ${width}px`, async () => {
      const { root } = await mountAt(CoffeeTile, {}, { locale: 'en', width })
      const link = root.querySelector('[data-testid="homepage-coffee-button"]')
      expect(root.querySelectorAll('a')).toHaveLength(1)
      expect(link?.tagName).toBe('A')
      const tile = root.querySelector('[data-testid="homepage-coffee"]')!.getBoundingClientRect()
      const points = [
        middle(root.querySelector('[data-testid="coffee-cup"]')!),
        middle(root.querySelector('h3')!),
        middle(root.querySelector('p')!),
        [tile.left + 24, tile.top + 24] as const,
        [tile.right - 24, tile.bottom - 24] as const,
      ]
      for (const [x, y] of points) expect(document.elementFromPoint(x, y)?.closest('a'), `the point ${x}, ${y}`).toBe(link)
    })
  }
})
