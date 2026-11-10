import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WelcomeTile from './WelcomeTile.vue'

function tile(props: { isNew?: boolean; count?: number; phone?: boolean } = {}) {
  return mount(WelcomeTile, { props: { isNew: true, count: 0, ...props } })
}

const find = (wrapper: ReturnType<typeof tile>, id: string) => wrapper.find(`[data-testid="${id}"]`)

describe('WelcomeTile (ticket 0830)', () => {
  it('is a section named by its heading, with its line under it', () => {
    const wrapper = tile()
    const heading = wrapper.get('h2')
    expect(heading.text()).toBe('Bead patterns, drawn the way the beads sit.')
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe(heading.attributes('id'))
    expect(wrapper.text()).toContain('For loom, peyote and brick stitch.')
  })

  it("offers a new visitor one primary button, the page's way in, with See how it works beside it", async () => {
    const wrapper = tile()
    const wayIn = find(wrapper, 'welcome-make-first')
    expect(wayIn.text()).toBe('Make your first Project')
    expect(wayIn.classes()).toContain('app-button--primary')
    expect(wrapper.findAll('.app-button--primary')).toHaveLength(1)
    expect(find(wrapper, 'welcome-open-editor').exists()).toBe(false)
    expect(find(wrapper, 'welcome-saved-projects').exists()).toBe(false)
    await wayIn.trigger('click')
    expect(wrapper.emitted('makeFirstProject')).toHaveLength(1)

    const seeHow = find(wrapper, 'welcome-see-how')
    expect(seeHow.text()).toBe('See how it works')
    expect(seeHow.classes()).not.toContain('app-button--primary')
    await seeHow.trigger('click')
    expect(wrapper.emitted('seeHow')).toHaveLength(1)
  })

  it('offers Open the editor and the Projects library with its count once Projects are saved', async () => {
    const wrapper = tile({ isNew: false, count: 3 })
    expect(find(wrapper, 'welcome-make-first').exists()).toBe(false)
    const open = find(wrapper, 'welcome-open-editor')
    expect(open.text()).toBe('Open the editor')
    expect(open.classes()).toContain('app-button--primary')
    expect(wrapper.findAll('.app-button--primary')).toHaveLength(1)
    const library = find(wrapper, 'welcome-saved-projects')
    expect(library.text()).toBe('Projects library · 3')
    await open.trigger('click')
    await library.trigger('click')
    expect(wrapper.emitted('openEditor')).toHaveLength(1)
    expect(wrapper.emitted('openSavedProjects')).toHaveLength(1)
    expect(find(wrapper, 'welcome-see-how').exists()).toBe(true)
  })

  it('counts the colors and Starters, and shows the piece as an image with its caption', () => {
    const wrapper = tile()
    expect(find(wrapper, 'welcome-counts').text()).toMatch(/^[\d\s,.]+ TOHO and Miyuki colors · \d+ Starters$/)
    const piece = find(wrapper, 'welcome-piece')
    expect(piece.element.tagName).toBe('CANVAS')
    expect(piece.attributes('role')).toBe('img')
    expect(piece.attributes('aria-label')).toBe('Peacock feather eyes, in peyote')
    expect(find(wrapper, 'welcome-caption').text()).toBe('Peyote · 48×23')
  })

  it('makes three promises, each a name over its line', () => {
    const promises = tile().findAll('[data-testid^="welcome-promise-"]')
    expect(promises.map((promise) => promise.find('.welcome__promise-name').text())).toEqual(['Yours, on this device', 'Works offline', 'Free forever'])
    expect(promises[1]!.find('.welcome__promise-line').text()).toBe('Once open, it keeps working without a connection.')
  })

  it('on a phone has no button: the bar carries the way in, and the promises are one grouped list', () => {
    const wrapper = tile({ phone: true })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.get('h2').text()).toBe('Bead patterns, drawn the way the beads sit.')
    expect(find(wrapper, 'welcome-piece').exists()).toBe(true)
    expect(wrapper.findAll('.grouped-list__row')).toHaveLength(3)
  })
})
