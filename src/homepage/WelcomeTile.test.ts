import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WelcomeCuff from './WelcomeCuff.vue'
import WelcomeTile from './WelcomeTile.vue'

function tile(props: { isNew?: boolean; count?: number; phone?: boolean; shown?: boolean } = {}) {
  return mount(WelcomeTile, { props: { isNew: true, count: 0, ...props } })
}

const find = (wrapper: ReturnType<typeof tile>, id: string) => wrapper.find(`[data-testid="${id}"]`)

/** The primary buttons of the tile's way in: the cuff's Row done is the Progress bar's own (ticket 1157). */
const wayInPrimaries = (wrapper: ReturnType<typeof tile>) => wrapper.findAll('.welcome__way-in .app-button--primary')

describe('WelcomeTile (tickets 0830, 1157)', () => {
  it('is a section named by its heading, with its line under it', () => {
    const wrapper = tile()
    const heading = wrapper.get('h1')
    expect(heading.text()).toBe('A free bead pattern editor that works in three techniques')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(wrapper.text()).toContain('Loom, peyote, and brick stitch.')
  })

  it("offers a new visitor one primary button, the page's way in", async () => {
    const wrapper = tile()
    const wayIn = find(wrapper, 'welcome-make-first')
    expect(wayIn.text()).toBe('Make your first Project')
    expect(wayIn.classes()).toContain('app-button--primary')
    expect(wayIn.classes()).toContain('app-button--2xl')
    expect(wayInPrimaries(wrapper)).toHaveLength(1)
    expect(find(wrapper, 'welcome-open-editor').exists()).toBe(false)
    expect(find(wrapper, 'welcome-saved-projects').exists()).toBe(false)
    await wayIn.trigger('click')
    expect(wrapper.emitted('makeFirstProject')).toHaveLength(1)
  })

  it('offers a new visitor Start from a ready design, a secondary button as big as the way in beside it (ticket 0953)', async () => {
    const wrapper = tile()
    const start = find(wrapper, 'welcome-start-from-starter')
    expect(start.text()).toBe('Start from a ready design')
    expect(start.classes()).not.toContain('app-button--text')
    expect(start.classes()).toContain('app-button--2xl')
    expect(start.element.parentElement).toBe(find(wrapper, 'welcome-make-first').element.parentElement)
    await start.trigger('click')
    expect(wrapper.emitted('startFromStarter')).toHaveLength(1)
    expect(find(tile({ isNew: false, count: 3 }), 'welcome-start-from-starter').exists()).toBe(false)
  })

  it('offers Open the editor and the Projects library with its count once Projects are saved', async () => {
    const wrapper = tile({ isNew: false, count: 3 })
    expect(find(wrapper, 'welcome-make-first').exists()).toBe(false)
    const open = find(wrapper, 'welcome-open-editor')
    expect(open.text()).toBe('Open the editor')
    expect(open.classes()).toContain('app-button--primary')
    expect(wayInPrimaries(wrapper)).toHaveLength(1)
    const library = find(wrapper, 'welcome-saved-projects')
    expect(library.text()).toBe('Projects library · 3')
    expect(open.classes()).toContain('app-button--2xl')
    expect(library.classes()).toContain('app-button--2xl')
    await open.trigger('click')
    await library.trigger('click')
    expect(wrapper.emitted('openEditor')).toHaveLength(1)
    expect(wrapper.emitted('openSavedProjects')).toHaveLength(1)
  })

  it('shows the cuff being woven in place of the finished piece: no counts, caption or See how it works (ticket 1157)', () => {
    const wrapper = tile()
    expect(find(wrapper, 'welcome-cuff').exists()).toBe(true)
    for (const gone of ['welcome-counts', 'welcome-caption', 'welcome-piece', 'welcome-see-how']) expect(find(wrapper, gone).exists(), gone).toBe(false)
  })

  it('weaves the cuff only while Welcome is the section shown', () => {
    expect(tile({ shown: true }).getComponent(WelcomeCuff).props('shown')).toBe(true)
    expect(tile().getComponent(WelcomeCuff).props('shown')).toBe(false)
  })

  it('makes four promises, each a name over its line, free export last', () => {
    const promises = tile().findAll('[data-testid^="welcome-promise-"]')
    expect(promises.map((promise) => promise.find('.welcome__promise-name').text())).toEqual(['Everything here is free', 'Start from a picture', 'Count and weave', 'Free export'])
    expect(promises[1]!.find('.welcome__promise-line').text()).toBe('Turn a photo into a bead pattern.')
  })

  it("on a phone has no way in, the bar carries it, the cuff's moves alone; the promises are one grouped list", () => {
    const wrapper = tile({ phone: true })
    expect(wrapper.findAll('button').map((button) => button.attributes('data-testid'))).toEqual(['welcome-cuff-previous', 'welcome-cuff-next'])
    expect(wrapper.get('h1').text()).toBe('A free bead pattern editor that works in three techniques')
    expect(find(wrapper, 'welcome-cuff').exists()).toBe(true)
    expect(wrapper.findAll('.grouped-list__row')).toHaveLength(4)
  })
})
