import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { provide, defineComponent, h, ref } from 'vue'
import MenuPanel from './MenuPanel.vue'
import { PANEL_CONTEXT } from './panelContext'
import { en } from '../../i18n/en'
import { COFFEE_URL } from '../../data/coffeeLink'
import { choosePanelOption, panelOptionShown } from '../../testUtils/choosePanelOption'

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const base = { projectCount: 1, toolsPosition: 'bottom' as const, inputMode: 'pen' as const, handedness: 'right' as const, penSeen: false }

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

  it('lists New Project, Convert image and the Projects library with its count, New Project and the library opening a subpanel', () => {
    const wrapper = mountIn()
    const projects = wrapper.get('[data-testid="menu-panel"] section')
    const rows = projects.findAll('.panel-item').map((row) => row.text())
    expect(rows).toEqual([en.projects.newProjectButton, en.convertImage.fileLabel, `${en.projects.heading}1`])
    expect(projects.findAll('.panel-item__mark--sub')).toHaveLength(2)
    expect(wrapper.get('[data-testid="menu-convert-image"] svg').attributes('data-icon')).toBe('image')
    // Its own library icon (ticket 188), not the Save Project icon it used to reuse.
    expect(wrapper.get('[data-testid="menu-saved-projects"] svg').attributes('data-icon')).toBe('library')
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
    expect(wrapper.get('[data-testid="menu-item-source"]').attributes('href')).toContain('github.com')
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

  // How a theme is stored, Match device as none, is devicePreferences'.
  it('applies a theme at once and remembers it on this device', async () => {
    const wrapper = mountIn()
    await choosePanelOption(wrapper, 'theme-picker', 'dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('openbeads:theme')).toBe('dark')
  })

  it('has a Buy me a coffee row opening the Coffee link in a new tab', () => {
    const row = mountIn().get('[data-testid="menu-item-coffee"]')
    expect(row.attributes('href')).toBe(COFFEE_URL)
    expect(row.attributes('target')).toBe('_blank')
    expect(row.attributes('rel')).toBe('noopener')
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

  it('opens the Feedback sheet from Help’s Send feedback, after Keyboard shortcuts, and from the link under Language (ticket 0700)', async () => {
    const wrapper = mountIn()
    const panel = wrapper.getComponent(MenuPanel)
    const help = wrapper.findAll('[role="group"]').find((group) => group.find('h3').text() === en.panels.menu.help)!
    const rows = help.findAll('.panel-item').map((row) => row.attributes('data-testid'))
    expect(rows.slice(0, 2)).toEqual(['menu-item-shortcuts', 'menu-item-feedback'])
    const feedback = wrapper.get('[data-testid="menu-item-feedback"]')
    expect(feedback.text()).toBe(en.panels.menu.sendFeedback)
    expect(feedback.find('svg[data-icon="message"]').exists()).toBe(true)
    const link = wrapper.get('[data-testid="menu-report-translation"]')
    expect(link.text()).toBe(en.panels.menu.reportTranslation)
    expect(link.element.previousElementSibling?.getAttribute('data-testid')).toBe('language-switcher')
    await feedback.trigger('click')
    await link.trigger('click')
    expect(panel.emitted('feedback')).toEqual([['general'], ['translation']])
  })

  // Folding and remembering is PanelSection's; the Menu names each section for it.
  it('folds a section shut, remembered under the Menu\'s own name for it', async () => {
    const wrapper = mountIn()
    await wrapper.get('[aria-expanded]').trigger('click')
    expect(localStorage.getItem('openbeads:panel-sections-closed')).toBe('menu:projects')
  })
})

describe('MenuPanel on the Homepage (ticket 540)', () => {
  it('shows Homepage as the current page and leaves out what belongs to the editor', () => {
    const wrapper = mountIn({ page: 'homepage', projectCount: undefined, toolsPosition: undefined, inputMode: undefined })
    const groups = wrapper.findAll('[role="group"]').filter((group) => group.find('h3').exists())
    expect(groups.map((group) => group.get('h3').text())).toEqual([en.panels.menu.preferences, en.panels.menu.help, en.panels.menu.about])

    expect(wrapper.get('[data-testid="menu-item-homepage"]').attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-tools-position"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="language-switcher"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-item-feedback"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-report-translation"]').exists()).toBe(true)
  })

  it('links to the Homepage without marking it current in the editor, and has the shortcuts there', () => {
    const wrapper = mountIn()
    expect(wrapper.get('[data-testid="menu-item-homepage"]').attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('[data-testid="menu-item-homepage"]').attributes('href')).toMatch(/homepage\/$/)
    expect(wrapper.find('[data-testid="menu-item-shortcuts"]').exists()).toBe(true)
  })

  it('holds Saved Projects alone in its Projects section while the library is not empty, and opens its subpanel (ticket 0716)', () => {
    const openSub = vi.fn()
    const wrapper = mountIn({ page: 'homepage', projectCount: 3 }, openSub)

    expect(wrapper.find('[data-testid="menu-new-project"]').exists()).toBe(false)
    const row = wrapper.get('[data-testid="menu-saved-projects"]')
    expect(row.text()).toContain('3')
    row.trigger('click')
    expect(wrapper.getComponent(MenuPanel).emitted('saved-projects')).toHaveLength(1)
    expect(openSub).toHaveBeenCalledOnce()

    expect(mountIn({ page: 'homepage', projectCount: 0 }).find('[data-testid="menu-saved-projects"]').exists()).toBe(false)
  })
})

describe('MenuPanel Convert image row and leaving (ticket 0756)', () => {
  it('asks to convert, and shows the row as the current page while the converter is open, where it asks nothing', async () => {
    const editor = mountIn()
    expect(editor.get('[data-testid="menu-convert-image"]').attributes('aria-current')).toBeUndefined()
    await editor.get('[data-testid="menu-convert-image"]').trigger('click')
    const asked = (editor.findComponent(MenuPanel).emitted('convert-image') ?? []).length
    expect(asked).toBe(1)

    const converting = mountIn({ page: 'convert-image' })
    expect(converting.get('[data-testid="menu-convert-image"]').attributes('aria-current')).toBe('page')
    await converting.get('[data-testid="menu-convert-image"]').trigger('click')
    expect(converting.findComponent(MenuPanel).emitted('convert-image')).toBeUndefined()
    expect(converting.find('[data-testid="menu-new-project"]').exists()).toBe(true)
  })

  it('awaits the page’s leave before New Project opens its form, and stays when the person stays', async () => {
    let answer = false
    const openSub = vi.fn()
    const leave = vi.fn(async () => answer)
    const wrapper = mountIn({ page: 'convert-image', leave }, openSub)

    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await Promise.resolve()
    expect(leave).toHaveBeenCalledOnce()
    expect(openSub).not.toHaveBeenCalled()
    expect(wrapper.findComponent(MenuPanel).emitted('new-project')).toBeUndefined()

    answer = true
    await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
    await vi.waitFor(() => expect(openSub).toHaveBeenCalledOnce())
    expect(wrapper.findComponent(MenuPanel).emitted('new-project')).toHaveLength(1)
  })

  it('holds back a click on the Homepage item until the page lets go, and follows the link as usual on the editor', async () => {
    const leave = vi.fn(async () => false)
    const wrapper = mountIn({ page: 'convert-image', leave })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    wrapper.get('[data-testid="menu-item-homepage"]').element.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    await Promise.resolve()
    expect(leave).toHaveBeenCalledOnce()

    const editor = mountIn({ leave })
    const plain = new MouseEvent('click', { bubbles: true, cancelable: true })
    editor.get('[data-testid="menu-item-homepage"]').element.addEventListener('click', (event) => event.preventDefault(), { once: true })
    editor.get('[data-testid="menu-item-homepage"]').element.dispatchEvent(plain)
    expect(leave).toHaveBeenCalledOnce()
  })
})
