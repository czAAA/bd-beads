// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import { decodeProject, encodeProject } from './projectEncoding'
import { replaceBead } from './projectBead'
import { setPalette, setSwatchLetter, shownLetters, withLettersBack } from './paletteEdits'
import { withLetters } from './layerRecord'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { BUILT_IN_COLORS, addedColorId, addUsedColor, defaultPalette, projectPalette } from './palette'
import { paintAt } from '../testUtils/layers'
import { beadsOfLayer, canvasOf } from './layerRecord'
import { layersView } from '../testUtils/layerFields'

const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('a Project\'s default colors follow its Bead (tickets 0528, 1070)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const round15 = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/15-0')!
  const input = { technique: 'loom', size: { width: 4, height: 2, unit: 'beads' } } as const
  const tohoOf = (family: string) => defaultPalette(roundBead.id).find((color) => color.family === family)!
  const teal = tohoOf('teal')
  const tealId = addedColorId(teal.hex)
  const ids = (beadId: string) => defaultPalette(beadId).map((color) => color.id)

  it('starts a new Project on its Bead\'s default colors', () => {
    expect(createProject({ ...input, beadId: delica.id }).palette).toEqual(ids(delica.id))
    expect(createProject({ ...input, beadId: roundBead.id }).palette).toEqual(ids(roundBead.id))
  })

  it('brings the new Bead\'s default colors in, keeps an old one a bead uses as an added color, drops the rest, and leaves every painted cell as it was', () => {
    const before = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], teal.hex)
    const after = replaceBead(before, delica)
    expect(after.palette).toEqual([...ids(delica.id), tealId])
    expect(after.paletteCodes).toBeUndefined()
    expect(beadsOfLayer(after, 'canvas')).toBe(beadsOfLayer(before, 'canvas'))
  })

  it('keeps a used old default color\'s code where the new Bead\'s catalog lists it in its size (ticket 0538)', () => {
    const black = tohoOf('black')
    const catalog = { id: 'toho', codes: [{ code: black.code!, family: ['Black'], finish: 'opaque' as const, wording: 'Opaque', sizes: ['15/0'] }] }
    const before = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], black.hex)
    const after = replaceBead(before, round15, catalog)
    expect(after.palette).toContain(addedColorId(black.hex))
    expect(after.paletteCodes).toEqual({ [black.hex]: black.code })
    expect(projectPalette(after).byHex(black.hex)!.code).toBe(black.code)
  })

  it('undoes the Bead and the Palette together', () => {
    const before = createProject({ ...input, beadId: roundBead.id })
    const after = replaceBead(before, delica)
    const undone = restoreSnapshot(after, snapshotOf(before))
    expect(canvasOf(undone).beadId).toBe(roundBead.id)
    expect(undone.palette).toEqual(before.palette)
  })

  it('goes A to B to A back to the same Palette when no bead is painted', () => {
    const start = createProject({ ...input, beadId: roundBead.id })
    expect(replaceBead(replaceBead(start, delica), roundBead).palette).toEqual(start.palette)
  })

  it('does not bring back an old default the maker removed on the way', () => {
    const painted = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], teal.hex)
    const away = replaceBead(painted, delica)
    const removed = setPalette(away, away.palette.filter((id) => id !== tealId))
    expect(removed.removedDefaults).toEqual([teal.hex])
    const back = replaceBead(removed, roundBead)
    expect(back.palette).not.toContain(teal.id)
    expect(back.palette).not.toContain(tealId)
  })

  it('remembers a removal in the undo snapshot, so Undo brings the color and the memory back', () => {
    const painted = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], teal.hex)
    const away = replaceBead(painted, delica)
    const removed = setPalette(away, away.palette.filter((id) => id !== tealId))
    const undone = restoreSnapshot(removed, snapshotOf(away))
    expect(undone.palette).toContain(tealId)
    expect(undone.removedDefaults).toBeUndefined()
  })

  it('opens a Project stored with the twelve on a Delica bead with the same colors shown', () => {
    const stored = { ...createProject({ ...input, beadId: delica.id }), palette: BUILT_IN_COLORS.map((color) => color.id) }
    const opened = normalizeProject(stored)
    expect(projectPalette(opened).colors.map((color) => color.hex)).toEqual(BUILT_IN_COLORS.map((color) => color.hex))
  })
})

