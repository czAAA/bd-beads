export type FormFactor = 'round' | 'cylinder' | 'cube'

export interface Bead {
  id: string
  brand: string
  name: string
  size: string
  formFactor: FormFactor
  /** Bead footprint in millimeters, used to convert a physical pattern size into a grid. */
  widthMm: number
  heightMm: number
}

export const BEAD_CATALOG: readonly Bead[] = [
  {
    id: 'toho-cube-1.5mm',
    brand: 'TOHO',
    name: 'Cube',
    size: '1.5mm',
    formFactor: 'cube',
    widthMm: 1.5,
    heightMm: 1.5,
  },
  {
    id: 'toho-round-11-0',
    brand: 'TOHO',
    name: 'Round',
    size: '11/0',
    formFactor: 'round',
    widthMm: 2.2,
    heightMm: 2.2,
  },
  {
    id: 'miyuki-delica-11-0',
    brand: 'Miyuki',
    name: 'Delica',
    size: '11/0',
    formFactor: 'cylinder',
    widthMm: 1.6,
    heightMm: 1.3,
  },
]

export function findBead(id: string): Bead | undefined {
  return BEAD_CATALOG.find((bead) => bead.id === id)
}
