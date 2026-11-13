import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { fitProblems, mountAt } from '../../testUtils/browserFit'
import ConvertPageHost from '../../testUtils/ConvertPageHost.vue'
import { flatColorsPicture, pictureSet } from '../../testUtils/convertPicture'
import { settleForMeasuring } from '../../testUtils/textFitInPage'

const props = {
  start: { draft: { technique: 'peyote', beadId: 'miyuki/delica/11-0', name: '', makerName: '' }, file: new File(['x'], 'fox.png', { type: 'image/png' }) },
  decodeImage: async () => flatColorsPicture(),
  loadCatalog: async () => undefined,
  readClipboardImage: async () => undefined,
}

// The found-colors table (tickets 0758, 0896): its heading stays at the top of the Colors popover's list as it scrolls,
// over the rows' own columns.
describe('the Convert image found-colors table heading', () => {
  it('stays in view as the list scrolls and sits over the columns of the rows', async () => {
    const mounted = await mountAt(ConvertPageHost, props, { locale: 'en', width: 1366 })
    await page.viewport(1366, 420)
    await pictureSet(mounted.root)
    mounted.root.querySelector<HTMLElement>('[data-testid="convert-colors-more"]')?.click()
    await settleForMeasuring()
    const list = mounted.root.querySelector<HTMLElement>('.convert-colors__table')!
    const heading = () => mounted.root.querySelector<HTMLElement>('[data-testid="found-colors-header"]')!.getBoundingClientRect()
    list.scrollTop = 24
    await settleForMeasuring()

    expect(list.scrollTop).toBeGreaterThan(0)
    expect(heading().top).toBeCloseTo(list.getBoundingClientRect().top, 0)

    const cells = [...mounted.root.querySelectorAll<HTMLElement>('[data-testid="found-colors-header"] span')].map((cell) => cell.getBoundingClientRect())
    const row = mounted.root.querySelector('[data-testid="found-color"]')!
    const change = row.querySelector('[data-testid="found-color-remap"]')!.getBoundingClientRect()
    const count = row.querySelector('.found-color__count')!.getBoundingClientRect()
    const [beadsCell, changeCell] = [cells[2]!, cells[3]!]
    expect(changeCell.left + changeCell.width / 2).toBeCloseTo(change.left + change.width / 2, 0)
    expect(beadsCell.right).toBeCloseTo(count.right, 0)
  })

  // A phone's table (ticket 0782): the text fit check passes a word broken across lines, so this checks what it cannot,
  // that a found color's hex stays whole, and that the heading's "From picture → Becomes" sits over its two columns.
  for (const locale of ['en', 'longest'] as const) {
    it(`keeps each found color's hex on one line at 320px, under "From picture → Becomes", in ${locale}`, async () => {
      const mounted = await mountAt(ConvertPageHost, props, { locale, width: 1366 })
      await pictureSet(mounted.root)
      mounted.root.querySelector<HTMLElement>('[data-testid="convert-colors-more"]')?.click()
      await page.viewport(320, 640)
      await settleForMeasuring()

      const names = [...mounted.root.querySelectorAll<HTMLElement>('[data-testid="found-color-name"]')]
      expect(names.length).toBeGreaterThan(0)
      for (const name of names) expect(name.getBoundingClientRect().height, name.textContent ?? '').toBeLessThanOrEqual(parseFloat(getComputedStyle(name).lineHeight) + 0.5)

      const pair = mounted.root.querySelector('.found-colors-header__pair')!.getBoundingClientRect()
      const row = mounted.root.querySelector('[data-testid="found-color"]')!
      const swatches = [...row.querySelectorAll('.found-color__swatch')].map((swatch) => swatch.getBoundingClientRect())
      expect(pair.left).toBeCloseTo(swatches[0]!.left, 0)
      expect(pair.right).toBeGreaterThan(swatches[1]!.right)
      expect(mounted.root.querySelector('.found-colors-header__action')!.getBoundingClientRect().width).toBe(0)
    })
  }
})

