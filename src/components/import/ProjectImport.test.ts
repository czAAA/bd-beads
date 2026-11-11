import { beforeEach, describe, expect, it } from 'vitest'
import { settleImport } from '../../testUtils/settleImport'
import { gzipJson } from '../../testUtils/gzipJson'
import { mount } from '@vue/test-utils'
import ProjectImport from './ProjectImport.vue'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import { paintAt } from '../../testUtils/layers'
import { serializeLibrary, serializeProject } from '../../domain/projectFile'
import { frameGrid } from '../../testUtils/frameGrid'
import { en } from '../../i18n/en'

const cubeBead = BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!

function makeProject(name: string): Project {
  return createProject({
    name,
    technique: 'loom',
    beadId: cubeBead.id,
    size: { width: 15, height: 15, unit: 'mm' },
  })
}

async function pickFile(wrapper: ReturnType<typeof mount>, contents: string | File) {
  const input = wrapper.find<HTMLInputElement>('[data-testid="import-file"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [typeof contents === 'string' ? new File([await gzipJson(contents)], 'import.openbeads', { type: 'application/json' }) : contents],
  })

  await input.trigger('change')
  await settleImport()
}

describe('ProjectImport import', () => {
  it('puts no accept filter on either file input on a touch device, so an iPad does not grey out .openbeads (ticket 469)', () => {
    for (const compact of [false, true]) {
      const input = mount(ProjectImport, { props: { projects: [], compact } }).find('[data-testid="import-file"]')
      expect(input.exists()).toBe(true)
      expect(input.attributes('accept')).toBeUndefined()
    }
  })

  it('offers Project files on a device with no touch (ticket 0859)', () => {
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    try {
      for (const compact of [false, true]) {
        const input = mount(ProjectImport, { props: { projects: [], compact } }).find('[data-testid="import-file"]')
        expect(input.attributes('accept')).toBe('.openbeads,.json')
      }
    } finally {
      Reflect.deleteProperty(navigator, 'maxTouchPoints')
    }
  })

  it('hands back the Projects in a single-Project file', async () => {
    const project = makeProject('Fox')
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, serializeProject(project))

    expect(wrapper.emitted('import')).toEqual([[[project], new Map()]])
    expect(wrapper.find('[data-testid="import-result"]').text()).toContain('1')
  })

  it('hands back a whole library at once', async () => {
    const library = [makeProject('Fox'), makeProject('Owl')]
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, serializeLibrary(library))

    expect(wrapper.emitted('import')).toEqual([[library, new Map()]])
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

  it('says a damaged Project file is damaged, and imports nothing', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, 'this is not a project')
    expect(wrapper.get('[data-testid="import-error"]').text()).toBe(en.transfer.damagedFile)

    expect(wrapper.emitted('import')).toBeUndefined()
  })

  it('points a picture at Convert image, and says anything else is not a Project file (ticket 0859)', async () => {
    const wrapper = mount(ProjectImport, { props: { projects: [] } })

    await pickFile(wrapper, new File(['\x89PNG'], 'sunflower.png', { type: 'image/png' }))
    expect(wrapper.get('[data-testid="import-error"]').text()).toBe(en.transfer.pictureFile)
    await pickFile(wrapper, new File(['notes'], 'notes.txt', { type: 'text/plain' }))
    expect(wrapper.get('[data-testid="import-error"]').text()).toBe(en.transfer.notProjectFile)
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
