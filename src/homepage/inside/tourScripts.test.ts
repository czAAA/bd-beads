import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { InsideRowId } from '../../i18n/translations'
import type { Hand, Target } from './hand'
import { HOLD, TOUR_SCRIPTS } from './tourScripts'

// The pictures are drawn on a canvas this DOM doesn't have; any picture does here.
vi.mock('./landscape', () => ({ landscapeFile: async () => new File([], 'landscape.png', { type: 'image/png' }) }))
vi.mock('./balloon', () => ({ balloonFile: async () => new File([], 'balloon.png', { type: 'image/png' }) }))

/** A hand on a fixture of the editor's controls, as the ghost plays (not at once): what it pressed, by test id, and every
 * time it waited, rested or scrolled for. */
function fakeHand(controls: string = '') {
  const root = document.createElement('div')
  root.innerHTML = controls
  const presses: string[] = []
  const times: number[] = []
  const name = (target: Target) => (typeof target === 'string' ? target : 'control')
  const hand = {
    instant: false,
    root,
    canvas: { activeProject: ref(undefined), referenceImage: { image: ref(undefined) }, convertSession: ref(undefined) },
    press: async (target: Target) => (presses.push(name(target)), document.createElement('button')),
    pressWith: async (target: Target) => void presses.push(name(target)),
    find: async () => document.createElement('div'),
    wait: async (ms: number) => void times.push(ms),
    hover: async (_target: Target, ms: number) => void times.push(ms),
    scroll: async (_target: Target, _by: number, ms: number) => void times.push(ms),
    frame: async () => {},
    moveTo: async () => {},
    middleOf: () => ({ x: 0, y: 0 }),
    stroke: async () => {},
    drag: async () => {},
    dragFrame: async () => {},
  }
  return { hand: hand as unknown as Hand, presses, times }
}

describe("What's inside's Mirror row (ticket 0802)", () => {
  it("mirrors the whole Frame with the band's own button where the band shows it (full, compact)", async () => {
    const { hand, presses } = fakeHand('<button data-testid="margin-mirror-frame"></button>')
    await TOUR_SCRIPTS.mirror(hand)
    expect(presses[0]).toBe('margin-mirror-frame')
    expect(presses).not.toContain('margin-frame-tools')
  })

  it('mirrors it from the Frame tools menu where the band has no room for the button (folded, narrow)', async () => {
    const { hand, presses } = fakeHand('<button data-testid="margin-frame-tools"></button>')
    await TOUR_SCRIPTS.mirror(hand)
    expect(presses.slice(0, 2)).toEqual(['margin-frame-tools', 'margin-frame-tools-mirror'])
    expect(presses).not.toContain('margin-mirror-frame')
  })
})

describe("What's inside's rows in the order they play (ticket 0830)", () => {
  it('closes the Mirror before the Starter gallery, which comes right after the Mirror row', async () => {
    const { hand, presses } = fakeHand()
    await TOUR_SCRIPTS.starters(hand)
    expect(presses.slice(0, 4)).toEqual(['pill-tool-mirror', 'mirror-bar-close', 'strip-frame', 'frame-replace-from-starter'])
  })

  it("starts the Reference image row by clearing the Starter's ring, the Mirror closed already", async () => {
    const { hand, presses } = fakeHand()
    await TOUR_SCRIPTS.reference(hand)
    expect(presses).not.toContain('pill-tool-mirror')
    expect(presses[0]).toBe('pill-tool-select')
  })
})

describe("What's inside's rows wait only for the tour's holds", () => {
  const holds: number[] = Object.values(HOLD)
  for (const row of Object.keys(TOUR_SCRIPTS) as InsideRowId[]) {
    it(`${row}: every wait is one of the tour's holds`, async () => {
      const { hand, times } = fakeHand()
      await TOUR_SCRIPTS[row](hand)
      expect(times.filter((ms) => !holds.includes(ms))).toEqual([])
    })
  }
})
