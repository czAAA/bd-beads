import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { en } from '../../i18n/en'
import { browserDevicePreferences } from '../../services/devicePreferences'
import { fakeMatchMedia } from '../../testUtils/fakeMatchMedia'
import WhatsInside from './WhatsInside.vue'
import { TOUR_TIMING } from './useInsideTour'

/** What the stand-in demo's snapshot gives: its Project as the press found it. */
const taken = vi.hoisted(() => ({ project: { id: 'ring' } }))
const demo = vi.hoisted(() => ({ fresh: vi.fn(async () => undefined), refit: vi.fn(async () => undefined), snapshot: vi.fn(async () => taken) }))

// The editor and what the ghost does in it have tests of their own: here they stand in, the rows doing nothing.
vi.mock('./InsideEditor.vue', () => ({
  default: defineComponent({
    props: { expand: String },
    emits: ['toggleExpand', 'pressed'],
    setup(props, { expose, emit }) {
      expose({ ...demo, hand: () => ({}), hideGhost: () => undefined, giveFocusBack: () => undefined })
      return () =>
        h('div', { 'data-testid': 'inside-editor', onClick: () => emit('pressed') }, [
          props.expand ? h('button', { 'data-testid': 'strip-expand', onClick: () => emit('toggleExpand') }, props.expand) : undefined,
        ])
    },
  }),
}))
vi.mock('./tourScripts', () => ({ TOUR_SCRIPTS: new Proxy({}, { get: () => async () => undefined }) }))

function mountSection(props: { withEditor: boolean; shown?: boolean; wide?: boolean }, locale: 'en' | 'ru' = 'en') {
  localStorage.setItem('openbeads:locale', locale)
  // The language is read once per test (testSetup); a second language in one test reads it afresh.
  browserDevicePreferences.forget()
  return mount(WhatsInside, { props: { shown: false, wide: true, ...props }, attachTo: document.body })
}

/** Lets the demo editor arrive: it is asked for once the page has painted (here, at once) or What's inside shows. */
async function demoArrives() {
  await vi.advanceTimersByTimeAsync(0)
  await vi.dynamicImportSettled()
  await flushPromises()
}

/** What's inside with its demo editor there. */
async function section(props: { withEditor: boolean; shown?: boolean; wide?: boolean }, locale: 'en' | 'ru' = 'en') {
  const wrapper = mountSection(props, locale)
  await demoArrives()
  return wrapper
}

type Section = ReturnType<typeof mountSection>
const find = (wrapper: Section, id: string) => wrapper.find(`[data-testid="${id}"]`)
const lit = (wrapper: Section) => wrapper.findAll('[aria-current="step"]').map((chapter) => chapter.attributes('data-testid'))
const layout = (wrapper: Section) => find(wrapper, 'whats-inside').attributes('data-layout')
const caption = (wrapper: Section) => wrapper.get('[data-testid="inside-caption-shown"]').text()
/** One row of the stand-in tour: lit, then done, nothing between. */
const ROW_MS = TOUR_TIMING.before + TOUR_TIMING.after

