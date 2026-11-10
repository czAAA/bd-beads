import { describe, expect, it } from 'vitest'
import { webProjectLocks } from './projectLocks'

// The browser's own Web Locks (ticket 0834), which jsdom has none of: two claims in one page wait on each other as two
// tabs' do, a lock being the origin's.
describe('webProjectLocks', () => {
  const locks = webProjectLocks(navigator.locks)
  /** A claim whose answers are written down. */
  function claim(id: string) {
    const heard: boolean[] = []
    const letGo = locks.claim(id, (held) => heard.push(held))
    return { heard, letGo }
  }

  it('gives a Project to the first tab, tells the second it is taken, and hands it over when the first lets go', async () => {
    const first = claim('locks-a')
    await expect.poll(() => first.heard).toEqual([true])
    const second = claim('locks-a')
    await expect.poll(() => second.heard).toEqual([false])

    first.letGo()

    await expect.poll(() => second.heard).toEqual([false, true])
    second.letGo()
  })

  it('holds different Projects apart', async () => {
    const first = claim('locks-b')
    const second = claim('locks-c')

    await expect.poll(() => [first.heard, second.heard]).toEqual([[true], [true]])
    first.letGo()
    second.letGo()
  })

  it('gives a Project back to the tab that let it go and claims it again, without saying it is taken', async () => {
    const first = claim('locks-e')
    await expect.poll(() => first.heard).toEqual([true])
    first.letGo()
    const again = claim('locks-e')

    await expect.poll(() => again.heard).toEqual([true])
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(again.heard).toEqual([true])
    again.letGo()
  })

  it('tells a claim given up while waiting nothing more, and frees the lock for the next', async () => {
    const first = claim('locks-d')
    await expect.poll(() => first.heard).toEqual([true])
    const gaveUp = claim('locks-d')
    await expect.poll(() => gaveUp.heard).toEqual([false])
    gaveUp.letGo()

    first.letGo()
    const next = claim('locks-d')

    await expect.poll(() => next.heard).toEqual([true])
    expect(gaveUp.heard).toEqual([false])
    next.letGo()
  })
})
