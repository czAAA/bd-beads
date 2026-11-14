import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaveReminder from './SaveReminder.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import { en } from '../../i18n/en'
import type { TooltipProps } from '../ui/tooltipProps'

function mountRing(props: Partial<InstanceType<typeof SaveReminder>['$props']> = {}) {
  return mount(SaveReminder, { props: { beads: 64, labelOpen: false, ...props }, attachTo: document.body })
}

describe('SaveReminder (ticket 0796)', () => {
  it('is a button named Save Project file, described by its count line', () => {
    const wrapper = mountRing()
    const button = wrapper.get('[data-testid="save-ring"]')
    const described = document.getElementById(button.attributes('aria-describedby')!)

    expect(button.attributes('aria-label')).toBe('Save Project file')
    expect(described?.textContent).toBe('Beads since last file: 64')
  })

  it('shows its label only when open: Save Project file and what the count counts (ticket 0858)', async () => {
    const wrapper = mountRing({ lastFileAt: Date.now() })
    expect(wrapper.classes()).not.toContain('save-ring--open')

    await wrapper.setProps({ labelOpen: true })
    expect(wrapper.classes()).toContain('save-ring--open')
    expect(wrapper.get('[data-testid="save-ring-label"] .save-ring__text').text()).toBe('Save Project file')
    expect(wrapper.get('[data-testid="save-ring-count"]').text()).toBe('64 beads since the last file')
    // Open, its words are its name (ticket 0940): no label over them, and no second count line.
    const button = wrapper.get('[data-testid="save-ring"]')
    expect(button.attributes('aria-label')).toBeUndefined()
    expect(button.attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.get('[data-testid="save-ring-label"]').attributes('aria-hidden')).toBeUndefined()
    expect(button.text().replace(/\s+/g, ' ')).toBe('Save Project file 64 beads since the last file')
    await wrapper.setProps({ beads: 1 })
    expect(wrapper.get('[data-testid="save-ring-count"]').text()).toBe('1 bead since the last file')
  })

  it('says why to save in place of the count while the Project has never had a file (ticket 0987)', async () => {
    const wrapper = mountRing({ beads: 170, labelOpen: true })

    expect(wrapper.get('[data-testid="save-ring-count"]').text()).toBe('the browser can clear your work, a file stays')
    await wrapper.setProps({ lastFileAt: Date.now() })
    expect(wrapper.get('[data-testid="save-ring-count"]').text()).toBe('170 beads since the last file')
  })

  it('has a Tooltip with the Save key, the body, the count and when the last file was', async () => {
    const wrapper = mountRing({ lastFileAt: Date.now() })
    const tooltip = wrapper.getComponent(AppTooltip)

    expect(tooltip.props()).toMatchObject({ name: 'Save Project file', hotkey: 'Ctrl/Cmd+S', body: en.saveReminder.body, meta: ['Beads since last file: 64', 'Last file: today'] })
    await wrapper.setProps({ lastFileAt: undefined })
    expect((tooltip.props() as TooltipProps).meta).toEqual(['Beads since last file: 64', 'No Project file yet'])
  })

  it('asks to save when pressed, and says when the pointer or focus is on it', async () => {
    const wrapper = mountRing()
    const button = wrapper.get('[data-testid="save-ring"]')
    await button.trigger('click')
    await button.trigger('pointerenter')
    await button.trigger('pointerleave')
    await button.trigger('focus')

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('hold')).toEqual([[true], [false], [true]])
  })
})
