import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { PALETTE } from '../../domain/palette'
import { createPattern } from '../../domain/pattern'
import { en } from '../../i18n/en'
import { useA11yAnnouncer } from './useA11yAnnouncer'

function setup(frame?: { row: number; column: number; rows: number; columns: number } | null, cursor = { row: 1, column: 2 }) {
  const made = createPattern({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: 3, height: 3, unit: 'beads' },
  })
  const { frame: _frame, ...open } = made
  const pattern = frame === null ? (open as typeof made) : frame ? { ...made, frame } : made
  return useA11yAnnouncer({
    messages: () => en,
    currentPattern: () => pattern,
    beadCursor: () => cursor,
  })
}

describe('useA11yAnnouncer', () => {
  it('says the announced text on the next tick, clearing it first', async () => {
    const { announcement, announce } = setup()
    announce('one')
    expect(announcement.value).toBe('')
    await nextTick()
    expect(announcement.value).toBe('one')
  })

  it('names a bead color from the Palette, else Custom, else empty', () => {
    const { colorWords } = setup()
    const first = PALETTE[0]!
    expect(colorWords(first.hex.toUpperCase())).toBe(en.colorNames[first.id])
    expect(colorWords('#123457')).toBe(en.colorNames.custom)
    expect(colorWords(null)).toBe(en.a11y.emptyBead)
  })

  it('counts the cursor\'s row and column from the Frame\'s own corner when there is one', async () => {
    const { announcement, announceCursor } = setup({ row: 10, column: 20, rows: 3, columns: 3 }, { row: 11, column: 22 })
    announceCursor()
    await nextTick()
    expect(announcement.value).toBe(en.a11y.cursorPosition.replace('{row}', '2').replace('{column}', '3').replace('{color}', en.a11y.emptyBead))
  })

  it('counts from the canvas\'s first bead when there is no Frame', async () => {
    const { announcement, announceCursor } = setup(null, { row: 41, column: 52 })
    announceCursor()
    await nextTick()
    expect(announcement.value).toBe(en.a11y.cursorPosition.replace('{row}', '42').replace('{column}', '53').replace('{color}', en.a11y.emptyBead))
  })

  it('announces the cursor as 1-based row and column with the color under it', async () => {
    const { announcement, announceCursor } = setup()
    announceCursor()
    await nextTick()
    expect(announcement.value).toBe(
      en.a11y.cursorPosition.replace('{row}', '2').replace('{column}', '3').replace('{color}', en.a11y.emptyBead),
    )
  })
})
