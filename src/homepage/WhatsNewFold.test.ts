import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { BUILD_DATE, BUILD_VERSION } from '../data/build'
import type { Locale } from '../domain/locale'
import type { NotesFile, NotesFileNote, ReleaseNoteKind } from '../domain/notesFile'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { shownDay } from './whatsNew'
import WhatsNewFold from './WhatsNewFold.vue'

beforeEach(() => localStorage.clear())

const note = (name: string, version: string, kind: ReleaseNoteKind, line: string): NotesFileNote => ({ name, version, date: name.slice(0, 10), kind, line })

/** A file like the canvas's: a block with all three kinds after release 2.0.0, a block of one New row before it. */
const FILE: NotesFile = {
  version: '2.1.2',
  releases: [
    { version: '1.0.0', date: '2026-11-20' },
    { version: '2.0.0', date: '2026-12-01' },
  ],
  notes: [
    note('2026-12-04-0003', '2.1.2', 'fixed', 'Row done answers at once'),
    note('2026-12-03-0002', '2.1.1', 'changed', 'A gap shows the grid'),
    note('2026-12-02-0001', '2.1.0', 'new', 'Turn the Frame again'),
    note('2026-11-28-0000', '1.2.0', 'new', 'The Mirror bar offers every count'),
  ],
}

const head = (wrapper: VueWrapper) => wrapper.get('[data-testid="homepage-whats-new-toggle"]')
const body = (wrapper: VueWrapper) => wrapper.get('[data-testid="homepage-whats-new-notes"]')

async function opened(notes: (locale: Locale) => Promise<NotesFile | null>) {
  const wrapper = mount(WhatsNewFold, { props: { notes } })
  await head(wrapper).trigger('click')
  await flushPromises()
  return wrapper
}

describe("What's new, folded (tickets 0824, 0880, 1047)", () => {
  it('starts closed, showing its name, the Version the maker is on and its date, and reads no notes yet', () => {
    const notes = vi.fn(async () => FILE)
    const wrapper = mount(WhatsNewFold, { props: { notes } })
    expect(head(wrapper).attributes('aria-expanded')).toBe('false')
    expect(head(wrapper).text()).toContain(en.homepage.whatsNew.name)
    const latest = wrapper.get('[data-testid="homepage-whats-new-latest"]')
    expect(latest.text()).toBe(`${BUILD_VERSION} · ${shownDay(BUILD_DATE, 'en').when}`)
    expect(latest.get('time').attributes('datetime')).toBe(BUILD_DATE)
    expect(body(wrapper).isVisible()).toBe(false)
    expect(notes).not.toHaveBeenCalled()
  })

  it('opens to each block with its heading and its rows, kind label and line, and closes again', async () => {
    const notes = vi.fn(async () => FILE)
    const wrapper = await opened(notes)
    expect(notes).toHaveBeenCalledWith('en')
    expect(head(wrapper).attributes('aria-expanded')).toBe('true')
    expect(body(wrapper).isVisible()).toBe(true)
    expect(head(wrapper).attributes('aria-controls')).toBe(body(wrapper).attributes('id'))
    const blocks = wrapper.findAll('[data-testid="homepage-whats-new-block"]')
    expect(blocks.map((block) => block.get('.whats-new__block-head').text())).toEqual(['2.1.2Dec 4', '1.2.0Nov 28'])
    const rows = blocks[0].findAll('[data-testid="homepage-release-note"]')
    expect(rows.map((row) => [row.get('[data-testid="kind-label"]').text(), row.get('.whats-new__line').text()])).toEqual([
      [en.releaseNoteKinds.new, 'Turn the Frame again'],
      [en.releaseNoteKinds.changed, 'A gap shows the grid'],
      [en.releaseNoteKinds.fixed, 'Row done answers at once'],
    ])
    expect(rows.map((row) => row.classes('whats-new__note--next-kind')), 'a gap where the kind changes').toEqual([false, true, true])
    expect(blocks[1].findAll('[data-testid="homepage-release-note"]')).toHaveLength(1)
    await head(wrapper).trigger('click')
    expect(head(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('puts each release’s dated line above the blocks it released, in the order the fold draws them', async () => {
    const wrapper = await opened(async () => FILE)
    const order = body(wrapper)
      .findAll('[data-testid="homepage-whats-new-block"], [data-testid="homepage-whats-new-release"]')
      .map((item) => (item.attributes('data-testid') === 'homepage-whats-new-release' ? item.text() : item.get('.whats-new__version').text()))
    expect(order).toEqual(['2.1.2', 'Release 2.0.0Dec 1', '1.2.0', 'Release 1.0.0Nov 20'])
  })

  it('ends with Every change, CHANGELOG.md on main in a new tab', async () => {
    const wrapper = await opened(async () => FILE)
    const link = body(wrapper).get('[data-testid="homepage-history"]')
    expect(link.text()).toBe(en.homepage.whatsNew.history)
    expect(link.attributes('href')).toBe('https://github.com/czAAA/bd-beads/blob/main/CHANGELOG.md')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('shows only Every change when the notes file can’t be read', async () => {
    const wrapper = await opened(async () => null)
    expect(body(wrapper).findAll('[data-testid="homepage-whats-new-block"], [data-testid="homepage-whats-new-release"]')).toHaveLength(0)
    expect(body(wrapper).get('[data-testid="homepage-history"]').isVisible()).toBe(true)
  })

  it('reads the file again at the next open when it couldn’t be read', async () => {
    const notes = vi.fn<(locale: Locale) => Promise<NotesFile | null>>().mockResolvedValueOnce(null).mockResolvedValue(FILE)
    const wrapper = await opened(notes)
    expect(wrapper.findAll('[data-testid="homepage-whats-new-block"]')).toHaveLength(0)
    await head(wrapper).trigger('click')
    await head(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="homepage-whats-new-block"]')).toHaveLength(2)
  })

  it('reads the file of the language shown, and writes its kinds and release lines in it', async () => {
    localStorage.setItem('openbeads:locale', 'ru')
    const notes = vi.fn(async () => FILE)
    const wrapper = await opened(notes)
    expect(notes).toHaveBeenCalledWith('ru')
    expect(wrapper.get('[data-testid="kind-label"]').text()).toBe(ru.releaseNoteKinds.new)
    expect(wrapper.get('[data-testid="homepage-whats-new-release"]').text()).toBe('Выпуск 2.0.01 дек.')
  })
})

describe("What's new from Update ready's link (ticket 1048)", () => {
  const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 100, width: 100, x: 0, y: top }) as DOMRect

  it('starts open with its notes, and scrolls the room it is in until its top shows', async () => {
    const room = document.body.appendChild(document.createElement('div'))
    room.style.overflowY = 'auto'
    room.getBoundingClientRect = () => rect(100, 500)
    Object.defineProperty(room, 'offsetHeight', { value: 400 })
    const notes = vi.fn(async () => FILE)
    const wrapper = mount(WhatsNewFold, { props: { notes, startOpen: true }, attachTo: room })
    wrapper.element.getBoundingClientRect = () => rect(420, 1200)
    await flushPromises()
    expect(head(wrapper).attributes('aria-expanded')).toBe('true')
    expect(notes).toHaveBeenCalledWith('en')
    expect(wrapper.findAll('[data-testid="homepage-whats-new-block"]')).toHaveLength(2)
    expect(room.scrollTop).toBe(320)
    wrapper.unmount()
    room.remove()
  })
})
