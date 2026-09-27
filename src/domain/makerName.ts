/**
 * The maker's name (CONTEXT.md, ticket 161): who made a Pattern, printed on its PDF and PNG exports. It belongs to the
 * person using this device, not to a Pattern, so it is kept on the device like the theme and never sent anywhere
 * (ADR 0001). Empty means the exports leave it out.
 */
export const MAKER_NAME_KEY = 'bd-beads:maker-name'

/** The longest name the field takes (NameOnExports card). */
export const MAX_MAKER_NAME = 40

/** A name as it is kept: trimmed, and no longer than the field allows. */
export function normalizeMakerName(name: string): string {
  return name.trim().slice(0, MAX_MAKER_NAME).trim()
}

export function loadMakerName(storage: Pick<Storage, 'getItem'> = localStorage): string {
  try {
    return normalizeMakerName(storage.getItem(MAKER_NAME_KEY) ?? '')
  } catch {
    // Storage can be blocked (private mode, site data off): the exports just carry no name.
    return ''
  }
}

/** Keeps the name on this device, or forgets it when empty; hands back the name as kept. */
export function saveMakerName(name: string, storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): string {
  const kept = normalizeMakerName(name)
  try {
    if (kept) storage.setItem(MAKER_NAME_KEY, kept)
    else storage.removeItem(MAKER_NAME_KEY)
  } catch {
    // Blocked storage: the name still holds for this visit.
  }
  return kept
}
