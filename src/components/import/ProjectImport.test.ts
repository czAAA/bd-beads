import { beforeEach, describe, expect, it } from 'vitest'
import { settleImport } from '../../testUtils/settleImport'
import { gzipJson } from '../../testUtils/gzipJson'
import { mount } from '@vue/test-utils'
import ProjectImport from './ProjectImport.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, type Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'
import { serializeLibrary, serializeProject } from '../../domain/projectFile'
import { frameGrid } from '../../testUtils/frameGrid'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

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
    value: [new File([await gzipJson(contents)], 'import.openbeads', { type: 'application/json' })],
  })

  await input.trigger('change')
  await settleImport()
}

describe('ProjectImport import', () => {
  it('puts no accept filter on either file input, so an iPad does not grey out .openbeads (ticket 469)', () => {
    for (const compact of [false, true]) {
      const input = mount(ProjectImport, { props: { projects: [], compact } }).find('[data-testid="import-file"]')
      expect(input.exists()).toBe(true)
      expect(input.attributes('accept')).toBeUndefined()
    }
  })

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
    const incoming = paintAt(local, [{ row: 0, column: 0 }], '#e63746')
    const wrapper = mount(ProjectImport, { props: { projects: [local] } })

    await pickFile(wrapper, serializeProject(incoming))

    const [added] = wrapper.emitted('import')![0] as [Project[]]
    expect(added).toHaveLength(1)
    expect(added[0]!.id).not.toBe(local.id)
    expect(frameGrid(added[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('says so and imports nothing when the file is not an openbeads file', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, 'this is not a project')

    expect(wrapper.emitted('import')).toBeUndefined()
    expect(wrapper.find('[data-testid="import-error"]').exists()).toBe(true)
  })
})

describe('ProjectImport testidPrefix (ticket 168)', () => {
  beforeEach(() => {
    localStorage.setItem('openbeads:locale', 'en')
  })

  it('prefixes its testids and shows the inline result', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [], testidPrefix: 'menu-' } })
    const input = wrapper.find<HTMLInputElement>('[data-testid="menu-import-file"]')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File([await gzipJson(serializeProject(makeProject('Fox')))], 'import.openbeads', { type: 'application/json' })],
    })
    await input.trigger('change')
    await settleImport()

    expect(wrapper.find('[data-testid="import-result"]').text()).toContain('1')
  })
})
