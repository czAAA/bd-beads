import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppButton from './AppButton.vue'
import AppSelect from './AppSelect.vue'
import AppTooltip from './AppTooltip.vue'
import ExpandButton from './ExpandButton.vue'
import IconButton from './IconButton.vue'
import { CONTROLS, type ControlDeps } from '../../composables/shell/controlRegistry'
import type { TooltipProps } from './tooltipProps'

describe('AppButton', () => {
  it.each(['primary', 'secondary', 'in-box', 'toolbox', 'text', 'danger', 'link'] as const)('draws the %s variant', (variant) => {
    const button = mount(AppButton, { props: { variant }, slots: { default: 'Save Project' } }).get('button')
    expect(button.classes()).toContain(`app-button--${variant}`)
    expect(button.classes()).toContain('ui-control')
    expect(button.text()).toBe('Save Project')
    expect(button.attributes('type')).toBe('button')
  })

  it('puts the leading icon before the label and a trailing chevron after it', () => {
    const button = mount(AppButton, {
      props: { icon: 'export', trailingIcon: 'chevron-down' },
      slots: { default: 'Export' },
    }).get('button')
    const icons = button.findAll('svg').map((svg) => svg.attributes('data-icon'))
    expect(icons).toEqual(['export', 'chevron-down'])
    expect(button.findAll('svg').every((svg) => svg.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it('has the three heights of the Button card', () => {
    for (const size of ['md', 'lg', 'sm'] as const) {
      expect(mount(AppButton, { props: { size } }).get('button').classes()).toContain(`app-button--${size}`)
    }
  })

  it('announces a selected segment with aria-pressed, and says nothing when it is not a toggle', () => {
    expect(mount(AppButton, { props: { selected: true } }).get('button').attributes('aria-pressed')).toBe('true')
    expect(mount(AppButton, { props: { selected: false } }).get('button').attributes('aria-pressed')).toBe('false')
    expect(mount(AppButton).get('button').attributes('aria-pressed')).toBeUndefined()
  })

  it('is aria-disabled, stays focusable, ignores a click and says why in its Tooltip', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AppButton, {
      attachTo: document.body,
      props: { disabled: true, label: 'Remove Frame', disabledBody: 'There is no Frame to remove.' },
      attrs: { onClick },
      slots: { default: 'Remove Frame' },
    })
    const button = wrapper.get('button')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__body').text()).toBe('There is no Frame to remove.')
  })

  it('shows no Tooltip unless it is given one, and none when disabled without a reason', () => {
    expect(mount(AppButton, { slots: { default: 'New Project' } }).find('.app-tooltip').exists()).toBe(false)
    expect(mount(AppButton, { props: { disabled: true, tooltip: 'Start an empty canvas.' } }).find('.app-tooltip').exists()).toBe(false)
  })

  it('shows a sentence that adds to the label as its Tooltip', async () => {
    const wrapper = mount(AppButton, { attachTo: document.body, props: { tooltip: 'Start an empty canvas.' }, slots: { default: 'New Project' } })
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Start an empty canvas.')
    expect(wrapper.get('button').text()).toBe('New Project')
  })

  it('draws a link in danger without a box, and takes a registry action for its label and reason', async () => {
    const link = mount(AppButton, { props: { variant: 'link', icon: 'delete', danger: true }, slots: { default: 'Delete all' } }).get('button')
    expect(link.classes()).toEqual(expect.arrayContaining(['app-button--link', 'app-button--danger-link']))
    expect(link.get('svg').attributes('data-icon')).toBe('delete')

    const action = CONTROLS.find((c) => c.id === 'rotate')!
    const withReason = { ...action, enabled: () => false, disabledBody: () => 'Set a Frame first.' }
    const wrapper = mount(AppButton, { attachTo: document.body, props: { action: withReason, deps: {} as ControlDeps } })
    expect(wrapper.get('button').text()).not.toBe('')
    expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Set a Frame first.')
  })
})

describe('IconButton', () => {
  it('takes its accessible name from its label and shows it as a tooltip that screen readers skip', () => {
    const wrapper = mount(IconButton, { props: { icon: 'keyboard', label: 'Keyboard shortcuts', shape: 'round', tooltip: true } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Keyboard shortcuts')
    expect(button.classes()).toContain('icon-btn--round')
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Keyboard shortcuts')
    expect(wrapper.get('[role="tooltip"]').attributes('aria-hidden')).toBe('true')
    expect(button.attributes('aria-describedby')).toBeUndefined()
  })

  it.each(['secondary', 'in-box', 'toolbox', 'plain'] as const)('draws the %s look', (variant) => {
    expect(mount(IconButton, { props: { icon: 'zoom-in', label: 'Zoom in', variant } }).get('button').classes()).toContain(
      `icon-btn--${variant}`,
    )
  })
})

describe('IconButton disabled (ticket 327)', () => {
  it('is aria-disabled, stays focusable, ignores a click and says why in its Tooltip', async () => {
    const onClick = vi.fn()
    const wrapper = mount(IconButton, {
      attachTo: document.body,
      props: { icon: 'undo', label: 'Undo', disabled: true, disabledBody: 'Nothing to undo.', tooltip: true },
      attrs: { onClick },
    })
    const button = wrapper.get('button')
    expect(button.attributes('aria-disabled')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Nothing to undo.')
  })

  it('shows no Tooltip when disabled with no reason given', () => {
    const wrapper = mount(IconButton, { props: { icon: 'undo', label: 'Undo', disabled: true, tooltip: true } })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })
})

describe('IconButton variants and registry action (ticket 330)', () => {
  it('shows no Tooltip unless it is given one', () => {
    const wrapper = mount(IconButton, { props: { icon: 'zoom-in', label: 'Zoom in' } })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toBe('Zoom in')
  })

  it('passes a body and a key through to its Tooltip', async () => {
    const wrapper = mount(IconButton, {
      attachTo: document.body,
      props: { icon: 'paint', label: 'Paint', hotkey: '1', tooltip: { body: 'Click or drag to paint.' } },
    })
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__name').text()).toBe('Paint')
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Click or drag to paint.')
    expect(wrapper.text()).toContain('1')
  })

  it('draws the tool tab: underline when selected, and the key badge only with showHotkey', () => {
    const tool = (props: object) => mount(IconButton, { props: { icon: 'paint', label: 'Paint', variant: 'tool', hotkey: '1', ...props } })
    const selected = tool({ selected: true, showHotkey: true })
    expect(selected.get('button').classes()).toEqual(expect.arrayContaining(['icon-btn--tool', 'icon-btn--selected']))
    expect(selected.get('button').attributes('aria-pressed')).toBe('true')
    expect(selected.get('button').attributes('aria-keyshortcuts')).toBe('1')
    expect(selected.get('.icon-btn__key').text()).toBe('1')
    expect(tool({}).find('.icon-btn__key').exists()).toBe(false)
    expect(tool({ showHotkey: true, hotkey: undefined }).find('.icon-btn__key').exists()).toBe(false)
  })

  it('reads its name, key and body from a registry action', async () => {
    const action = CONTROLS.find((c) => c.id === 'tool-paint')!
    const wrapper = mount(IconButton, { attachTo: document.body, props: { action } })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Paint')
    expect(wrapper.get('svg').attributes('data-icon')).toBe('paint')
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__name').text()).toBe('Paint')
  })

  it('reads its enabled state and disabled reason from a registry action', async () => {
    const action = CONTROLS.find((c) => c.id === 'rotate')!
    const withReason = { ...action, enabled: () => false, disabledBody: () => 'Set a Frame first.' }
    const onClick = vi.fn()
    const wrapper = mount(IconButton, { attachTo: document.body, props: { action: withReason, deps: {} as ControlDeps }, attrs: { onClick } })
    expect(wrapper.get('button').attributes('aria-disabled')).toBe('true')
    await wrapper.get('button').trigger('click')
    expect(onClick).not.toHaveBeenCalled()
    await wrapper.get('.app-tooltip').trigger('pointerenter', { pointerType: 'mouse' })
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Set a Frame first.')
  })
})

describe('AppTooltip props (ticket 327)', () => {
  it('types `disabledBody` as required when `disabled` is set', () => {
    const ok: TooltipProps[] = [{ name: 'Undo' }, { name: 'Undo', hotkey: 'Z', body: 'x' }, { name: 'Undo', disabled: true, disabledBody: 'Why' }]
    // @ts-expect-error a disabled Tooltip has to say why
    const missing: TooltipProps = { name: 'Undo', disabled: true }
    expect([ok.length, missing.name]).toEqual([3, 'Undo'])
  })
})

describe('AppTooltip', () => {
  function tooltip() {
    return mount(AppTooltip, {
      attachTo: document.body,
      props: { name: 'An estimate' },
      slots: { default: '<button type="button" :aria-describedby="params.describedby">?</button>' },
    })
  }

  it('shows while a mouse hovers its trigger and hides when it leaves', async () => {
    const wrapper = tooltip()
    const bubble = wrapper.get('[role="tooltip"]')
    expect(bubble.isVisible()).toBe(false)

    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })
    expect(bubble.isVisible()).toBe(true)
    await wrapper.trigger('pointerleave')
    expect(bubble.isVisible()).toBe(false)
  })

  it('shows the name, a key chip and a description line when given them (ticket 251)', async () => {
    const wrapper = mount(AppTooltip, {
      attachTo: document.body,
      props: { name: 'Paint', hotkey: '1', body: 'Click or drag to paint.' },
      slots: { default: '<button type="button">x</button>' },
    })
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.get('.app-tooltip__name').text()).toBe('Paint')
    expect(wrapper.get('.app-tooltip__key').text()).toBe('1')
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Click or drag to paint.')
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)
  })

  it('shows the name and the reason, with no key chip, for a disabled trigger (ticket 327)', async () => {
    const wrapper = mount(AppTooltip, {
      attachTo: document.body,
      props: { name: 'Undo', hotkey: undefined, body: 'Hidden', disabled: true, disabledBody: 'Nothing to undo.' },
      slots: { default: '<button type="button" aria-disabled="true">x</button>' },
    })
    await wrapper.trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)
    expect(wrapper.get('.app-tooltip__name').text()).toBe('Undo')
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Nothing to undo.')
    expect(wrapper.get('.app-tooltip__body').classes()).toContain('app-tooltip__body--disabled')
    expect(wrapper.find('.app-tooltip__key').exists()).toBe(false)
  })

  it('shows a disabled trigger\'s reason on focus and on a long press', async () => {
    vi.useFakeTimers()
    const wrapper = mount(AppTooltip, {
      attachTo: document.body,
      props: { name: 'Undo', disabled: true, disabledBody: 'Nothing to undo.' },
      slots: { default: '<button type="button" aria-disabled="true">x</button>' },
    })
    await wrapper.get('button').trigger('focusin')
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)
    await wrapper.trigger('focusout')
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)

    await wrapper.trigger('pointerdown', { pointerType: 'touch' })
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(wrapper.get('.app-tooltip__body').text()).toBe('Nothing to undo.')
    vi.useRealTimers()
  })

  it('does not show for a touch', async () => {
    const wrapper = tooltip()
    await wrapper.trigger('pointerenter', { pointerType: 'touch' })
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
  })

  it('shows for a hovering pen, like a mouse', async () => {
    const wrapper = tooltip()
    await wrapper.trigger('pointerenter', { pointerType: 'pen', buttons: 0 })
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)
    await wrapper.trigger('pointerleave', { pointerType: 'pen' })
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
  })

  it('does not show for a pen that enters with its tip down (a pen that cannot hover)', async () => {
    const wrapper = tooltip()
    await wrapper.trigger('pointerenter', { pointerType: 'pen', buttons: 1 })
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
  })

  it('shows on a long touch or pen press and hides on release (ticket 166: tooltips become long-press)', async () => {
    vi.useFakeTimers()
    try {
      for (const pointerType of ['touch', 'pen'] as const) {
        const wrapper = tooltip()
        await wrapper.trigger('pointerdown', { pointerType })
        expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)

        vi.advanceTimersByTime(500)
        await wrapper.vm.$nextTick()
        expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)

        await wrapper.trigger('pointerup', { pointerType })
        expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
      }
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not open from a long-press timer whose press already lifted', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = tooltip()
      await wrapper.trigger('pointerdown', { pointerType: 'touch' })
      await wrapper.trigger('pointerup', { pointerType: 'touch' })
      vi.advanceTimersByTime(500)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows on keyboard focus, hides on Escape, and describes its trigger', async () => {
    const wrapper = tooltip()
    const button = wrapper.get('button')
    await button.trigger('focusin')
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(true)
    expect(button.attributes('aria-describedby')).toBe(wrapper.get('[role="tooltip"]').attributes('id'))

    await button.trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
  })
})

