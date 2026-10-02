import { MAX_ADDED_COLORS, normalizeHex } from '../domain/palette'

/**
 * The Custom colors that joined the Palette (CONTEXT.md, ticket 227): they belong to the person using this device, not
 * to a Pattern, so they are kept on the device like the theme and the maker name and never sent anywhere (ADR 0001).
 * Cells store the hex, so a Pattern painted with them opens fine on a device that lacks them.
 */
export const ADDED_COLORS_KEY = 'bd-beads:added-colors'

/** Where the added colors are kept (ADR 0020). */
export interface AddedColorsStore {
  load: () => string[]
  save: (hexes: readonly string[]) => void
}

export function createAddedColorsStore(storage: Pick<Storage, 'getItem' | 'setItem'>): AddedColorsStore {
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
  }
}

/** The added colors in this browser's localStorage. */
export const browserAddedColorsStore: AddedColorsStore = {
  load: () => createAddedColorsStore(localStorage).load(),
  save: (hexes) => createAddedColorsStore(localStorage).save(hexes),
}
