import { beforeEach, describe, expect, it } from 'vitest'
import { framedGrid, type Grid, type Project, type RowProgress } from './project'
import { parseProjectsFile } from './projectFile'
import { loadProjects, saveProjects } from '../services/libraryStore'
import libraryFile from './fixtures/library-file.json?raw'
import libraryV1 from './fixtures/library-v1.json?raw'
import libraryV2 from './fixtures/library-v2.json?raw'
import libraryV2OverCap from './fixtures/library-v2-over-cap.json?raw'
import projectFile from './fixtures/project-file.json?raw'

/**
 * Stored-data compatibility (ticket 103, ADR 0018): the renderer work changes how a Project is drawn and nothing about
 * how it is kept, so every library and file format the app has written must keep opening as exactly the Projects it
 * held. The fixtures are committed as literal files, generated once from the pictures below and never by the code under
 * test, so a change to an encoder or decoder can't quietly rewrite what "unchanged" means here.
 */

const STORAGE_KEY = 'bd-beads:patterns'

/** The most cells a Project could be created with before ADR 0019 took the limit away: the fixture below is past it. */
const FORMER_CELL_CAP = 10_000

const COLORS: Record<string, string> = { R: '#c81e3c', B: '#1e64c8', K: '#1f1f1f' }

/** A picture as text, one string per row: a letter is that color's bead, anything else an empty cell. */
function grid(rows: string[]): Grid {
  return rows.map((row) => [...row].map((letter) => ({ color: COLORS[letter] ?? null })))
}

const loomPicture = ['R.B.', '.KR.', 'B..K']
const peyotePicture = ['RRB..', '.KKR.', 'B...R', '..KBB']
const brickPicture = ['R.K', '.BR', 'K.B', 'R..']

const BEAD = 'toho-cube-1.5mm'
const noProgress: RowProgress = { enabled: false, direction: 'rows', currentRow: 0, currentColumn: 0 }

/** A Project the way it should read back: every field present, nothing a newer build dropped still hanging on. */
function expectedProject(fields: Partial<Omit<Project, 'beads' | 'frame'>> & Pick<Project, 'id' | 'name' | 'technique'> & { grid: Grid }): Project {
  const { grid: cells, ...rest } = fields
  return {
    beadId: BEAD,
    ...framedGrid(cells),
    rowProgress: noProgress,
    rotation: 0,
    createdAt: 0,
    updatedAt: 0,
    ...rest,
  }
}

/** The bead's label, which a Project saved before names existed takes as its own. */
const CUBE_LABEL = 'TOHO Cube 1.5mm'

const v1Library: Project[] = [
  expectedProject({
    id: 'v1-oldest',
    name: CUBE_LABEL,
    technique: 'loom',
    grid: grid(loomPicture),
    // Saved before direction and the column pointer existed: they come back defaulted, the row pointer as it was.
    rowProgress: { enabled: true, direction: 'rows', currentRow: 1, currentColumn: 0 },
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
  }),
  expectedProject({
    id: 'v1-later',
    name: 'Peyote strap',
    technique: 'peyote',
    grid: grid(peyotePicture),
    rowProgress: { enabled: true, direction: 'columns', currentRow: 2, currentColumn: 3 },
    rotation: 90,
    imageColors: ['#c81e3c', '#1e64c8', '#1f1f1f'],
    createdAt: 1700000002000,
    updatedAt: 1700000003000,
  }),
]

const v2Library: Project[] = [
  expectedProject({
    id: 'v2-brick',
    name: 'Brick swatch',
    technique: 'brick',
    grid: grid(brickPicture),
    createdAt: 1710000000000,
    updatedAt: 1710000001000,
  }),
  expectedProject({
    id: 'v2-loom',
    name: 'Loom rotated',
    technique: 'loom',
    grid: grid(loomPicture),
    rowProgress: { enabled: true, direction: 'columns', currentRow: 2, currentColumn: 1 },
    rotation: 90,
    imageColors: ['#c81e3c', '#1e64c8'],
    createdAt: 1710000002000,
    updatedAt: 1710000003000,
  }),
]

