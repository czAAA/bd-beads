// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import { decodeProject, encodeProject } from './projectEncoding'
import { replaceBead } from './projectBead'
import { setPalette, setSwatchLetter, shownLetters, withColorsInPalette, withLettersBack } from './paletteEdits'
import { withLetters } from './layerRecord'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { BUILT_IN_COLORS, addedColorId, addUsedColor, codesOfColors, defaultPalette, projectPalette } from './palette'
import { paintAt } from '../testUtils/layers'
import { beadsOfLayer, canvasOf } from './layerRecord'
import { layersView } from '../testUtils/layerFields'

const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('a Project\'s Palette is its own (ADR 0103)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const input = { technique: 'loom', size: { width: 4, height: 2, unit: 'beads' } } as const
  const ids = (beadId: string) => defaultPalette(beadId).map((color) => color.id)

  it('starts a new Project with one section, its Bead\'s default colors with their codes', () => {
    const made = createProject({ ...input, beadId: delica.id })
    expect(made.palette).toEqual(ids(delica.id))
    expect(made.paletteCodes).toEqual(codesOfColors(defaultPalette(delica.id)))
    expect(projectPalette(made).sections.map((section) => section.id)).toEqual(['miyuki-delica'])
  })

  it('keeps every color and code when a layer\'s Bead changes, and every painted cell as it was', () => {
    const before = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], '#123456')
    for (const layer of ['canvas', 'frame'] as const) {
      const after = replaceBead(before, delica, layer)
      expect([after.palette, after.paletteCodes, after.paletteLetters]).toEqual([before.palette, before.paletteCodes, before.paletteLetters])
      expect(beadsOfLayer(after, 'frame')).toBe(beadsOfLayer(before, 'frame'))
    }
  })

  it('opens a Project stored with the twelve on a Delica bead with the same colors shown', () => {
    const stored = { ...createProject({ ...input, beadId: delica.id }), palette: BUILT_IN_COLORS.map((color) => color.id) }
    const opened = normalizeProject(stored)
    expect(projectPalette(opened).colors.map((color) => color.hex)).toEqual(BUILT_IN_COLORS.map((color) => color.hex))
  })
})

describe('a swatch keeps its catalog code (ticket 0538)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const input = { technique: 'loom', beadId: delica.id, size: { width: 4, height: 2, unit: 'beads' } } as const
  const blue = addedColorId('#123456')
  const red = addedColorId('#654321')
  const DB1 = { catalog: 'miyuki-delica', code: 'DB1' }
  const TOHO = { catalog: 'toho', code: '45' }
  const defaults = codesOfColors(defaultPalette(delica.id))
  const coded = () => {
    const project = createProject(input)
    return setPalette(project, [...project.palette, blue, red], { '#123456': DB1, '#654321': TOHO })
  }

  it('is saved with the Project, each in its catalog\'s section, and gone with its swatch', () => {
    const project = coded()
    expect(project.paletteCodes).toEqual({ ...defaults, '#123456': DB1, '#654321': TOHO })
    expect(projectPalette(project).sections.map((section) => section.id)).toEqual(['miyuki-delica', 'toho'])
    expect(setPalette(project, project.palette.filter((id) => id !== red)).paletteCodes).toEqual({ ...defaults, '#123456': DB1 })
  })

  it('keeps each section\'s swatches together when one is moved into another', () => {
    const project = coded()
    const moved = setPalette(project, [red, ...project.palette.filter((id) => id !== red)])
    expect(moved.palette).toEqual([red, ...project.palette.filter((id) => id !== red)])
    expect(projectPalette(moved).sections.map((section) => section.id)).toEqual(['toho', 'miyuki-delica'])
    const into = setPalette(project, [project.palette[0]!, red, ...project.palette.slice(1).filter((id) => id !== red)])
    expect(into.palette).toEqual(project.palette)
  })

  it('reads a Project saved without codes unchanged, and ignores unreadable ones', () => {
    const plain = createProject(input)
    expect(normalizeProject(plain).paletteCodes).toEqual(plain.paletteCodes)
    const odd = normalizeProject({ ...coded(), paletteCodes: { '#123456': 'DB1', nope: 'X', '#654321': 7 } } as never)
    expect(odd.paletteCodes).toEqual({ ...defaults, '#123456': DB1 })
  })
})

