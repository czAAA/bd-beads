import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PatternList from './PatternList.vue'
import { createPattern, summarizePattern, type Pattern } from '../domain/pattern'
import { serializeLibrary, serializePattern } from '../domain/patternFile'
import { BEAD_CATALOG } from '../domain/beads'
import { ru } from '../i18n/ru'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern() {
  return createPattern({
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

describe('PatternList', () => {
  it('still renders its box with an empty message when there are no saved patterns (ticket 39: always one of the below-canvas boxes)', () => {
    const wrapper = mount(PatternList, { props: { patterns: [] } })

    expect(wrapper.find('[data-testid="pattern-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-list-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="pattern-item"]').exists()).toBe(false)
  })

  it('renders one entry per saved pattern with its summary', () => {
    const first = makePattern()
    const second = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [first, second] } })

    const items = wrapper.findAll('[data-testid="pattern-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain(summarizePattern(first))
    expect(items[1]!.text()).toContain(summarizePattern(second))
  })

  it('marks the active pattern as pressed', () => {
    const first = makePattern()
    const second = makePattern()
    const wrapper = mount(PatternList, {
      props: { patterns: [first, second], activePatternId: second.id },
    })

    expect(wrapper.find(`[data-testid="select-pattern-${first.id}"]`).attributes('aria-pressed')).toBe(
      'false',
    )
    expect(wrapper.find(`[data-testid="select-pattern-${second.id}"]`).attributes('aria-pressed')).toBe(
      'true',
    )
  })

  it('emits select with the pattern id when an entry is clicked', async () => {
    const pattern = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [pattern] } })

    await wrapper.find(`[data-testid="select-pattern-${pattern.id}"]`).trigger('click')

    expect(wrapper.emitted('select')).toEqual([[pattern.id]])
  })

  it('emits remove with the pattern id when its remove button is clicked', async () => {
    const pattern = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [pattern] } })

    await wrapper.find(`[data-testid="remove-pattern-${pattern.id}"]`).trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[pattern.id]])
  })

  it('renders the remove button as an icon, with an aria-label conveying its action for screen readers', () => {
    const pattern = makePattern()
    const wrapper = mount(PatternList, { props: { patterns: [pattern] } })

    const removeButton = wrapper.find(`[data-testid="remove-pattern-${pattern.id}"]`)
    expect(removeButton.text()).toBe('')
    expect(removeButton.find('svg').exists()).toBe(true)
    expect(removeButton.attributes('aria-label')).toBe(
      `${ru.patterns.removeButton}: ${summarizePattern(pattern)}`,
    )
  })
})

describe('PatternList exports (ticket 118)', () => {
  function named(name: string): Pattern {
    return createPattern({
      name,
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 15, height: 15, unit: 'mm' },
    })
  }

  /** What the browser was handed to save: the file name and its contents. */
  interface DownloadedFile {
    name: string
    contents: string
  }

  let downloads: DownloadedFile[]

  beforeEach(() => {
    downloads = []
    const blobs = new Map<string, Blob>()

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        const url = `blob:${blobs.size}`
        blobs.set(url, blob)
        return url
      },
      revokeObjectURL: () => {},
    })

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      const blob = blobs.get(this.href)!
      downloads.push({ name: this.download, contents: '' })
      void blob.text().then((contents) => {
        downloads[downloads.length - 1]!.contents = contents
      })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('writes the open Pattern out to a file named after it', async () => {
    const pattern = named('Fox')
    const wrapper = mount(PatternList, { props: { patterns: [pattern], activePatternId: pattern.id } })

    await wrapper.find('[data-testid="export-pattern"]').trigger('click')
    await flushPromises()

    expect(downloads).toHaveLength(1)
    expect(downloads[0]!.name).toBe('bd-beads-fox.json')
    expect(downloads[0]!.contents).toBe(serializePattern(pattern))
  })

  it('has no Pattern to export while none is open, even with some saved', () => {
    const wrapper = mount(PatternList, { props: { patterns: [named('Fox')] } })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-pattern"]').element.disabled).toBe(true)
  })

  it('writes every saved Pattern out to one file, not just the open one', async () => {
    const library = [named('Fox'), named('Owl')]
    const wrapper = mount(PatternList, { props: { patterns: library, activePatternId: library[0]!.id } })

    await wrapper.find('[data-testid="export-library"]').trigger('click')
    await flushPromises()

    expect(downloads[0]!.name).toBe('bd-beads-library.json')
    expect(downloads[0]!.contents).toBe(serializeLibrary(library))
  })

  it('has nothing to export while nothing is saved', () => {
    const wrapper = mount(PatternList, { props: { patterns: [] } })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-pattern"]').element.disabled).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-library"]').element.disabled).toBe(true)
  })
})
