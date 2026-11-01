import { describe, expect, it } from 'vitest'
import { useAppPage } from './useAppPage'

describe('useAppPage', () => {
  it('starts on the editor, which has nothing to leave', async () => {
    const pages = useAppPage()
    expect(pages.page.value).toBe('editor')
    expect(await pages.leave()).toBe(true)
  })

  it('leaves another page at once when it registered no guard', async () => {
    const pages = useAppPage()
    pages.open('convert-image')
    expect(await pages.leave()).toBe(true)
    expect(pages.page.value).toBe('editor')
  })

  it('stays on the page while its guard answers no, and leaves when it answers yes', async () => {
    const pages = useAppPage()
    let answer = false
    pages.open('convert-image')
    pages.registerLeaveGuard(async () => answer)
    expect(await pages.leave()).toBe(false)
    expect(pages.page.value).toBe('convert-image')
    answer = true
    expect(await pages.leave()).toBe(true)
    expect(pages.page.value).toBe('editor')
  })

  it('forgets a guard that was unregistered, and keeps a newer one when an older one is', async () => {
    const pages = useAppPage()
    pages.open('convert-image')
    const first = pages.registerLeaveGuard(() => false)
    first()
    expect(await pages.leave()).toBe(true)

    pages.open('convert-image')
    const old = pages.registerLeaveGuard(() => true)
    pages.registerLeaveGuard(() => false)
    old()
    expect(await pages.leave()).toBe(false)
  })
})
