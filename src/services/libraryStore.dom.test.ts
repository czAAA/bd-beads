import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProject, type Grid, type Project, type Technique, frameGrid, withFrameGrid } from '../domain/project'
import { loadProjects, saveProjects } from './libraryStore'
import { parseProjectsFile, serializeLibrary } from '../domain/projectFile'
import { BEAD_CATALOG } from '../domain/beads'
import { refuseStorageWrites } from '../testUtils/storageWrites'

const STORAGE_KEY = 'openbeads:patterns'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

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

  it('saves a whole library in one write', () => {
    const first = makeProject()
    const second = makeProject()

    saveProjects([first, second])

    expect(loadProjects()).toEqual([first, second])
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
    const { name: _name, ...legacyProject } = makeProject()
    localStorage.setItem('openbeads:patterns', JSON.stringify([legacyProject]))

    expect(loadProjects()[0]!.name).toBe('TOHO Cube 1.5mm')
  })

  it('loads a Project saved before ADR 0026 that still carries its millimetre size, ignoring it', () => {
    const project = makeProject()
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...project, widthMm: 15, heightMm: 15 }]))

    const [loaded] = loadProjects()

    expect(loaded!.frame!.columns).toBe(project.frame!.columns)
    expect(loaded!.frame!.rows).toBe(project.frame!.rows)
    expect(loaded).not.toHaveProperty('widthMm')
    expect(loaded).not.toHaveProperty('heightMm')
  })

  it('does not write the millimetre size back when such a Project is saved again', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...makeProject(), widthMm: 15, heightMm: 15 }]))

    saveProjects(loadProjects())

    const raw = localStorage.getItem(STORAGE_KEY)!
    expect(raw).not.toContain('widthMm')
    expect(raw).not.toContain('heightMm')
  })

  it('lets a write that does not fit through to the caller instead of swallowing it', () => {
    refuseStorageWrites()

    expect(() => saveProjects([makeProject()])).toThrow()
  })

  describe('the compact stored format (ADR 0009)', () => {
    it('writes a version marker and a compact grid instead of an object per cell', () => {
      saveProjects([makeProject()])

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(stored.version).toBe(4)
      expect(stored.patterns[0].grid).toBeUndefined()
      expect(stored.patterns[0].encodedBeads).toEqual({ colors: [], rows: {} })
      expect(stored.patterns[0].frame.encodedBeads).toEqual({ colors: [], rows: {} })
    })

    it('reads a library saved in the old unversioned format back unchanged', () => {
      const project = makeProject()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([project]))

      expect(loadProjects()).toEqual([project])
    })

    it('rewrites a library saved in the old format compactly on the next save', () => {
      const legacy = paintedOrdinaryProject()
      localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy]))
      const legacyBytes = storedBytes()

      const loaded = loadProjects()
      saveProjects(loaded)

      expect(loaded).toEqual([legacy])
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(4)
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
      const { beads: _beads, frame: _frame, ...base } = makeProject()
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
      const { beads: _beads, frame: _frame, ...base } = makeProject()
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

      expect(JSON.parse(exported).projects[0].encodedBeads).toBeDefined()
      expect(parseProjectsFile(exported).projects).toEqual([project])
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

      expect(opened!.palette.slice(0, 3)).toEqual(['red', 'added-123456', 'black'])
      expect(opened!.palette).toHaveLength(14)
      expect(localStorage.getItem('openbeads:added-colors')).toBeNull()
      expect(localStorage.getItem('openbeads:palette-order')).toBeNull()
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).patterns[0].palette).toContain('added-abcdef')
      expect(loadProjects()[0]!.palette).toEqual(opened!.palette)
    })

    it('leaves a Project that has its own Palette alone, and the keys where they are', () => {
      keepOnDevice()
      saveProjects([makeProject()])

      expect(loadProjects()[0]!.palette).toHaveLength(12)
      expect(localStorage.getItem('openbeads:added-colors')).not.toBeNull()
    })
  })
})
