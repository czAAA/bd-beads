import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import ConvertPageHost from '../../testUtils/ConvertPageHost.vue'
import { flatColorsPicture, pictureSet } from '../../testUtils/convertPicture'
import { settleForMeasuring } from '../../testUtils/textFitInPage'

const props = {
  start: { draft: { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: '', makerName: '' }, file: new File(['x'], 'fox.png', { type: 'image/png' }) },
  decodeImage: async () => flatColorsPicture(),
  loadCatalog: async () => undefined,
  readClipboardImage: async () => undefined,
}

// Create Project has a Tooltip, so AppButton wraps it, and the Progress bar's rules must still reach the button inside
// (ticket 0679): Back and Create Project are one height, and on a phone they share the row half and half.
describe('the Convert image Progress bar on Review', () => {
  it('draws Back and Create Project at one height, and side by side at one width on a phone', async () => {
    const mounted = await mountAt(ConvertPageHost, props, { locale: 'en', width: 1366 })
    await pictureSet(mounted.root)
    mounted.root.querySelector<HTMLElement>('[data-testid="convert-step-review"]')?.click()
    await settleForMeasuring()
    const size = (testid: string) => {
      const box = mounted.root.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect()
      return { top: box.top, width: box.width, height: box.height }
    }

    await page.viewport(1366, 900)
    await settleForMeasuring()
    expect(size('convert-image-create').height).toBe(size('convert-back').height)

    await page.viewport(390, 844)
    await settleForMeasuring()
    expect(size('convert-image-create')).toEqual({ ...size('convert-back'), width: size('convert-image-create').width })
    expect(size('convert-image-create').width).toBeCloseTo(size('convert-back').width, 0)
  })
})

// The found-colors table (ticket 0758): its heading stays at the top of the step as the list scrolls, over the rows' own columns.
describe('the Convert image found-colors table heading', () => {
  it('stays in view as the step scrolls and sits over the columns of the rows', async () => {
    const mounted = await mountAt(ConvertPageHost, props, { locale: 'en', width: 1366 })
    await pictureSet(mounted.root)
    mounted.root.querySelector<HTMLElement>('[data-testid="convert-step-colors"]')?.click()
    await settleForMeasuring()
    mounted.root.querySelector<HTMLElement>('[data-testid="convert-color-by-color"]')?.click()
    await page.viewport(1366, 240)
    await settleForMeasuring()
    const pane = mounted.root.querySelector<HTMLElement>('[data-testid="convert-step-pane"]')!
    const heading = () => mounted.root.querySelector<HTMLElement>('[data-testid="found-colors-header"]')!.getBoundingClientRect()
    // Scrolled until the heading would have left the pane, with the rows still under it.
    const target = heading().top - pane.getBoundingClientRect().top + 24
    pane.scrollTop = target
    await settleForMeasuring()

    expect(pane.scrollTop).toBeCloseTo(target, 0)
    expect(heading().top).toBeCloseTo(pane.getBoundingClientRect().top, 0)

    const cells = [...mounted.root.querySelectorAll<HTMLElement>('[data-testid="found-colors-header"] > span')].map((cell) => cell.getBoundingClientRect())
    const row = mounted.root.querySelector('[data-testid="found-color"]')!
    const change = row.querySelector('[data-testid="found-color-remap"]')!.getBoundingClientRect()
    const count = row.querySelector('.found-color__count')!.getBoundingClientRect()
    const [beadsCell, changeCell] = [cells[2]!, cells[3]!]
    expect(changeCell.left + changeCell.width / 2).toBeCloseTo(change.left + change.width / 2, 0)
    expect(beadsCell.right).toBeCloseTo(count.right, 0)
  })
})
