import { withColorBeadMapping, type ColorBeadDefaults } from './beadMapping'

const STORAGE_KEY = 'bd-beads:color-bead-defaults'

export function loadColorBeadDefaults(): ColorBeadDefaults {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ColorBeadDefaults)
      : {}
  } catch {
    return {}
  }
}

export function saveColorBeadDefaults(defaults: ColorBeadDefaults): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
}

/** Points a Palette color at the Bead it means everywhere by default; passing no bead unmaps it again. */
export function saveColorBeadDefault(colorId: string, beadId: string | null): void {
  saveColorBeadDefaults(withColorBeadMapping(loadColorBeadDefaults(), colorId, beadId))
}
