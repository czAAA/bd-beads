import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import FileButton from './FileButton.vue'
import FormField from './FormField.vue'
import NumberField from './NumberField.vue'
import SegmentedControl from './SegmentedControl.vue'
import AppStepper from './AppStepper.vue'
import TextField from './TextField.vue'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

describe('FormField', () => {
  it('labels its control, with the note at the right, a hint and an error saying what to enter', () => {
    const wrapper = mount(FormField, {
      props: { label: 'Height', labelFor: 'h', aside: 'optional', hint: 'In beads', error: 'Enter a height.' },
      slots: { default: '<input id="h" />' },
    })

    expect(wrapper.find('label[for="h"]').text()).toBe('Height')
    expect(wrapper.find('.form-field__aside').text()).toBe('optional')
    expect(wrapper.find('.form-field__hint').text()).toBe('In beads')
    const error = wrapper.find('[role="alert"]')
    expect(error.text()).toBe('Enter a height.')
    expect(error.find('[data-icon="warning"]').exists()).toBe(true)
  })
})

describe('TextField and NumberField', () => {
  it('binds its value and passes attributes to the input', async () => {
    const value = ref('Fox')
    const wrapper = mount(TextField, {
      props: { modelValue: value.value, 'onUpdate:modelValue': (next: string | number | undefined) => (value.value = String(next)), placeholder: 'Name' },
      attrs: { 'data-testid': 'name' },
    })

    const input = wrapper.find<HTMLInputElement>('[data-testid="name"]')
    expect(input.element.value).toBe('Fox')
    expect(input.attributes('placeholder')).toBe('Name')
    await input.setValue('Owl')
    expect(value.value).toBe('Owl')
  })

  it('shows its invalid and disabled states', () => {
    const invalid = mount(TextField, { props: { invalid: true } })
    expect(invalid.classes()).toContain('text-field--invalid')
    expect(invalid.find('input').attributes('aria-invalid')).toBe('true')

    const disabled = mount(TextField, { props: { disabled: true } })
    expect(disabled.classes()).toContain('text-field--disabled')
    expect(disabled.find('input').element.disabled).toBe(true)
  })

  it('shows its unit as a border label, described once, and asks for the right keyboard', () => {
    const beads = mount(NumberField, { props: { unit: 'beads', whole: true } })
    const unit = beads.find('.text-field__unit')
    expect(unit.text()).toBe('beads')
    expect(beads.find('input').attributes('aria-describedby')).toBe(unit.attributes('id'))
    expect(unit.attributes('aria-hidden')).toBe('true')
    expect(mount(NumberField).find('input').attributes('aria-describedby')).toBeUndefined()
    expect(beads.find('input').attributes('type')).toBe('number')
    expect(beads.find('input').attributes('inputmode')).toBe('numeric')

    expect(mount(NumberField, { props: { unit: 'mm' } }).find('input').attributes('inputmode')).toBe('decimal')
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'loom', label: 'Loom' },
    { value: 'peyote', label: 'Peyote' },
    { value: 'brick', label: 'Brick stitch' },
  ] as const

  function mountControl(start = 'loom') {
    const value = ref<string>(start)
    const wrapper = mount(SegmentedControl, {
      props: { options, modelValue: value.value, 'onUpdate:modelValue': (next: string) => {
        value.value = next
        void wrapper.setProps({ modelValue: next })
      } },
      attachTo: document.body,
    })
    return { wrapper, value }
  }

  it('keeps its choice when disabled, by click or arrow key, and says why on hover', async () => {
    const wrapper = mount(SegmentedControl, {
      props: {
        options: options.map((o) => ({ ...o, tooltip: { name: o.label, body: 'Choose it.', disabledBody: 'Not now.' } })),
        modelValue: 'loom',
        disabled: true,
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-value="peyote"]').trigger('click')
    await wrapper.find('[data-value="loom"]').trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-value="peyote"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-value="peyote"]').attributes('disabled')).toBeUndefined()
  })

  it('is a radiogroup with the chosen option checked and the only tab stop', () => {
    const { wrapper } = mountControl('peyote')

    expect(wrapper.attributes('role')).toBe('radiogroup')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios.map((radio) => radio.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('chooses on a click', async () => {
    const { wrapper, value } = mountControl()

    await wrapper.find('[data-value="brick"]').trigger('click')

    expect(value.value).toBe('brick')
  })

  it('moves the choice with the arrows, Home and End, taking focus along', async () => {
    const { wrapper, value } = mountControl()

    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(value.value).toBe('peyote')
    await wrapper.vm.$nextTick()
    expect(document.activeElement).toBe(wrapper.find('[data-value="peyote"]').element)
    await wrapper.trigger('keydown', { key: 'End' })
    expect(value.value).toBe('brick')
    await wrapper.trigger('keydown', { key: 'Home' })
    expect(value.value).toBe('loom')
    await wrapper.trigger('keydown', { key: 'ArrowLeft' })
    expect(value.value).toBe('loom')
  })
})

describe('NumberField stepper', () => {
  it('repeats while held, stops at the minimum, and a release adds no step', async () => {
    vi.useFakeTimers()
    try {
      const value = ref<string | number | undefined>('4')
      const wrapper = mount(NumberField, {
        props: {
          modelValue: value.value,
          'onUpdate:modelValue': (next: string | number | undefined) => {
            value.value = next
            void wrapper.setProps({ modelValue: next })
          },
          stepper: true,
          min: 1,
          decreaseLabel: 'Fewer',
          increaseLabel: 'More',
          testidPrefix: 'n',
        },
      })
      const minus = wrapper.find('[data-testid="n-decrease"]')
      await minus.trigger('pointerdown', { pointerType: 'mouse', button: 0 })
      expect(value.value).toBe('3')
      await vi.advanceTimersByTimeAsync(3000)
      expect(value.value).toBe('1')
      await minus.trigger('pointerup')
      await minus.trigger('click')
      expect(value.value).toBe('1')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('AppStepper', () => {
  function mountStepper(start: number, props: Record<string, unknown> = {}) {
    const value = ref(start)
    const wrapper = mount(AppStepper, {
      props: {
        modelValue: value.value,
        'onUpdate:modelValue': (next: number) => {
          value.value = next
          void wrapper.setProps({ modelValue: next })
        },
        valueLabel: 'Colors',
        decreaseLabel: 'Fewer colors',
        increaseLabel: 'More colors',
        min: 2,
        max: 4,
        ...props,
      },
    })
    return { wrapper, value }
  }

  it('steps the value by one, each button named for what it does', async () => {
    const { wrapper, value } = mountStepper(3)
    const [minus, plus] = wrapper.findAll('.stepper__button')

    expect(minus!.attributes('aria-label')).toBe('Fewer colors')
    expect(plus!.attributes('aria-label')).toBe('More colors')
    await plus!.trigger('click')
    expect(value.value).toBe(4)
    expect(wrapper.find('.stepper__value').text()).toBe('4')
  })

  it('turns a button off at its limit', () => {
    const { wrapper } = mountStepper(2)
    const [minus, plus] = wrapper.findAll<HTMLButtonElement>('.stepper__button')

    expect(minus!.element.disabled).toBe(true)
    expect(plus!.element.disabled).toBe(false)
  })

  it('locks both buttons while disabled', () => {
    const { wrapper } = mountStepper(3, { disabled: true })

    expect(wrapper.classes()).toContain('stepper--disabled')
    expect(wrapper.findAll<HTMLButtonElement>('button').every((button) => button.element.disabled)).toBe(true)
  })

  it('repeats while a button is held, and a release adds no step', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper, value } = mountStepper(2, { max: 50 })
      const plus = wrapper.findAll('.stepper__button')[1]!
      await plus.trigger('pointerdown', { pointerType: 'mouse', button: 0 })
      expect(value.value).toBe(3)
      await vi.advanceTimersByTimeAsync(1000)
      const held = value.value
      expect(held).toBeGreaterThan(4)
      await plus.trigger('pointerup')
      await plus.trigger('click')
      await vi.advanceTimersByTimeAsync(1000)
      expect(value.value).toBe(held)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops repeating at the limit', async () => {
    vi.useFakeTimers()
    try {
      const { wrapper, value } = mountStepper(3)
      await wrapper.findAll('.stepper__button')[1]!.trigger('pointerdown', { pointerType: 'mouse', button: 0 })
      await vi.advanceTimersByTimeAsync(2000)
      expect(value.value).toBe(4)
    } finally {
      vi.useRealTimers()
    }
  })

  describe('typing the value', () => {
    async function open(start = 3, props: Record<string, unknown> = {}) {
      const mounted = mountStepper(start, props)
      await mounted.wrapper.find('.stepper__value-button').trigger('click')
      return { ...mounted, input: mounted.wrapper.find<HTMLInputElement>('input') }
    }

    it('names the number and opens it as a numeric input with the current value', async () => {
      const { wrapper, input } = await open()
      expect(wrapper.find('.stepper__value-button').attributes('aria-label')).toBe('Colors')
      expect(input.attributes('inputmode')).toBe('numeric')
      expect(input.attributes('aria-label')).toBe('Colors')
      expect(input.element.value).toBe('3')
    })

    it('commits on Enter', async () => {
      const { input, value } = await open()
      await input.setValue('4')
      await input.trigger('keydown', { key: 'Enter' })
      expect(value.value).toBe(4)
    })

    it('commits on blur', async () => {
      const { input, value } = await open(2)
      await input.setValue('3')
      await input.trigger('blur')
      expect(value.value).toBe(3)
    })

    it('cancels on Escape', async () => {
      const { wrapper, input, value } = await open()
      await input.setValue('4')
      await input.trigger('keydown', { key: 'Escape' })
      expect(value.value).toBe(3)
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('clamps an out-of-range value', async () => {
      const first = await open()
      await first.input.setValue('99')
      await first.input.trigger('keydown', { key: 'Enter' })
      expect(first.value.value).toBe(4)
      const second = await open()
      await second.input.setValue('-5')
      await second.input.trigger('keydown', { key: 'Enter' })
      expect(second.value.value).toBe(2)
    })

    it('reverts on empty or invalid input', async () => {
      const first = await open()
      await first.input.setValue('')
      await first.input.trigger('keydown', { key: 'Enter' })
      expect(first.value.value).toBe(3)
      const second = await open()
      await second.input.setValue('abc')
      await second.input.trigger('blur')
      expect(second.value.value).toBe(3)
    })

    it('reverts on hex or exponent input', async () => {
      const { input, value } = await open()
      await input.setValue('0x4')
      await input.trigger('keydown', { key: 'Enter' })
      expect(value.value).toBe(3)
    })

    it('commits the typed number before a button steps from it', async () => {
      const { wrapper, input, value } = await open(2, { max: 50 })
      await input.setValue('10')
      await wrapper.findAll('.stepper__button')[1]!.trigger('pointerdown', { pointerType: 'mouse', button: 0 })
      await input.trigger('blur')
      expect(value.value).toBe(11)
    })

    it('closes when the stepper gets locked', async () => {
      const { wrapper } = await open()
      await wrapper.setProps({ disabled: true })
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('keeps the number focusable while locked with a reason, but does not open it', async () => {
      const { wrapper } = mountStepper(3, { disabled: true, disabledBody: 'Locked.' })
      const button = wrapper.find<HTMLButtonElement>('.stepper__value-button')
      expect(button.element.disabled).toBe(false)
      expect(button.attributes('aria-disabled')).toBe('true')
      await button.trigger('click')
      expect(wrapper.find('input').exists()).toBe(false)
    })

    it('does not open while locked', async () => {
      const { wrapper } = mountStepper(3, { disabled: true })
      await wrapper.find('.stepper__value-button').trigger('click')
      expect(wrapper.find('input').exists()).toBe(false)
    })
  })
})

describe('FileButton', () => {
  it('opens the file picker from a labelled target, with its limits written under it', () => {
    const wrapper = mount(FileButton, {
      props: { label: 'Convert image', icon: 'image', limits: 'PNG, JPEG, up to 10 MB' },
      attrs: { 'data-testid': 'file', accept: 'image/*' },
    })

    const input = wrapper.find('[data-testid="file"]')
    expect(input.attributes('type')).toBe('file')
    expect(input.attributes('accept')).toBe('image/*')
    expect(wrapper.find('label').text()).toBe('Convert image')
    expect(wrapper.find('[data-testid="file-button-limits"]').text()).toBe('PNG, JPEG, up to 10 MB')
  })

  it('says why it is off, in words', () => {
    const wrapper = mount(FileButton, { props: { label: 'Convert image', disabled: true, disabledReason: 'Enter a size first.' } })

    expect(wrapper.find('input').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Enter a size first.')
  })

  it('takes a dropped file', async () => {
    const wrapper = mount(FileButton, { props: { label: 'Convert image' } })
    const file = new File(['x'], 'fox.png', { type: 'image/png' })
    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } })

    wrapper.find('label').element.dispatchEvent(drop)

    expect(wrapper.emitted('drop-file')).toEqual([[file]])
  })
})
