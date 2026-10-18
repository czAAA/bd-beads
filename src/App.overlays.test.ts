import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithProject } from './testUtils/seedProject'
import { drawnProject, pressBead } from './testUtils/beads'
import { openSheet } from './testUtils/pill'
import { frameGrid } from './domain/project'

/** Ticket 449, ADR 0061: the first press outside an open overlay only closes it, never draws. Stack and exemptions:
 * `useOverlayLayer.dom.test.ts`. */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const OVERLAYS: Array<[string, (wrapper: Awaited<ReturnType<typeof mountWithProject>>) => Promise<void>, string]> = [
  ['the colour popover', async (wrapper) => void (await wrapper.get('[data-testid="pill-color"]').trigger('click')), '[data-testid="color-popover"]'],
  ['the Menu', (wrapper) => openSheet(wrapper, 'strip-menu'), '[data-testid="panel-body"]'],
  ['the Project panel', (wrapper) => openSheet(wrapper, 'strip-project'), '[data-testid="panel-body"]'],
]

describe.each(['mouse', 'touch', 'pen'])('a %s press on the canvas', (pointerType) => {
  it.each(OVERLAYS)('closes %s and paints nothing', async (_name, open, selector) => {
    const wrapper = await mountWithProject(15, 30, { attachTo: document.body })
    await open(wrapper)
    expect(wrapper.find(selector).exists()).toBe(true)

    await pressBead(wrapper, 0, { pointerType })
    await flushPromises()

    expect(wrapper.find(selector).exists()).toBe(false)
    expect(frameGrid(drawnProject(wrapper)).flat().every((cell) => !cell.color)).toBe(true)
    wrapper.unmount()
  })
})
