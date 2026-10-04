import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createProject, type Project } from '../../domain/project'
import { serializeProjectForQr } from '../../domain/qrExport'
import { useSharedProjectLink } from './useSharedProjectLink'

const shared = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Shared', size: { width: 3, height: 3, unit: 'beads' } })

function mountWith(library: Project[] = []) {
  const deps = { projects: () => library, addProject: vi.fn(), flushPendingSave: vi.fn() }
  const wrapper = mount(
    defineComponent({
      setup() {
        useSharedProjectLink(deps)
        return () => h('div')
      },
    }),
  )
  return { deps, wrapper }
}

afterEach(() => window.history.replaceState(null, '', '/'))

describe('useSharedProjectLink', () => {
  it('opens the Project a share link carries and drops the fragment', () => {
    const link = serializeProjectForQr(shared, 'http://localhost:3000/')
    window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)

    const { deps } = mountWith()

    expect(deps.addProject).toHaveBeenCalledTimes(1)
    expect(deps.addProject.mock.calls[0]![0]).toMatchObject({ name: 'Shared' })
    expect(window.location.hash).toBe('')
  })

  it('gives it a fresh id when this device already has that Project', () => {
    const link = serializeProjectForQr(shared, 'http://localhost:3000/')
    window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)

    const { deps } = mountWith([shared])

    expect(deps.addProject.mock.calls[0]![0].id).not.toBe(shared.id)
  })

  it('leaves an ordinary page load alone', () => {
    const { deps } = mountWith()
    expect(deps.addProject).not.toHaveBeenCalled()
  })

  it('ignores a link that cannot be read, and still drops the fragment', () => {
    window.history.replaceState(null, '', '/#pattern=***')

    const { deps } = mountWith()

    expect(deps.addProject).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('')
  })

  it('flushes a deferred save when the page is hidden', () => {
    const { deps } = mountWith()
    window.dispatchEvent(new Event('pagehide'))
    expect(deps.flushPendingSave).toHaveBeenCalledTimes(1)
  })

  it('flushes on unmount and stops listening for pagehide', () => {
    const { deps, wrapper } = mountWith()
    wrapper.unmount()
    expect(deps.flushPendingSave).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('pagehide'))
    expect(deps.flushPendingSave).toHaveBeenCalledTimes(1)
  })
})
