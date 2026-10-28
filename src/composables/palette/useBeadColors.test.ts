import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { projectPalette } from '../../domain/palette'
import { listedColorName } from '../../i18n/colorName'
import { en } from '../../i18n/en'
import { paintAt } from '../../testUtils/layers'
import { editHarness } from '../../testUtils/editHarness'
import { useProjectPalette } from '../tools/usePalette'
import { useBeadColors } from './useBeadColors'

const delica = createProject({ technique: 'loom', beadId: 'miyuki/delica/11-0', size: { width: 3, height: 3, unit: 'beads' } })
const toho = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })

function setup(project = delica) {
  const harness = editHarness(project)
  const { currentProject } = harness
  const { palette, addUsed } = useProjectPalette({ currentProject, edit: harness.edit })
  return { harness, palette, ...useBeadColors({ currentProject, palette, addUsed }) }
}

describe('useBeadColors', () => {
  it('offers nothing for a Bead with no Color catalog', async () => {
    const { available, load, swatches } = setup(toho)
    await load()
    expect(available.value).toBe(false)
    expect(swatches.value).toEqual([])
  })

  it('lists the Delica codes of the Project’s size once loaded', async () => {
    const { available, load, swatches, state } = setup()
    expect(available.value).toBe(true)
    expect(state.value).toBe('idle')
    await load()
    expect(state.value).toBe('ready')
    expect(swatches.value.length).toBeGreaterThan(100)
    expect(swatches.value.find((entry) => entry.code === 'DB1')).toMatchObject({ approximate: true })
  })

  it('adds a code’s color as one Edit that Undo takes back, shows it as taken, and says a second add knew it', async () => {
    const { harness, load, swatches, add } = setup()
    await load()
    const entry = swatches.value.find((candidate) => !candidate.taken)!
    expect(add(entry.hex)).toBe('added')
    expect(harness.project.palette).toContain(`added-${entry.hex.slice(1)}`)
    expect(swatches.value.find((candidate) => candidate.code === entry.code)!.taken).toBe(true)
    expect(add(entry.hex)).toBe('known')
    harness.history.onUndo()
    expect(harness.project.palette).not.toContain(`added-${entry.hex.slice(1)}`)
  })
})

describe('a swatch added from the catalog keeps its code (ticket 0538)', () => {
  it('saves the code with the Project, shows it in Beads needed, and Undo takes it back', async () => {
    const { harness, palette, load, swatches, add } = setup()
    await load()
    const entry = swatches.value.find((candidate) => !candidate.taken)!
    add(entry.hex, entry.code)
    expect(harness.project.paletteCodes).toEqual({ [entry.hex]: entry.code })
    expect(palette.value.byHex(entry.hex)?.code).toBe(entry.code)
    const painted = paintAt(harness.project, [{ row: 0, column: 0 }], entry.hex)
    expect(listedColorName(en, projectPalette(painted).byHex(entry.hex), entry.hex)).toContain(entry.code)
    harness.history.onUndo()
    expect(harness.project.paletteCodes).toBeUndefined()
  })
})
