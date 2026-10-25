import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { provide, defineComponent, h, ref } from 'vue'
import MenuPanel from './MenuPanel.vue'
import { PANEL_CONTEXT } from './panelContext'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'
import { choosePanelOption, panelOptionShown } from '../../testUtils/choosePanelOption'

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
const base = { projects: [project], toolsPosition: 'bottom' as const, inputMode: 'pen' as const, handedness: 'right' as const, penSeen: false }

/** The panel inside a shell's context. */
function mountIn(props: Record<string, unknown> = {}, openSub = () => {}) {
  const Host = defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { itemRole: ref(undefined), close: () => {}, openSub })
      return () => h(MenuPanel, { ...base, ...props })
    },
  })
  return mount(Host)
}

describe('MenuPanel (ticket 443)', () => {
  it('has Projects, Preferences, Help and About in that order, each a named group', () => {
    const wrapper = mountIn()
    const groups = wrapper.findAll('[role="group"]').filter((group) => group.find('h3').exists())
    expect(groups.map((group) => group.get('h3').text())).toEqual([en.panels.menu.projects, en.panels.menu.preferences, en.panels.menu.help, en.panels.menu.about])
  })

  it('lists New Project and the Projects library with its count, each opening a subpanel', () => {
    const wrapper = mountIn()
    const projects = wrapper.get('[data-testid="menu-panel"] section')
    const rows = projects.findAll('.panel-item').map((row) => row.text())
    expect(rows).toEqual([en.projects.newProjectButton, `${en.projects.heading}1`])
    expect(projects.findAll('.panel-item__mark--sub')).toHaveLength(2)
  })

  it('shows the Input row only once a pen has been seen', () => {
    expect(mountIn().find('[data-testid="menu-input-mode"]').exists()).toBe(false)
    const pen = mountIn({ penSeen: true })
    expect(pen.find('[data-testid="menu-input-mode"]').exists()).toBe(true)
    expect(panelOptionShown(pen, 'menu-input-mode')).toBe(en.panels.menu.pen)
  })

  it('shows Writing hand only once a pen has been seen, and asks for the other hand', async () => {
    expect(mountIn().find('[data-testid="menu-handedness"]').exists()).toBe(false)
    const pen = mountIn({ penSeen: true })
    expect(pen.get('[data-testid="menu-handedness"]').text()).toContain(en.panels.menu.writingHand)
    expect(panelOptionShown(pen, 'menu-handedness')).toBe(en.panels.menu.right)
    await choosePanelOption(pen, 'menu-handedness', 'left')
    expect(pen.findComponent(MenuPanel).emitted('update:handedness')).toEqual([['left']])
  })

  it('has Source code opening a new tab, and the version as text', () => {
    const wrapper = mountIn()
    expect(wrapper.get('[data-testid="menu-item-source"]').attributes('target')).toBe('_blank')
    expect(wrapper.get('[data-testid="menu-version"]').text()).toContain(en.panels.menu.version)
  })

  it('has the language and theme as pickers, and a language change is remembered', async () => {
    const wrapper = mountIn()
    expect(panelOptionShown(wrapper, 'language-switcher')).toBe('English')
    expect(panelOptionShown(wrapper, 'theme-picker')).toBe(en.theme.matchDevice)
    await choosePanelOption(wrapper, 'language-switcher', 'pl')
    expect(localStorage.getItem('openbeads:locale')).toBe('pl')
  })

  it('applies a theme at once and remembers it on this device', async () => {
    const wrapper = mountIn()
    await choosePanelOption(wrapper, 'theme-picker', 'dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('openbeads:theme')).toBe('dark')
    await choosePanelOption(wrapper, 'theme-picker', 'device')
    expect(localStorage.getItem('openbeads:theme')).toBeNull()
  })

  it('has no Buy me a coffee row while there is no link', () => {
    expect(mountIn().find('[data-testid="menu-item-coffee"]').exists()).toBe(false)
  })

  it('emits its choices', async () => {
    const openSub = vi.fn()
    const wrapper = mountIn({}, openSub)
    const panel = wrapper.getComponent(MenuPanel)
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
    await choosePanelOption(wrapper, 'menu-tools-position', 'left')
    expect(['new-project', 'saved-projects'].map((name) => panel.emitted(name)?.length)).toEqual([1, 1])
    // New Project and the Projects library each open a subpanel.
    expect(openSub).toHaveBeenCalledTimes(2)
    expect(panel.emitted('update:toolsPosition')).toEqual([['left']])
  })

  it('folds a section shut and remembers it on this device', async () => {
    const wrapper = mountIn()
    const header = wrapper.get('[aria-expanded]')
    expect(header.attributes('aria-expanded')).toBe('true')
    await header.trigger('click')
    expect(wrapper.find('[data-testid="menu-new-project"]').exists()).toBe(false)
    expect(localStorage.getItem('openbeads:panel-sections-closed')).toBe('menu:projects')
    wrapper.unmount()
    expect(mountIn().find('[data-testid="menu-new-project"]').exists()).toBe(false)
  })
})

describe('MenuPanel on the Overview (ticket 540)', () => {
  it('shows Overview as the current page and leaves out what belongs to the editor', () => {
    const wrapper = mountIn({ page: 'overview', projects: undefined, toolsPosition: undefined, inputMode: undefined })
    const groups = wrapper.findAll('[role="group"]').filter((group) => group.find('h3').exists())
    expect(groups.map((group) => group.get('h3').text())).toEqual([en.panels.menu.preferences, en.panels.menu.help, en.panels.menu.about])

    expect(wrapper.get('[data-testid="menu-item-overview"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-tools-position"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
  })

  it('does not mark Overview as current in the editor', () => {
    expect(mountIn().get('[data-testid="menu-item-overview"]').attributes('aria-current')).toBeUndefined()
  })
})
