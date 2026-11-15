import { describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import { MIRROR_CONTROLS, roomyMirrorBar, roomySelectionBar, selectionBarArmed } from '../../testUtils/contextBarHosts'
import { byTestid, expectTouchScreen, hitAreaProblems } from '../../testUtils/hitAreas'
import { tokenPx } from '../../testUtils/tokenPx'

// On touch the bars' small controls take a finger (ticket 0962): every control answers across `touch-target` and no
// pad lies over another's drawing.
describe('ContextBar hit areas on touch (ticket 0962)', () => {
  it('gives every Mirror bar control a touch-target hit area that lies over no other', async () => {
    expectTouchScreen()
    const { root } = await mountAt(roomyMirrorBar, {}, { locale: 'en', width: 1280 })
    expect(root.querySelector('.context-bar--scrolls')).toBeNull()
    expect(hitAreaProblems(byTestid(root, MIRROR_CONTROLS), tokenPx(document.body, '--touch-target'))).toEqual([])
  })

  it('gives every Selection bar button a touch-target hit area that lies over no other', async () => {
    expectTouchScreen()
    const { root } = await mountAt(roomySelectionBar, {}, { locale: 'en', width: 1280 })
    await selectionBarArmed(root)
    const buttons = [...root.querySelectorAll<HTMLElement>('.context-bar__button')].filter((button) => button.offsetWidth > 0)
    expect(buttons.length).toBeGreaterThan(4)
    const controls = Object.fromEntries(buttons.map((button, index) => [button.dataset.testid ?? `button ${index}`, button]))
    expect(hitAreaProblems(controls, tokenPx(document.body, '--touch-target'))).toEqual([])
  })
})
