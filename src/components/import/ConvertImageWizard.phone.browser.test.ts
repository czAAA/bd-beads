import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import type { ColorCatalog } from '../../domain/colorCatalog'
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

/** A Delica catalog of a few codes, so My beads is offered. */
const catalog: ColorCatalog = {
  id: 'miyuki-delica',
  codes: [
    { code: 'DB723', family: ['Red'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB726', family: ['Blue'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
    { code: 'DB721', family: ['Yellow'], finish: 'opaque', wording: 'Opaque', sizes: ['11/0'] },
  ],
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

/** A drag on the sheet's grab zone, by `dy` px (up is negative), let go at `endY` when given. */
async function dragGrab(root: HTMLElement, dy: number, endY?: number) {
  const grab = byId(root, 'convert-sheet-grab')!
  const startY = grab.getBoundingClientRect().top + 4
  grab.dispatchEvent(new PointerEvent('pointerdown', { clientY: startY, pointerId: 1, bubbles: true }))
  grab.dispatchEvent(new PointerEvent('pointerup', { clientY: endY ?? startY + dy, pointerId: 1, bubbles: true }))
  await settleForMeasuring()
}
const previewHeight = (root: HTMLElement) => root.querySelector('.convert-page__preview')!.getBoundingClientRect().height
const openColorsList = async (root: HTMLElement) => {
  await press(root, 'convert-setting-colors-count')
  await press(root, 'convert-colors-more')
}

// The Colors list, Clean up and Lighting laid out as sheets (ConvertImage card DS-4, ticket 0919).
describe('the Colors list, Clean up and Lighting as sheets on a phone', () => {
  it('opens the Colors list in the Colors sheet\'s place at the half detent, and the back arrow returns to the number of colors', async () => {
    const root = await mountPhone(390, 844)
    await openColorsList(root)
    expect(byId(root, 'convert-sheet-colors')).not.toBeNull()
    expect(previewHeight(root) / window.innerHeight).toBeGreaterThanOrEqual(0.5)
    const back = byId(root, 'convert-colors-back')!
    expect(back.getAttribute('aria-label')).toBe('Back to the number of colors')
    expect(back.getBoundingClientRect().width, 'touch-target square').toBeGreaterThanOrEqual(44)
    expect(byId(root, 'convert-found-count')!.textContent).toBe('3 colors')
    back.click()
    await settleForMeasuring()
    expect(byId(root, 'convert-sheet-colors-count')).not.toBeNull()
    expect(byId(root, 'convert-sheet-colors')).toBeNull()
  })

  for (const [width, height] of SIZES) {
    it(`drags the Colors list up to the full detent and back, and below half it closes, at ${width} × ${height}`, async () => {
      const root = await mountPhone(width, height)
      await openColorsList(root)
      await dragGrab(root, -60)
      expect(previewHeight(root), 'the beads keep 160 px').toBe(160)
      expect(box(root, 'convert-sheet-colors').bottom).toBe(window.innerHeight)
      expect(byId(root, 'convert-preview-tools')!.offsetParent, 'the bar on the beads is hidden').toBeNull()
      expect(byId(root, 'convert-sheet-close')!.getBoundingClientRect().top, 'the head stays').toBeGreaterThan(160)

      await dragGrab(root, 60)
      expect(byId(root, 'convert-sheet-colors')).not.toBeNull()
      expect(previewHeight(root) / window.innerHeight).toBeGreaterThanOrEqual(0.5)
      expect(byId(root, 'convert-preview-tools')!.offsetParent).not.toBeNull()

      await dragGrab(root, 60)
      expect(byId(root, 'convert-sheet-colors')).toBeNull()
      expect(byId(root, 'convert-foot')).not.toBeNull()
    })
  }

  it('closes the Colors list let go near the foot of the page from the full detent', async () => {
    const root = await mountPhone(390, 844)
    await openColorsList(root)
    await dragGrab(root, -60)
    await dragGrab(root, 0, 800)
    expect(byId(root, 'convert-sheet-colors')).toBeNull()
  })

  it('drags no other sheet past half', async () => {
    const root = await mountPhone(390, 844)
    await press(root, 'convert-setting-clean-up')
    await dragGrab(root, -60)
    expect(previewHeight(root) / window.innerHeight).toBeGreaterThanOrEqual(0.5)
  })

  it('opens Change in its row with Keep exact, and a pick redraws the beads above', async () => {
    const root = await mountPhone(360, 640)
    await openColorsList(root)
    await dragGrab(root, -60)
    await press(root, 'found-color-remap')
    const picker = box(root, 'found-color-picker')
    expect(picker.left).toBeGreaterThanOrEqual(0)
    expect(picker.right).toBeLessThanOrEqual(360)
    const before = byId(root, 'found-color-name')!.textContent
    await press(root, 'found-color-keep-exact')
    expect(byId(root, 'found-color-source')!.textContent).toContain('Kept exact')
    expect(byId(root, 'found-color-name')!.textContent).not.toBe(before)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('fits Clean up under the half detent at 390 × 844 with no scroll, and at 360 × 640 scrolls to its last line', async () => {
    const root = await mountPhone(390, 844)
    await press(root, 'convert-setting-clean-up')
    const body = byId(root, 'convert-sheet-body')!
    // A px of slack: the sheet's height is a fraction of one (the root's 112.5%), which the two round apart.
    expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight + 1)
    expect(previewHeight(root) / window.innerHeight).toBeGreaterThanOrEqual(0.5)
    expect(box(root, 'convert-clean-up-switch').top).toBeGreaterThan(box(root, 'convert-sheet-close').top)
    await vi.waitFor(() => expect(document.activeElement, 'focus goes past the head, to the first control').toBe(byId(root, 'convert-clean-up-switch')))

    await page.viewport(360, 640)
    await settleForMeasuring()
    expect(previewHeight(root) / window.innerHeight).toBeGreaterThanOrEqual(0.5)
    const last = byId(root, 'convert-small-colors-joined')!
    last.scrollIntoView({ block: 'end' })
    expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(body.getBoundingClientRect().bottom + 1)
  })

  it('opens Lighting at the half detent and scrolls to Saturation, each reset 44 to hit', async () => {
    const root = await mountPhone(360, 640)
    await press(root, 'convert-setting-picture')
    await press(root, 'convert-lighting-more')
    expect(previewHeight(root) / window.innerHeight).toBeGreaterThanOrEqual(0.5)
    const body = byId(root, 'convert-sheet-body')!
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    const reset = byId(root, 'convert-lighting-saturation-reset')!
    reset.scrollIntoView({ block: 'end' })
    await settleForMeasuring()
    const at = reset.getBoundingClientRect()
    expect(at.bottom).toBeLessThanOrEqual(body.getBoundingClientRect().bottom + 1)
    expect(at.top, 'under the head, which stays').toBeGreaterThanOrEqual(byId(root, 'convert-sheet-close')!.getBoundingClientRect().bottom - 1)
    expect(Math.min(at.width, at.height), 'touch-target to hit').toBeGreaterThanOrEqual(44)

    const autoFix = () => byId(root, 'convert-lighting-sheet-switch')!
    const was = autoFix().getAttribute('aria-checked')
    await press(root, 'convert-lighting-sheet-switch')
    expect(autoFix().getAttribute('aria-checked'), 'Auto-fix lighting switches in the sheet').not.toBe(was)
  })

  it('opens My beads in the Colors list\'s place at the same detents, and Back returns to the list', async () => {
    const withCatalog = await mountAt(ConvertPageHost, { ...props, loadCatalog: async () => catalog }, { locale: 'en', width: 360 })
    await page.viewport(360, 640)
    const root = withCatalog.root
    await pictureSet(root)
    await settleForMeasuring()
    await openColorsList(root)
    await dragGrab(root, -60)
    await press(root, 'convert-color-source')
    await press(root, 'convert-edit-my-beads')
    expect(byId(root, 'convert-my-beads')).not.toBeNull()
    expect(previewHeight(root), 'still at the full detent').toBe(160)
    expect(root.querySelectorAll('[data-testid="convert-sheet-close"]').length, 'one head').toBe(1)
    expect(await fitProblems('Convert image page (My beads sheet)', 'en', 360)).toEqual([])
    await press(root, 'convert-my-beads-back')
    expect(byId(root, 'convert-my-beads')).toBeNull()
    expect(byId(root, 'convert-colors-back')).not.toBeNull()
  })

  for (const locale of ['en', 'longest'] as const) {
    it(`fits the Colors list, its Change picker and Lighting at 360 × 640 in ${locale}`, async () => {
      const root = await mountPhone(360, 640, locale)
      await openColorsList(root)
      expect(await fitProblems('Convert image page (colors list sheet)', locale, 360)).toEqual([])
      await dragGrab(root, -60)
      await press(root, 'found-color-remap')
      expect(await fitProblems('Convert image page (colors list sheet, Change open)', locale, 360)).toEqual([])
      await press(root, 'convert-sheet-close')
      await press(root, 'convert-setting-picture')
      await press(root, 'convert-lighting-more')
      expect(await fitProblems('Convert image page (lighting sheet)', locale, 360)).toEqual([])
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

describe('the Colors list, Clean up and Lighting on a portrait tablet and a phone on its side', () => {
  it('opens each as a card above the dock on a tablet, at most 360 tall, scrolling inside', async () => {
    const root = await mountPhone(820, 1180)
    expect(root.querySelector('.convert-page')!.getAttribute('data-layout')).toBe('tablet')
    for (const [setting, more, sheet] of [['colors-count', 'convert-colors-more', 'colors'], ['clean-up', undefined, 'clean-up'], ['picture', 'convert-lighting-more', 'lighting']] as const) {
      await press(root, `convert-setting-${setting}`)
      if (more) await press(root, more)
      const card = box(root, `convert-sheet-${sheet}`)
      expect(card.height, sheet).toBeLessThanOrEqual(360)
      expect(card.bottom, sheet).toBeLessThanOrEqual(box(root, 'convert-foot').top)
      expect(byId(root, 'convert-sheet-grab'), 'no grab zone').toBeNull()
      await press(root, 'convert-sheet-close')
    }
  })

  it('opens each in the column on a phone on its side, the beads staying', async () => {
    const root = await mountPhone(844, 390)
    const preview = root.querySelector('.convert-page__preview')!.getBoundingClientRect()
    for (const [setting, more, sheet] of [['colors-count', 'convert-colors-more', 'colors'], ['clean-up', undefined, 'clean-up'], ['picture', 'convert-lighting-more', 'lighting']] as const) {
      await press(root, `convert-setting-${setting}`)
      if (more) await press(root, more)
      expect(box(root, `convert-sheet-${sheet}`).left, sheet).toBeGreaterThanOrEqual(preview.right - 1)
      expect(root.querySelector('.convert-page__preview')!.getBoundingClientRect().width).toBe(preview.width)
      expect(await fitProblems(`Convert image page (${sheet} sheet, side)`, 'en', 844), sheet).toEqual([])
      await press(root, 'convert-sheet-close')
    }
  })
})
