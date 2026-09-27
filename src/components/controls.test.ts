import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppButton from './AppButton.vue'
import AppLink from './AppLink.vue'
import AppSelect from './AppSelect.vue'
import AppTooltip from './AppTooltip.vue'
import ExpandButton from './ExpandButton.vue'
import IconButton from './IconButton.vue'

describe('AppButton', () => {
  it.each(['primary', 'secondary', 'in-box', 'toolbox', 'text', 'danger'] as const)('draws the %s variant', (variant) => {
    const button = mount(AppButton, { props: { variant }, slots: { default: 'Save Pattern' } }).get('button')
    expect(button.classes()).toContain(`app-button--${variant}`)
    expect(button.classes()).toContain('ui-control')
    expect(button.text()).toBe('Save Pattern')
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
      expect(mount(AppButton, { props: { size } }).classes()).toContain(`app-button--${size}`)
    }
  })

  it('announces a selected segment with aria-pressed, and says nothing when it is not a toggle', () => {
    expect(mount(AppButton, { props: { selected: true } }).attributes('aria-pressed')).toBe('true')
    expect(mount(AppButton, { props: { selected: false } }).attributes('aria-pressed')).toBe('false')
    expect(mount(AppButton).attributes('aria-pressed')).toBeUndefined()
  })

  it('does nothing while disabled', async () => {
    const wrapper = mount(AppButton, { props: { disabled: true }, attrs: { onClick: () => {} } })
    await wrapper.trigger('click')
    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})

describe('IconButton', () => {
  it('takes its accessible name from its label and shows it as a tooltip that screen readers skip', () => {
    const wrapper = mount(IconButton, { props: { icon: 'keyboard', label: 'Keyboard shortcuts', shape: 'round' } })
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

describe('AppTooltip', () => {
  function tooltip() {
    return mount(AppTooltip, {
      attachTo: document.body,
      props: { text: 'An estimate' },
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

  it('does not show for a touch', async () => {
    const wrapper = tooltip()
    await wrapper.trigger('pointerenter', { pointerType: 'touch' })
    expect(wrapper.get('[role="tooltip"]').isVisible()).toBe(false)
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

describe('AppLink', () => {
  it('draws Delete all in danger with its icon', () => {
    const link = mount(AppLink, { props: { icon: 'delete', danger: true }, slots: { default: 'Delete all' } }).get('button')
    expect(link.classes()).toContain('app-link--danger')
    expect(link.get('svg').attributes('data-icon')).toBe('delete')
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
  const files = ['AppButton', 'IconButton', 'AppLink', 'AppSelect', 'ExpandButton', 'AppTooltip']
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
    expect(style).not.toMatch(/box-shadow|z-index:\s*\d/)
    // px only for hairline borders and the focus ring's offset.
    for (const px of style.match(/[\d.]+px/g) ?? []) expect(['1px', '2px', '3px']).toContain(px)
  })

  it.each(files.filter((name) => name !== 'AppTooltip'))('%s shows the focus ring from the keyboard only', (name) => {
    const style = styleOf(name)
    expect(style).toContain(':focus-visible')
    expect(style).toContain('var(--focus-ring)')
    expect(style).not.toMatch(/:focus(?!-visible)/)
  })

  it.each(files.filter((name) => name !== 'AppTooltip' && name !== 'AppSelect' && name !== 'AppLink'))(
    '%s drops the pressed shrink under reduced motion',
    (name) => {
      expect(styleOf(name)).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transform: none/)
    },
  )
})

describe('New Pattern', () => {
  it('is the primary Button with the plus icon', async () => {
    const { default: App } = await import('../App.vue')
    const button = mount(App).get('[data-testid="new-pattern-button"]')
    expect(button.classes()).toEqual(expect.arrayContaining(['app-button', 'app-button--primary']))
    expect(button.get('svg').attributes('data-icon')).toBe('plus')
  })
})
