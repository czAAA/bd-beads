import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PatternTransfer from './PatternTransfer.vue'
import { BEAD_CATALOG } from '../domain/beads'
import { createPattern, paintCells, type Pattern } from '../domain/pattern'
import { serializeLibrary, serializePattern } from '../domain/patternFile'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(name: string): Pattern {
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

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
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

async function pickFile(wrapper: ReturnType<typeof mount>, contents: string) {
  const input = wrapper.find<HTMLInputElement>('[data-testid="import-file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File([contents], 'import.json', { type: 'application/json' })],
  })

  await input.trigger('change')
  await flushPromises()
}

describe('PatternTransfer export', () => {
  it('writes the open Pattern out to a file named after it', async () => {
    const pattern = makePattern('Fox')
    const wrapper = mount(PatternTransfer, { props: { pattern, patterns: [pattern] } })

    await wrapper.find('[data-testid="export-pattern"]').trigger('click')
    await flushPromises()

    expect(downloads).toHaveLength(1)
    expect(downloads[0]!.name).toBe('bd-beads-fox.json')
    expect(downloads[0]!.contents).toBe(serializePattern(pattern))
  })

  it('has nothing to export while no Pattern is open', () => {
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-pattern"]').element.disabled).toBe(
      true,
    )
  })

  it('writes every saved Pattern out to one file, not just the open one', async () => {
    const library = [makePattern('Fox'), makePattern('Owl')]
    const wrapper = mount(PatternTransfer, { props: { pattern: library[0], patterns: library } })

    await wrapper.find('[data-testid="export-library"]').trigger('click')
    await flushPromises()

    expect(downloads[0]!.name).toBe('bd-beads-library.json')
    expect(downloads[0]!.contents).toBe(serializeLibrary(library))
  })

  it('has nothing to export while nothing is saved', () => {
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-library"]').element.disabled).toBe(
      true,
    )
  })
})

describe('PatternTransfer import', () => {
  it('hands back the Patterns in a single-Pattern file', async () => {
    const pattern = makePattern('Fox')
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    await pickFile(wrapper, serializePattern(pattern))

    expect(wrapper.emitted('import')).toEqual([[[pattern]]])
    expect(wrapper.find('[data-testid="import-result"]').text()).toContain('1')
  })

  it('hands back a whole library at once', async () => {
    const library = [makePattern('Fox'), makePattern('Owl')]
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    await pickFile(wrapper, serializeLibrary(library))

    expect(wrapper.emitted('import')).toEqual([[library]])
  })

  it('brings in a Pattern that clashes with a local one under a new identity, keeping both', async () => {
    const local = makePattern('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { horizontal: false, vertical: false })
    const wrapper = mount(PatternTransfer, { props: { patterns: [local] } })

    await pickFile(wrapper, serializePattern(incoming))

    const [added] = wrapper.emitted('import')![0] as [Pattern[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(added[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the file is not a bd-beads file', async () => {
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    await pickFile(wrapper, 'this is not a pattern')

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
  })
})