describe('a swatch keeps its catalog code (ticket 0538)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const delica15 = { ...delica, id: 'miyuki/delica/15-0', size: '15/0' }
  const catalog = {
    id: 'miyuki-delica',
    codes: [
      { code: 'DB1', family: ['Blue'], finish: 'opaque' as const, wording: 'Opaque', sizes: ['11/0', '15/0'] },
      { code: 'DB2', family: ['Red'], finish: 'opaque' as const, wording: 'Opaque', sizes: ['11/0'] },
    ],
  }
  const input = { technique: 'loom', beadId: delica.id, size: { width: 4, height: 2, unit: 'beads' } } as const
  const blue = addedColorId('#123456')
  const red = addedColorId('#654321')
  const coded = () => {
    const project = createProject(input)
    return setPalette(project, [...project.palette, blue, red], { '#123456': 'DB1', '#654321': 'DB2' })
  }

  it('is saved with the Project and gone with its swatch', () => {
    const project = coded()
    expect(project.paletteCodes).toEqual({ '#123456': 'DB1', '#654321': 'DB2' })
    expect(setPalette(project, project.palette.filter((id) => id !== red)).paletteCodes).toEqual({ '#123456': 'DB1' })
  })

  it('keeps the codes the new Bead lists in its size and drops the rest', () => {
    expect(replaceBead(coded(), delica15, catalog).paletteCodes).toEqual({ '#123456': 'DB1' })
  })

  it('clears them all for a Bead with no catalog, and Undo puts them back', () => {
    const project = coded()
    const toho = replaceBead(project, roundBead)
    expect(toho.paletteCodes).toBeUndefined()
    expect(restoreSnapshot(toho, snapshotOf(project)).paletteCodes).toEqual(project.paletteCodes)
  })

  it('a coded swatch that becomes a default keeps its code, and loses it for good once removed', () => {
    const beige = defaultPalette(delica.id).find((color) => color.family === 'beige')!
    const start = createProject({ ...input, beadId: roundBead.id })
    const coded = setPalette(start, [...start.palette, addedColorId(beige.hex)], { [beige.hex]: 'DB1' })
    const away = replaceBead(coded, delica, catalog)
    expect(away.palette).toContain(beige.id)
    expect(away.paletteCodes).toEqual({ [beige.hex]: 'DB1' })
    const removed = setPalette(away, away.palette.filter((id) => id !== beige.id))
    expect(removed.paletteCodes).toBeUndefined()
    expect(replaceBead(removed, roundBead).paletteCodes).toBeUndefined()
  })

  it('reads a Project saved without codes unchanged, and ignores unreadable ones', () => {
    const plain = createProject(input)
    expect(normalizeProject(plain).paletteCodes).toBeUndefined()
    const odd = normalizeProject({ ...coded(), paletteCodes: { '#123456': 'DB1', nope: 'X', '#654321': 7 } } as never)
    expect(odd.paletteCodes).toEqual({ '#123456': 'DB1' })
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
    const withAdded = setPalette(start, addUsedColor(start.palette, '#123456', defaultPalette(input.beadId)).ids)
    const added = withAdded.paletteLetters!['#123456']!
    const black = projectPalette(start).colors.find((color) => color.family === 'black')!.id
    const deleted = setPalette(withAdded, withAdded.palette.filter((id) => id !== black))
    expect(deleted.paletteLetters![white]).toBe(start.paletteLetters![white])
    expect(deleted.paletteLetters!['#123456']).toBe(added)
    const moved = setPalette(deleted, [...deleted.palette].reverse())
    expect(moved.paletteLetters).toEqual(deleted.paletteLetters)
    const readded = setPalette(moved, addUsedColor(moved.palette, '#654321', defaultPalette(input.beadId)).ids)
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
    const changed = setPalette(start, addUsedColor(start.palette, '#123456', defaultPalette(input.beadId)).ids)
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
    const added = setPalette(changed, addUsedColor(changed.palette, '#123456', defaultPalette(input.beadId)).ids)
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
