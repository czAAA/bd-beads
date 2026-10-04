import { CANVAS_BACKGROUND_MAX } from '../rendering/canvasBackgrounds'

export const CANVAS_BACKGROUND_STORAGE_KEY = 'bd-beads:canvas-background'

/** Where the person's Canvas color is kept on this device, like the theme pick (ticket 252). It is a number, 1 to 6, so it survives a change of theme. */
export interface CanvasBackgroundStore {
  load: () => number
  save: (choice: number) => void
}

export function createCanvasBackgroundStore(storage: Pick<Storage, 'getItem' | 'setItem'>): CanvasBackgroundStore {
  return {
    load() {
      let raw: string | null = null
      try {
        raw = storage.getItem(CANVAS_BACKGROUND_STORAGE_KEY)
      } catch {
        // Storage can be blocked (private mode, site data off): the first background.
      }
      const choice = Number(raw)
      return Number.isInteger(choice) && choice >= 1 && choice <= CANVAS_BACKGROUND_MAX ? choice : 1
    },
    save(choice) {
      try {
        storage.setItem(CANVAS_BACKGROUND_STORAGE_KEY, String(choice))
      } catch {
        // Storage can be blocked; the choice still holds for this visit.
      }
    },
  }
}

export const browserCanvasBackgroundStore: CanvasBackgroundStore = {
  load: () => createCanvasBackgroundStore(localStorage).load(),
  save: (choice) => createCanvasBackgroundStore(localStorage).save(choice),
}