// The found beads and Compare's picture are drawn on the canvas after the Project renderer, which leaves its grid
// transform on the context (ticket 0787): both must land on the beads as they are on screen, not scaled by the zoom.
describe('the preview’s overlays on the canvas', () => {
  /** A black wall round a red square, with a green patch in the top-right corner: wall and patch are the background. */
  const cornered = async () => {
    const data = new Uint8ClampedArray(40 * 40 * 4)
    for (let y = 0; y < 40; y += 1) {
      for (let x = 0; x < 40; x += 1) {
        const red = x >= 15 && x < 25 && y >= 15 && y < 25
        const green = x >= 32 && y < 8
        data.set(red ? [255, 0, 0, 255] : green ? [0, 255, 0, 255] : [0, 0, 0, 255], (y * 40 + x) * 4)
      }
    }
    return { width: 40, height: 40, data }
  }
  /** Every pixel 4 × 4 beads in its own color: the widest Width and Exact, where the converter opens smaller and on the
   * Bead's palette (ticket 0863). */
  const atEveryPixel = async (root: HTMLElement) => {
    await pictureSet(root)
    const slider = root.querySelector<HTMLInputElement>('[data-testid="convert-width-range"]')!
    slider.value = slider.max
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    root.querySelector<HTMLElement>('[data-testid="convert-colors-more"]')!.click()
    await settleForMeasuring()
    root.querySelector<HTMLElement>('[data-testid="convert-color-source"]')!.click()
    await settleForMeasuring()
    root.querySelector<HTMLElement>('[data-testid="convert-color-source-option"][data-value="exact"]')!.click()
    // Pressed again, the button closes its popover (ticket 0896), so a press on the beads is not one outside it.
    root.querySelector<HTMLElement>('[data-testid="convert-colors-more"]')!.click()
    await settleForMeasuring()
  }
  const topRightPixel = (root: HTMLElement) => {
    const canvas = root.querySelector<HTMLCanvasElement>('[data-testid="convert-image-canvas"]')!
    return Array.from(canvas.getContext('2d')!.getImageData(canvas.width - 4, 4, 1, 1).data)
  }

  it('fades and hatches the found beads where they are, to the picture’s far corner', async () => {
    const mounted = await mountAt(ConvertPageHost, { ...props, decodeImage: cornered }, { locale: 'en', width: 1366 })
    await atEveryPixel(mounted.root)
    // Background on the bar turns Remove background on with its tool and popover (ticket 0896).
    mounted.root.querySelector<HTMLElement>('[data-testid="convert-tool-background"]')!.click()
    await settleForMeasuring()
    const [r, g, b] = topRightPixel(mounted.root)
    // Pure green is the bead as drawn; faded, or under a hatch line, it is not.
    expect(g).toBeGreaterThan(100)
    expect(r! + b!).toBeGreaterThan(80)
  })

  it('keeps the patch under a tap of the Background tool, through the pointer, with Undo then on show', async () => {
    const mounted = await mountAt(ConvertPageHost, { ...props, decodeImage: cornered }, { locale: 'en', width: 1366 })
    await atEveryPixel(mounted.root)
    const find = (testid: string) => mounted.root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)
    find('convert-tool-background')!.click()
    await settleForMeasuring()
    expect(find('convert-reset-marks')).toBeNull()
    const share = () => find('convert-background-found')!.textContent
    const before = share()
    // A tap on the green patch in the top-right corner, found with the wall: its patch is kept.
    const box = find('convert-image-box')!.getBoundingClientRect()
    const at = { clientX: box.right - 4, clientY: box.top + 4, bubbles: true, pointerId: 1 }
    find('convert-image-box')!.dispatchEvent(new PointerEvent('pointerdown', at))
    window.dispatchEvent(new PointerEvent('pointerup', at))
    await settleForMeasuring()
    expect(share()).not.toBe(before)
    expect(find('convert-reset-marks')).not.toBeNull()
    const [r, g, b] = topRightPixel(mounted.root)
    expect(g).toBeGreaterThan(200)
    expect(r! + b!).toBeLessThan(80)
  })

  it('shows the original picture where the beads are while Compare is held', async () => {
    const mounted = await mountAt(ConvertPageHost, { ...props, decodeImage: cornered }, { locale: 'en', width: 1366 })
    await atEveryPixel(mounted.root)
    const compare = mounted.root.querySelector<HTMLElement>('[data-testid="convert-compare"]')!
    await userEvent.hover(compare)
    compare.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settleForMeasuring()
    const [r, g, b] = topRightPixel(mounted.root)
    expect(g).toBeGreaterThan(200)
    expect(r! + b!).toBeLessThan(80)
    compare.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
})

// The first window (ticket 0896, ConvertImage card DS-1): at a desktop's and an iPad's size the column holds everything
// whole with no scroll, in the longest wording too, a popover opens beside it, and under 1024 px the column stacks.
/** The foot's bottom padding (20 at the 18px root is --space-20): what the column may overrun at 1180 × 820, ticket 0897. */
const FOOT_BOTTOM_PADDING_PX = 20

describe('Convert image, the quiet converter', () => {
  const find = (root: HTMLElement, testid: string) => root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
  const rect = (root: HTMLElement, testid: string) => find(root, testid).getBoundingClientRect()

  for (const [width, height] of [
    [1440, 900],
    [1180, 820],
  ] as const) {
    for (const locale of ['en', 'longest'] as const) {
      it(`fits the column with nothing under a fold at ${width} × ${height} in ${locale}, and its popovers beside it`, async () => {
        const mounted = await mountAt(ConvertPageHost, props, { locale, width })
        await page.viewport(width, height)
        await pictureSet(mounted.root)
        await settleForMeasuring()
        const root = mounted.root
        const column = find(root, 'convert-column')
        // At 1180 × 820 the longest wording runs the column past the window by the sticky foot's padding (ticket 0897),
        // and in the longest words Clean up's button wraps (ticket 0906): the column scrolls above the pinned foot.
        if (locale !== 'longest') expect(column.scrollHeight - column.clientHeight).toBeLessThanOrEqual(width === 1440 ? 1 : FOOT_BOTTOM_PADDING_PX)
        expect(rect(root, 'convert-image-create').bottom).toBeLessThanOrEqual(height)
        // The bar's buttons stand whole inside it.
        const bar = rect(root, 'convert-preview-tools')
        for (const button of find(root, 'convert-preview-tools').querySelectorAll('button')) {
          const box = button.getBoundingClientRect()
          expect([box.left >= bar.left, box.right <= bar.right]).toEqual([true, true])
        }
        expect(await fitProblems('Convert image page', locale, width)).toEqual([])

        for (const [button, popover] of [
          ['convert-bead-button', 'convert-bead-popover'],
          ['convert-size-more', 'convert-size-popover'],
          ['convert-colors-more', 'convert-colors-popover'],
          ['convert-clean-up-button', 'convert-clean-up-popover'],
        ] as const) {
          find(root, button).click()
          await settleForMeasuring()
          const box = rect(root, popover)
          expect(box.right, popover).toBeLessThanOrEqual(column.getBoundingClientRect().left)
          expect([box.top >= 0, box.bottom <= height], popover).toEqual([true, true])
          // Clean up's stands with its bottom level with its button's (DS-3).
          if (popover === 'convert-clean-up-popover' && column.scrollHeight <= column.clientHeight + 1) expect(box.bottom).toBeCloseTo(rect(root, button).bottom, 0)
          expect(await fitProblems(`Convert image ${popover}`, locale, width)).toEqual([])
          find(root, button).click()
          await settleForMeasuring()
        }
        // The Size popover's slider labels never touch.
        find(root, 'convert-size-more').click()
        await settleForMeasuring()
        for (const ends of root.querySelectorAll('[data-testid="convert-size-popover"] .vs-ends')) {
          const shown = [...ends.children].filter((label) => getComputedStyle(label).visibility !== 'hidden').map((label) => label.getBoundingClientRect())
          shown.sort((a, b) => a.left - b.left)
          for (let index = 1; index < shown.length; index += 1) expect(shown[index]!.left).toBeGreaterThan(shown[index - 1]!.right)
        }
      })
    }
  }

  it('stands the Colors list’s opened Change in view inside its popover at iPad size', async () => {
    const mounted = await mountAt(ConvertPageHost, props, { locale: 'en', width: 1180 })
    await page.viewport(1180, 820)
    await pictureSet(mounted.root)
    find(mounted.root, 'convert-colors-more').click()
    await settleForMeasuring()
    find(mounted.root, 'found-color-remap').click()
    await new Promise((resolve) => setTimeout(resolve, 400))
    await settleForMeasuring()
    const picker = rect(mounted.root, 'found-color-picker')
    const list = mounted.root.querySelector('.convert-colors__table')!.getBoundingClientRect()
    expect([picker.top >= list.top - 1, picker.bottom <= list.bottom + 1]).toEqual([true, true])
    expect(await fitProblems('Convert image page (iPad)', 'en', 1180)).toEqual([])
  })

  it('stacks the column under the preview in portrait, a popover opening in place in it', async () => {
    const mounted = await mountAt(ConvertPageHost, props, { locale: 'longest', width: 1024 })
    await page.viewport(1024, 1366)
    await pictureSet(mounted.root)
    find(mounted.root, 'convert-size-more').click()
    await settleForMeasuring()
    const preview = mounted.root.querySelector('.convert-page__preview')!.getBoundingClientRect()
    expect(preview.bottom).toBeLessThanOrEqual(rect(mounted.root, 'convert-column').top + 1)
    const popover = rect(mounted.root, 'convert-size-popover')
    expect(popover.top).toBeGreaterThan(rect(mounted.root, 'convert-size-more').bottom)
    expect(await fitProblems('Convert image page (portrait)', 'longest', 1024)).toEqual([])
  })

  it('sets the ways in with one height in one row, and fits the drop zone in the longest wording', async () => {
    const mounted = await mountAt(ConvertPageHost, { ...props, start: { draft: props.start.draft } }, { locale: 'longest', width: 1180 })
    await page.viewport(1180, 820)
    await settleForMeasuring()
    const file = find(mounted.root, 'convert-choose-file').closest('label')!.getBoundingClientRect()
    const paste = rect(mounted.root, 'convert-paste')
    expect([paste.top, paste.height]).toEqual([file.top, file.height])
    expect(await fitProblems('Convert image page (no picture)', 'longest', 1180)).toEqual([])
  })
})
