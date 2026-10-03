import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PatternImport from './PatternImport.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import type { PixelData } from '../../domain/imageConversion'
import { createPattern, paintCells, type Pattern, frameGrid } from '../../domain/pattern'
import { serializeLibrary, serializePattern } from '../../domain/patternFile'
import { patternQrMatrix } from '../../domain/qrExport'
import { rasterizeQrMatrix } from '../../testUtils/rasterizeQrMatrix'

const APP_URL = 'http://localhost:3000/'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makePattern(name: string): Pattern {
  return createPattern({
    name,
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

/** For a test that picks no picture: the decoder is not reached. */
const noDecoder = vi.fn()

async function pickFile(wrapper: ReturnType<typeof mount>, contents: string) {
  const input = wrapper.find<HTMLInputElement>('[data-testid="import-file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File([contents], 'import.json', { type: 'application/json' })],
  })

  await input.trigger('change')
  await flushPromises()
}

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

describe('PatternImport import', () => {
  it('hands back the Patterns in a single-Pattern file', async () => {
    const pattern = makePattern('Fox')
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [] } })

    await pickFile(wrapper, serializePattern(pattern))

    expect(wrapper.emitted('import')).toEqual([[[pattern]]])
    expect(wrapper.find('[data-testid="import-result"]').text()).toContain('1')
  })

  it('hands back a whole library at once', async () => {
    const library = [makePattern('Fox'), makePattern('Owl')]
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [] } })

    await pickFile(wrapper, serializeLibrary(library))

    expect(wrapper.emitted('import')).toEqual([[library]])
  })

  it('brings in a Pattern that clashes with a local one under a new identity, keeping both', async () => {
    const local = makePattern('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [local] } })

    await pickFile(wrapper, serializePattern(incoming))

    const [added] = wrapper.emitted('import')![0] as [Pattern[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the file is not a bd-beads file', async () => {
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [] } })

    await pickFile(wrapper, 'this is not a pattern')

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
  })
})

describe('PatternImport QR import (ticket 68)', () => {
  it('scanning/importing a Pattern exported as a QR code reproduces it exactly', async () => {
    const original = makePattern('Fox')
    const matrix = patternQrMatrix(original, APP_URL)!
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [] } })

    await pickQrPicture(wrapper, rasterizeQrMatrix(matrix))

    expect(wrapper.emitted('import')).toEqual([[[original]]])
    expect(wrapper.find('[data-testid="qr-import-result"]').exists()).toBe(true)
  })

  it('brings in a Pattern that clashes with a local one under a new identity, keeping both', async () => {
    const local = makePattern('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const matrix = patternQrMatrix(incoming, APP_URL)!
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [local] } })

    await pickQrPicture(wrapper, rasterizeQrMatrix(matrix))

    const [added] = wrapper.emitted('import')![0] as [Pattern[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the picture holds no QR code', async () => {
    const blank: PixelData = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [] } })

    await pickQrPicture(wrapper, blank)

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="qr-import-error"]').exists()).toBe(true)
  })
})

describe('PatternImport toastResults and testidPrefix (ticket 168: the iPad mini tier\'s More menu)', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('emits import-result instead of drawing the inline result, and prefixes its testids', async () => {
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [], toastResults: true, testidPrefix: 'menu-' } })
    const input = wrapper.find<HTMLInputElement>('[data-testid="menu-import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([serializePattern(makePattern('Fox'))], 'import.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="import-result"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')).toEqual([['import-file', 'Patterns imported: 1', 'success']])
  })

  it('emits a danger import-result for a failed file, and for a failed QR picture', async () => {
    const wrapper = mount(PatternImport, { props: { decodeImage: noDecoder, patterns: [], toastResults: true } })

    await pickFile(wrapper, 'not json')
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')![0]).toEqual(['import-file', 'Could not import that file', 'danger'])

    const blank: PixelData = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }
    await pickQrPicture(wrapper, blank)
    expect(wrapper.find('[data-testid="qr-import-error"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')![1]).toEqual(['import-qr', 'Could not find a bd-beads QR code in that picture', 'danger'])
  })
})
