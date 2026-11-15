import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import ConvertPageHost from '../../testUtils/ConvertPageHost.vue'
import { flatColorsPicture, pictureSet } from '../../testUtils/convertPicture'
import { byTestid, expectTouchScreen, hitAreaProblems } from '../../testUtils/hitAreas'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import { tokenPx } from '../../testUtils/tokenPx'

const props = {
  start: { draft: { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: '', makerName: '' }, file: new File(['x'], 'fox.png', { type: 'image/png' }) },
  decodeImage: async () => flatColorsPicture(),
  loadCatalog: async () => undefined,
  readClipboardImage: async () => undefined,
}

// On touch the converter's small controls take a finger (ticket 0962): Auto-fix lighting's row, each Lighting slider
// and its reset, and Small colors join's −, number and +, each across `touch-target`, none over another.
describe('the Convert image page on touch (ticket 0962)', () => {
  it('gives the Lighting row, the Lighting sliders and Small colors join’s stepper a touch-target hit area each', async () => {
    expectTouchScreen()
    const { root } = await mountAt(ConvertPageHost, props, { locale: 'en', width: 1366 })
    await pictureSet(root)
    const least = tokenPx(document.body, '--touch-target')
    expect(hitAreaProblems(byTestid(root, ['convert-lighting-switch', 'convert-lighting-more']), least)).toEqual([])

    root.querySelector<HTMLElement>('[data-testid="convert-lighting-more"]')!.click()
    await settleForMeasuring()
    const sliders = [...root.querySelectorAll('[data-testid="convert-lighting-popover"] input[type="range"]')]
    const resets = [...root.querySelectorAll('[data-testid="convert-lighting-popover"] .convert-lighting-sliders__reset')]
    expect(sliders.length).toBeGreaterThan(1)
    expect(resets.length).toBe(sliders.length)
    const lighting = Object.fromEntries([...sliders.map((slider, index) => [`slider ${index}`, slider]), ...resets.map((reset, index) => [`reset ${index}`, reset])])
    expect(hitAreaProblems(lighting, least)).toEqual([])
    await userEvent.keyboard('{Escape}')
    await settleForMeasuring()

    root.querySelector<HTMLElement>('[data-testid="convert-clean-up-button"]')!.click()
    await settleForMeasuring()
    const stepper = byTestid(root, ['convert-small-colors-fewer', 'convert-small-colors-more'])
    stepper.value = root.querySelector('[data-testid="convert-small-colors-value"] button')!
    expect(hitAreaProblems(stepper, least)).toEqual([])
  })
})