describe('Swatch letters (ticket 0573)', () => {
  const input = { technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 4, height: 2, unit: 'beads' } } as const
  const hexOf = (project: Project, id: string) => projectPalette(project).byId(id)!.hex
  const familyHex = (project: Project, family: string) => projectPalette(project).colors.find((color) => color.family === family)!.hex

  it('gives every Palette color a letter in Palette order, A first', () => {
    const project = createProject(input)
    const palette = projectPalette(project)
    expect(project.paletteLetters![palette.colors[0]!.hex]).toBe('A')
    expect(project.paletteLetters![palette.colors[1]!.hex]).toBe('B')
    expect(Object.keys(project.paletteLetters!)).toHaveLength(palette.colors.length)
  })

  it('gives a new color the lowest unused letter and never changes another color\'s letter when one is deleted or moved', () => {
    const start = createProject(input)
    const white = familyHex(start, 'white')
    const withAdded = setPalette(start, addUsedColor(start.palette, '#123456', start.paletteCodes).ids)
    const added = withAdded.paletteLetters!['#123456']!
    const black = projectPalette(start).colors.find((color) => color.family === 'black')!.id
    const deleted = setPalette(withAdded, withAdded.palette.filter((id) => id !== black))
    expect(deleted.paletteLetters![white]).toBe(start.paletteLetters![white])
    expect(deleted.paletteLetters!['#123456']).toBe(added)
    const moved = setPalette(deleted, [...deleted.palette].reverse())
    expect(moved.paletteLetters).toEqual(deleted.paletteLetters)
    const readded = setPalette(moved, addUsedColor(moved.palette, '#654321', moved.paletteCodes).ids)
    expect(readded.paletteLetters!['#654321']).toBe('A')
  })

  it('gives a Project saved before letters its letters in Palette order when opened, and keeps Letters off', () => {
    const { paletteLetters: _letters, ...old } = createProject(input)
    const opened = normalizeProject(old)
    expect(opened.paletteLetters![hexOf(opened, opened.palette[0]!)]).toBe('A')
    expect(canvasOf(opened).letters).toBeUndefined()
  })

  it('keeps stored letters and the Letters choice through opening and through Undo', () => {
    const start = withLetters(createProject(input), 'canvas', true)
    const changed = setPalette(start, addUsedColor(start.palette, '#123456', start.paletteCodes).ids)
    expect(layersView(normalizeProject(decodeProject(JSON.parse(JSON.stringify(encodeProject(changed))))))).toMatchObject({ letters: true, paletteLetters: changed.paletteLetters })
    expect(restoreSnapshot(changed, snapshotOf(start)).paletteLetters).toEqual(start.paletteLetters)
  })

  it('changes a color\'s letter as one Undo step, a color that had it taking this one\'s (ticket 1092)', () => {
    const start = createProject(input)
    const [first, second] = projectPalette(start).colors
    const changed = setSwatchLetter(start, second!.hex, 'A')
    expect([changed.paletteLetters![first!.hex], changed.paletteLetters![second!.hex]]).toEqual(['B', 'A'])
    expect(restoreSnapshot(changed, snapshotOf(start)).paletteLetters).toEqual(start.paletteLetters)
    expect(setSwatchLetter(start, first!.hex, 'A')).toBe(start)
    // A swatch added later still gets the lowest letter nobody has.
    const added = setPalette(changed, addUsedColor(changed.palette, '#123456', changed.paletteCodes).ids)
    expect(Object.values(added.paletteLetters!).filter((letter) => letter === 'A')).toHaveLength(1)
  })

  it('gives a color back the letter it had, unless another color has taken it or the color is not in the Palette (ticket 1092)', () => {
    const start = createProject(input)
    const [first, second] = projectPalette(start).colors
    expect(withLettersBack(start, { [second!.hex]: 'Q' }).paletteLetters![second!.hex]).toBe('Q')
    expect(withLettersBack(start, { [second!.hex]: 'A' }).paletteLetters).toEqual(start.paletteLetters)
    expect(withLettersBack(start, { '#123456': 'Q' }).paletteLetters).toEqual(start.paletteLetters)
    expect(start.paletteLetters![first!.hex]).toBe('A')
  })

  it('turns Letters on and off, off being unsaved, and shows letters only while it is on', () => {
    const project = createProject(input)
    expect(shownLetters(project, 'canvas')).toBeUndefined()
    const on = withLetters(project, 'canvas', true)
    expect(shownLetters(on, 'canvas')).toBe(on.paletteLetters)
    expect(shownLetters(on, 'frame')).toBeUndefined()
    expect('letters' in canvasOf(withLetters(on, 'canvas', false))).toBe(false)
  })
})

describe('every color a bead shows is in the Palette (ticket 1124)', () => {
  const base = createProject({ technique: 'loom', beadId: roundBead.id, size: { width: 3, height: 3, unit: 'beads' } })
  const pasted = paintAt(paintAt(base, [{ row: 0, column: 0 }], '#123456'), [{ row: 1, column: 1 }], '#abcdef')

  it('adds a color the beads show and the Palette lacks, last, with a Swatch letter', () => {
    const fixed = withColorsInPalette(pasted)
    expect(fixed.palette).toEqual([...base.palette, addedColorId('#123456'), addedColorId('#abcdef')])
    expect(fixed.paletteLetters?.['#123456']).toBeDefined()
    expect(fixed.paletteLetters?.['#abcdef']).toBeDefined()
  })

  it('is the same Project when none is missing', () => {
    const fixed = withColorsInPalette(pasted)
    expect(withColorsInPalette(fixed)).toBe(fixed)
    expect(withColorsInPalette(base)).toBe(base)
  })

  it('gives a Project saved with such beads their colors when it opens', () => {
    const reopened = normalizeProject(JSON.parse(JSON.stringify(pasted)))
    expect(reopened.palette).toContain(addedColorId('#123456'))
    expect(reopened.paletteLetters?.['#abcdef']).toBeDefined()
  })
})
