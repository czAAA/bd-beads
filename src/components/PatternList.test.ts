import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PatternList from './PatternList.vue'
import { createPattern, summarizePattern } from '../domain/pattern'
import { BEAD_CATALOG } from '../domain/beads'
import { ru } from '../i18n/ru'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern() {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

describe('PatternList', () => {
  it('still renders its box with an empty message when there are no saved patterns (ticket 39: always one of the three below-canvas boxes)', () => {
    const wrapper = mount(PatternList, { props: { patterns: [] } })

    expect(wrapper.find('[data-testid="pattern-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-list-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-item"]').exists()).toBe(false)
  })

  it('renders one entry per saved pattern with its summary', () => {
    const first = makePattern()
    const second = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [first, second] } })

    const items = wrapper.findAll('[data-testid="pattern-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain(summarizePattern(first))
    expect(items[1]!.text()).toContain(summarizePattern(second))
  })

  it('marks the active pattern as pressed', () => {
    const first = makePattern()
    const second = makePattern()
    const wrapper = mount(PatternList, {
      props: { patterns: [first, second], activePatternId: second.id },
    })

    expect(wrapper.find(`[data-testid="select-pattern-${first.id}"]`).attributes('aria-pressed')).toBe(
      'false',
    )
    expect(wrapper.find(`[data-testid="select-pattern-${second.id}"]`).attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('emits select with the pattern id when an entry is clicked', async () => {
    const pattern = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [pattern] } })

    await wrapper.find(`[data-testid="select-pattern-${pattern.id}"]`).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[pattern.id]])
  })

  it('emits remove with the pattern id when its remove button is clicked', async () => {
    const pattern = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [pattern] } })

    await wrapper.find(`[data-testid="remove-pattern-${pattern.id}"]`).trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[pattern.id]])
  })

  it('renders the remove button as an icon, with an aria-label conveying its action for screen readers', () => {
    const pattern = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [pattern] } })

    const removeButton = wrapper.find(`[data-testid="remove-pattern-${pattern.id}"]`)
    expect(removeButton.text()).toBe('')
    expect(removeButton.find('svg').exists()).toBe(true)
    expect(removeButton.attributes('aria-label')).toBe(
      `${ru.patterns.removeButton}: ${summarizePattern(pattern)}`,
    )
  })
})
