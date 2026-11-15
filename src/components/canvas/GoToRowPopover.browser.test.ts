import { describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import GoToRowPopover from './GoToRowPopover.vue'

// Go to row with a row that doesn't exist (ticket 0980, UX-087): the field is drawn in `danger` even under the focus
// ring, and it is the card's 72px wide (`--go-to-row-field`), not as wide as a bare input.
async function typed(text: string) {
  const anchor = document.createElement('button')
  document.body.append(anchor)
  const mounted = await mountAt(GoToRowPopover, { anchor, title: 'Go to row', unit: 'Row', current: 5, total: 27, showLabel: 'Show row' }, { locale: 'en', width: 768 })
  const input = document.querySelector<HTMLInputElement>('[data-testid="go-to-row-field"]')!
  input.focus()
  input.value = text
  input.dispatchEvent(new Event('input'))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  const box = input.closest<HTMLElement>('.text-field')!
  // Its border eases to the new color: measure where it lands.
  for (const animation of box.getAnimations()) animation.finish()
  const probe = document.createElement('span')
  probe.style.color = 'var(--danger)'
  document.body.append(probe)
  const danger = getComputedStyle(probe).color
  probe.remove()
  const result = { border: getComputedStyle(box).borderTopColor, width: box.getBoundingClientRect().width, danger }
  mounted.unmount()
  anchor.remove()
  return result
}

describe('Go to row in a browser (ticket 0980)', () => {
  it('draws a row that does not exist in danger while the field has focus', async () => {
    const { border, danger } = await typed('99')
    expect(border).toBe(danger)
  })

  it('is the card’s 72px wide', async () => {
    expect((await typed('12')).width).toBe(72)
  })
})
