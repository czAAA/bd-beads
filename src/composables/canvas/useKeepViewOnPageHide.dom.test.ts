import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { KeptProjectView } from '../../domain/keptView'
import { useKeepViewOnPageHide } from './useKeepViewOnPageHide'

const VIEW: KeptProjectView = { project: 'p1', view: { zoom: 2, middle: { x: 10, y: 20 } } }

function setup(current: KeptProjectView | undefined, known = true) {
  const write = vi.fn()
  const scope = effectScope()
  scope.run(() => useKeepViewOnPageHide({ read: () => undefined, write }, () => current, () => known))
  return { write, scope }
}

function hide(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useKeepViewOnPageHide (ticket 1108)', () => {
  it('keeps the view as the page is left and as it is hidden, not as it comes back', () => {
    const { write, scope } = setup(VIEW)
    window.dispatchEvent(new Event('pagehide'))
    hide('hidden')
    hide('visible')
    expect(write.mock.calls).toEqual([[VIEW], [VIEW]])
    scope.stop()
  })

  it('forgets the kept view when there is none to keep', () => {
    const { write, scope } = setup(undefined)
    window.dispatchEvent(new Event('pagehide'))
    expect(write).toHaveBeenCalledWith(undefined)
    scope.stop()
  })

  it('leaves the kept view alone while the Project is still loading', () => {
    const { write, scope } = setup(undefined, false)
    window.dispatchEvent(new Event('pagehide'))
    expect(write).not.toHaveBeenCalled()
    scope.stop()
  })

  it('stops listening once its shell is gone', () => {
    const { write, scope } = setup(VIEW)
    scope.stop()
    window.dispatchEvent(new Event('pagehide'))
    expect(write).not.toHaveBeenCalled()
  })
})
