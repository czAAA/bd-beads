import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EditableLine from './EditableLine.vue'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const props = { label: 'maker:', value: '', editLabel: 'Change', emptyText: 'Add a name', maxlength: 20, normalize: (raw: string) => raw.trim(), testid: 'line' }
const mountLine = (extra: Record<string, unknown> = {}) => mount(EditableLine, { props: { ...props, ...extra }, attachTo: document.body })

describe('EditableLine (ticket 554)', () => {
  it('reads the empty text with no plus, and a press opens the field with its placeholder', async () => {
    const wrapper = mountLine({ placeholder: 'Your name' })
    expect(wrapper.get('[data-testid="line-add"]').text()).toBe('Add a name')
    await wrapper.get('[data-testid="line-add"]').trigger('click')
    expect(wrapper.get('[data-testid="line-input"]').attributes('placeholder')).toBe('Your name')
  })

  it('shows its counter only near the limit (ticket 0854)', async () => {
    const wrapper = mountLine()
    await wrapper.get('[data-testid="line-add"]').trigger('click')
    expect(wrapper.find('[data-testid="field-counter"]').exists()).toBe(false)
    await wrapper.get('[data-testid="line-input"]').setValue('x'.repeat(10))
    expect(wrapper.get('[data-testid="field-counter"]').text()).toBe('10/20')
  })

  it('keeps a value longer than the limit whole when left as it was, and refuses one edited but still too long', async () => {
    const long = 'x'.repeat(26)
    const wrapper = mountLine({ value: long })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    expect(wrapper.get('[data-testid="field-counter"]').classes()).toContain('field-counter--over')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.find('[data-testid="line-form"]').exists()).toBe(false)
    expect(wrapper.emitted('save')).toBeUndefined()

    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue('y'.repeat(25))
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.get('[data-testid="line-error"]').text()).toBe('Use 20 characters or fewer.')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('[data-testid="line-input"]').setValue('y'.repeat(20))
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.emitted('save')).toEqual([['y'.repeat(20)]])
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

  it('refuses an empty value when required', async () => {
    const wrapper = mountLine({ value: 'Ada', requiredMessage: 'Needs a name.' })
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue(' ')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    expect(wrapper.get('[data-testid="line-error"]').text()).toBe('Needs a name.')
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})

// In a panel (ticket 0854) as on the margin sheet (ticket 0685), a tap away is how most people finish typing.
describe.each([
  ['in a panel', false],
  ['in the margin\'s title block', true],
])('EditableLine %s', (_where, bare) => {
  const pressOutside = () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }))

  it('closes on a press outside its field and keeps what was typed', async () => {
    const wrapper = mountLine({ value: 'Ada', bare })
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
    const wrapper = mountLine({ value: 'Ada', bare })
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

describe('EditableLine gives the keyboard back to the line (ticket 0939)', () => {
  const settle = async (wrapper: ReturnType<typeof mountLine>) => {
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
  }

  it('puts focus on the pencil after Enter, the Save button, Escape and the Cancel button', async () => {
    const wrapper = mountLine({ value: 'Ada' })
    const pencil = () => wrapper.get('[data-testid="line-edit"]').element
    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue('Eve')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    await settle(wrapper)
    expect(document.activeElement).toBe(pencil())

    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-save"]').trigger('click')
    await settle(wrapper)
    expect(document.activeElement).toBe(pencil())

    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    wrapper.get('[data-testid="line-input"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(wrapper)
    expect(document.activeElement).toBe(pencil())

    await wrapper.get('[data-testid="line-edit"]').trigger('click')
    await wrapper.get('[data-testid="line-cancel"]').trigger('click')
    await settle(wrapper)
    expect(document.activeElement).toBe(pencil())
    wrapper.unmount()
  })

  it('puts focus on the line inviting a value when it is still empty, and keeps the edit open after a refusal', async () => {
    const wrapper = mountLine({ requiredMessage: 'Give it a name.' })
    await wrapper.get('[data-testid="line-add"]').trigger('click')
    await wrapper.get('[data-testid="line-input"]').setValue('  ')
    await wrapper.get('[data-testid="line-form"]').trigger('submit')
    await settle(wrapper)
    expect(wrapper.find('[data-testid="line-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="line-add"]').exists()).toBe(false)

    wrapper.get('[data-testid="line-input"]').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle(wrapper)
    expect(document.activeElement).toBe(wrapper.get('[data-testid="line-add"]').element)
    wrapper.unmount()
  })
})

describe('EditableLine as a chip on the margin sheet (tickets 0685, 1258)', () => {
  // The whole chip is the button: the empty text is an invitation (ticket 0803), a value reads with its pencil.
  it.each(['', 'Ada'])('starts the edit from a press on its words (%j)', async (value) => {
    const wrapper = mountLine({ value, bare: true })
    await wrapper.get('[data-testid="line"]').trigger('click')
    expect(wrapper.find('[data-testid="line-form"]').exists()).toBe(true)
  })

  it('is one button holding its words round the value and a pencil, named for the edit and the value', () => {
    const wrapper = mountLine({ value: 'Ada', bare: true, prefix: 'by' })
    const chip = wrapper.get('button')
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(chip.text()).toBe('byAda')
    expect(chip.find('svg').exists()).toBe(true)
    expect(chip.attributes('aria-label')).toMatch(/: Ada$/)
  })
})