async function press(wrapper: Section, id: string) {
  await find(wrapper, id).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  for (const spy of Object.values(demo)) spy.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe("What's inside (tickets 0797, 0825, 0830)", () => {
  it('holds a frame for the demo editor until it has come, after the page has painted, and never asks for one on a phone (ticket 0991)', async () => {
    const wrapper = mountSection({ withEditor: true })
    expect(find(wrapper, 'inside-editor').exists()).toBe(false)
    expect(find(wrapper, 'inside-editor-waiting').exists()).toBe(true)
    await demoArrives()
    expect(find(wrapper, 'inside-editor').exists()).toBe(true)
    expect(find(wrapper, 'inside-editor-waiting').exists()).toBe(false)

    const phone = mountSection({ withEditor: false, shown: true, wide: false })
    await demoArrives()
    expect(find(phone, 'inside-editor').exists()).toBe(false)
    expect(find(phone, 'inside-editor-waiting').exists()).toBe(false)
  })

  it('holds its heading and four chapters as a list of buttons, none lit before the tour, with the editor', async () => {
    const wrapper = await section({ withEditor: true })
    expect(wrapper.get('h2#homepage-inside').text()).toBe("What's inside")
    const chapters = wrapper.findAll('ul[data-testid="inside-chapters"] > li > button')
    expect(chapters.map((chapter) => chapter.text())).toEqual(['Draw', 'Start from something', 'Real bead colors', 'Weave and keep'])
    expect(lit(wrapper)).toEqual([])
    expect(find(wrapper, 'inside-editor').exists()).toBe(true)
  })

  it("describes each chapter by its rows' names", async () => {
    const wrapper = await section({ withEditor: true })
    const described = (id: string) => wrapper.get(`#${find(wrapper, id).attributes('aria-describedby')}`).text()
    expect(described('inside-chapter-draw')).toBe('Canvas and Frame, Techniques, Project editing, Tools at the pointer, and Mirror')
    expect(described('inside-chapter-beadColors')).toBe('Colors built in and Letters')
  })

  it('captions the first row before the tour starts, and is no live region', async () => {
    const wrapper = await section({ withEditor: true })
    expect(caption(wrapper)).toContain('Canvas and Frame')
    expect(caption(wrapper)).toContain(en.homepage.inside.rows.canvas.text)
    expect(caption(wrapper)).toContain('1 / 14')
    expect(find(wrapper, 'inside-caption').attributes('aria-live')).toBeUndefined()
  })

  it('plays a chapter pressed from its first row, the chapter lit and the caption naming the row, its line and its place', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-weaveKeep')
    expect(lit(wrapper)).toEqual(['inside-chapter-weaveKeep'])
    expect(caption(wrapper)).toContain('Row progress')
    expect(caption(wrapper)).toContain('Mark rows done as you weave.')
    expect(caption(wrapper)).toContain('11 / 14')
  })

  it('starts the tour by itself a moment after it first shows, the lit chapter following the row that plays', async () => {
    const wrapper = await section({ withEditor: true, shown: true })
    await vi.advanceTimersByTimeAsync(TOUR_TIMING.start - 1)
    expect(lit(wrapper)).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(lit(wrapper)).toEqual(['inside-chapter-draw'])
    // Draw is five rows: its fifth still lights it, the sixth lights Start from something.
    await vi.advanceTimersByTimeAsync(ROW_MS * 4)
    expect(lit(wrapper)).toEqual(['inside-chapter-draw'])
    expect(caption(wrapper)).toContain('5 / 14')
    await vi.advanceTimersByTimeAsync(ROW_MS)
    expect(lit(wrapper)).toEqual(['inside-chapter-startFrom'])
    expect(caption(wrapper)).toContain('Convert image')
    expect(caption(wrapper)).toContain('6 / 14')
  })

  it('Pause stops the tour at its row, the chapter still lit, and reads Play, which plays on from that row', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-startFrom')
    await vi.advanceTimersByTimeAsync(ROW_MS)
    expect(caption(wrapper)).toContain('7 / 14')
    const pause = find(wrapper, 'inside-pause')
    expect(pause.text()).toBe('Pause')

    await press(wrapper, 'inside-pause')
    expect(pause.text()).toBe('Play')
    await vi.advanceTimersByTimeAsync(ROW_MS * 3)
    expect(lit(wrapper)).toEqual(['inside-chapter-startFrom'])
    expect(caption(wrapper)).toContain('7 / 14')

    await press(wrapper, 'inside-pause')
    expect(pause.text()).toBe('Pause')
    expect(caption(wrapper)).toContain('7 / 14')
    await vi.advanceTimersByTimeAsync(ROW_MS)
    expect(caption(wrapper)).toContain('8 / 14')
  })

  it('a chapter pressed while paused plays, and Play reads Pause again', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-draw')
    await press(wrapper, 'inside-pause')
    await press(wrapper, 'inside-chapter-beadColors')
    expect(find(wrapper, 'inside-pause').text()).toBe('Pause')
    expect(lit(wrapper)).toEqual(['inside-chapter-beadColors'])
  })

  it('Open editor from here takes what the demo shows at the press, then stops the tour, and hands it to the page (ticket 0879)', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-draw')
    expect(find(wrapper, 'inside-open-from-here').text()).toBe('Open editor from here')
    await press(wrapper, 'inside-open-from-here')
    expect(demo.snapshot).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('openFromHere')).toEqual([[taken]])
    await press(wrapper, 'inside-open-from-here')
    expect(wrapper.emitted('openFromHere')).toHaveLength(1)
    expect(find(wrapper, 'inside-pause').text()).toBe('Play')
    const before = demo.fresh.mock.calls.length
    await vi.advanceTimersByTimeAsync(ROW_MS * 13)
    expect(demo.fresh).toHaveBeenCalledTimes(before)
  })

  it('answers a press in the demo by lighting Open editor from here once and focusing it, the tour playing on (ticket 0950)', async () => {
    const wrapper = await section({ withEditor: true, shown: true })
    await flushPromises()
    const open = () => find(wrapper, 'inside-open-from-here')
    expect(open().classes()).toContain('app-button--secondary')
    const playing = caption(wrapper)
    await press(wrapper, 'inside-editor')
    expect(open().classes()).toEqual(expect.arrayContaining(['app-button--primary', 'inside__control--answer']))
    expect(document.activeElement).toBe(open().element)
    expect(caption(wrapper)).toBe(playing)
    expect(find(wrapper, 'inside-pause').text()).toBe('Pause')
    ;(document.activeElement as HTMLElement).blur()
    await press(wrapper, 'inside-editor')
    expect(document.activeElement, 'only the first press takes the focus').toBe(document.body)
    expect(open().classes()).toContain('app-button--primary')
  })

  it('stands beside the demo where the box is wide, which offers Expand; Expand puts it in a band and reads Collapse', async () => {
    const wrapper = await section({ withEditor: true })
    expect(layout(wrapper)).toBe('beside')
    expect(find(wrapper, 'strip-expand').text()).toBe('expand')
    await press(wrapper, 'strip-expand')
    expect(layout(wrapper)).toBe('band')
    expect(find(wrapper, 'strip-expand').text()).toBe('collapse')
    await press(wrapper, 'strip-expand')
    expect(layout(wrapper)).toBe('beside')
  })

  it('is a band over the demo with no Expand under 1000px', async () => {
    const wrapper = await section({ withEditor: true, wide: false })
    expect(layout(wrapper)).toBe('band')
    expect(find(wrapper, 'strip-expand').exists()).toBe(false)
  })

  it('Expand starts the playing row again in the new size', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-startFrom')
    await vi.advanceTimersByTimeAsync(ROW_MS)
    demo.fresh.mockClear()
    await press(wrapper, 'strip-expand')
    expect(demo.fresh).toHaveBeenCalledTimes(1)
    expect(lit(wrapper)).toEqual(['inside-chapter-startFrom'])
    expect(caption(wrapper)).toContain('7 / 14')
    expect(find(wrapper, 'inside-pause').text()).toBe('Pause')
  })

  it('Expand keeps a paused tour paused, only setting its view again', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-startFrom')
    await press(wrapper, 'inside-pause')
    demo.fresh.mockClear()
    await press(wrapper, 'strip-expand')
    expect(find(wrapper, 'inside-pause').text()).toBe('Play')
    expect(lit(wrapper)).toEqual(['inside-chapter-startFrom'])
    expect(demo.fresh).not.toHaveBeenCalled()
    expect(demo.refit).toHaveBeenCalledTimes(1)
  })

  it('a page that crosses 1000px resizes the demo as Expand does: the playing row starts again, a paused tour has its view set again', async () => {
    const wrapper = await section({ withEditor: true })
    await press(wrapper, 'inside-chapter-startFrom')
    await vi.advanceTimersByTimeAsync(ROW_MS)
    demo.fresh.mockClear()
    await wrapper.setProps({ wide: false })
    await flushPromises()
    expect(layout(wrapper)).toBe('band')
    expect(demo.fresh).toHaveBeenCalledTimes(1)
    expect(lit(wrapper)).toEqual(['inside-chapter-startFrom'])

    await press(wrapper, 'inside-pause')
    demo.fresh.mockClear()
    await wrapper.setProps({ wide: true })
    await flushPromises()
    expect(demo.fresh).not.toHaveBeenCalled()
    expect(demo.refit).toHaveBeenCalledTimes(1)
  })

  it('under reduced motion has no Pause, shows the end of a pressed chapter\'s first row, and of the lit chapter\'s next row, round to its first', async () => {
    vi.stubGlobal('matchMedia', fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }).matchMedia)
    const wrapper = await section({ withEditor: true, shown: true })
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()
    expect(find(wrapper, 'inside-pause').exists()).toBe(false)
    expect(find(wrapper, 'inside-open-from-here').exists()).toBe(true)
    expect(find(wrapper, 'strip-expand').exists()).toBe(true)
    expect(lit(wrapper)).toEqual(['inside-chapter-draw'])
    expect(caption(wrapper)).toContain('1 / 14')

    await press(wrapper, 'inside-chapter-beadColors')
    expect(lit(wrapper)).toEqual(['inside-chapter-beadColors'])
    expect(caption(wrapper)).toContain('9 / 14')
    await press(wrapper, 'inside-chapter-beadColors')
    expect(caption(wrapper)).toContain('10 / 14')
    await press(wrapper, 'inside-chapter-beadColors')
    expect(caption(wrapper)).toContain('9 / 14')
    await vi.advanceTimersByTimeAsync(ROW_MS * 4)
    expect(caption(wrapper)).toContain('9 / 14')
  })

  it('on a phone has no editor, no chapters and no tour: the heading over one grouped list of the 14 rows in the tour\'s order, nothing to press (ticket 0827)', async () => {
    const wrapper = await section({ withEditor: false, shown: true, wide: false })
    await vi.advanceTimersByTimeAsync(5000)
    expect(find(wrapper, 'inside-editor').exists()).toBe(false)
    expect(wrapper.get('h2#homepage-inside').text()).toBe("What's inside")
    const rows = wrapper.findAll('[data-testid^="inside-row-"]')
    expect(rows).toHaveLength(14)
    expect(rows.every((row) => row.element.tagName === 'LI')).toBe(true)
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(rows[0].text()).toBe(`Canvas and Frame. ${en.homepage.inside.rows.canvas.text}`)
    expect(rows[3].text()).toBe(`Tools at the pointer. ${en.homepage.inside.rows.toolsAtPointer.text}`)
    expect(rows[5].text()).toContain('Convert image')
    expect(rows[13].text()).toContain('Saved Projects')
    expect(rows.every((row) => row.find('.grouped-list__tile [data-icon]').exists())).toBe(true)
    expect(find(wrapper, 'inside-list').classes()).toContain('grouped-list')
    expect(lit(wrapper)).toEqual([])
  })

  it('speaks Russian', async () => {
    const wrapper = await section({ withEditor: true }, 'ru')
    expect(wrapper.findAll('ul[data-testid="inside-chapters"] > li > button')).toHaveLength(4)
    expect(find(wrapper, 'inside-open-from-here').text()).not.toBe('Open editor from here')
  })
})
