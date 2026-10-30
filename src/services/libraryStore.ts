import { inKnownTechniques, normalizeProject, type StoredProject } from '../domain/storedProject'
import type { Project } from '../domain/project'
import {
  decodeEarlierProject,
  decodeFlatProject,
  decodeProject,
  decodeVersionTwelveProject,
  encodeProject,
  type EncodedFlatProject,
  type EncodedGridProject,
  type EncodedProject,
  type EncodedVersionThreeProject,
} from '../domain/projectEncoding'
import { paletteFromDevice } from '../domain/palette'
import { liftFlatWeave, renamedBrickBlock, type SavedProject } from '../domain/flatWeave'
import { ADDED_COLORS_KEY, PALETTE_ORDER_KEY, readDeviceAddedColors, readDevicePaletteOrder } from './legacyDevicePalette'
import { readKey } from './storageKeys'
import { projectSummaryOf, type ProjectSummary, type SealedProject } from '../domain/sealedProject'

const STORAGE_KEY = 'openbeads:patterns'

// Where loadProjects keeps a value it can't read: a save writes the whole library (ADR 0012), so giving up and
// returning nothing would be one edit from overwriting a real library; a build predating a format can't read newer ones
// (ADR 0045), so keep the bytes.
const UNREADABLE_KEY = 'openbeads:patterns:unreadable'

// The stored format saveProjects writes (ADR 0009): v1 a bare array of Projects with full hex cells, v2 an envelope
// with compact grids, v3 compact beads by position, v4 (ADR 0066) the Frame's own beads, its settings a map (0636) or a
// flat Brick block, v5 (0664, ADR 0079) the layer list, v6 (0691) brick stitch's Drop under its new id.
const STORED_VERSION = 6
/** The first version that stores the layer list, which a Project is kept sealed from (ticket 0716). */
const LAYERED_VERSION = 5

interface StoredLibrary {
  version: number
  // The key stays `patterns` in storage (ADR 0050).
  patterns: EncodedProject[]
}

/** The same envelope as version 4 wrote it, before the Project held its layers. */
interface StoredFlatLibrary {
  version: number
  patterns: EncodedFlatProject[]
}

/** The same envelope as version 3 wrote it, before the Frame had beads of its own (temporary, see versionThree.ts). */
interface StoredVersionThreeLibrary {
  version: number
  patterns: EncodedVersionThreeProject[]
}

/** The same envelope as version 2 wrote it: every Project a fixed grid of cells, before the Canvas (ADR 0026). */
interface StoredGridLibrary {
  version: number
  patterns: EncodedGridProject[]
}

// Every readable stored format by version: each takes parsed JSON and returns plain Projects. v1 is recognised by being
// an array; a reader may throw on a wrong shape, which loadProjects treats like unparseable JSON.
const READERS: Record<number, (parsed: unknown) => StoredProject[]> = {
  1: (parsed) => (parsed as SavedProject[]).map(liftFlatWeave),
  2: (parsed) => (parsed as StoredGridLibrary).patterns.map(decodeEarlierProject),
  3: (parsed) => (parsed as StoredVersionThreeLibrary).patterns.map(decodeEarlierProject),
  4: (parsed) => (parsed as StoredFlatLibrary).patterns.map(decodeFlatProject),
  5: (parsed) => (parsed as StoredLibrary).patterns.map(decodeVersionTwelveProject),
  6: (parsed) => (parsed as StoredLibrary).patterns.map(decodeProject),
}

/** Which stored format a parsed value is in, or undefined when it's neither a version-1 array nor a versioned
 * envelope. */
function versionOf(parsed: unknown): number | undefined {
  if (Array.isArray(parsed)) {
    return 1
  }
  const version = (parsed as StoredLibrary | null)?.version
  return typeof version === 'number' ? version : undefined
}

/** Sets a stored value this build can't read aside, so a later save can't quietly replace it (see UNREADABLE_KEY). */
function keepUnreadable(raw: string): void {
  try {
    localStorage.setItem(UNREADABLE_KEY, raw)
  } catch {
    // No room for a second copy. Nothing better to do than carry on: the value is still under STORAGE_KEY for as long
    // as nothing overwrites it, and refusing to start the app over this would help no one.
  }
}

// TEMPORARY (ticket 0525): removed at the public release (ticket 0391). A Project stored before the Palette belonged to
// it is given the added colors and slot order this device kept, once: they are written into the library, and only then
// are the device keys removed.
function withDevicePalette(stored: StoredProject[], sealed: readonly SealedProject[]): StoredProject[] {
  const withoutPalette = stored.filter((project) => (project as Partial<Project>).palette === undefined)
  const added = readDeviceAddedColors(localStorage)
  const order = readDevicePaletteOrder(localStorage)
  if (withoutPalette.length === 0 || (added.length === 0 && order.length === 0)) return stored
  const palette = paletteFromDevice(added, order)
  const migrated = stored.map((project) => (withoutPalette.includes(project) ? { ...project, palette } : project))
  try {
    saveProjects(migrated.map(normalizeProject), sealed)
    localStorage.removeItem(ADDED_COLORS_KEY)
    localStorage.removeItem(PALETTE_ORDER_KEY)
  } catch {
    // No room to write: the device keys stay, and the next load tries again.
  }
  return migrated
}

/** The library as the editor opens it (ticket 0716): Projects decoded, and those kept sealed in their stored form. */
interface OpenedLibrary {
  projects: Project[]
  sealed: SealedProject[]
}

