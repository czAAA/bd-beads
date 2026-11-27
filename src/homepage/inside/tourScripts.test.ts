import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { InsideRowId } from '../../i18n/translations'
import type { Hand, Target } from './hand'
import { PEACOCK_CUFF } from './peacock'
import { HOLD, TOUR_SCRIPTS, TRACED_BY_HAND } from './tourScripts'

// The pictures are drawn on a canvas this DOM doesn't have; any picture does here.
vi.mock('./peacockPicture', () => ({ peacockFile: async () => new File([], 'peacock.png', { type: 'image/png' }) }))
vi.mock('./balloon', () => ({ balloonFile: async () => new File([], 'balloon.png', { type: 'image/png' }) }))

/** A hand on a fixture of the editor's controls, as the ghost plays (not at once): what it pressed, by test id, and every
 * time it waited, rested or scrolled for. */
function fakeHand(controls: string = '') {
  const root = document.createElement('div')
  root.innerHTML = controls
  const presses: string[] = []
  const times: number[] = []
  /** The beads stroked by hand, and those laid at once. */
  const stroked: unknown[] = []
  const laid: unknown[] = []
  /** What it did with the Radial toolbox, in order. */
  const ring: string[] = []
  /** The Techniques set without a press: where the band's chip is not on the sheet. */
  const techniques: string[] = []
  const letters: boolean[] = []
  const name = (target: Target) => (typeof target === 'string' ? target : 'control')
  const hand = {
    instant: false,
    root,
    canvas: { activeProject: ref(undefined), onSetFrameTechnique: (technique: string) => techniques.push(technique), referenceImage: { image: ref(undefined) }, convertSession: ref(undefined), onSelectColor: () => {}, onSelectTool: () => {}, onSetLetters: (on: boolean) => letters.push(on) },
    press: async (target: Target) => (presses.push(name(target)), document.createElement('button')),
    pressWith: async (target: Target) => void presses.push(name(target)),
    find: async () => document.createElement('div'),
    wait: async (ms: number) => void times.push(ms),
    hover: async (_target: Target, ms: number) => void times.push(ms),
    scroll: async (_target: Target, _by: number, ms: number) => void times.push(ms),
    frame: async () => {},
    moveTo: async () => {},
    middleOf: () => ({ x: 0, y: 0 }),
    stroke: async (cells: unknown[]) => void stroked.push(...cells),
    lay: (cells: unknown[]) => void laid.push(...cells),
    drag: async () => {},
    dragFrame: async () => {},
    openToolbox: async (_bead: unknown, by: string) => void ring.push(by),
    slideTo: async (_target: Target, ms: number) => void (ring.push('slide'), times.push(ms)),
    closeToolbox: async () => void ring.push('close'),
  }
  return { hand: hand as unknown as Hand, presses, times, stroked, laid, ring, techniques, letters }
}

describe("What's inside's Technique row (ticket 1222)", () => {
  it("changes the Frame's Technique with the band's chip, and as the chip would where the sheet has no room for it", async () => {
    const chip = fakeHand('<div data-testid="margin-technique-picker"></div>')
    await TOUR_SCRIPTS.techniques(chip.hand)
    expect(chip.presses.length).toBeGreaterThan(0)
    expect(chip.techniques).toEqual([])

    const bare = fakeHand()
    await TOUR_SCRIPTS.techniques(bare.hand)
    expect(bare.presses).toEqual([])
    expect(bare.techniques.at(-1)).toBe('peyote')
  })
})

describe("What's inside's Letters row (ticket 1258)", () => {
  it("presses the sheet's switch, and turns Letters on as it would where the sheet has no room for it", async () => {
    const shown = fakeHand('<div data-testid="margin-letters"></div>')
    await TOUR_SCRIPTS.letters(shown.hand)
    expect(shown.presses).toEqual(['margin-letters'])
    expect(shown.letters).toEqual([])

    const bare = fakeHand()
    await TOUR_SCRIPTS.letters(bare.hand)
    expect(bare.presses).toEqual([])
    expect(bare.letters).toEqual([true])
  })
})

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

describe("What's inside's Tools at the pointer row (ticket 1114)", () => {
  it('opens the Radial toolbox by a hold and picks a color by a slide, paints three beads, then opens it by a click, presses Undo and closes it', async () => {
    const { hand, presses, stroked, ring } = fakeHand()
    await TOUR_SCRIPTS.toolsAtPointer(hand)
    expect(ring).toEqual(['hold', 'slide', 'click', 'close'])
    expect(stroked).toHaveLength(3)
    expect(presses).toEqual(['radial-undo'])
  })
})

describe("What's inside's rows in the order they play (ticket 0830)", () => {
  it('closes the Mirror before the Starter gallery, the Mirror row left it on (Convert image plays between them since 0949)', async () => {
    const { hand, presses } = fakeHand()
    await TOUR_SCRIPTS.starters(hand)
    expect(presses.slice(0, 6)).toEqual(['pill-tool-mirror', 'mirror-bar-close', 'margin-frame-tools', 'margin-frame-tools-remove', 'confirm-modal-confirm', 'strip-project'])
    expect(presses).toContain('frame-from-starter')
  })

  it("starts the Reference image row by clearing the Starter's ring, and sets the cuff's Frame over its Frame with none removed (ticket 0831)", async () => {
    const { hand, presses } = fakeHand()
    await TOUR_SCRIPTS.reference(hand)
    expect(presses.slice(0, 5)).toEqual(['margin-frame-tools', 'margin-frame-tools-remove', 'confirm-modal-confirm', 'pill-tool-select', 'context-bar-clear'])
    expect(presses).toContain('context-bar-frame')
  })
})

describe("What's inside's Reference image row is short (ticket 0949)", () => {
  it('traces the start of the eye by hand and lays the rest of the feather at once, the Mirror left closed', async () => {
    const { hand, presses, stroked, laid } = fakeHand()
    await TOUR_SCRIPTS.reference(hand)
    expect(stroked).toHaveLength(TRACED_BY_HAND)
    expect(laid).toHaveLength(PEACOCK_CUFF.lines * PEACOCK_CUFF.length)
    expect(presses.filter((id) => id.startsWith('margin-') || id.startsWith('mirror-bar'))).toEqual(['margin-frame-tools', 'margin-frame-tools-remove'])
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
