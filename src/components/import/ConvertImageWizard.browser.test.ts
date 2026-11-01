import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
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

// A part is drawn like a Selection (ticket 0757): the preview takes real pointer input, and choosing the part leaves
// the Width in beads as it was.
describe('A part on the preview', () => {
  const picture = async () => ({ width: 400, height: 300, data: new Uint8ClampedArray(400 * 300 * 4).fill(200) })

  it('is drawn, moved and pulled by its handles, with the Width unchanged', async () => {
    const mounted = await mountAt(ConvertPageHost, { ...props, decodeImage: picture }, { locale: 'en', width: 1366 })
    await pictureSet(mounted.root)
    const find = (testid: string) => mounted.root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
    const rect = (testid: string) => find(testid).getBoundingClientRect()
    const width = () => (find('convert-width-range') as HTMLInputElement).value

    // Width 20 beads, then A part from the Picture step, and back to the Size step to read the Width.
    find('convert-step-size').click()
    await settleForMeasuring()
    const slider = find('convert-width-range') as HTMLInputElement
    slider.value = '20'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    find('convert-step-picture').click()
    await settleForMeasuring()
    find('convert-weave').querySelector<HTMLElement>('[data-value="part"]')!.click()
    find('convert-step-size').click()
    await settleForMeasuring()
    expect(width()).toBe('20')

    // Where the part stands on the picture, as fractions of its width and height: the preview re-fits as the part changes.
    const onPicture = () => {
      const box = rect('convert-image-box')
      const part = rect('convert-image-frame-outline')
      return { left: (part.left - box.left) / box.width, right: (part.right - box.left) / box.width, top: (part.top - box.top) / box.height }
    }
    const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(0.04)

    // Drag inside it to move it: the part keeps its size and goes where it is dropped, as far as the picture allows.
    const before = onPicture()
    await userEvent.dragAndDrop(find('convert-image-frame-outline'), find('convert-zoom-in'))
    const moved = onPicture()
    expect(moved.left).toBeGreaterThan(before.left + 0.05)
    near(moved.right - moved.left, before.right - before.left)
    near(moved.right, 1)
    expect(width()).toBe('20')

    // Pull its left handle half way across it: the part is narrowed, its right edge kept.
    await userEvent.dragAndDrop(find('convert-crop-left'), find('convert-crop-top'))
    const pulled = onPicture()
    near(pulled.right - pulled.left, (moved.right - moved.left) / 2)
    near(pulled.right, moved.right)
    expect(width()).toBe('20')

    // Drag outside it to draw a new one, from where the drag began to where it ended.
    await userEvent.dragAndDrop(find('convert-image-canvas'), find('convert-zoom-in'))
    const drawn = onPicture()
    near(drawn.left, 0.5)
    near(drawn.right, 1)
    near(drawn.top, 0.5)
    expect(width()).toBe('20')
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
