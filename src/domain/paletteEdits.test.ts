// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { normalizeProject } from './storedProject'
import { replaceBead } from './projectBead'
import { setPalette, shownLetters, withLetters } from './paletteEdits'
import { restoreSnapshot, snapshotOf } from './undoSnapshot'
import type { Project } from './project'
import { BEAD_CATALOG } from './beads'
import { BUILT_IN_COLORS, addedColorId, addUsedColor, projectPalette } from './palette'
import { paintAt } from '../testUtils/layers'
import { beadsOfLayer, canvasOf } from './layerRecord'

const roundBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/round/11-0')!

describe('a Project\'s default colors follow its Bead (ticket 0528)', () => {
  const delica = BEAD_CATALOG.find((bead) => bead.id === 'miyuki/delica/11-0')!
  const input = { technique: 'loom', size: { width: 4, height: 2, unit: 'beads' } } as const
  const tealId = addedColorId('#2fb6ae')

  it('starts a new Project on its Bead\'s built-in colors', () => {
    expect(createProject({ ...input, beadId: delica.id }).palette).toHaveLength(16)
    expect(createProject({ ...input, beadId: roundBead.id }).palette).toHaveLength(12)
  })

  it('moves the Palette with the Bead and leaves every painted cell as it was', () => {
    const before = paintAt(createProject({ ...input, beadId: roundBead.id }), [{ row: 0, column: 0 }], '#2fb6ae')
    const after = replaceBead(before, delica)
    expect(after.palette).toHaveLength(16 + 1)
    expect(after.palette).toContain(tealId)
    expect(beadsOfLayer(after, 'canvas')).toBe(beadsOfLayer(before, 'canvas'))
  })

  it('undoes the Bead and the Palette together', () => {
    const before = createProject({ ...input, beadId: roundBead.id })
    const after = replaceBead(before, delica)
    const undone = restoreSnapshot(after, snapshotOf(before))
    expect(canvasOf(undone).beadId).toBe(roundBead.id)
    expect(undone.palette).toEqual(before.palette)
  })

  it('goes A to B to A with no duplicates and the same built-in colors', () => {
    const start = createProject({ ...input, beadId: roundBead.id })
    const back = replaceBead(replaceBead(start, delica), roundBead)
    expect(back.palette.slice(0, 12)).toEqual(start.palette)
    expect(new Set(back.palette).size).toBe(back.palette.length)
  })

  it('does not bring back an old default the maker removed on the way', () => {
    const away = replaceBead(createProject({ ...input, beadId: roundBead.id }), delica)
    const removed = setPalette(away, away.palette.filter((id) => id !== tealId))
    expect(removed.removedDefaults).toEqual(['#2fb6ae'])
    const back = replaceBead(removed, roundBead)
    expect(back.palette).not.toContain('teal')
    expect(back.palette).not.toContain(tealId)
  })

  it('remembers a removal in the undo snapshot, so Undo brings the color and the memory back', () => {
    const away = replaceBead(createProject({ ...input, beadId: roundBead.id }), delica)
    const removed = setPalette(away, away.palette.filter((id) => id !== tealId))
    const undone = restoreSnapshot(removed, snapshotOf(away))
    expect(undone.palette).toContain(tealId)
    expect(undone.removedDefaults).toBeUndefined()
  })

  it('opens a Project stored with the twelve on a Delica bead with the same colors shown', () => {
    const stored = { ...createProject({ ...input, beadId: delica.id }), palette: BUILT_IN_COLORS.map((color) => color.id) }
    const opened = normalizeProject(stored)
    expect(opened.palette).toHaveLength(12)
    expect(opened.palette).toContain(tealId)
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

  it('does not bring back a default removed on the way, and a coded swatch that becomes a default keeps its code', () => {
    const start = createProject({ ...input, beadId: roundBead.id })
    const teal = setPalette(start, [...start.palette, addedColorId('#e6d5b8')], { '#e6d5b8': 'DB1' })
    const away = replaceBead(teal, delica, catalog)
    expect(away.palette).toContain('beige')
    expect(away.paletteCodes).toEqual({ '#e6d5b8': 'DB1' })
    const removed = setPalette(away, away.palette.filter((id) => id !== 'beige'))
    expect(removed.paletteCodes).toBeUndefined()
    expect(replaceBead(removed, roundBead).palette).not.toContain('beige')
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

  it('gives every Palette color a letter in Palette order, A first', () => {
    const project = createProject(input)
    const palette = projectPalette(project)
    expect(project.paletteLetters![palette.colors[0]!.hex]).toBe('A')
    expect(project.paletteLetters![palette.colors[1]!.hex]).toBe('B')
    expect(Object.keys(project.paletteLetters!)).toHaveLength(palette.colors.length)
  })

  it('gives a new color the lowest unused letter and never changes another color\'s letter when one is deleted or moved', () => {
    const start = createProject(input)
    const white = hexOf(start, 'white')
    const withAdded = setPalette(start, addUsedColor(start.palette, '#123456').ids)
    const added = withAdded.paletteLetters!['#123456']!
    const deleted = setPalette(withAdded, withAdded.palette.filter((id) => id !== 'black'))
    expect(deleted.paletteLetters![white]).toBe(start.paletteLetters![white])
    expect(deleted.paletteLetters!['#123456']).toBe(added)
    const moved = setPalette(deleted, [...deleted.palette].reverse())
    expect(moved.paletteLetters).toEqual(deleted.paletteLetters)
    const readded = setPalette(moved, addUsedColor(moved.palette, '#654321').ids)
    expect(readded.paletteLetters!['#654321']).toBe('A')
  })

  it('gives a Project saved before letters its letters in Palette order when opened, and keeps Letters off', () => {
    const { paletteLetters: _letters, ...old } = createProject(input)
    const opened = normalizeProject(old)
    expect(opened.paletteLetters![hexOf(opened, opened.palette[0]!)]).toBe('A')
    expect(canvasOf(opened).letters).toBeUndefined()
  })

  it('keeps stored letters and the Letters choice through opening and through Undo', () => {
    const start = withLetters(createProject(input), true)
    const changed = setPalette(start, addUsedColor(start.palette, '#123456').ids)
    expect(normalizeProject(JSON.parse(JSON.stringify(changed)))).toMatchObject({ letters: true, paletteLetters: changed.paletteLetters })
    expect(restoreSnapshot(changed, snapshotOf(start)).paletteLetters).toEqual(start.paletteLetters)
  })

  it('turns Letters on and off, off being unsaved, and shows letters only while it is on', () => {
    const project = createProject(input)
    expect(shownLetters(project)).toBeUndefined()
    const on = withLetters(project, true)
    expect(shownLetters(on)).toBe(on.paletteLetters)
    expect('letters' in withLetters(on, false)).toBe(false)
  })
})