/** 101 × 101 = 10,201 beads, one past the cap's worth of rows: rows cycle red, empty, blue. */
const overCapRows = Array.from({ length: 101 }, (_row, row) => ['R', '.', 'B'][row % 3]!.repeat(101))
const overCapProject = expectedProject({
  id: 'v2-over-cap',
  name: 'Over the cap',
  technique: 'peyote',
  grid: grid(overCapRows),
  rowProgress: { enabled: true, direction: 'rows', currentRow: 50, currentColumn: 0 },
  createdAt: 1720000000000,
  updatedAt: 1720000001000,
})

const fileRowProgress: RowProgress = { enabled: true, direction: 'rows', currentRow: 1, currentColumn: 0 }
const fileProjects = {
  peyote: expectedProject({
    id: 'file-one',
    name: 'Shared peyote',
    technique: 'peyote',
    grid: grid(peyotePicture),
    rowProgress: fileRowProgress,
    createdAt: 1730000000000,
    updatedAt: 1730000001000,
  }),
  loom: expectedProject({
    id: 'file-a',
    name: 'Loom in a file',
    technique: 'loom',
    grid: grid(loomPicture),
    rowProgress: fileRowProgress,
    createdAt: 1730000000000,
    updatedAt: 1730000001000,
  }),
  brick: expectedProject({
    id: 'file-b',
    name: 'Brick in a file',
    technique: 'brick',
    grid: grid(brickPicture),
    rowProgress: fileRowProgress,
    createdAt: 1730000000000,
    updatedAt: 1730000001000,
  }),
}

beforeEach(() => {
  localStorage.clear()
})

describe('stored-data compatibility', () => {
  describe('the browser library', () => {
    it('opens a version 1 library (a bare array, an object per cell) as the Projects it held', () => {
      localStorage.setItem(STORAGE_KEY, libraryV1)

      expect(loadProjects()).toEqual(v1Library)
    })

    it('opens a version 2 library (the versioned envelope, compact cells) as the Projects it held', () => {
      localStorage.setItem(STORAGE_KEY, libraryV2)

      expect(loadProjects()).toEqual(v2Library)
    })

    it('opens a Project larger than the current cell cap, every bead where it was', () => {
      expect(overCapProject.frame!.columns * overCapProject.frame!.rows).toBeGreaterThan(FORMER_CELL_CAP)
      localStorage.setItem(STORAGE_KEY, libraryV2OverCap)

      expect(loadProjects()).toEqual([overCapProject])
    })

    it('keeps an unreadable value aside only for a value it cannot read, never for these', () => {
      for (const stored of [libraryV1, libraryV2, libraryV2OverCap]) {
        localStorage.setItem(STORAGE_KEY, stored)
        loadProjects()
      }

      expect(localStorage.getItem('bd-beads:patterns:unreadable')).toBeNull()
    })

    it.each([
      ['version 1', libraryV1, v1Library],
      ['version 2', libraryV2, v2Library],
      ['over-cap', libraryV2OverCap, [overCapProject]],
    ])('saves a %s library back in the current format and reads it back the same', (_label, stored, expected) => {
      localStorage.setItem(STORAGE_KEY, stored)

      saveProjects(loadProjects())

      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 3 })
      expect(loadProjects()).toEqual(expected)
    })

    it('writes the current format the same way every time: save, load, save again is byte-for-byte the same', () => {
      localStorage.setItem(STORAGE_KEY, libraryV2)

      saveProjects(loadProjects())
      const first = localStorage.getItem(STORAGE_KEY)
      saveProjects(loadProjects())

      expect(localStorage.getItem(STORAGE_KEY)).toBe(first)
    })
  })

  describe('Project files', () => {
    it('opens a single-Project file as the Project it held', () => {
      expect(parseProjectsFile(projectFile).projects).toEqual([fileProjects.peyote])
    })

    it('opens a whole-library file as every Project it held, in order', () => {
      expect(parseProjectsFile(libraryFile).projects).toEqual([fileProjects.loom, fileProjects.brick])
    })
  })
})
