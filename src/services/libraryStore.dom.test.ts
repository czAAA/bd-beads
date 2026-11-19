import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject } from '../domain/createProject'
import type { Grid, Project } from '../domain/project'
import type { Technique } from '../domain/weave'
import { browserLibraryStore, loadProjects, saveProjects, type HeldProject } from './libraryStore'
import { parseProjectsFile, serializeLibrary } from '../domain/projectFile'
import { BEAD_CATALOG } from '../domain/beads'
import { refuseStorageWrites } from '../testUtils/storageWrites'
import { frameGrid, withFrameGrid } from '../testUtils/frameGrid'
import { backgroundOf, canvasOf, frameOf, withBackground } from '../domain/layerRecord'
import { layersView } from '../testUtils/layerFields'
import { legacyRecordOf } from '../testUtils/legacyFile'
import { encodeProject } from '../domain/projectEncoding'
import { withColorsInPalette } from '../domain/paletteEdits'
import { storeLibrary } from '../testUtils/hugeProject'

// Counts the encodings a save makes (ticket 0677), passing each through to the real encoder.
vi.mock('../domain/projectEncoding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/projectEncoding')>()
  return { ...actual, encodeProject: vi.fn(actual.encodeProject) }
})

const STORAGE_KEY = 'openbeads:patterns'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

