import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PatternTransfer from './PatternTransfer.vue'
import { BEAD_CATALOG } from '../domain/beads'
import type { PixelData } from '../domain/imageConversion'
import { createPattern, paintCells, type Pattern } from '../domain/pattern'
import { serializeLibrary, serializePattern } from '../domain/patternFile'
import { patternQrMatrix } from '../domain/qrExport'
import { denselyColoredGrid } from '../testUtils/denselyColoredGrid'
import { rasterizeQrMatrix } from '../testUtils/rasterizeQrMatrix'

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
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
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

describe('PatternTransfer QR export (ticket 68, ADR 0015)', () => {
  it('shows nothing until Export as QR code is clicked', () => {
    const pattern = makePattern('Fox')
    const wrapper = mount(PatternTransfer, { props: { pattern, patterns: [pattern] } })

    expect(wrapper.find('[data-testid="qr-export-panel"]').exists()).toBe(false)
  })

  it('has nothing to export while no Pattern is open', () => {
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-qr"]').element.disabled).toBe(true)
  })

  it('shows a scannable QR code for a Pattern within the size cap', async () => {
    const pattern = makePattern('Fox')
    const wrapper = mount(PatternTransfer, { props: { pattern, patterns: [pattern] } })

    await wrapper.find('[data-testid="export-qr"]').trigger('click')

    expect(wrapper.find('[data-testid="qr-code"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="qr-code-module"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="qr-too-large"]').exists()).toBe(false)
  })

  it('shows a "too large for QR" message and no code for a Pattern over the size cap, pointing at the fallback', async () => {
    let pattern = createPattern({
      name: 'Huge',
      technique: 'loom',
      beadId: cubeBead.id,
      size: { width: 90, height: 135, unit: 'mm' }, // 60 x 90, ADR 0009's own worst-case size
    })
    pattern = { ...pattern, grid: denselyColoredGrid(pattern.columns, pattern.rows) }
    const wrapper = mount(PatternTransfer, { props: { pattern, patterns: [pattern] } })

    await wrapper.find('[data-testid="export-qr"]').trigger('click')

    expect(wrapper.find('[data-testid="qr-too-large"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="qr-code"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="export-pattern"]').exists()).toBe(true)
  })

  it('closes the panel', async () => {
    const pattern = makePattern('Fox')
    const wrapper = mount(PatternTransfer, { props: { pattern, patterns: [pattern] } })

    await wrapper.find('[data-testid="export-qr"]').trigger('click')
    await wrapper.find('[data-testid="qr-export-close"]').trigger('click')

    expect(wrapper.find('[data-testid="qr-export-panel"]').exists()).toBe(false)
  })
})

describe('PatternTransfer QR import (ticket 68)', () => {
  async function pickQrPicture(wrapper: ReturnType<typeof mount>, pixels: PixelData) {
    const decodeImage = vi.fn().mockResolvedValue(pixels)
    await wrapper.setProps({ decodeImage })
    const input = wrapper.find<HTMLInputElement>('[data-testid="import-qr"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['pretend this is a picture'], 'qr.png', { type: 'image/png' })],
    })
    await input.trigger('change')
    await flushPromises()
  }

  it('scanning/importing a Pattern exported as a QR code reproduces it exactly', async () => {
    const original = makePattern('Fox')
    const matrix = patternQrMatrix(original)!
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    await pickQrPicture(wrapper, rasterizeQrMatrix(matrix))

    expect(wrapper.emitted('import')).toEqual([[[original]]])
    expect(wrapper.find('[data-testid="qr-import-result"]').exists()).toBe(true)
  })

  it('brings in a Pattern that clashes with a local one under a new identity, keeping both', async () => {
    const local = makePattern('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const matrix = patternQrMatrix(incoming)!
    const wrapper = mount(PatternTransfer, { props: { patterns: [local] } })

    await pickQrPicture(wrapper, rasterizeQrMatrix(matrix))

    const [added] = wrapper.emitted('import')![0] as [Pattern[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(added[0]!.grid[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the picture holds no QR code', async () => {
    const blank: PixelData = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }
    const wrapper = mount(PatternTransfer, { props: { patterns: [] } })

    await pickQrPicture(wrapper, blank)

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="qr-import-error"]').exists()).toBe(true)
  })
})
