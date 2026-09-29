import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPattern, type Pattern } from '../domain/pattern'
import { serializePatternForQr } from '../domain/qrExport'
import { useSharedPatternLink } from './useSharedPatternLink'

const shared = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Shared', size: { width: 3, height: 3, unit: 'beads' } })

function mountWith(library: Pattern[] = []) {
  const deps = { patterns: () => library, addPattern: vi.fn(), flushPendingSave: vi.fn() }
  const wrapper = mount(
    defineComponent({
      setup() {
        useSharedPatternLink(deps)
        return () => h('div')
      },
    }),
  )
  return { deps, wrapper }
}

afterEach(() => window.history.replaceState(null, '', '/'))

describe('useSharedPatternLink', () => {
  it('opens the Pattern a share link carries and drops the fragment', () => {
    const link = serializePatternForQr(shared, 'http://localhost:3000/')
    window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)

    const { deps } = mountWith()

    expect(deps.addPattern).toHaveBeenCalledTimes(1)
    expect(deps.addPattern.mock.calls[0]![0]).toMatchObject({ name: 'Shared' })
    expect(window.location.hash).toBe('')
  })

  it('gives it a fresh id when this device already has that Pattern', () => {
    const link = serializePatternForQr(shared, 'http://localhost:3000/')
    window.history.replaceState(null, '', `/${link.slice(link.indexOf('#'))}`)

    const { deps } = mountWith([shared])

    expect(deps.addPattern.mock.calls[0]![0].id).not.toBe(shared.id)
  })

  it('leaves an ordinary page load alone', () => {
    const { deps } = mountWith()
    expect(deps.addPattern).not.toHaveBeenCalled()
  })

  it('ignores a link that cannot be read, and still drops the fragment', () => {
    window.history.replaceState(null, '', '/#pattern=***')

    const { deps } = mountWith()

    expect(deps.addPattern).not.toHaveBeenCalled()
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
