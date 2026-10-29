import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditableLine from './EditableLine.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const props = { label: 'maker:', value: '', editLabel: 'Change', emptyText: 'Add a name', maxlength: 10, normalize: (raw: string) => raw.trim(), testid: 'line' }
const mountLine = (extra: Record<string, unknown> = {}) => mount(EditableLine, { props: { ...props, ...extra }, attachTo: document.body })

describe('EditableLine (ticket 554)', () => {
  it('reads the empty text with no value, and a press opens the field', async () => {
    const wrapper = mountLine()
    expect(wrapper.get('[data-testid="line-add"]').text()).toBe('Add a name')
    await wrapper.get('[data-testid="line-add"]').trigger('click')
    expect(wrapper.get('[data-testid="line-form"]').text()).toContain('0/10')
  })

  it('saves what was typed, normalized, and nothing when it is unchanged', async () => {
    const wrapper = mountLine({ value: 'Ada' })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.emitted('save')).toBeUndefined()

    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue('  Eve ')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([['Eve']])
  })

  it('clears an optional value saved empty', async () => {
    const wrapper = mountLine({ value: 'Ada' })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue('')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([['']])
  })

  it('refuses an empty value when required, and Escape cancels', async () => {
    const wrapper = mountLine({ value: 'Ada', requiredMessage: 'Needs a name.' })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue(' ')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.get('[data-testid="line-error"]').text()).toBe('Needs a name.')
    expect(wrapper.emitted('save')).toBeUndefined()

    await wrapper.get('[data-testid="line-form"]').trigger('panel-escape')
    expect(wrapper.find('[data-testid="line-form"]').exists()).toBe(false)
  })
})

describe('EditableLine in the margin\'s title block (ticket 0685)', () => {
  const pressOutside = () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }))

  it('closes on a press outside its floated field and keeps what was typed', async () => {
    const wrapper = mountLine({ value: 'Ada', bare: true })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue(' Eve ')
    wrapper.get('[data-testid="line-input"]').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="line-form"]').exists()).toBe(true)

    pressOutside()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="line-form"]').exists()).toBe(false)
    expect(wrapper.emitted('save')).toEqual([['Eve']])
  })

  it('still cancels on Escape, keeping nothing of what was typed', async () => {
    const wrapper = mountLine({ value: 'Ada', bare: true })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue('Eve')
    wrapper.get('[data-testid="line-input"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="line-form"]').exists()).toBe(false)
    expect(wrapper.emitted('save')).toBeUndefined()

    pressOutside()
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
