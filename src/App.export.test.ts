import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'
import { BEAD_CATALOG } from './domain/beads'
import { downloadFile } from './services/fileDownload'
import { createProject } from './domain/project'
import { projectExportFileName } from './domain/projectFile'
import { saveProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { exportProjectPdf, exportProjectPng } from './rendering/projectExport'
import { openPanel } from './testUtils/pill'

/** Drawing needs a real canvas and the hand-over a real browser, which jsdom is not: both are observed instead (the exports are checked in a browser by e2e/visual/export.spec.ts). */
vi.mock('./services/fileDownload', () => ({ downloadFile: vi.fn() }))
vi.mock('./rendering/projectExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./rendering/projectExport')>()),
  exportProjectPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  exportProjectPdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
}))

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!
const project = createProject({ technique: 'loom', beadId: cubeBead.id, name: 'My scarf', size: { width: 15, height: 30, unit: 'mm' } })

const mounted: ReturnType<typeof mount>[] = []

beforeEach(() => {
  vi.mocked(downloadFile).mockClear()
  vi.mocked(exportProjectPng).mockClear()
  vi.mocked(exportProjectPdf).mockClear()
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  saveProjects([project])
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
})

function mountApp() {
  const wrapper = mount(App)
  mounted.push(wrapper)
  return wrapper
}

/** The Picture and the Printable chart are rows of the Frame panel (tickets 443, 555). */
async function openExportMenu(wrapper: ReturnType<typeof mount>) {
  await openPanel(wrapper, 'strip-frame')
}

describe('App PNG and PDF export (tickets 73, 74)', () => {
  it('hands over the open Project as a PNG named for it', async () => {
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    await wrapper.find('[data-testid="export-png"]').trigger('click')
    await flushPromises()

    expect(exportProjectPng).toHaveBeenCalledWith(
      expect.objectContaining({ id: project.id }),
      expect.objectContaining({ name: 'My scarf', labels: en.print }),
      60,
    )
    expect(downloadFile).toHaveBeenCalledWith(projectExportFileName(project, 'png'), expect.any(Blob), 'image/png')
    expect(projectExportFileName(project, 'png')).toBe('openbeads-my-scarf.png')
  })

  it("hands over the open Project as a PDF, with the labels in the app's language", async () => {
    const wrapper = mountApp()
    await openExportMenu(wrapper)

    await wrapper.find('[data-testid="export-pdf"]').trigger('click')
    await flushPromises()

    expect(exportProjectPdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: project.id }),
      expect.objectContaining({ name: 'My scarf', labels: en.print }),
    )
    expect(downloadFile).toHaveBeenCalledWith('openbeads-my-scarf.pdf', expect.any(Blob), 'application/pdf')
  })

})

describe('App empty, loading and failed states (ticket 158)', () => {
  it('offers Export Project as the way out when a save fails, handing over the open Project', async () => {
    const wrapper = mountApp()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await openPanel(wrapper, 'strip-project')
    await wrapper.find('[data-testid="project-name-edit"]').trigger('click')
    await flushPromises()
    await wrapper.get<HTMLInputElement>('[data-testid="project-name-input"]').setValue('Owl')
    await wrapper.find('[data-testid="project-name-form"]').trigger('submit')
    await flushPromises()
    setItem.mockRestore()
    vi.mocked(downloadFile).mockClear()

    await wrapper.find('[data-testid="save-failed-export"]').trigger('click')

    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledWith(expect.stringMatching(/\.openbeads$/), expect.any(Uint8Array), 'application/json'))
  })
})
