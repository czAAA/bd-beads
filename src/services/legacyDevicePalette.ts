import { normalizeHex } from '../domain/color'
import { readKey } from './storageKeys'

// TEMPORARY (ticket 0525): removed at the public release (ticket 0391). Before the Palette belonged to a Project the
// Custom colors and the slot order were kept on the device; libraryStore reads them once to give them to the
// Projects saved without a Palette.
export const ADDED_COLORS_KEY = 'openbeads:added-colors'
export const PALETTE_ORDER_KEY = 'openbeads:palette-order'

type ReadableStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function readJsonArray(storage: ReadableStorage, key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(readKey(storage, key) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** The hexes of the added colors this device kept, in the order they were added. */
export function readDeviceAddedColors(storage: ReadableStorage): string[] {
  const kept: string[] = []
  for (const entry of readJsonArray(storage, ADDED_COLORS_KEY)) {
    const hex = typeof entry === 'string' ? normalizeHex(entry) : undefined
    if (hex && !kept.includes(hex)) kept.push(hex)
  }
  return kept
}

/** The swatch ids in the slot order this device kept. */
export function readDevicePaletteOrder(storage: ReadableStorage): string[] {
  return readJsonArray(storage, PALETTE_ORDER_KEY).filter((id): id is string => typeof id === 'string')
}
