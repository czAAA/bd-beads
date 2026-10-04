import type { Page } from '@playwright/test'

/** One piece of text that does not fit its box. */
export interface TextMisfit {
  /** What is wrong: the text pokes out of its box or the screen, the box is too small for its content, or a one-line control wraps. */
  problem: 'pokes-out' | 'cut-off' | 'wraps'
  /** A short description of the element: tag, test id and classes. */
  element: string
  text: string
  /** By how many pixels the text overflows (for `wraps`: how many extra lines). */
  pixels: number
  /** What the text is cut by or runs past, e.g. "the viewport" or "div.left-column". */
  against: string
}

/** Controls that are meant to be one line; running paragraphs are exempt from the wrap check. */
const ONE_LINE = 'button, a, label, th, h1, h2, h3, h4, h5, h6, summary, legend, [role="tab"], [role="menuitem"], [role="button"], .ui-pill, [data-one-line]'

/** One-line controls that are designed to take more lines than one, with how many: the Overview's tab line, the segmented control's two-line options. */
const MORE_LINES: [string, number][] = [
  ['.carousel__tab-line', 2],
  ['.segmented__option', 2],
  ['.bead-quantities__tooltip', 99],
  ['[role="tooltip"]', 99],
]

/** Boxes that hold artwork or the scrolling drawing, whose content is meant to be wider than the box. */
const CUT_OFF_BY_DESIGN = '[data-testid="app-canvas"], [data-testid="example-paper"]'

/**
 * Not checked: text the user typed (a long Project name legitimately ends in an ellipsis), and the Project drawing's
 * own furniture (the big backdrop word and the ruler numbers, which are meant to run past the edge of the scrolling canvas).
 */
const USER_TEXT = '[data-user-text], [data-testid="project-info"], [data-testid="phone-project-summary"], [data-testid="canvas-strip-title"], [data-testid="name-on-exports-value"], [data-testid="canvas-backdrop"], [data-testid="ruler-label"], .project-canvas__clip, .project-list__name'

/**
 * Measures, in the browser, every visible piece of text on the page against the box that is meant to hold it, and
 * returns the ones that do not fit (ticket 229). The three rules, in `measure` below:
 * - text partly outside an ancestor that clips it, its own box or the viewport (text wholly outside is off-screen on
 *   purpose: the closed drawer, carousel cards not yet scrolled to), or an element that clips or ellipsizes its content
 *   with more content than room;
 * - a one-line control (ONE_LINE) whose text breaks onto two or more lines.
 * Vertical clipping by a scroll container is ignored, since the column scrolls.
 */