function makeProject(technique: Technique = 'loom') {
  return createProject({
    technique,
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

/** An ordinary 60×90 Project — 9×13.5cm in 1.5mm cubes — painted the blocky way beadwork designs actually look. */
function paintedOrdinaryProject(): Project {
  const hexes = ['#1f1f1f', '#ffffff', '#c81e3c', '#1e64c8', '#1ea05a', '#f0c419', '#8e44ad', '#e67e22', null]
  const project = createProject({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 90, height: 135, unit: 'mm' },
  })
  const grid: Grid = frameGrid(project).map((cells, row) =>
    cells.map((_cell, column) => ({
      color: hexes[(Math.floor(row / 10) + Math.floor(column / 10)) % hexes.length]!,
    })),
  )
  return withFrameGrid(project, grid)
}

function storedBytes(): number {
  return localStorage.getItem(STORAGE_KEY)!.length
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('projectStorage', () => {
  it('returns no projects when nothing has been saved yet', () => {
    expect(loadProjects()).toEqual([])
  })

  it('saves a project and lists it back', () => {
    const project = makeProject()

    saveProjects([project])

    expect(loadProjects()).toEqual([project])
  })

  it('skips a Project woven in a Technique this build does not know, and loads the rest (ticket 0644)', () => {
    const first = makeProject()
    const second = makeProject()
    saveProjects([first, second])
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    stored.patterns[0].layers[0].technique = 'herringbone'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    expect(loadProjects()).toEqual([second])
  })

  it('saves a whole library in one write', () => {
    const first = makeProject()
    const second = makeProject()

    saveProjects([first, second])

    expect(loadProjects()).toEqual([first, second])
  })

  it('encodes again only the Project that changed since the last save (ticket 0677)', () => {
    const library = [makeProject(), makeProject(), makeProject()]
    saveProjects(library)
    const edited = { ...library[1]!, updatedAt: library[1]!.updatedAt + 1 }
    vi.mocked(encodeProject).mockClear()

    saveProjects([edited, library[0]!, library[2]!])

    expect(vi.mocked(encodeProject).mock.calls).toEqual([[edited]])
    expect(loadProjects()).toEqual([edited, library[0], library[2]])
  })

  it('encodes the library it opened while the device is idle, so the first save encodes only what changed (ticket 0677)', () => {
    vi.useFakeTimers()
    try {
      saveProjects([makeProject(), makeProject()])
      const [first, second] = browserLibraryStore.load()
      vi.runAllTimers()
      vi.mocked(encodeProject).mockClear()
      const edited = { ...first!, updatedAt: first!.updatedAt + 1 }

      saveProjects([edited, second!])

      expect(vi.mocked(encodeProject).mock.calls).toEqual([[edited]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('writes the same library a whole encoding would (ticket 0677)', () => {
    const library = [makeProject(), paintedOrdinaryProject()]
    saveProjects(library)

    saveProjects(library)

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ version: 6, patterns: library.map(encodeProject) }))
  })

  it('replaces what was stored rather than merging with it', () => {
    const project = makeProject()
    saveProjects([project])

    const updated = { ...project, updatedAt: project.updatedAt + 1 }
    saveProjects([updated])

    expect(loadProjects()).toEqual([updated])
  })

  it('saving an empty library clears what was stored', () => {
    saveProjects([makeProject()])

    saveProjects([])

    expect(loadProjects()).toEqual([])
  })

  it('ignores corrupted data in storage instead of throwing', () => {
    localStorage.setItem('openbeads:patterns', 'not json')

    expect(loadProjects()).toEqual([])
  })

  it.each(['peyote', 'brick'] as const)('saves and reloads a %s project identically to a loom one', (technique) => {
    const project = makeProject(technique)

    saveProjects([project])

    expect(loadProjects()).toEqual([project])
  })

  it('backfills a name from the bead label for projects saved before names existed', () => {
    const { name: _name, ...legacyProject } = legacyRecordOf(makeProject())
    localStorage.setItem('openbeads:patterns', JSON.stringify([legacyProject]))

    expect(canvasOf(loadProjects()[0]).name).toBe('TOHO Cube 1.5mm')
  })

  it('loads a Project saved before ADR 0026 that still carries its millimetre size, ignoring it', () => {
    const project = makeProject()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...legacyRecordOf(project), widthMm: 15, heightMm: 15 }]))

    const [loaded] = loadProjects()

    expect(frameOf(loaded)!.columns).toBe(frameOf(project)!.columns)
    expect(frameOf(loaded)!.rows).toBe(frameOf(project)!.rows)
    expect(loaded).not.toHaveProperty('widthMm')
    expect(loaded).not.toHaveProperty('heightMm')
  })

  it('does not write the millimetre size back when such a Project is saved again', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...legacyRecordOf(makeProject()), widthMm: 15, heightMm: 15 }]))

    saveProjects(loadProjects())

    const [saved] = JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns
    expect(saved).not.toHaveProperty('widthMm')
    expect(saved).not.toHaveProperty('heightMm')
  })

  it('lets a write that does not fit through to the caller instead of swallowing it', () => {
    refuseStorageWrites()

    expect(() => saveProjects([makeProject()])).toThrow()
  })

  describe('the compact stored format (ADR 0009)', () => {
    it('writes a version marker and a compact grid instead of an object per cell', () => {
      saveProjects([makeProject()])

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.version).toBe(6)
      expect(stored.patterns[0].grid).toBeUndefined()
      expect(stored.patterns[0].layers[0].encodedBeads).toEqual({ colors: [], rows: {} })
      expect(stored.patterns[0].layers[1].encodedBeads).toEqual({ colors: [], rows: {} })
    })

    it('reads a library saved in the old unversioned format back unchanged', () => {
      const project = makeProject()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([legacyRecordOf(project)]))

      expect(loadProjects().map(layersView)).toEqual([layersView(project)])
    })

    it('rewrites a library saved in the old format compactly on the next save', () => {
      const legacy = paintedOrdinaryProject()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([legacyRecordOf(legacy)]))
      const legacyBytes = storedBytes()

      const loaded = loadProjects()
      saveProjects(loaded)

      expect(loaded.map(layersView)).toEqual([layersView(withColorsInPalette(legacy))])
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(6)
      expect(storedBytes()).toBeLessThan(legacyBytes / 10)
    })

    it('ignores a library written by a newer format version instead of throwing', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, patterns: [{ whatever: true }] }))

      expect(loadProjects()).toEqual([])
    })

    it('ignores a library whose shape does not match the version it claims', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, patterns: null }))

      expect(loadProjects()).toEqual([])
    })

    it('keeps a stored value it cannot read, so the next save cannot quietly replace it', () => {
      const unreadable = JSON.stringify({ version: 99, patterns: [{ whatever: true }] })
      localStorage.setItem(STORAGE_KEY, unreadable)

      loadProjects()
      saveProjects([]) // what an edit made on the empty library the app started from would write

      expect(localStorage.getItem('openbeads:patterns:unreadable')).toBe(unreadable)
    })

    it('finds a library saved under the old bd-beads: key, copies it forward and keeps its unreadable safeguard (ticket 392)', () => {
      const project = makeProject()
      saveProjects([project])
      const saved = localStorage.getItem(STORAGE_KEY)!
      localStorage.clear()
      localStorage.setItem('bd-beads:patterns', saved)

      expect(loadProjects()).toEqual([project])
      expect(localStorage.getItem(STORAGE_KEY)).toBe(saved)
      expect(localStorage.getItem('bd-beads:patterns')).toBe(saved)

      localStorage.clear()
      localStorage.setItem('bd-beads:patterns', '{"version":99}')
      expect(loadProjects()).toEqual([])
      expect(localStorage.getItem('openbeads:patterns:unreadable')).toBe('{"version":99}')
    })

    it('opens a Project whose runs do not add up to its grid, rather than refusing it', () => {
      // A hand-edited or truncated stored value: two cells of runs for a 10x10 grid. The Project's own dimensions
      // decide the shape, so the rest comes back empty instead of the Project being unopenable.
      const { beads: _beads, frame: _frame, ...base } = legacyRecordOf(makeProject())
      const rest = { ...base, columns: 10, rows: 10 }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 2, patterns: [{ ...rest, cells: { colors: ['#ff0000'], runs: '1x2' } }] }),
      )

      const [loaded] = loadProjects()

      expect(frameGrid(loaded!).length).toBe(10)
      expect(frameGrid(loaded!).every((row) => row.length === 10)).toBe(true)
      expect([frameGrid(loaded!)[0]![0]!.color, frameGrid(loaded!)[0]![1]!.color, frameGrid(loaded!)[0]![2]!.color]).toEqual([
        '#ff0000',
        '#ff0000',
        null,
      ])
    })

    it('drops runs that overrun the grid instead of growing it', () => {
      const { beads: _beads, frame: _frame, ...base } = legacyRecordOf(makeProject())
      const rest = { ...base, columns: 10, rows: 10 }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 2, patterns: [{ ...rest, cells: { colors: ['#ff0000'], runs: '1x400' } }] }),
      )

      const [loaded] = loadProjects()

      expect(frameGrid(loaded!).length).toBe(10)
      expect(frameGrid(loaded!).every((row) => row.length === 10)).toBe(true)
    })

    it('hands exported Project files plain Projects, which the file then encodes itself', () => {
      const project = paintedOrdinaryProject()
      saveProjects([project])

      const exported = serializeLibrary(loadProjects())

      expect(JSON.parse(exported).projects[0].layers[0].encodedBeads).toBeDefined()
      expect(parseProjectsFile(exported).projects).toEqual([withColorsInPalette(project)])
    })

    it('costs a painted 60x90 Project roughly 3KB rather than roughly 100KB', () => {
      const project = paintedOrdinaryProject()
      const plainJsonBytes = JSON.stringify([project]).length

      saveProjects([project])

      // Measured: 72,149 bytes as plain JSON (a color string per bead) against about 3,200 stored — ADR 0009's saving, a little smaller now that a bead is a string and not an object. The bound is
      // loose enough that an encoding tweak doesn't have to be chased here, and tight enough to fail if the compact
      // form ever stops being written.
      expect(plainJsonBytes).toBeGreaterThan(60 * 1024)
      expect(storedBytes()).toBeLessThan(5 * 1024)
    })
  })

  // TEMPORARY (ticket 0525): removed at the public release (ticket 0391), with the migration it tests.
  describe('the device\'s old Palette (temporary, ticket 0525)', () => {
    const stripPalette = (project: Project) => {
      const { palette: _palette, ...stored } = project
      return stored
    }
    const keepOnDevice = () => {
      localStorage.setItem('openbeads:added-colors', JSON.stringify(['#123456', '#abcdef']))
      localStorage.setItem('openbeads:palette-order', JSON.stringify(['red', 'added-123456', 'black']))
    }
    const saveWithoutPalette = (...projects: Project[]) => {
      saveProjects(projects)
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      stored.patterns = stored.patterns.map((project: Project) => stripPalette(project))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    }

    it('goes into a Project saved without a Palette, once, and the device keys are removed', () => {
      keepOnDevice()
      saveWithoutPalette(makeProject())

      const [opened] = loadProjects()

      // The device's generic red and black are no Bead's default colors now (ticket 1070): the same swatches, added.
      expect(opened!.palette.slice(0, 3)).toEqual(['added-e63746', 'added-123456', 'added-1a1a1a'])
      expect(opened!.palette).toHaveLength(14)
      expect(localStorage.getItem('openbeads:added-colors')).toBeNull()
      expect(localStorage.getItem('openbeads:palette-order')).toBeNull()
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns[0].palette).toContain('added-abcdef')
      expect(loadProjects()[0]!.palette).toEqual(opened!.palette)
    })

    it('leaves a Project that has its own Palette alone, and the keys where they are', () => {
      keepOnDevice()
      saveProjects([makeProject()])

      expect(loadProjects()[0]!.palette).toEqual(makeProject().palette)
      expect(localStorage.getItem('openbeads:added-colors')).not.toBeNull()
    })
  })
})

