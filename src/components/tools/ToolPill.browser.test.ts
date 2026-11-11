import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt, resizeTo } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import ToolPill from './ToolPill.vue'

// On a phone the Tool pill is longer than its edge (ticket 0837, F-06-01): Paint stays whole at its start and the colour
// control at its end, the tools between them scroll and the end where they are cut fades. Wider screens are unchanged.

const props = { activeTool: 'paint', position: 'bottom', recentsInPill: ['#1f77b4', '#2ca02c', '#ff7f0e'], popoverOpen: false, hasClipboard: true, colorHex: '#e63746', colorName: 'Red' }

const get = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!

/** Whether `inner` lies whole inside `outer` and the screen, a pixel of rounding allowed. */
function whole(inner: HTMLElement, outer: HTMLElement): boolean {
  const a = inner.getBoundingClientRect()
  const b = outer.getBoundingClientRect()
  return a.width > 0 && a.left >= Math.max(b.left, 0) - 1 && a.right <= Math.min(b.right, window.innerWidth) + 1
}

/** Whether the element's own centre is what a tap there lands on. */
function tappable(el: HTMLElement): boolean {
  const box = el.getBoundingClientRect()
  return el.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
}

describe('ToolPill on a phone (ticket 0837)', () => {
  it.each([390, 320])('keeps Paint and the colour control whole and tappable at %ipx, fades the cut end and scrolls the tools between', async (width) => {
    const { root } = await mountAt(ToolPill, props, { locale: 'en', width })
    const pill = get(root, 'tool-pill')
    const tools = get(root, 'tool-pill-tools')
    for (const id of ['pill-tool-paint', 'pill-color']) {
      expect(whole(get(root, id), pill), `${id} whole`).toBe(true)
      expect(tappable(get(root, id)), `${id} tappable`).toBe(true)
    }
    expect(whole(pill, document.body), 'the pill on the screen').toBe(true)
    // The recents give way first; the tools still overflow, so they scroll and their cut end fades.
    expect(root.querySelector('[data-testid="pill-recent"]')).toBeNull()
    expect(tools.scrollWidth).toBeGreaterThan(tools.clientWidth)
    expect(tools.classList).toContain('tool-pill__tools--cut-end')
    expect(getComputedStyle(tools).maskImage).not.toBe('none')

    tools.scrollLeft = tools.scrollWidth
    await settleForMeasuring()
    expect(tools.classList).toContain('tool-pill__tools--cut-start')
    expect(tools.classList).not.toContain('tool-pill__tools--cut-end')
    expect(whole(get(root, 'pill-tool-paste'), tools), 'the last tool scrolled into view').toBe(true)
    expect(whole(get(root, 'pill-tool-paint'), pill) && whole(get(root, 'pill-color'), pill), 'the pinned ends stay put').toBe(true)
  })

  it('is unchanged on tablets and laptops: nothing cut, nothing faded, the recents shown', async () => {
    const { root } = await mountAt(ToolPill, props, { locale: 'en', width: 1280 })
    for (const width of [1280, 1024, 768]) {
      await resizeTo(width)
      const tools = get(root, 'tool-pill-tools')
      expect(tools.scrollWidth, `${width}px`).toBeLessThanOrEqual(tools.clientWidth + 1)
      expect(getComputedStyle(tools).maskImage, `${width}px`).toBe('none')
      expect(root.querySelectorAll('[data-testid="pill-recent"]'), `${width}px`).toHaveLength(3)
    }
  })

  it('docked to a side on a phone held sideways, keeps Paint and the colour control whole and fades the tools\' cut end', async () => {
    const { root } = await mountAt(ToolPill, { ...props, position: 'right' }, { locale: 'en', width: 844 })
    await page.viewport(844, 390)
    await settleForMeasuring()
    const pill = get(root, 'tool-pill')
    const tools = get(root, 'tool-pill-tools')
    for (const id of ['pill-tool-paint', 'pill-color']) {
      const [a, b] = [get(root, id).getBoundingClientRect(), pill.getBoundingClientRect()]
      expect(a.top >= b.top - 1 && a.bottom <= Math.min(b.bottom, window.innerHeight) + 1, `${id} whole`).toBe(true)
    }
    expect(tools.scrollHeight).toBeGreaterThan(tools.clientHeight)
    // Top to bottom, the gradient's default, which the computed value leaves unsaid.
    expect(getComputedStyle(tools).maskImage).toMatch(/^linear-gradient\(rgba/)
  })
})
