import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProjectImport from './ProjectImport.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, paintCells, type Project, frameGrid } from '../../domain/project'
import { serializeLibrary, serializeProject } from '../../domain/projectFile'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho-cube-1.5mm')!

function makeProject(name: string): Project {
  return createProject({
    name,
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

async function pickFile(wrapper: ReturnType<typeof mount>, contents: string) {
  const input = wrapper.find<HTMLInputElement>('[data-testid="import-file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File([contents], 'import.json', { type: 'application/json' })],
  })

  await input.trigger('change')
  await flushPromises()
}

describe('ProjectImport import', () => {
  it('hands back the Projects in a single-Project file', async () => {
    const project = makeProject('Fox')
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, serializeProject(project))

    expect(wrapper.emitted('import')).toEqual([[[project]]])
    expect(wrapper.find('[data-testid="import-result"]').text()).toContain('1')
  })

  it('hands back a whole library at once', async () => {
    const library = [makeProject('Fox'), makeProject('Owl')]
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, serializeLibrary(library))

    expect(wrapper.emitted('import')).toEqual([[library]])
  })

  it('brings in a Project that clashes with a local one under a new identity, keeping both', async () => {
    const local = makeProject('Fox')
    const incoming = paintCells(local, [{ row: 0, column: 0 }], '#e63746', { columns: 0, rows: 0 })
    const wrapper = mount(ProjectImport, { props: { projects: [local] } })

    await pickFile(wrapper, serializeProject(incoming))

    const [added] = wrapper.emitted('import')![0] as [Project[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the file is not a bd-beads file', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, 'this is not a project')

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
  })
})

describe('ProjectImport toastResults and testidPrefix (ticket 168: the iPad mini tier\'s More menu)', () => {
  beforeEach(() => {
    localStorage.setItem('bd-beads:locale', 'en')
  })

  it('emits import-result instead of drawing the inline result, and prefixes its testids', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [], toastResults: true, testidPrefix: 'menu-' } })
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

  it('emits a danger import-result for a failed file', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [], toastResults: true } })

    await pickFile(wrapper, 'not json')
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(false)
    expect(wrapper.emitted('import-result')![0]).toEqual(['import-file', 'Could not import that file', 'danger'])
  })
})
