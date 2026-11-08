import { afterEach, describe, expect, it } from 'vitest'
import { mountAt, type Mounted } from '../testUtils/browserFit'
import { settleForMeasuring } from '../testUtils/textFitInPage'
import HomePage from './HomePage.vue'
import { fakeFeedback } from '../testUtils/fakeFeedback'
import '../styles/boxHandoff.css'

let mounted: Mounted | undefined
afterEach(() => {
  delete document.documentElement.dataset.handoff
  mounted?.unmount()
})

/** An element's opacity now, which the leave's fade (`duration-base`) moves. */
const opacity = (selector: string) => () => getComputedStyle(mounted!.root.querySelector(selector)!).opacity

// Leaving for the editor (tickets 0776, 0783, 0822): the content fades, the Canvas strip with its slogan and its way in
// stays, as the editor's first paint draws it again.
describe('leaving the Homepage for the editor', () => {
  it('fades the section, More below and the Progress bar but keeps the strip', async () => {
    mounted = await mountAt(HomePage, { projectCount: 3, feedback: fakeFeedback() }, { locale: 'en', width: 1280 })
    await settleForMeasuring()
    document.documentElement.dataset.handoff = 'leaving'
    await expect.poll(opacity('.homepage__page')).toBe('0')
    await expect.poll(opacity('[data-testid="section-bar"]')).toBe('0')
    await expect.poll(opacity('[data-testid="more-below"]')).toBe('0')
    expect(opacity('.homepage__strip')()).toBe('1')
  })
})
