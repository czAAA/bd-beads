import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { flatColorsPicture, pictureSet } from '../../testUtils/convertPicture'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import ConvertImageWizard from './ConvertImageWizard.vue'

const props = {
  start: { draft: { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: '', makerName: '' }, file: new File(['x'], 'fox.png', { type: 'image/png' }) },
  decodeImage: async () => flatColorsPicture(),
  loadCatalog: async () => undefined,
  readClipboardImage: async () => undefined,
}

// Create Project has a Tooltip, so AppButton wraps it, and the footer's rules must still reach the button inside
// (ticket 0679): on the large Modal the two are one height; on the phone sheet they share the row half and half.
describe('the Convert image wizard footer', () => {
  it('draws Cancel and Create Project at one height, and side by side at one width on the phone sheet', async () => {
    const mounted = await mountAt(ConvertImageWizard, props, { locale: 'en', width: 1366 })
    await pictureSet(mounted.root)
    const size = (testid: string) => {
      const box = mounted.root.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect()
      return { top: box.top, width: box.width, height: box.height }
    }

    await page.viewport(1366, 900)
    await settleForMeasuring()
    expect(size('convert-image-create').height).toBe(size('convert-image-cancel').height)

    await page.viewport(390, 844)
    await settleForMeasuring()
    expect(size('convert-image-create')).toEqual(size('convert-image-cancel'))
  })
})
