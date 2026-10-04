import { describe, expect, it } from 'vitest'
import { createProject, paintCells } from '../domain/project'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { headerMaker, printText } from './printText'

const at = new Date(2026, 8, 26, 14, 32)
const noMirror = { columns: 0, rows: 0 }

function delicaProject(painted: number) {
  const base = createProject({ technique: 'loom', beadId: 'miyuki-delica-11-0', name: 'Logo panel', size: { width: 80, height: 60, unit: 'beads' } })
  const cells = Array.from({ length: painted }, (_, index) => ({ row: Math.floor(index / 80), column: index % 80 }))
  return paintCells(base, cells, '#e63746', noMirror)
}

describe('printText (tickets 162, 164)', () => {
  it('says what the pages print about the Project: technique word, size, bead, estimate, date and time', () => {
    const text = printText(delicaProject(10), en, 'en', 'Maria Kovaleva', at)

    expect(text.techniqueWord).toBe('Loom')
    expect(text.size).toBe('80×60')
    expect(text.metaLine).toMatch(/^80×60 · Miyuki Delica 11\/0 · ≈ .+ cm$/)
    expect(text.exportedAt).toBe('Sep 26, 2026 · 14:32')
    expect(text.maker).toBe('Maria Kovaleva')
  })

  it('writes Beads needed in beads and grams, the Total from the total count, with the note', () => {
    const text = printText(delicaProject(4800), en, 'en', '', at)

    expect(text.colors).toEqual([{ hex: '#e63746', name: 'Red', beads: '4 800', grams: '24 g' }])
    expect(text.totalBeads).toBe('4 800 beads')
    expect(text.totalGrams).toBe('24 g')
    expect(text.gramsNote).toBe('≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares.')
  })

  it('shows no grams and no note for a Bead with no weight', () => {
    const text = printText({ ...delicaProject(10), beadId: 'a-bead-this-device-never-had' }, en, 'en', '', at)

    expect(text.colors[0]!.grams).toBeUndefined()
    expect(text.totalGrams).toBeUndefined()
    expect(text.gramsNote).toBeUndefined()
    expect(text.metaLine).toBe('80×60 · Unknown bead')
  })

  it('speaks Russian: the date, the plural, the decimal comma', () => {
    const text = printText(delicaProject(761), ru, 'ru', '', at)

    expect(text.exportedAt).toBe('26 сент. 2026 г. · 14:32')
    expect(text.totalBeads).toBe('761 бисеринка')
    expect(text.totalGrams).toBe('3,9 г')
    expect(text.techniqueWord).toBe(ru.form.techniqueLoom)
  })

  it('cuts a long maker name in the header, never a short one', () => {
    expect(headerMaker('Maria')).toBe('Maria')
    expect(headerMaker('x'.repeat(40))).toHaveLength(32)
    expect(headerMaker('x'.repeat(40)).endsWith('…')).toBe(true)
  })

  it("keeps the device-wide maker's name, and the background is just that name, when the Project has no override (ticket 182)", () => {
    const text = printText(delicaProject(10), en, 'en', 'Maria Kovaleva', at)

    expect(text.maker).toBe('Maria Kovaleva')
    expect(text.background).toBe('Maria Kovaleva')
  })

  it("overrides the device-wide maker's name with the Project's own, and joins it with the Project's name in the background (ticket 182)", () => {
    const project = { ...delicaProject(10), makerName: 'Bead Master' }
    const text = printText(project, en, 'en', 'Maria Kovaleva', at)

    expect(text.maker).toBe('Bead Master')
    expect(text.background).toBe('Logo panel · Bead Master')
  })
})
