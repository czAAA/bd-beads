import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { beadCopy, DEFAULT_BEAD } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { createPalette, defaultPaletteIds, projectPalette } from '../../domain/palette'
import { listedColorName } from '../../i18n/colorName'
import { en } from '../../i18n/en'
import { paintAt } from '../../testUtils/layers'
import { editHarness } from '../../testUtils/editHarness'
import { withLayers } from '../../testUtils/layerFields'
import { useProjectPalette } from '../tools/usePalette'
import { useBeadColors } from './useBeadColors'

const delica = createProject({ technique: 'loom', beadId: 'miyuki/delica/11-0', size: { width: 3, height: 3, unit: 'beads' } })
const toho = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const tohoRound = createProject({ technique: 'loom', beadId: 'toho/round/11-0', size: { width: 3, height: 3, unit: 'beads' } })
/** A Project on a Bead the registry lacks: the only Bead without a Color catalog, as every registry Bead has one
 * (ticket 0694). */
const noCatalog = withLayers(toho, { beadId: 'brand/gone/1', bead: { ...beadCopy(DEFAULT_BEAD), id: 'brand/gone/1' } })

function setup(project = delica) {
  const harness = editHarness(project)
  const { currentProject } = harness
  const { palette, addUsed } = useProjectPalette({ currentProject, edit: harness.edit })
  return { harness, palette, ...useBeadColors({ currentProject, palette, addUsed }) }
}

describe('useBeadColors', () => {
  it('offers a catalog only while it is the Bead\'s own, none after Replace Bead until it is loaded (ticket 0760)', async () => {
    const current = ref(tohoRound)
    const { catalog, load } = useBeadColors({ currentProject: () => current.value, palette: ref(createPalette(defaultPaletteIds())), addUsed: () => ({ outcome: 'known' }) })
    await load()
    expect(catalog.value?.id).toBe('toho')
    current.value = delica
    expect(catalog.value).toBeUndefined()
    await load()
    expect(catalog.value?.id).toBe('miyuki-delica')
  })

  it('offers nothing for a Bead with no Color catalog', async () => {
    const { available, load, swatches } = setup(noCatalog)
    await load()
    expect(available.value).toBe(false)
    expect(swatches.value).toEqual([])
  })

  it('lists TOHO Round 11/0 codes from the one toho catalog, each approximate (ticket 0694)', async () => {
    const { available, load, swatches, state } = setup(tohoRound)
    expect(available.value).toBe(true)
    await load()
    expect(state.value).toBe('ready')
    expect(swatches.value.find((entry) => entry.code === '1')).toMatchObject({ family: 'Crystal', finish: 'transparent', approximate: true })
    expect(swatches.value.every((entry) => entry.approximate)).toBe(true)
  })

  it('lists TOHO Cube 1.5mm real codes, from TOHO\'s international cube card (ticket 0695)', async () => {
    const { available, load, swatches, state } = setup(toho)
    expect(available.value).toBe(true)
    await load()
    expect(state.value).toBe('ready')
    expect(swatches.value.length).toBeGreaterThan(0)
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

describe('a Project on a Miyuki Round Bead (ticket 0693)', () => {
  const round = createProject({ technique: 'loom', beadId: 'miyuki/round/6-0', size: { width: 3, height: 3, unit: 'beads' } })

  it('lists the Round codes of its size, the square-hole ones among them, and no Delica code', async () => {
    const { load, swatches, state } = setup(round)
    await load()
    expect(state.value).toBe('ready')
    const codes = swatches.value.map((entry) => entry.code)
    expect(codes).toContain('3271')
    expect(codes).not.toContain('DB1')
    expect(swatches.value.find((entry) => entry.code === '3271')).toMatchObject({ approximate: true, discontinued: false })
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

  it('prefills a color Report from the highlighted swatch, else the active Palette color with a code (ticket 0700)', async () => {
    const harness = editHarness(delica)
    const { currentProject } = harness
    const { palette, addUsed } = useProjectPalette({ currentProject, edit: harness.edit })
    const reports: unknown[] = []
    const active: { id?: string } = {}
    const colors = useBeadColors({ currentProject, palette, addUsed, selectedColorId: () => active.id, report: (_kind, prefill) => void reports.push(prefill) })
    await colors.load()
    const swatch = colors.swatches.value.find((entry) => entry.code === 'DB1')!

    colors.report!()
    expect(reports.at(-1)).toEqual({ brand: 'Miyuki', catalog: 'miyuki-delica' })

    colors.report!({ code: 'DB1', hex: swatch.hex })
    expect(reports.at(-1)).toEqual({ brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB1', hex: swatch.hex })

    colors.add(swatch.hex, 'DB1')
    active.id = palette.value.colors.find((color) => color.code === 'DB1')!.id
    colors.report!()
    expect(reports.at(-1)).toEqual({ brand: 'Miyuki', catalog: 'miyuki-delica', code: 'DB1', hex: swatch.hex, swatchLetter: currentProject()!.paletteLetters![swatch.hex] })
    expect(reports.at(-1)).toHaveProperty('swatchLetter', expect.stringMatching(/^[A-Z]+$/))
  })

  it('offers no Report without a way to open one', () => {
    expect(setup()).not.toHaveProperty('report')
  })
})
