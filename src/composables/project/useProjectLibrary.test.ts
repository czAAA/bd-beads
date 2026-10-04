import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, paintCells, type Project, frameGrid } from '../../domain/project'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { loadProjects } from '../../services/libraryStore'
import { refuseStorageWrites, spyOnStorageWrites } from '../../testUtils/storageWrites'
import { useProjectLibrary } from './useProjectLibrary'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    ...createProject({
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    }),
    ...overrides,
  }
}

/** One painted cell, the way a stroke's per-cell commit arrives at replaceProject. */
function withPaintedCell(project: Project, row: number, column: number): Project {
  return paintCells(project, [{ row, column }], '#e63746', NO_MIRROR_AXES, false)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useProjectLibrary', () => {
  it('starts from what was saved, with the most recently updated Project open', () => {
    const older = makeProject({ updatedAt: 1000 })
    const newer = makeProject({ updatedAt: 2000 })
    localStorage.setItem('bd-beads:patterns', JSON.stringify([older, newer]))

    const library = useProjectLibrary()

    expect(library.projects.value.map((project) => project.id)).toEqual([newer.id, older.id])
    expect(library.activeProjectId.value).toBe(newer.id)
    expect(library.activeProject.value?.id).toBe(newer.id)
  })

  it('opens nothing when nothing has been saved yet', () => {
    const library = useProjectLibrary()

    expect(library.projects.value).toEqual([])
    expect(library.activeProjectId.value).toBeUndefined()
    expect(library.activeProject.value).toBeUndefined()
  })

  it('adds a Project, opens it, and persists straight away', () => {
    const library = useProjectLibrary()

    library.addProject(makeProject())

    expect(library.activeProjectId.value).toBe(library.projects.value[0]!.id)
    expect(loadProjects()).toEqual(library.projects.value)
  })

  it('persists a replaced Project straight away by default', () => {
    const library = useProjectLibrary()
    const project = makeProject()
    library.addProject(project)

    library.replaceProject(withPaintedCell(project, 0, 0))

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('holds back a deferred replace until the pending save is flushed', () => {
    const library = useProjectLibrary()
    const project = makeProject()
    library.addProject(project)

    library.replaceProject(withPaintedCell(project, 0, 0), { deferSave: true })

    expect(frameGrid(library.activeProject.value!)[0]![0]!.color).toBe('#e63746')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()

    library.flushPendingSave()

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('writes once for a whole stroke of deferred cells, not once per cell', () => {
    const library = useProjectLibrary()
    library.addProject(makeProject())

    const writes = spyOnStorageWrites()
    for (let column = 0; column < 10; column++) {
      library.replaceProject(withPaintedCell(library.activeProject.value!, 0, column), { deferSave: true })
    }
    expect(writes.count).toBe(0)

    library.flushPendingSave()

    expect(writes.count).toBe(1)
    expect(frameGrid(loadProjects()[0]!)[0]!.every((cell) => cell.color === '#e63746')).toBe(true)
  })

  it('flushing with nothing pending writes nothing', () => {
    const library = useProjectLibrary()
    library.addProject(makeProject())

    const writes = spyOnStorageWrites()
    library.flushPendingSave()

    expect(writes.count).toBe(0)
  })

  it('persists an immediate change together with whatever a deferred one left pending', () => {
    const library = useProjectLibrary()
    const project = makeProject()
    library.addProject(project)

    library.replaceProject(withPaintedCell(project, 0, 0), { deferSave: true })
    library.replaceProject(withPaintedCell(library.activeProject.value!, 1, 1))

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')
  })

  it('removes a Project, persists the removal, and opens another remaining one', () => {
    const library = useProjectLibrary()
    const first = makeProject({ updatedAt: 1000 })
    const second = makeProject({ updatedAt: 2000 })
    library.addProject(first)
    library.addProject(second)

    library.removeProject(second.id)

    expect(library.projects.value.map((project) => project.id)).toEqual([first.id])
    expect(library.activeProjectId.value).toBe(first.id)
    expect(loadProjects().map((project) => project.id)).toEqual([first.id])
  })

  it('leaves the open Project alone when a different one is removed', () => {
    const library = useProjectLibrary()
    const first = makeProject({ updatedAt: 1000 })
    const second = makeProject({ updatedAt: 2000 })
    library.addProject(first)
    library.addProject(second)

    library.removeProject(first.id)

    expect(library.activeProjectId.value).toBe(second.id)
  })

  it('adds imported Projects and persists them', () => {
    const library = useProjectLibrary()
    const imported = [makeProject({ updatedAt: 1000 }), makeProject({ updatedAt: 2000 })]

    library.addProjects(imported)

    expect(loadProjects().map((project) => project.id)).toEqual([imported[1]!.id, imported[0]!.id])
    expect(library.activeProjectId.value).toBe(imported[1]!.id)
  })

  it('never interrupts an open Project when importing', () => {
    const library = useProjectLibrary()
    const open = makeProject({ updatedAt: 1000 })
    library.addProject(open)

    library.addProjects([makeProject({ updatedAt: 5000 })])

    expect(library.activeProjectId.value).toBe(open.id)
  })

  it('reports a failed save instead of throwing, and clears the report once a save gets through', () => {
    const library = useProjectLibrary()
    const project = makeProject()
    library.addProject(project)
    expect(library.saveFailed.value).toBe(false)

    const failing = refuseStorageWrites()
    expect(() => library.replaceProject(withPaintedCell(project, 0, 0))).not.toThrow()
    expect(library.saveFailed.value).toBe(true)

    failing.mockRestore()
    library.replaceProject(withPaintedCell(library.activeProject.value!, 1, 1))

    expect(library.saveFailed.value).toBe(false)
  })

  it('reports a failed save on a deferred stroke only once it is flushed', () => {
    const library = useProjectLibrary()
    const project = makeProject()
    library.addProject(project)

    refuseStorageWrites()
    library.replaceProject(withPaintedCell(project, 0, 0), { deferSave: true })
    expect(library.saveFailed.value).toBe(false)

    library.flushPendingSave()

    expect(library.saveFailed.value).toBe(true)
  })

  it('keeps a failed change pending so the next save retries it', () => {
    const library = useProjectLibrary()
    const project = makeProject()
    library.addProject(project)

    const failing = refuseStorageWrites()
    library.replaceProject(withPaintedCell(project, 0, 0))
    failing.mockRestore()

    library.flushPendingSave()

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    expect(library.saveFailed.value).toBe(false)
  })

  describe('saveNow (ticket 115)', () => {
    it('writes a deferred change straight away and reports that it landed', () => {
      const library = useProjectLibrary()
      const project = makeProject()
      library.addProject(project)
      library.replaceProject(withPaintedCell(project, 0, 0), { deferSave: true })

      const saved = library.saveNow()

      expect(saved).toBe(true)
      expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    })

    it('writes even with nothing pending, so a "saved" answer never rests on an assumption', () => {
      const library = useProjectLibrary()
      library.addProject(makeProject())

      const writes = spyOnStorageWrites()

      expect(library.saveNow()).toBe(true)
      expect(writes.count).toBe(1)
    })

    it('reports a refused write and raises saveFailed', () => {
      const library = useProjectLibrary()
      library.addProject(makeProject())

      refuseStorageWrites()

      expect(library.saveNow()).toBe(false)
      expect(library.saveFailed.value).toBe(true)
    })

    it('clears an earlier saveFailed once the write gets through', () => {
      const library = useProjectLibrary()
      const project = makeProject()
      library.addProject(project)
      const failing = refuseStorageWrites()
      library.replaceProject(withPaintedCell(project, 0, 0))
      failing.mockRestore()

      expect(library.saveNow()).toBe(true)
      expect(library.saveFailed.value).toBe(false)
    })
  })

  describe('last-saved order (ticket 145)', () => {
    const ids = (library: ReturnType<typeof useProjectLibrary>) => library.projects.value.map((project) => project.id)

    function storedLibrary(...projects: Project[]) {
      localStorage.setItem('bd-beads:patterns', JSON.stringify(projects))
    }

    it('gives a library saved before the order existed a stable order, newest edit first, loading every Project unchanged', () => {
      const a = makeProject({ updatedAt: 1000 })
      const b = makeProject({ updatedAt: 3000 })
      const c = makeProject({ updatedAt: 2000 })
      const d = makeProject({ updatedAt: 2000 })
      storedLibrary(a, b, c, d)

      const library = useProjectLibrary()

      expect(ids(library)).toEqual([b.id, c.id, d.id, a.id])
      expect(library.projects.value.find((project) => project.id === a.id)).toEqual(a)
      expect(ids(useProjectLibrary())).toEqual([b.id, c.id, d.id, a.id])
    })

    it('puts a new Project first, and keeps that order across a reload', () => {
      const older = makeProject({ updatedAt: 5000, savedAt: 5000 })
      storedLibrary(older)
      const library = useProjectLibrary()

      const created = makeProject({ updatedAt: 1 })
      library.addProject(created)

      expect(ids(library)).toEqual([created.id, older.id])
      expect(ids(useProjectLibrary())).toEqual([created.id, older.id])
    })

    it('moves a Project to the front when a change to it is saved, even one saved before', () => {
      const first = makeProject({ savedAt: 3000 })
      const second = makeProject({ savedAt: 2000 })
      const third = makeProject({ savedAt: 1000 })
      storedLibrary(first, second, third)
      const library = useProjectLibrary()

      library.replaceProject(withPaintedCell(third, 0, 0))

      expect(ids(library)).toEqual([third.id, first.id, second.id])
      expect(ids(useProjectLibrary())).toEqual([third.id, first.id, second.id])
    })

    it('moves the open Project to the front on Save, even with nothing changed', () => {
      const first = makeProject({ savedAt: 3000, updatedAt: 3000 })
      const opened = makeProject({ savedAt: 1000, updatedAt: 1000 })
      storedLibrary(first, opened)
      const library = useProjectLibrary()
      library.activeProjectId.value = opened.id

      library.saveNow()

      expect(ids(library)).toEqual([opened.id, first.id])
      expect(ids(useProjectLibrary())).toEqual([opened.id, first.id])
    })

    it('puts imported Projects first, the most recently edited of them leading', () => {
      const existing = makeProject({ savedAt: 5000, updatedAt: 9000 })
      storedLibrary(existing)
      const library = useProjectLibrary()

      const older = makeProject({ updatedAt: 1000 })
      const newer = makeProject({ updatedAt: 2000 })
      library.addProjects([older, newer])

      expect(ids(library)).toEqual([newer.id, older.id, existing.id])
      expect(ids(useProjectLibrary())).toEqual([newer.id, older.id, existing.id])
    })

    it('keeps the order of the rest when one is removed', () => {
      const first = makeProject({ savedAt: 3000 })
      const second = makeProject({ savedAt: 2000 })
      const third = makeProject({ savedAt: 1000 })
      storedLibrary(first, second, third)
      const library = useProjectLibrary()

      library.removeProject(second.id)

      expect(ids(library)).toEqual([first.id, third.id])
      expect(ids(useProjectLibrary())).toEqual([first.id, third.id])
    })
  })
})
