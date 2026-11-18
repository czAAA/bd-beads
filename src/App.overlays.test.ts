import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { drawnProject, pressBead, rightClickBead } from './testUtils/beads'
import { openPanel } from './testUtils/pill'
import { frameGrid } from './testUtils/frameGrid'

/** Ticket 449, ADR 0061: the first press outside an open overlay only closes it, never draws. Stack and exemptions:
 * `useOverlayLayer.dom.test.ts`. */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

type Mounted = Awaited<ReturnType<typeof mountWithProject>>
/** Whether an overlay that leaves the page when it closes is there. */
const there = (selector: string) => (wrapper: Mounted) => wrapper.find(selector).exists()

const OVERLAYS: Array<[string, (wrapper: Mounted) => Promise<void>, (wrapper: Mounted) => boolean]> = [
  ['the colour popover', async (wrapper) => void (await wrapper.get('[data-testid="pill-color"]').trigger('click')), there('[data-testid="color-popover"]')],
  ['the Menu', (wrapper) => openPanel(wrapper, 'strip-menu'), there('[data-testid="panel-body"]')],
  ['the Project panel', (wrapper) => openPanel(wrapper, 'strip-project'), there('[data-testid="panel-body"]')],
  // The Radial toolbox (ticket 1064) stays in the page, hidden, so its last look can fade out.
  ['the Radial toolbox', (wrapper) => rightClickBead(wrapper, 40), (wrapper) => wrapper.get('[data-testid="radial-toolbox"]').isVisible()],
]

describe.each(['mouse', 'touch', 'pen'])('a %s press on the canvas', (pointerType) => {
  it.each(OVERLAYS)('closes %s and paints nothing', async (_name, open, shown) => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await open(wrapper)
    expect(shown(wrapper)).toBe(true)

    await pressBead(wrapper, 0, { pointerType })
    await flushPromises()

    expect(shown(wrapper)).toBe(false)
    expect(frameGrid(drawnProject(wrapper)).flat().every((cell) => !cell.color)).toBe(true)
    wrapper.unmount()
  })
})
