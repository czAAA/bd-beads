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

/** An element's opacity once the leave's fade (`duration-base`) has had time to end. */
async function settledOpacity(selector: string): Promise<string> {
  await new Promise((done) => setTimeout(done, 400))
  return getComputedStyle(mounted!.root.querySelector(selector)!).opacity
}

// Leaving for the editor (tickets 0776, 0783, 0822): the content fades, the Canvas strip with its slogan and its way in
// stays, as the editor's first paint draws it again.
describe('leaving the Homepage for the editor', () => {
  it('fades the section and the Progress bar but keeps the strip', async () => {
    mounted = await mountAt(HomePage, { projectCount: 3, feedback: fakeFeedback() }, { locale: 'en', width: 1280 })
    await settleForMeasuring()
    document.documentElement.dataset.handoff = 'leaving'
    expect(await settledOpacity('.homepage__strip')).toBe('1')
    expect(await settledOpacity('.homepage__page')).toBe('0')
    expect(await settledOpacity('[data-testid="section-bar"]')).toBe('0')
  })
})
