import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'
import { browserDevicePreferences } from '../../services/devicePreferences'
import WhatsInside from './WhatsInside.vue'

// The editor and what the ghost does in it have tests of their own: here they stand in, the rows doing nothing.
vi.mock('./InsideEditor.vue', () => ({
  default: defineComponent({
    setup(_, { expose }) {
      expose({ fresh: async () => undefined, hand: () => ({}), hideGhost: () => undefined, giveFocusBack: () => undefined })
      return () => h('div', { 'data-testid': 'inside-editor' })
    },
  }),
}))
vi.mock('./tourScripts', () => ({ TOUR_SCRIPTS: new Proxy({}, { get: () => async () => undefined }) }))

function section(props: { withEditor: boolean; shown?: boolean }, locale: 'en' | 'ru' = 'en') {
  localStorage.setItem('openbeads:locale', locale)
  // The language is read once per test (testSetup); a second language in one test reads it afresh.
  browserDevicePreferences.forget()
  return mount(WhatsInside, { props: { shown: false, ...props }, attachTo: document.body })
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe("What's inside (ticket 0797)", () => {
  it('has four quiet cards that take no press, in order, in every shipped language', () => {
    for (const [locale, t] of [['en', en], ['ru', ru]] as const) {
      const cards = section({ withEditor: true }, locale).findAll('[data-testid^="inside-card-"]')
      expect(cards.map((card) => card.get('strong').text())).toEqual(Object.values(t.homepage.inside.cards).map((card) => card.name))
      expect(cards.every((card) => !card.find('button, a').exists())).toBe(true)
    }
  })

  it('lists the 13 rows beside the editor as buttons, named alone until one plays', () => {
    const wrapper = section({ withEditor: true })
    const rows = wrapper.findAll('[data-testid^="inside-row-"]')
    expect(rows).toHaveLength(13)
    expect(rows.every((row) => row.element.tagName === 'BUTTON')).toBe(true)
    expect(rows.map((row) => row.text())).toEqual(Object.values(en.homepage.inside.rows).map((row) => row.name))
    expect(wrapper.find('[aria-current="step"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="inside-editor"]').exists()).toBe(true)
  })

  it('plays from a row pressed, lighting it with its line under its name', async () => {
    const wrapper = section({ withEditor: true })
    await wrapper.get('[data-testid="inside-row-mirror"]').trigger('click')
    await flushPromises()
    const playing = wrapper.get('[aria-current="step"]')
    expect(playing.attributes('data-testid')).toBe('inside-row-mirror')
    expect(playing.text()).toBe(`${en.homepage.inside.rows.mirror.name}${en.homepage.inside.rows.mirror.text}`)
  })

  it('starts the tour by itself 900ms after it first shows', async () => {
    const wrapper = section({ withEditor: true, shown: true })
    await vi.advanceTimersByTimeAsync(899)
    expect(wrapper.find('[aria-current="step"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(wrapper.get('[aria-current="step"]').attributes('data-testid')).toBe('inside-row-canvas')
  })

  it('on a phone has no editor and no tour: the cards, then the 13 rows each with its line, nothing to press', async () => {
    const wrapper = section({ withEditor: false, shown: true })
    await vi.advanceTimersByTimeAsync(5000)
    expect(wrapper.find('[data-testid="inside-editor"]').exists()).toBe(false)
    const rows = wrapper.findAll('[data-testid^="inside-row-"]')
    expect(rows).toHaveLength(13)
    expect(rows.every((row) => row.element.tagName === 'LI' && !row.find('button').exists())).toBe(true)
    expect(rows[0].text()).toBe(`${en.homepage.inside.rows.canvas.name}${en.homepage.inside.rows.canvas.text}`)
    expect(wrapper.find('[aria-current="step"]').exists()).toBe(false)
  })
})
