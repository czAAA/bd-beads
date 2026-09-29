import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, moveToRow, setRowProgressEnabled, toggleRowDirection, type Pattern } from '../domain/pattern'
import { ru } from '../i18n/ru'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

/** 10 columns x 20 rows, Row progress on, so Previous/Next both have room to be enabled. */
function makePattern(): Pattern {
  const pattern = createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 30, unit: 'mm' },
  })
  return setRowProgressEnabled(pattern, true)
}

describe('ProgressBar', () => {
  it('shows the current row and total, 1-based', () => {
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4) } })

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b5\D+20\b/)
  })

  it('emits move-row(1) from Next and move-row(-1) from Previous', async () => {
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4) } })

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-previous"]').trigger('click')

    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('disables Previous at the first row and Next at the last, same as the Toolbox buttons did', () => {
    const pattern = makePattern()

    const atStart = mount(ProgressBar, { props: { pattern } })
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').element.disabled).toBe(true)
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').element.disabled).toBe(false)

    const atEnd = mount(ProgressBar, { props: { pattern: moveToRow(pattern, pattern.rows - 1) } })
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').element.disabled).toBe(false)
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').element.disabled).toBe(true)
  })

  it('names Row not done and Row done in words and keeps their hotkeys in the tooltip (ticket 94, plus Space/Shift+Space from ticket 178)', () => {
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4) } })

    const previous = wrapper.find('[data-testid="progress-bar-previous"]')
    const next = wrapper.find('[data-testid="progress-bar-next"]')
    expect(previous.text()).toBe(ru.rowProgress.previousButton)
    expect(previous.attributes('title')).toContain('Shift+Enter, Shift+Space')
    expect(next.text()).toBe(ru.rowProgress.nextButton)
    expect(next.attributes('title')).toContain('(Enter, Space)')
  })

  it('shows a compact "current/total" counter and icon-only Previous/Next with the same hover label and hotkeys (ticket 188)', async () => {
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4) } })

    expect(wrapper.find('[data-testid="progress-bar-compact-position"]').text()).toBe('5/20')

    const previous = wrapper.find('[data-testid="progress-bar-previous-compact"]')
    const next = wrapper.find('[data-testid="progress-bar-next-compact"]')
    expect(previous.attributes('aria-label')).toBe(ru.rowProgress.previousButton)
    expect(next.attributes('aria-label')).toBe(ru.rowProgress.nextButton)
    // No visible text of their own -- an icon-only button, unlike the reference tier's Previous/Next.
    expect(previous.find('svg').exists()).toBe(true)

    await next.trigger('click')
    await previous.trigger('click')
    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('disables the compact Previous/Next the same as the reference tier\'s', () => {
    const pattern = makePattern()

    const atStart = mount(ProgressBar, { props: { pattern } })
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-previous-compact"]').element.disabled).toBe(true)
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-next-compact"]').element.disabled).toBe(false)

    const atEnd = mount(ProgressBar, { props: { pattern: moveToRow(pattern, pattern.rows - 1) } })
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-previous-compact"]').element.disabled).toBe(false)
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-next-compact"]').element.disabled).toBe(true)
  })

  it('says which way the rows run after the total', () => {
    const rows = mount(ProgressBar, { props: { pattern: makePattern() } })
    expect(rows.find('[data-testid="progress-bar-position"]').text()).toContain(ru.rowProgress.topToBottom)

    const columns = mount(ProgressBar, { props: { pattern: toggleRowDirection(makePattern()) } })
    expect(columns.find('[data-testid="progress-bar-position"]').text()).toContain(ru.rowProgress.leftToRight)
  })

  it('shows only the switch and a label while Row progress is off, and turns it on', async () => {
    const wrapper = mount(ProgressBar, { props: { pattern: setRowProgressEnabled(makePattern(), false) } })

    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.text()).toBe(ru.toolbox.groups.rowProgress)
    expect(wrapper.find('[data-testid="progress-bar"]').classes()).toContain('progress-bar--off')

    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(wrapper.emitted('toggle-row-progress')).toEqual([[true]])
  })

  it('turns Row progress off from the switch and the row direction from its button', async () => {
    const wrapper = mount(ProgressBar, { props: { pattern: makePattern() } })

    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    expect(wrapper.emitted('toggle-row-direction')).toHaveLength(1)
    expect(wrapper.emitted('toggle-row-progress')).toEqual([[false]])
  })
})