export async function findTextMisfits(page: Page): Promise<TextMisfit[]> {
  await page.evaluate(async () => {
    await document.fonts.ready
    // Dialogs and sheets arrive with a short animation; what is measured is where they end up.
    await Promise.all(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? 0)).map((animation) => animation.finished.catch(() => undefined)))
  })
  return page.evaluate(
    ({ oneLine, userText, moreLines, cutOffByDesign }) => {
      const TOLERANCE = 1
      const misfits: TextMisfit[] = []
      const seen = new Set<string>()

      const describe = (element: Element): string => {
        const id = element.getAttribute('data-testid')
        const classes = [...element.classList].slice(0, 2).join('.')
        return `${element.tagName.toLowerCase()}${id ? `[${id}]` : ''}${classes ? `.${classes}` : ''}`
      }
      const add = (misfit: TextMisfit) => {
        const key = `${misfit.problem}|${misfit.element}|${misfit.text}`
        if (seen.has(key)) return
        seen.add(key)
        misfits.push(misfit)
      }
      const round = (value: number) => Math.round(value * 10) / 10

      const isHidden = (element: Element): boolean => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true
          if (Number(style.opacity) === 0) return true
          // Visually hidden text (the screen-reader-only heading): a clipped, tiny box.
          const box = node.getBoundingClientRect()
          if (style.position === 'absolute' && box.width <= 1 && box.height <= 1 && style.overflow !== 'visible') return true
        }
        return false
      }

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        const owner = node.parentElement
        if (!text || !owner) continue
        if (['SCRIPT', 'STYLE', 'OPTION', 'NOSCRIPT', 'TEXTAREA'].includes(owner.tagName)) continue
        if (owner.closest(userText) || isHidden(owner)) continue

        range.selectNodeContents(node)
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
        if (rects.length === 0) continue
        const box = {
          left: Math.min(...rects.map((rect) => rect.left)),
          right: Math.max(...rects.map((rect) => rect.right)),
          top: Math.min(...rects.map((rect) => rect.top)),
          bottom: Math.max(...rects.map((rect) => rect.bottom)),
        }
        const shown = text.length > 60 ? `${text.slice(0, 57)}...` : text

        // Past the viewport's edge, or past a clipping ancestor's: partly outside is a fault, wholly outside is off-screen.
        const clips: { name: string; left: number; right: number; top: number; bottom: number; vertical: boolean; scrolls: boolean; snaps: boolean }[] = []
        // An ancestor only clips what it contains: a fixed element (dialogs, sheets) is clipped by none of them, an
        // absolute one only by an ancestor at or above its containing block.
        let skipUnpositioned = false
        for (let ancestor: Element | null = owner; ancestor && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          if (style.position === 'fixed') break
          const containing = style.position !== 'static' || style.transform !== 'none'
          const considered = !skipUnpositioned || containing
          if (containing) skipUnpositioned = false
          if (style.position === 'absolute') skipUnpositioned = true
          const clipsX = style.overflowX !== 'visible'
          const clipsY = style.overflowY !== 'visible'
          if (!considered || (!clipsX && !clipsY)) continue
          const rect = ancestor.getBoundingClientRect()
          clips.push({
            name: describe(ancestor),
            left: rect.left + ancestor.clientLeft,
            right: rect.left + ancestor.clientLeft + ancestor.clientWidth,
            top: rect.top + ancestor.clientTop,
            bottom: rect.top + ancestor.clientTop + ancestor.clientHeight,
            // A scroll container scrolls vertically, so text cut at its bottom edge is not a fault; hidden is.
            vertical: clipsY && style.overflowY !== 'auto' && style.overflowY !== 'scroll',
            scrolls: style.overflowY === 'auto' || style.overflowY === 'scroll',
            // A strip that snaps as it scrolls sideways (the Overview carousel) is meant to have cards cut at its edge.
            snaps: (style.overflowX === 'auto' || style.overflowX === 'scroll') && style.scrollSnapType !== 'none',
          })
        }
        clips.push({ name: 'the viewport', left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight, vertical: false, scrolls: false, snaps: false })
        // Once a scroll container has had its say about vertical cuts, the boxes outside it don't (the text scrolls).
        let scrollsY = false
        for (const clip of clips) {
          if (clip.snaps) break
          if (scrollsY) clip.vertical = false
          if (clip.scrolls) scrollsY = true
          const sides: [string, number][] = [
            ['left', clip.left - box.left],
            ['right', box.right - clip.right],
          ]
          if (clip.vertical) {
            sides.push(['top', clip.top - box.top], ['bottom', box.bottom - clip.bottom])
          }
          const wholeX = box.right <= clip.left || box.left >= clip.right
          const wholeY = box.bottom <= clip.top || box.top >= clip.bottom
          if (clip.name === 'the viewport') {
            // Wholly off the screen is a fault too (a menu opened out of view), except in the closed drawer, which waits there on purpose.
            const drawer = owner.closest('[data-testid="drawer"]')?.getBoundingClientRect()
            if (wholeX && drawer && (drawer.right <= 0 || drawer.left >= window.innerWidth)) continue
          } else if (wholeX || (clip.vertical && wholeY)) continue
          const worst = Math.max(...sides.map(([, pixels]) => pixels))
          if (worst > TOLERANCE) {
            add({ problem: 'pokes-out', element: describe(owner), text: shown, pixels: round(worst), against: clip.name })
            break
          }
        }

        // Past its own box.
        const own = owner.getBoundingClientRect()
        const ownPast = Math.max(box.right - own.right, own.left - box.left)
        if (ownPast > TOLERANCE && getComputedStyle(owner).display !== 'inline') {
          add({ problem: 'pokes-out', element: describe(owner), text: shown, pixels: round(ownPast), against: 'its own box' })
        }

        // One-line controls that wrap.
        const control = owner.closest(oneLine)
        if (control && !control.closest('p, [data-wrap-ok]')) {
          const lines = new Set(rects.map((rect) => Math.round(rect.top / 4))).size
          const allowed = moreLines.find(([selector]) => owner.closest(selector))?.[1] ?? 1
          if (lines > allowed) {
            add({ problem: 'wraps', element: describe(owner), text: shown, pixels: lines - allowed, against: `${lines} lines, at most ${allowed}` })
          }
        }
      }

      // Boxes that clip or ellipsize their content with more content than room.
      for (const element of document.body.querySelectorAll('*')) {
        const style = getComputedStyle(element)
        const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip'
        const ellipsis = style.textOverflow === 'ellipsis'
        if (!clipsX && !ellipsis) continue
        if (!element.textContent?.trim() || element.closest(userText) || element.closest(cutOffByDesign) || isHidden(element)) continue
        const rect = element.getBoundingClientRect()
        if (rect.right <= 0 || rect.left >= window.innerWidth) continue
        const extra = element.scrollWidth - element.clientWidth
        if (extra > TOLERANCE) {
          const text = element.textContent.replace(/\s+/g, ' ').trim()
          add({ problem: 'cut-off', element: describe(element), text: text.length > 60 ? `${text.slice(0, 57)}...` : text, pixels: extra, against: 'its own width' })
        }
      }
      return misfits
    },
    { oneLine: ONE_LINE, userText: USER_TEXT, moreLines: MORE_LINES, cutOffByDesign: CUT_OFF_BY_DESIGN },
  )
}
