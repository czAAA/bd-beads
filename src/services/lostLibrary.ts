// TEMPORARY (ticket 0781): remove once the lost library it was added for is found or known to be gone. Looks through
// this browser's storage for every copy of the library the app may have kept, and packs them raw into one file, so a
// beader without a console (Safari on an iPad) can still find and hand over what's there. Reads only.

/** Every key a copy of the library may be kept under: the library, the copy set aside as unreadable, the pre-rename one. */
const LIBRARY_KEYS = ['openbeads:patterns', 'openbeads:patterns:unreadable', 'bd-beads:patterns']

/** A stored copy of the library: its Projects' names, or undefined when it can't be read here. */
export interface FoundCopy {
  key: string
  names: string[] | undefined
}

/** What the search found: each copy, and all of them raw as one file to hand over; no file when no copy holds a
 * Project or anything unreadable (an emptied library is still a copy, but there's nothing in it to hand over). */
export interface LostLibrary {
  copies: FoundCopy[]
  file: string | undefined
}

/** A stored Project's name, whichever version saved it: the Canvas layer's since ADR 0079, the Project's before. */
function nameOf(project: unknown): string {
  const stored = project as { name?: unknown; layers?: { name?: unknown }[] } | null
  const name = Array.isArray(stored?.layers) ? stored.layers[0]?.name : stored?.name
  return typeof name === 'string' ? name : ''
}

function namesIn(raw: string): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    const patterns: unknown = Array.isArray(parsed) ? parsed : (parsed as { patterns?: unknown } | null)?.patterns
    return Array.isArray(patterns) ? patterns.map(nameOf) : undefined
  } catch {
    return undefined
  }
}

/** Every copy of the library in `storage`, read without changing anything. */
export function findLostLibrary(storage: Pick<Storage, 'getItem'>, origin: string, now: Date): LostLibrary {
  const raw = LIBRARY_KEYS.flatMap((key) => {
    const value = storage.getItem(key)
    return value === null ? [] : [[key, value] as const]
  })
  const copies = raw.map(([key, value]) => ({ key, names: namesIn(value) }))
  const holdsAnything = copies.some((copy) => copy.names === undefined || copy.names.length > 0)
  return {
    copies,
    file: !holdsAnything ? undefined : JSON.stringify({ origin, savedAt: now.toISOString(), keys: Object.fromEntries(raw) }),
  }
}
