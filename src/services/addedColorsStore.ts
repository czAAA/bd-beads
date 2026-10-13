import { MAX_ADDED_COLORS, normalizeHex } from '../domain/palette'

/**
 * The Custom colors that joined the Palette (CONTEXT.md, ticket 227): they belong to the person using this device, not
 * to a Project, so they are kept on the device like the theme and the maker name and never sent anywhere (ADR 0001).
 * Cells store the hex, so a Project painted with them opens fine on a device that lacks them.
 */
export const ADDED_COLORS_KEY = 'bd-beads:added-colors'

/** The ids of the Palette's swatches in the order their slots were arranged (ticket 398), built-in ones included. */
export const PALETTE_ORDER_KEY = 'bd-beads:palette-order'

/** Where the added colors and the slot order are kept (ADR 0020). */
export interface AddedColorsStore {
  load: () => string[]
  save: (hexes: readonly string[]) => void
  loadOrder: () => string[]
  saveOrder: (ids: readonly string[]) => void
}

function createAddedColorsStore(storage: Pick<Storage, 'getItem' | 'setItem'>): AddedColorsStore {
  return {
    load() {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(ADDED_COLORS_KEY) ?? '[]')
        if (!Array.isArray(parsed)) return []
        const kept: string[] = []
        for (const entry of parsed) {
          const hex = typeof entry === 'string' ? normalizeHex(entry) : undefined
          if (hex && !kept.includes(hex)) kept.push(hex)
        }
        return kept.slice(0, MAX_ADDED_COLORS)
      } catch {
        // Blocked or damaged storage: the Palette is just the built-in colors.
        return []
      }
    },
    save(hexes) {
      try {
        storage.setItem(ADDED_COLORS_KEY, JSON.stringify(hexes))
      } catch {
        // Blocked storage: the colors still hold for this visit.
      }
    },
    loadOrder() {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(PALETTE_ORDER_KEY) ?? '[]')
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
      } catch {
        return []
      }
    },
    saveOrder(ids) {
      try {
        storage.setItem(PALETTE_ORDER_KEY, JSON.stringify(ids))
      } catch {
        // Blocked storage: the order still holds for this visit.
      }
    },
  }
}

/** The added colors in this browser's localStorage. */
export const browserAddedColorsStore: AddedColorsStore = {
  load: () => createAddedColorsStore(localStorage).load(),
  save: (hexes) => createAddedColorsStore(localStorage).save(hexes),
  loadOrder: () => createAddedColorsStore(localStorage).loadOrder(),
  saveOrder: (ids) => createAddedColorsStore(localStorage).saveOrder(ids),
}
