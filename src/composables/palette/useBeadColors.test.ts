import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { swatchHex } from '../../domain/beadSwatch'
import { createProject } from '../../domain/project'
import { editHarness } from '../../testUtils/editHarness'
import { useProjectPalette } from '../tools/usePalette'
import { useBeadColors } from './useBeadColors'

const delica = createProject({ technique: 'loom', beadId: 'miyuki/delica/11-0', size: { width: 3, height: 3, unit: 'beads' } })
const toho = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })

function setup(project = delica) {
  const harness = editHarness(project)
  // The harness holds a plain Project; a counter makes each Edit reach the computeds like the app's reactive one.
  const edits = ref(0)
  const replace = harness.replaceProject.getMockImplementation()!
  harness.replaceProject.mockImplementation((next) => {
    replace(next)
    edits.value++
  })
  const currentProject = () => (edits.value, harness.currentProject())
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

  it('adds a code’s color as one Edit that Undo takes back, and shows it as taken', async () => {
    const { harness, load, swatches, add } = setup()
    await load()
    const entry = swatches.value.find((candidate) => !candidate.taken)!
    expect(add(entry.hex)).toBe('added')
    expect(harness.project.palette).toContain(`added-${entry.hex.slice(1)}`)
    expect(swatches.value.find((candidate) => candidate.code === entry.code)!.taken).toBe(true)
    harness.history.onUndo()
    expect(harness.project.palette).not.toContain(`added-${entry.hex.slice(1)}`)
  })

  it('does not add a color the Palette already holds', async () => {
    const { harness, load, add } = setup()
    await load()
    const before = harness.project.palette
    expect(add(swatchHex('Blue', 'opaque')!)).toBe('known')
    expect(harness.project.palette).toEqual(before)
  })
})
