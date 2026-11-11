import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useAppPage } from './useAppPage'
import { useBackClosesPage } from './useBackClosesPage'

/** The tab's next popstate, once its handlers (and what they await) have run. */
const popped = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => setTimeout(resolve), { once: true }))

/** The browser's Back, as the person presses it. */
async function back() {
  const done = popped()
  history.back()
  await done
}

describe('useBackClosesPage', () => {
  let scope = effectScope()
  beforeEach(() => void (scope = effectScope()))
  afterEach(() => {
    scope.stop()
    vi.restoreAllMocks()
  })

  function setup(stays = false) {
    const appPage = useAppPage()
    const close = vi.fn(async () => (stays ? false : appPage.leave()))
    scope.run(() => useBackClosesPage({ page: appPage.page, close }))
    return { appPage, close }
  }

  // An earlier Back leaves the tab mid-history, where a push replaces what was ahead: count the pushes, not the length.
  it('puts one entry on the history while a page other than the editor shows', () => {
    const { appPage } = setup()
    const push = vi.spyOn(history, 'pushState')
    appPage.open('convert-image')
    appPage.open('convert-image')
    expect(push).toHaveBeenCalledOnce()
  })

  it('makes Back the page’s Close', async () => {
    const { appPage, close } = setup()
    appPage.open('convert-image')
    const entryOff = popped()
    await back()
    await entryOff
    expect(close).toHaveBeenCalledOnce()
    expect(appPage.page.value).toBe('editor')
  })

  it('keeps Back the page’s Close when the person stays', async () => {
    const { appPage, close } = setup(true)
    appPage.open('convert-image')
    await back()
    await back()
    expect(close).toHaveBeenCalledTimes(2)
    expect(appPage.page.value).toBe('convert-image')
  })

  it('takes the entry off when the page goes another way, without closing it again', async () => {
    const { appPage, close } = setup()
    appPage.open('convert-image')
    const entryOff = popped()
    appPage.open('editor')
    await entryOff
    expect(close).not.toHaveBeenCalled()
    appPage.open('convert-image')
    await back()
    expect(close).toHaveBeenCalledOnce()
  })

  it('keeps Back the Close of a page opened again before the last one’s entry came off', async () => {
    const { appPage, close } = setup(true)
    appPage.open('convert-image')
    const entryOff = popped()
    appPage.open('editor')
    appPage.open('convert-image')
    await entryOff
    await back()
    expect(close).toHaveBeenCalledOnce()
  })

  it('leaves Back to the browser on the editor', async () => {
    const { close } = setup()
    window.dispatchEvent(new PopStateEvent('popstate'))
    await Promise.resolve()
    expect(close).not.toHaveBeenCalled()
  })
})
