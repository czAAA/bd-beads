import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProjectImport from './ProjectImport.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import type { PixelData } from '../../domain/imageConversion'
import { createProject, paintCells, type Project, frameGrid } from '../../domain/project'
import { serializeLibrary, serializeProject } from '../../domain/projectFile'
import { projectQrMatrix } from '../../domain/qrExport'
import { rasterizeQrMatrix } from '../../testUtils/rasterizeQrMatrix'

const APP_URL = 'http://localhost:3000/'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(name: string): Project {
  return createProject({
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

describe('ProjectImport import', () => {
  it('hands back the Projects in a single-Project file', async () => {
    const project = makeProject('Fox')
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [] } })

    await pickFile(wrapper, serializeProject(project))

    expect(wrapper.emitted('import')).toEqual([[[project]]])
    expect(wrapper.find('[data-testid="import-result"]').text()).toContain('1')
  })

  it('hands back a whole library at once', async () => {
    const library = [makeProject('Fox'), makeProject('Owl')]
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [] } })

    await pickFile(wrapper, serializeLibrary(library))

    expect(wrapper.emitted('import')).toEqual([[library]])
  })

  it('brings in a Project that clashes with a local one under a new identity, keeping both', async () => {
    const local = makeProject('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [local] } })

    await pickFile(wrapper, serializeProject(incoming))

    const [added] = wrapper.emitted('import')![0] as [Project[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the file is not a bd-beads file', async () => {
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [] } })

    await pickFile(wrapper, 'this is not a project')

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
  })
})

describe('ProjectImport QR import (ticket 68)', () => {
  it('scanning/importing a Project exported as a QR code reproduces it exactly', async () => {
    const original = makeProject('Fox')
    const matrix = projectQrMatrix(original, APP_URL)!
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [] } })

    await pickQrPicture(wrapper, rasterizeQrMatrix(matrix))

    expect(wrapper.emitted('import')).toEqual([[[original]]])
    expect(wrapper.find('[data-testid="qr-import-result"]').exists()).toBe(true)
  })

  it('brings in a Project that clashes with a local one under a new identity, keeping both', async () => {
    const local = makeProject('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const matrix = projectQrMatrix(incoming, APP_URL)!
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [local] } })

    await pickQrPicture(wrapper, rasterizeQrMatrix(matrix))

    const [added] = wrapper.emitted('import')![0] as [Project[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the picture holds no QR code', async () => {
    const blank: PixelData = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [] } })

    await pickQrPicture(wrapper, blank)

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="qr-import-error"]').exists()).toBe(true)
  })
})

describe('ProjectImport toastResults and testidPrefix (ticket 168: the iPad mini tier\'s More menu)', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('emits import-result instead of drawing the inline result, and prefixes its testids', async () => {
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [], toastResults: true, testidPrefix: 'menu-' } })
    const input = wrapper.find<HTMLInputElement>('[data-testid="menu-import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([serializeProject(makeProject('Fox'))], 'import.json', { type: 'application/json' })],
    })
    await input.trigger('change')
    await flushPromises()

    expect(wrapper.find('[data-testid="import-result"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')).toEqual([['import-file', 'Projects imported: 1', 'success']])
  })

  it('emits a danger import-result for a failed file, and for a failed QR picture', async () => {
    const wrapper = mount(ProjectImport, { props: { decodeImage: noDecoder, projects: [], toastResults: true } })

    await pickFile(wrapper, 'not json')
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')![0]).toEqual(['import-file', 'Could not import that file', 'danger'])

    const blank: PixelData = { width: 40, height: 40, data: new Uint8ClampedArray(40 * 40 * 4).fill(255) }
    await pickQrPicture(wrapper, blank)
    expect(wrapper.find('[data-testid="qr-import-error"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')![1]).toEqual(['import-qr', 'Could not find a bd-beads QR code in that picture', 'danger'])
  })
})
