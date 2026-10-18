// The move of every storage key from `bd-beads:*` to `openbeads:*` (ticket 392, ADR 0048). @deprecated The old-key
// fallback: remove `readKey`'s copy-forward, `removeKey`'s marker and the old-name tests after release.

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const CURRENT_PREFIX = 'openbeads:'
const LEGACY_PREFIX = 'bd-beads:'

const legacyKey = (key: string) => LEGACY_PREFIX + key.slice(CURRENT_PREFIX.length)

/** Set once the old key has been dealt with, so a value the person since cleared isn't copied forward again. */
const doneMarker = (key: string) => `${key}:legacy-done`

// Reads a key; if only the old one exists and wasn't handled, copies it forward once. The old key is never touched:
// older builds read it.
export function readKey(storage: KeyStorage, key: string): string | null {
  const current = storage.getItem(key)
  if (current !== null || !key.startsWith(CURRENT_PREFIX) || storage.getItem(doneMarker(key)) !== null) {
    return current
  }

  const old = storage.getItem(legacyKey(key))
  if (old === null) {
    return null
  }
  try {
    storage.setItem(key, old)
    storage.setItem(doneMarker(key), '1')
  } catch {
    // No room to copy: the old value still answers this read, and the next read tries again.
  }
  return old
}

/** Clears a key for good: marks the old key as handled first, so the cleared value isn't brought back from it. */
export function removeKey(storage: KeyStorage, key: string): void {
  if (key.startsWith(CURRENT_PREFIX) && storage.getItem(legacyKey(key)) !== null) {
    try {
      storage.setItem(doneMarker(key), '1')
    } catch {
      // Without the marker the old value could return; clearing the key is still the right thing to try.
    }
  }
  storage.removeItem(key)
}