describe('a library opened with some Projects kept sealed (ticket 0716)', () => {
  /** A stored Project whose Canvas is one solid run per row, never decoded here: rows × columns beads. */
  function storedSolid(id: string, rows: number, columns: number, savedAt: number) {
    const stored = encodeProject({ ...makeProject(), id, savedAt, updatedAt: savedAt }) as unknown as { layers: { encodedBeads: unknown }[] }
    stored.layers[0]!.encodedBeads = { colors: ['#1a1a1a'], rows: Object.fromEntries(Array.from({ length: rows }, (_row, row) => [String(row), `0:1x${columns}`])) }
    return stored
  }

  function store(...patterns: unknown[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 6, patterns }))
  }

  it('keeps a Project the caller picks in its stored form, with what the list shows of it, and decodes the rest', () => {
    const small = makeProject()
    store(storedSolid('huge', 3000, 1000, 5), encodeProject(small))

    const opened = browserLibraryStore.open((summary) => summary.beads > 1_000_000)

    expect(opened.projects.map((project) => project.id)).toEqual([small.id])
    expect(opened.sealed).toMatchObject([{ id: 'huge', beads: 3_000_000, layerBeads: [3_000_000, 0], savedAt: 5 }])
  })

  it('writes a sealed Project back exactly as it was stored, beside the Projects saved after it', async () => {
    const huge = storedSolid('huge', 3000, 1000, 5)
    store(huge)
    browserLibraryStore.open(() => true)

    await browserLibraryStore.save([{ project: makeProject(), knownStored: false }], [])

    const patterns = (JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { patterns: unknown[] }).patterns
    expect(patterns).toContainEqual(huge)
    expect(patterns).toHaveLength(2)
  })

  it('opens a sealed Project as the same Project a whole load gives', () => {
    const painted = paintedOrdinaryProject()
    saveProjects([painted])
    const { sealed } = browserLibraryStore.open(() => true)

    expect(browserLibraryStore.unseal(sealed[0]!)).toEqual(loadProjects()[0])
  })

  it('counts the stored Projects without decoding any, for the main address and the Homepage', async () => {
    store(storedSolid('huge', 3000, 1000, 5), encodeProject(makeProject()))

    await expect(browserLibraryStore.count()).resolves.toBe(2)
    localStorage.setItem(STORAGE_KEY, 'not json')
    await expect(browserLibraryStore.count()).resolves.toBe(0)
  })
})

