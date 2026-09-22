import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressBar from './ProgressBar.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, moveToRow, setRowProgressEnabled, type Pattern } from '../domain/pattern'
import { ru } from '../i18n/ru'

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
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4), orientation: 'vertical' } })

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toContain('5 / 20')
  })

  it('emits move-row(1) from Next and move-row(-1) from Previous', async () => {
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4), orientation: 'vertical' } })

    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-previous"]').trigger('click')

    expect(wrapper.emitted('move-row')).toEqual([[1], [-1]])
  })

  it('disables Previous at the first row and Next at the last, same as the Toolbox buttons did', () => {
    const pattern = makePattern()

    const atStart = mount(ProgressBar, { props: { pattern, orientation: 'vertical' } })
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').element.disabled).toBe(true)
    expect(atStart.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').element.disabled).toBe(false)

    const atEnd = mount(ProgressBar, { props: { pattern: moveToRow(pattern, pattern.rows - 1), orientation: 'vertical' } })
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-previous"]').element.disabled).toBe(false)
    expect(atEnd.find<HTMLButtonElement>('[data-testid="progress-bar-next"]').element.disabled).toBe(true)
  })

  it("names each control and shows its hotkey (Enter/Shift+Enter, ticket 94's shortcuts kept unchanged)", () => {
    const wrapper = mount(ProgressBar, { props: { pattern: moveToRow(makePattern(), 4), orientation: 'vertical' } })

    const previous = wrapper.find('[data-testid="progress-bar-previous"]')
    const next = wrapper.find('[data-testid="progress-bar-next"]')
    expect(previous.attributes('aria-label')).toBe(ru.rowProgress.previousButton)
    expect(previous.attributes('title')).toContain('Shift+Enter')
    expect(next.attributes('aria-label')).toBe(ru.rowProgress.nextButton)
    expect(next.attributes('title')).toContain('(Enter)')
  })

  it('carries the given orientation as a modifier class, for App.vue to place it by Pattern shape', () => {
    const vertical = mount(ProgressBar, { props: { pattern: makePattern(), orientation: 'vertical' } })
    const horizontal = mount(ProgressBar, { props: { pattern: makePattern(), orientation: 'horizontal' } })

    expect(vertical.find('[data-testid="progress-bar"]').classes()).toContain('progress-bar--vertical')
    expect(horizontal.find('[data-testid="progress-bar"]').classes()).toContain('progress-bar--horizontal')
  })
})