// Reads the whole library in any stored format (see READERS); the next save rewrites it in the current one. A Project
// of the current format that `keepSealed` picks from its summary stays in its stored form, undecoded (ticket 0716). For
// an unreadable value (bad JSON, wrong shape, newer version) returns no Projects, after keeping the bytes aside.
function openStored(keepSealed: (summary: ProjectSummary) => boolean): OpenedLibrary {
  const raw = readKey(localStorage, STORAGE_KEY)
  if (raw === null) {
    return { projects: [], sealed: [] }
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    const version = versionOf(parsed)
    const read = version === undefined ? undefined : READERS[version]
    if (read && (version === STORED_VERSION || version === LAYERED_VERSION)) {
      const sealed: SealedProject[] = []
      const decoded: EncodedProject[] = []
      // Version 5 differs only in brick stitch's Drop, stored as a Brick block: renamed here, the beads left encoded.
      const current = (stored: EncodedProject) => (version === STORED_VERSION ? stored : { ...stored, layers: stored.layers.map(renamedBrickBlock) })
      for (const encoded of inKnownTechniques((parsed as StoredLibrary).patterns).map(current)) {
        const summary = projectSummaryOf(encoded)
        if (summary && keepSealed(summary)) sealed.push({ ...summary, stored: JSON.stringify(encoded) })
        else decoded.push(encoded)
      }
      return { projects: withDevicePalette(decoded.map(decodeProject), sealed).map(normalizeProject), sealed }
    }
    if (read) {
      return { projects: withDevicePalette(inKnownTechniques(read(parsed)), []).map(normalizeProject), sealed: [] }
    }
  } catch {
    // Unparseable, or not the shape the version it claims implies — the same situation either way: unreadable here.
  }

  keepUnreadable(raw)
  return { projects: [], sealed: [] }
}

/** Every stored Project, decoded (see openStored). @internal Tests read back what the app saved with it. */
export function loadProjects(): Project[] {
  return openStored(() => false).projects
}

/** How many Projects are stored, read without decoding any (ticket 0716): the main address decides between the
 * Homepage and the editor on it, and the Homepage names it. An unreadable value counts none. */
export function storedProjectCount(): number {
  try {
    const raw = readKey(localStorage, STORAGE_KEY)
    if (raw === null) return 0
    const parsed: unknown = JSON.parse(raw)
    const patterns = Array.isArray(parsed) ? parsed : (parsed as StoredLibrary | null)?.patterns
    return Array.isArray(patterns) ? inKnownTechniques(patterns).length : 0
  } catch {
    return 0
  }
}

/** Each Project's stored JSON, kept for that Project object (ticket 0677, as ADR 0080 keeps answers per bead map): a
 * Project is replaced whole on every change, so a save encodes only those that changed since the last one. */
const storedJson = new WeakMap<Project, string>()

function storedJsonOf(project: Project): string {
  let json = storedJson.get(project)
  if (json === undefined) {
    json = JSON.stringify(encodeProject(project))
    storedJson.set(project, json)
  }
  return json
}

/** Writes the whole library (ADR 0009) from each Project's kept encoding and each sealed one's stored JSON (ticket 0716):
 * memory is the truth (ticket 55). Throws the browser's QuotaExceededError when it doesn't fit; the caller surfaces it.
 * @internal Tests seed a library with it before mounting the App. */
export function saveProjects(projects: Project[], sealed: readonly SealedProject[] = []): void {
  const patterns = [...projects.map(storedJsonOf), ...sealed.map((project) => project.stored)]
  localStorage.setItem(STORAGE_KEY, `{"version":${STORED_VERSION},"patterns":[${patterns.join(',')}]}`)
}

/** A sealed Project decoded, as a whole load would give it, its stored JSON kept as its encoding so the next save
 * doesn't encode it again (ticket 0716). */
function unsealProject(sealed: SealedProject): Project {
  const project = normalizeProject(decodeProject(JSON.parse(sealed.stored) as EncodedProject))
  storedJson.set(project, sealed.stored)
  return project
}

// Where the Project library is kept (ADR 0020); useProjectLibrary persists through it, so tests fake it and a backend
// can add a store.
export interface LibraryStore {
  /** Every stored Project, decoded; see openStored for what an unreadable value gives. */
  load: () => Project[]
  /** The library with the Projects `keepSealed` picks left in their stored form (ticket 0716). */
  open: (keepSealed: (summary: ProjectSummary) => boolean) => OpenedLibrary
  /** A sealed Project decoded, when it is picked. */
  unseal: (sealed: SealedProject) => Project
  /** Replaces the stored library; throws when the device refuses the write (see saveProjects). */
  save: (projects: Project[], sealed?: readonly SealedProject[]) => void
}

/** How long to wait for a quiet moment where the browser has no idle callback (Safari). */
const IDLE_FALLBACK_MS = 200

function whenIdle(work: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(work)
  else setTimeout(work, IDLE_FALLBACK_MS)
}

/** Keeps the encoding of each Project of a library just opened, one per idle moment (ticket 0677): otherwise the first
 * save after opening would encode them all. */
function encodeWhenIdle(projects: readonly Project[]): void {
  const waiting = [...projects]
  const next = (): void => {
    const project = waiting.shift()
    if (!project) return
    storedJsonOf(project)
    whenIdle(next)
  }
  whenIdle(next)
}

/** The library in this browser's localStorage (ADR 0001). */
export const browserLibraryStore: LibraryStore = {
  load: () => {
    const projects = loadProjects()
    encodeWhenIdle(projects)
    return projects
  },
  open: (keepSealed) => {
    const opened = openStored(keepSealed)
    encodeWhenIdle(opened.projects)
    return opened
  },
  unseal: unsealProject,
  save: saveProjects,
}
