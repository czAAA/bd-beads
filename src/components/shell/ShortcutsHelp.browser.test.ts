import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { mountAt, resizeTo, type FitLocale } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import ShortcutsHelp from './ShortcutsHelp.vue'

// Keyboard shortcuts' layout (ticket 1159, ShortcutsHelp card): each group's rows in two columns down the left first,
// every key starting at one x in its column, never under its name; one column where a column would be under 22rem.

/** The Subpanel's content box: `panel-width-wide`, or the window less its gutters, less the panel's padding and border. */
const panelContent = 'calc(min(var(--panel-width-wide), 100vw - 2 * var(--frame-panel-gap)) - 2 * var(--space-8) - 2px)'
const InPanel = defineComponent({ setup: () => () => h('div', { style: { width: panelContent } }, [h(ShortcutsHelp)]) })

const box = (element: Element) => element.getBoundingClientRect()
const round = (value: number) => Math.round(value)

/** Each group's rows: where its row, name and keys stand. */
function layout(root: HTMLElement) {
  return [...root.querySelectorAll('.shortcuts-help__list')].map((list) =>
    [...list.querySelectorAll('.shortcuts-help__row')].map((row) => ({
      row: box(row),
      name: box(row.querySelector('dt')!),
      line: parseFloat(getComputedStyle(row.querySelector('dt')!).lineHeight),
      keys: box(row.querySelector('dd')!),
      chips: [...row.querySelectorAll('kbd')].map(box),
    })),
  )
}

/** Keys that leave their row, drop under the name's first line, or overflow their own track. */
function keyProblems(root: HTMLElement): string[] {
  return layout(root).flatMap((rows, group) =>
    rows.flatMap(({ row, name, line, keys, chips }, index) => {
      const problems: string[] = []
      const where = `group ${group} row ${index}`
      if (keys.top >= name.top + line) problems.push(`${where}: keys under the name's first line`)
      if (chips.some((chip) => chip.right > row.right + 0.5)) problems.push(`${where}: a key past the row's edge`)
      if (chips.some((chip) => chip.top > keys.top + 1)) problems.push(`${where}: keys wrap`)
      return problems
    }),
  )
}

async function mountHelp(width: number, locale: FitLocale = 'en') {
  const { root } = await mountAt(InPanel, {}, { locale, width, text: false })
  await resizeTo(width)
  await settleForMeasuring()
  return root
}

describe('ShortcutsHelp in its Subpanel', () => {
  it('fills a group of three 2 + 1, the right column level with the left, at 1440px', async () => {
    const root = await mountHelp(1440)
    const colors = layout(root)[1]
    expect(colors).toHaveLength(3)
    const [first, second, third] = colors
    expect({ secondUnderFirst: round(second.row.left) === round(first.row.left) && second.row.top > first.row.top, thirdBesideFirst: round(third.row.top) === round(first.row.top) && third.row.left > first.row.right }).toEqual({
      secondUnderFirst: true,
      thirdBesideFirst: true,
    })
  })

  it('starts every key at one x within each column, at 1440px', async () => {
    const root = await mountHelp(1440)
    const lefts = layout(root).flat().map(({ row, keys }) => ({ column: round(row.left), keys: round(keys.left) }))
    const byColumn = new Map<number, Set<number>>()
    for (const { column, keys } of lefts) byColumn.set(column, (byColumn.get(column) ?? new Set()).add(keys))
    expect([...byColumn.values()].map((xs) => xs.size)).toEqual([1, 1])
  })

  for (const locale of ['en', 'ru', 'longest'] as const) {
    it(`keeps every key on its row's first line and inside it, in two columns and one (${locale})`, async () => {
      const root = await mountHelp(1440, locale)
      expect(keyProblems(root)).toEqual([])
      await resizeTo(744) // an iPad mini upright: one column
      await settleForMeasuring()
      expect(new Set(layout(root).flat().map(({ row }) => round(row.left))).size).toBe(1)
      expect(keyProblems(root)).toEqual([])
    })
  }
})
