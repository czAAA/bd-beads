export interface PaletteColor {
  id: string
  hex: string
}

/** A free-standing set of paint colors (see CONTEXT.md's Palette entry), independent of the bead catalog. */
export const PALETTE: readonly PaletteColor[] = [
  { id: 'black', hex: '#1a1a1a' },
  { id: 'white', hex: '#ffffff' },
  { id: 'red', hex: '#e63746' },
  { id: 'orange', hex: '#f2994a' },
  { id: 'yellow', hex: '#f2c94c' },
  { id: 'green', hex: '#27ae60' },
  { id: 'teal', hex: '#2fb6ae' },
  { id: 'blue', hex: '#2f6fed' },
  { id: 'purple', hex: '#9b51e0' },
  { id: 'pink', hex: '#ec5990' },
  { id: 'brown', hex: '#8a5a3b' },
  { id: 'grey', hex: '#9aa0a6' },
]

export function findPaletteColor(id: string): PaletteColor | undefined {
  return PALETTE.find((color) => color.id === id)
}

/** The Palette color a painted cell holds, looked up by the hex the grid stores; undefined for a hex from outside the Palette. */
export function findPaletteColorByHex(hex: string): PaletteColor | undefined {
  return PALETTE.find((color) => color.hex === hex)
}
