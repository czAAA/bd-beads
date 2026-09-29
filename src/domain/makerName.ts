/**
 * The maker's name (CONTEXT.md, ticket 161): who made a Pattern, printed on its PDF and PNG exports. Keeping it on the
 * device is services/makerNameStore's job; what a name may be is here.
 */

/** The longest name the field takes (NameOnExports card). */
export const MAX_MAKER_NAME = 40

/** A name as it is kept: trimmed, and no longer than the field allows. */
export function normalizeMakerName(name: string): string {
  return name.trim().slice(0, MAX_MAKER_NAME).trim()
}