describe('a layer Background a library stored before ticket 1000', () => {
  /** A Project as an earlier build stored it: its layers' positions in the list of five, with no mark of the list. */
  function storedEarlier(canvas: number | string, frame: number | string) {
    const { backgroundPositions: _list, ...stored } = encodeProject(withBackground(withBackground(makeProject(), 'canvas', 1), 'frame', 1))
    return { ...stored, layers: [{ ...stored.layers[0]!, background: canvas }, { ...stored.layers[1]!, background: frame }] }
  }

  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 1],
    [5, 3],
  ])('opens a position stored as %i as %i, a Custom color untouched', (stored, moved) => {
    storeLibrary([], [storedEarlier(stored, '#336699')])

    const [project] = loadProjects()

    expect(backgroundOf(project!, 'canvas')).toBe(moved)
    expect(backgroundOf(project!, 'frame')).toBe('#336699')
  })

  it('never moves it twice: opened, saved and opened again, it stays where the first open put it', () => {
    storeLibrary([], [storedEarlier(5, 3)])

    saveProjects(loadProjects())
    const [project] = loadProjects()

    expect(backgroundOf(project!, 'canvas')).toBe(3)
    expect(backgroundOf(project!, 'frame')).toBe(2)
  })

  it('moves one kept sealed when it opens, and writes it back as it was stored', () => {
    const earlier = storedEarlier(4, 5)
    storeLibrary([], [earlier])
    const { sealed } = browserLibraryStore.open(() => true)

    const project = browserLibraryStore.unseal(sealed[0]!)
    saveProjects([], sealed)

    expect([backgroundOf(project, 'canvas'), backgroundOf(project, 'frame')]).toEqual([1, 3])
    expect((JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { patterns: unknown[] }).patterns).toEqual([earlier])
  })
})