describe('AppSelect', () => {
  it('passes its attributes and listeners to the native select and draws its own chevron', async () => {
    let changed = ''
    const wrapper = mount(AppSelect, {
      props: { variant: 'primary' },
      attrs: { 'aria-label': 'Replace bead', onChange: (event: Event) => (changed = (event.target as HTMLSelectElement).value) },
      slots: { default: '<option value="a">A</option><option value="b">B</option>' },
    })
    const select = wrapper.get('select')
    expect(select.attributes('aria-label')).toBe('Replace bead')
    expect(wrapper.classes()).toContain('app-select--primary')
    expect(wrapper.get('svg').attributes('data-icon')).toBe('chevron-down')

    await select.setValue('b')
    expect(changed).toBe('b')
  })
})

describe('ExpandButton', () => {
  it('points down while collapsed and up while expanded, and says which', () => {
    const collapsed = mount(ExpandButton, { props: { expanded: false, label: 'Show every color' } }).get('button')
    expect(collapsed.attributes('aria-expanded')).toBe('false')
    expect(collapsed.get('svg').attributes('data-icon')).toBe('arrow-down')

    const expanded = mount(ExpandButton, { props: { expanded: true, label: 'Show every color' } }).get('button')
    expect(expanded.attributes('aria-expanded')).toBe('true')
    expect(expanded.get('svg').attributes('data-icon')).toBe('arrow-up')
  })
})

