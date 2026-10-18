// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../domain/beads'
import {
  createProject,
  createProjectFromImage,
  moveToRow,
  paintCells,
  withFrame,
  type Project,
} from '../domain/project'
import { serializeLibrary } from '../domain/projectFile'
import { MAX_FILE_BYTES, MAX_UNPACKED_BYTES, packLibraryFile, packProjectFile, readProjectsFile } from './projectFileCodec'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(name = 'Fox'): Project {
  return createProject({ name, technique: 'peyote', beadId: cubeBead.id, size: { width: 15, height: 15, unit: 'mm' } })
}

const asFile = (bytes: BlobPart) => new Blob([bytes])
const gzipText = async (text: string) =>
  new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())

async function roundTrip(project: Project): Promise<Project> {
  const { projects } = await readProjectsFile(asFile(await packProjectFile(project)))
  return projects[0]!
}

describe('a .openbeads file', () => {
  it('is gzip', async () => {
    const bytes = await packProjectFile(makeProject())
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b])
  })

  it('round-trips a Custom colour and hexes outside the Palette', async () => {
    const painted = paintCells(makeProject(), [{ row: 1, column: 1 }, { row: 1, column: 2 }], '#123456', { columns: 0, rows: 0 })
    expect(await roundTrip(painted)).toEqual(painted)
  })

  it('round-trips an empty canvas', async () => {
    const empty = { ...makeProject(), beads: {}, frame: undefined } as Project
    expect(await roundTrip(empty)).toEqual(await roundTrip(await roundTrip(empty)))
  })

  it('round-trips a single bead', async () => {
    const one = paintCells({ ...makeProject(), beads: {}, frame: undefined } as Project, [{ row: 5, column: 7 }], '#abcdef', { columns: 0, rows: 0 })
    expect(await roundTrip(one)).toEqual(one)
  })

  it('round-trips a grid where every neighbour differs', async () => {
    let project = makeProject()
    const cells = Array.from({ length: 6 }, (_, i) => ({ row: 0, column: i }))
    for (const [i, cell] of cells.entries()) {
      project = paintCells(project, [cell], `#${(i + 1).toString(16).repeat(6)}`, { columns: 0, rows: 0 })
    }
    expect(await roundTrip(project)).toEqual(project)
  })

  it('round-trips a Russian name, a Frame, Row progress, Image colors and a field this build does not know', async () => {
    const project = {
      ...moveToRow(
        createProjectFromImage({
          name: 'Лиса',
          technique: 'peyote',
          beadId: cubeBead.id,
          size: { width: 4.5, height: 4.5, unit: 'mm' },
          grid: [
            [{ color: '#ff0000' }, { color: '#00ff00' }, { color: null }],
            [{ color: null }, { color: '#ff0000' }, { color: '#0000ff' }],
            [{ color: '#0000ff' }, { color: null }, { color: '#00ff00' }],
          ],
          imageColors: ['#ff0000', '#00ff00', '#0000ff'],
        }),
        2,
      ),
      futureField: { a: 1 },
    } as Project
    const restored = await roundTrip(withFrame(project, project.frame))
    expect(restored).toEqual(project)
    expect(restored.name).toBe('Лиса')
  })

  it('round-trips a library of several Projects', async () => {
    const library = [makeProject('Fox'), makeProject('Owl'), makeProject('Лиса')]
    const { projects } = await readProjectsFile(asFile(await packLibraryFile(library)))
    expect(projects).toEqual(library)
  })

  it('is a fraction of the plain JSON', async () => {
    const bigger = paintCells(makeProject(), [{ row: 3, column: 3 }], '#e63746', { columns: 0, rows: 0 })
    expect((await packProjectFile(bigger)).byteLength).toBeLessThan(serializeLibrary([bigger]).length)
  })
})

describe('refusing a file', () => {
  it('refuses a file that is neither format and a gzip that does not unpack', async () => {
    await expect(readProjectsFile(asFile('hello'))).rejects.toThrow()
    await expect(readProjectsFile(asFile(new Uint8Array([0x1f, 0x8b, 1, 2, 3])))).rejects.toThrow()
  })

  it('refuses a gzip of something that is not an openbeads file, or of a version this build does not know', async () => {
    await expect(readProjectsFile(asFile(await gzipText('{"kind":"x"}')))).rejects.toThrow()
    const future = JSON.parse(serializeLibrary([makeProject()]))
    future.version = 99
    await expect(readProjectsFile(asFile(await gzipText(JSON.stringify(future))))).rejects.toThrow()
  })
})

describe('a plain .json file from before ADR 0048 (deprecated)', () => {
  it('still imports', async () => {
    const project = paintCells(makeProject(), [{ row: 2, column: 3 }], '#e63746', { columns: 0, rows: 0 })
    const file = JSON.stringify({ kind: 'bd-beads/pattern', version: 3, patterns: [project] }, null, 2)
    expect((await readProjectsFile(asFile(file))).projects).toEqual([project])
    const library = JSON.stringify({ kind: 'bd-beads/library', version: 2, patterns: [project] })
    expect((await readProjectsFile(asFile(library))).projects).toEqual([project])
  })

  it('refuses an unknown kind or version', async () => {
    await expect(readProjectsFile(asFile('{"kind":"bd-beads/pattern","version":99,"patterns":[]}'))).rejects.toThrow()
    await expect(readProjectsFile(asFile('{"kind":"openbeads/project","version":3,"projects":[]}'))).rejects.toThrow()
  })
})

describe('the size limits (ticket 469)', () => {
  it('refuses a file over 25 MB without reading it', async () => {
    const big = { size: MAX_FILE_BYTES + 1, arrayBuffer: () => Promise.reject(new Error('read')) } as unknown as Blob
    await expect(readProjectsFile(big)).rejects.toThrow('size limit')
  })

  it('aborts a gzip that unpacks past 100 MB', async () => {
    const zeros = new Uint8Array(MAX_UNPACKED_BYTES + 1024 * 1024)
    const bomb = new Uint8Array(await new Response(new Blob([zeros]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
    expect(bomb.length).toBeLessThan(MAX_FILE_BYTES)
    await expect(readProjectsFile(asFile(bomb))).rejects.toThrow('size limit')
  })
})