describe('a library of version 5 opened with a Project kept sealed (ticket 0716)', () => {
  it('keeps it sealed in the current form, brick stitch\'s Brick block read as its Drop, and decodes the rest as before', () => {
    const brick = encodeProject(makeProject('brick')) as unknown as { layers: { techniqueSettings?: Record<string, number> }[] }
    brick.layers[0]!.techniqueSettings = { brickBlock: 2 }
    const other = makeProject()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 5, patterns: [brick, encodeProject(other)] }))
    const whole = loadProjects()

    const opened = browserLibraryStore.open((summary) => summary.id !== other.id)

    expect(opened.projects).toEqual(whole.filter((project) => project.id === other.id))
    expect(browserLibraryStore.unseal(opened.sealed[0]!)).toEqual(whole.find((project) => project.id !== other.id))
  })
})

describe('saving what a tab changed (tickets 0834, 1019)', () => {
  const change = (project: HeldProject, knownStored = true) => ({ project, knownStored })
  const storedIds = () => loadProjects().map((project) => project.id).sort()

  it('writes the Projects changed inside the call, answers later, and leaves every other Project as it is', async () => {
    const [kept, edited] = [makeProject(), makeProject()]
    saveProjects([kept, edited])
    browserLibraryStore.open(() => false)
    const changed = { ...edited, updatedAt: edited.updatedAt + 1 }

    const answer = browserLibraryStore.save([change(changed)], [])

    expect(loadProjects()).toEqual([changed, kept])
    await expect(answer).resolves.toEqual({ dropped: [] })
  })

  it('removes the ids removed', async () => {
    const [kept, removed] = [makeProject(), makeProject()]
    saveProjects([kept, removed])

    await browserLibraryStore.save([], [removed.id])

    expect(storedIds()).toEqual([kept.id])
  })

  it('keeps the Projects another tab stored since this one read, which a whole-library write would have erased', async () => {
    const mine = makeProject()
    saveProjects([mine])
    browserLibraryStore.open(() => false)
    const theirs = makeProject()
    saveProjects([mine, theirs])

    await browserLibraryStore.save([change({ ...mine, updatedAt: mine.updatedAt + 1 })], [])

    expect(storedIds()).toEqual([mine.id, theirs.id].sort())
  })

  it('does not write a Project it knew as stored whose record is gone, and says so', async () => {
    const [removedElsewhere, other] = [makeProject(), makeProject()]
    saveProjects([removedElsewhere, other])
    browserLibraryStore.open(() => false)
    saveProjects([other])

    const answer = await browserLibraryStore.save([change(removedElsewhere), change(makeProject(), false)], [])

    expect(answer.dropped).toEqual([removedElsewhere.id])
    expect(storedIds()).toHaveLength(2)
    expect(storedIds()).not.toContain(removedElsewhere.id)
  })

  it('rejects, writing nothing, when the device refuses the write', async () => {
    saveProjects([makeProject()])
    refuseStorageWrites(STORAGE_KEY)

    await expect(browserLibraryStore.save([change(makeProject(), false)], [])).rejects.toThrow()

    vi.restoreAllMocks()
    expect(loadProjects()).toHaveLength(1)
  })

  it('parses nothing while the value is the one this page wrote (tickets 0677, 0834)', async () => {
    saveProjects([makeProject(), makeProject()])
    const { projects } = browserLibraryStore.open(() => false)
    const edited = { ...projects[0]!, updatedAt: projects[0]!.updatedAt + 1 }
    const parse = vi.spyOn(JSON, 'parse')

    await browserLibraryStore.save([change(edited)], [])
    await browserLibraryStore.reread([edited, projects[1]!], () => false)

    expect(parse).not.toHaveBeenCalled()
  })
})

