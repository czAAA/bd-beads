import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import SettingStepper from './SettingStepper.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import { BRICK_DROP_SETTING } from '../../domain/weave'
import type { SettingSpec } from '../../domain/settingSpec'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

/** The stepper on one setting, its value held as a parent would. */
function mountStepper(setting: SettingSpec, start: number, props: Record<string, unknown> = {}) {
  const value = ref(start)
  const wrapper = mount(SettingStepper, {
    props: { setting, modelValue: value.value, 'onUpdate:modelValue': (next: number) => wrapper.setProps({ modelValue: (value.value = next) }), testid: 's', ...props },
    attachTo: document.body,
  })
  return { wrapper, value }
}

describe('SettingStepper (ticket 0624)', () => {
  it('is named and bounded by its description, stepping by its step', async () => {
    const { wrapper, value } = mountStepper({ ...BRICK_DROP_SETTING, step: 2 }, 1)

    expect(wrapper.get('[data-testid="s"]').text()).toContain('Drop')
    expect(wrapper.get('[data-testid="s-less"]').attributes('aria-label')).toBe('Fewer beads in each stitch')
    expect(wrapper.get('[data-testid="s-less"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="s-more"]').trigger('click')
    expect(value.value).toBe(3)
  })

  it('settles a typed value on a step within its range', async () => {
    const { wrapper, value } = mountStepper({ ...BRICK_DROP_SETTING, step: 2 }, 5)
    await wrapper.get('[data-testid="s-value"] button').trigger('click')
    const input = wrapper.get<HTMLInputElement>('input')

    await input.setValue('8')
    await input.trigger('keydown', { key: 'Enter' })
    expect(value.value).toBe(7)
  })

  it('shows its hover text where its words have one, and none where they have none', () => {
    const block = mountStepper(BRICK_DROP_SETTING, 1).wrapper.findComponent(AppTooltip)
    expect(block.props()).toMatchObject({ name: 'Drop', body: 'Beads picked up in each stitch: they sit straight beside each other before the next ones shift by half a bead. 1 is ordinary brick stitch.' })
    expect(mountStepper({ ...BRICK_DROP_SETTING, labelKey: 'unworded' }, 1).wrapper.findComponent(AppTooltip).exists()).toBe(false)
  })

  it('locks with its reason while disabled', () => {
    const { wrapper } = mountStepper(BRICK_DROP_SETTING, 2, { disabled: true, disabledBody: 'Rows are done.' })

    expect(wrapper.get('[data-testid="s-more"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.findComponent(AppTooltip).props()).toMatchObject({ disabled: true, disabledBody: 'Rows are done.' })
  })
})
