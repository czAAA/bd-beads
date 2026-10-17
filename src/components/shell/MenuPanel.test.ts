import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { provide, defineComponent, h, ref } from 'vue'
import MenuPanel from './MenuPanel.vue'
import { PANEL_CONTEXT } from './panelContext'
import { createProject } from '../../domain/project'
import { en } from '../../i18n/en'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })
const base = { projects: [project], toolsPosition: 'bottom' as const, inputMode: 'pen' as const, penSeen: false }

/** The panel inside a shell's context: `sheet` is the Top sheet's, with one option per line. */
function mountIn(sheet: boolean, props: Record<string, unknown> = {}) {
  const Host = defineComponent({
    setup() {
      provide(PANEL_CONTEXT, { sheet: ref(sheet), itemRole: ref(undefined), close: () => {} })
      return () => h(MenuPanel, { ...base, ...props })
    },
  })
  return mount(Host)
}

describe('MenuPanel (ticket 443)', () => {
  it('has Projects, Preferences, Help and About in that order, each a named group', () => {
    const wrapper = mountIn(false)
    const groups = wrapper.findAll('[role="group"]').filter((group) => group.find('h3').exists())
    expect(groups.map((group) => group.get('h3').text())).toEqual([en.panels.menu.projects, en.panels.menu.preferences, en.panels.menu.help, en.panels.menu.about])
  })

  it('lists New Project, Import, Export all, Saved Projects with its count and Delete all Projects last and danger', () => {
    const wrapper = mountIn(false)
    const projects = wrapper.get('[data-testid="menu-panel"] section')
    const rows = projects.findAll('.panel-item, .project-import__button').map((row) => row.text())
    expect(rows).toEqual([en.projects.newProjectButton, en.transfer.importLabel, `${en.transfer.exportLibraryButton}.openbeads`, `${en.projects.heading}1`, en.panels.menu.deleteAll])
    expect(wrapper.get('[data-testid="menu-delete-all"]').classes()).toContain('panel-item--danger')
  })

  it('disables Delete all Projects and Saved Projects with none saved, each with its reason', () => {
    const wrapper = mountIn(false, { projects: [] })
    expect(wrapper.get('[data-testid="menu-delete-all"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="menu-saved-projects"]').attributes('aria-disabled')).toBe('true')
  })

  it('shows the Input row only once a pen has been seen', () => {
    expect(mountIn(false).find('[data-testid="menu-input-mode"]').exists()).toBe(false)
    const pen = mountIn(false, { penSeen: true })
    expect(pen.find('[data-testid="menu-input-mode"]').exists()).toBe(true)
    expect(pen.get('[data-testid="menu-input-mode"]').text()).toContain(en.panels.menu.pen)
  })

  it('has the Tour item only while the Tour is on, and Source code opening a new tab, and the version as text', () => {
    const wrapper = mountIn(false)
    expect(wrapper.find('[data-testid="menu-item-tour"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="menu-item-source"]').attributes('target')).toBe('_blank')
    expect(wrapper.get('[data-testid="menu-version"]').text()).toContain(en.panels.menu.version)
  })

  it('under 1024px folds Language, Theme, Tools position and Input to a row with the current choice, and opens one option per line with a check on the current', async () => {
    const wrapper = mountIn(true, { penSeen: true })
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(false)
    expect(wrapper.findAll('[role="radiogroup"]')).toHaveLength(0)
    const position = wrapper.get('[data-testid="menu-tools-position"]')
    expect(position.get('button').text()).toContain(en.toolPill.bottom)
    await position.get('button').trigger('click')
    expect(position.get('button').attributes('aria-expanded')).toBe('true')
    expect(position.findAll('[role="radio"]').map((option) => option.text())).toEqual([en.toolPill.left, en.toolPill.top, en.toolPill.right, en.toolPill.bottom])
    expect(position.get('[aria-checked="true"]').text()).toBe(en.toolPill.bottom)
    expect(position.get('[aria-checked="true"] svg').attributes('data-icon')).toBe('check')
    await position.get('button').trigger('click')
    expect(position.findAll('[role="radio"]')).toHaveLength(0)
  })

  it('on the dropdown has the language switcher and the four theme segments', () => {
    const wrapper = mountIn(false)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="theme-toggle"]').findAll('[role="radio"]')).toHaveLength(4)
  })

  it('emits its choices', async () => {
    const wrapper = mountIn(false)
    const panel = wrapper.getComponent(MenuPanel)
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await wrapper.get('[data-testid="menu-export-all"]').trigger('click')
    await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
    await wrapper.get('[data-testid="menu-delete-all"]').trigger('click')
    await wrapper.get('[data-testid="menu-tools-position"] [data-value="left"]').trigger('click')
    expect(['new-project', 'export-all', 'saved-projects', 'delete-all'].map((name) => panel.emitted(name)?.length)).toEqual([1, 1, 1, 1])
    expect(panel.emitted('update:toolsPosition')).toEqual([['left']])
  })
})