describe('the controls follow the interaction rules and use only tokens', () => {
  const files = ['AppButton', 'IconButton', 'AppSelect', 'ExpandButton', 'AppTooltip']
  const styleOf = (name: string) => {
    const source = readFileSync(resolve(__dirname, `${name}.vue`), 'utf8')
    return /<style scoped>([\s\S]*)<\/style>/.exec(source)![1].replace(/\/\*[\s\S]*?\*\//g, '')
  }

  it.each(files)('%s hovers only with a fine pointer', (name) => {
    const style = styleOf(name)
    const outsideHoverMedia = style.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}/g, '')
    expect(outsideHoverMedia).not.toContain(':hover')
  })

  it.each(files)('%s writes no raw colors, durations, shadows or z-index', (name) => {
    const style = styleOf(name)
    expect(style).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
    expect(style).not.toMatch(/\d+m?s\b/)
    expect(style).not.toMatch(/box-shadow:(?!\s*var\()|z-index:\s*\d/)
    // px only for hairline borders and the focus ring's offset.
    for (const px of style.match(/[\d.]+px/g) ?? []) expect(['1px', '2px', '3px']).toContain(px)
  })

  it.each(files.filter((name) => name !== 'AppTooltip'))('%s shows the focus ring from the keyboard only', (name) => {
    const style = styleOf(name)
    expect(style).toContain(':focus-visible')
    expect(style).toContain('var(--focus-ring)')
    expect(style).not.toMatch(/:focus(?!-visible)/)
  })

  it.each(files.filter((name) => name !== 'AppTooltip' && name !== 'AppSelect'))(
    '%s drops the pressed shrink under reduced motion',
    (name) => {
      expect(styleOf(name)).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transform: none/)
    },
  )
})

describe('New Project', () => {
  it('is the primary Button with the plus icon', async () => {
    const { default: App } = await import('../../App.vue')
    const button = mount(App).get('[data-testid="new-project-button"]')
    expect(button.classes()).toEqual(expect.arrayContaining(['app-button', 'app-button--primary']))
    expect(button.get('svg').attributes('data-icon')).toBe('plus')
  })
})
