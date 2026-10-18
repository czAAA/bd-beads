import { normalizeMakerName } from '../domain/makerName'
import type { Project } from '../domain/project'
import type { LibraryStore } from './libraryStore'
import { readKey, removeKey } from './storageKeys'

// TEMPORARY (ADR 0060, ticket 441): remove this file, its test and its useAppShell call with ticket 0391 (public
// release).

/** Where the device-wide Maker's name was kept (ticket 161) before it moved onto each Project. */
export const LEGACY_MAKER_NAME_KEY = 'openbeads:maker-name'

// Every Project with no name of its own gets the device-wide one; a Project with its own keeps it. Empty device name:
// no change.
export function applyLegacyMakerName(projects: Project[], deviceName: string): Project[] {
  const name = normalizeMakerName(deviceName)
  if (!name) return projects
  return projects.map((project) => (project.makerName ? project : { ...project, makerName: name }))
}

// Copies a saved device-wide name into the library, then clears it only once the library took the write, so a refusal
// retries next load.
export function migrateLegacyMakerName(
  library: LibraryStore,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    const deviceName = readKey(storage, LEGACY_MAKER_NAME_KEY)
    if (deviceName === null) return
    library.save(applyLegacyMakerName(library.load(), deviceName))
    removeKey(storage, LEGACY_MAKER_NAME_KEY)
  } catch {
    // Blocked storage or a refused write: the device value stays and the next load tries again.
  }
}