describe('rereading what another tab stored (tickets 0834, 1019)', () => {
  it('gives nothing while storage holds what the tab holds', async () => {
    const mine = makeProject()
    await browserLibraryStore.save([{ project: mine, knownStored: false }], [])

    await expect(browserLibraryStore.reread([mine], () => false)).resolves.toEqual({ changed: [], gone: [] })
  })

  it('gives the Projects another tab changed or made, as the tab holds them, and the ids gone', async () => {
    const [mine, removed] = [makeProject(), makeProject()]
    saveProjects([mine, removed])
    const held = browserLibraryStore.open(() => false).projects
    const theirs = makeProject()
    const renamed = { ...mine, updatedAt: mine.updatedAt + 1 }
    saveProjects([renamed, theirs])

    const fresh = await browserLibraryStore.reread(held, () => false)

    expect(fresh.changed).toEqual([renamed, theirs])
    expect(fresh.gone).toEqual([removed.id])
  })

  it('keeps a Project the caller picks sealed', async () => {
    const theirs = makeProject()
    saveProjects([theirs])

    const fresh = await browserLibraryStore.reread([], () => true)

    expect(fresh.changed).toMatchObject([{ id: theirs.id, stored: expect.any(String) }])
  })

  it('refuses a stored value it cannot read', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json')

    await expect(browserLibraryStore.reread([], () => false)).rejects.toThrow()
  })

  it("hears another tab's write of the library, and stops hearing when asked", () => {
    const heard = vi.fn()
    const stop = browserLibraryStore.onOutsideChange(heard)

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'openbeads:theme' }))
    stop()
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))

    expect(heard).toHaveBeenCalledTimes(1)
  })
})

describe('the start (spec 1018)', () => {
  it('is ready at once and counts the stored Projects without a start, for the main address and the Homepage', async () => {
    await expect(browserLibraryStore.start()).resolves.toBe('ready')
    await expect(browserLibraryStore.count()).resolves.toBe(0)
    saveProjects([makeProject(), makeProject()])
    await expect(browserLibraryStore.count()).resolves.toBe(2)
  })
})
