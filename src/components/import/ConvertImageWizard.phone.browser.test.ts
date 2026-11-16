import { describe, expect, it, vi } from 'vitest'
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

const SIZES = [
  [390, 844],
  [360, 640],
] as const

const byId = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const box = (root: HTMLElement, id: string) => byId(root, id)!.getBoundingClientRect()
const press = async (root: HTMLElement, id: string) => {
  byId(root, id)!.click()
  await settleForMeasuring()
}

/** A page of this size, a picture set; the layout answers once the page has been measured. */
async function mountPhone(width: number, height: number, locale: 'en' | 'longest' = 'en') {
  const mounted = await mountAt(ConvertPageHost, props, { locale, width })
  await page.viewport(width, height)
  await pictureSet(mounted.root)
  await settleForMeasuring()
  return mounted.root
}

// The converter on a phone, a tablet and a phone on its side (ConvertImage card DS-4, ticket 0911).
describe('the Convert image page on a phone', () => {
  for (const [width, height] of SIZES) {
    it(`keeps the beads at half the height or more while Width and Colors open, and Create Project in reach at ${width} × ${height}`, async () => {
      const root = await mountPhone(width, height)
      expect(root.querySelector('.convert-page')!.getAttribute('data-layout')).toBe('phone')
      expect(box(root, 'convert-image-create').bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

      for (const setting of ['width', 'colors-count']) {
        await press(root, `convert-setting-${setting}`)
        const preview = root.querySelector('.convert-page__preview')!.getBoundingClientRect()
        expect(preview.height / window.innerHeight, setting).toBeGreaterThanOrEqual(0.5)
        expect(byId(root, 'convert-foot'), 'the dock is hidden while a sheet is open').toBeNull()
        await userEvent.keyboard('{Escape}')
        await settleForMeasuring()
        await vi.waitFor(() => expect(document.activeElement, 'focus goes back to the setting').toBe(byId(root, `convert-setting-${setting}`)))
      }
    })
  }

  it('opens one sheet at a time, and Close brings the dock back', async () => {
    const root = await mountPhone(390, 844)
    await press(root, 'convert-setting-bead')
    expect(byId(root, 'convert-sheet-bead')).not.toBeNull()
    await press(root, 'convert-sheet-close')
    expect(byId(root, 'convert-sheet-bead')).toBeNull()
    expect(byId(root, 'convert-foot')).not.toBeNull()
  })

  it('never opens a sheet taller than the half detent', async () => {
    const root = await mountPhone(360, 640)
    await press(root, 'convert-setting-width')
    await press(root, 'convert-size-more')
    expect(box(root, 'convert-sheet-size').height).toBeLessThanOrEqual(window.innerHeight / 2 + 1)
  })

  for (const locale of ['en', 'longest'] as const) {
    it(`fits every setting and sheet at 360 × 640 in ${locale}`, async () => {
      const root = await mountPhone(360, 640, locale)
      expect(await fitProblems('Convert image page (phone dock)', locale, 360)).toEqual([])
      for (const setting of ['picture', 'bead', 'width', 'colors-count', 'clean-up']) {
        await press(root, `convert-setting-${setting}`)
        expect(await fitProblems(`Convert image page (${setting} sheet)`, locale, 360), setting).toEqual([])
        await press(root, 'convert-sheet-close')
      }
      await press(root, 'convert-tool-background')
      expect(await fitProblems('Convert image page (background sheet)', locale, 360)).toEqual([])
    })
  }
})

describe('the Convert image page on a phone on its side', () => {
  it('takes a column at the right for the dock and for a sheet, the beads staying at the left', async () => {
    const root = await mountPhone(844, 390)
    expect(root.querySelector('.convert-page')!.getAttribute('data-layout')).toBe('side')
    const preview = root.querySelector('.convert-page__preview')!.getBoundingClientRect()
    await press(root, 'convert-setting-width')
    const sheet = box(root, 'convert-sheet-width')
    expect(sheet.left).toBeGreaterThanOrEqual(preview.right - 1)
    expect(root.querySelector('.convert-page__preview')!.getBoundingClientRect().width).toBe(preview.width)
  })
})
