import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { withColors } from '../../domain/canvas'
import type { Project } from '../../domain/project'
import type { SinceFileStore, SinceFiles } from '../../services/sinceFileStore'
import { bareProject, withLayers } from '../../testUtils/layerFields'
import { useBeadsSinceFile } from './useBeadsSinceFile'

const painted = (count: number) => withColors({}, Array.from({ length: count }, (_, column) => ({ row: 0, column, color: '#e63746' })))

function setup(stored: SinceFiles = {}, ids = ['test']) {
  let kept = stored
  const store: SinceFileStore = { read: () => kept, write: (next) => void (kept = next) }
  const open = ref<Project | undefined>(bareProject({}))
  const library = ref(ids)
  const since = useBeadsSinceFile({ currentProject: () => open.value, libraryIds: () => library.value, store, now: () => 1000 })
  return { since, open, library, kept: () => kept }
}

describe('useBeadsSinceFile', () => {
  const empty = bareProject({})
  const five = withLayers(empty, { beads: painted(5) })

  it('counts a new Project from its first bead, adds an Edit and Redo, takes off Undo, and keeps it on the device', () => {
    const { since, kept } = setup()
    expect(since.current.value).toEqual({ beads: 0 })

    since.count(empty, five, 1)
    since.count(five, empty, -1)
    since.count(empty, five, 1)
    since.count(five, withLayers(five, { beads: painted(7) }), 1)

    expect(since.current.value).toEqual({ beads: 7 })
    expect(kept()).toEqual({ test: { beads: 7 } })
  })

  it('reads what a reload kept', () => {
    expect(setup({ test: { beads: 64, lastFileAt: 5 } }).since.current.value).toEqual({ beads: 64, lastFileAt: 5 })
  })

  it('goes back to 0 with the time of the file when a Project file is saved', () => {
    const { since } = setup({ test: { beads: 64 } })
    since.fileSaved(['test'])

    expect(since.current.value).toEqual({ beads: 0, lastFileAt: 1000 })
  })

  it('gives a duplicate its original\'s count and time, and an import 0', () => {
    const { since, kept } = setup({ test: { beads: 64, lastFileAt: 5 }, old: { beads: 9 } }, ['test', 'old'])
    since.duplicated('test', 'copy')
    since.imported(['old'])

    expect(kept()).toMatchObject({ copy: { beads: 64, lastFileAt: 5 }, old: { beads: 0 } })
  })

  it('drops the records of no Project at start, and a Project\'s when it leaves the library', async () => {
    const { library, kept } = setup({ test: { beads: 3 }, gone: { beads: 4 }, other: { beads: 5 } }, ['test', 'other'])
    expect(Object.keys(kept())).toEqual(['test', 'other'])

    library.value = ['other']
    await nextTick()
    expect(Object.keys(kept())).toEqual(['other'])
  })

  it('counts nothing with no Project open', () => {
    const { since, open, kept } = setup()
    open.value = undefined
    since.count(empty, five, 1)

    expect(kept()).toEqual({})
  })
})
