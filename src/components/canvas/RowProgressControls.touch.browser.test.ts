import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { createProject } from '../../domain/createProject'
import { mountAt } from '../../testUtils/browserFit'
import { frameIdIn } from '../../testUtils/frameId'
import { expectTouchScreen } from '../../testUtils/hitAreas'
import RowProgressControls from './RowProgressControls.vue'

const project = createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 12, height: 12, unit: 'beads' } })

describe('Row progress’s compact strip on a coarse pointer (ticket 1256)', () => {
  it('gives each button a hit area 44px tall and as wide as drawn, so no neighbors share a press', async () => {
    expectTouchScreen()
    const narrow = defineComponent({ setup: () => () => h('div', { style: { display: 'flex', width: '360px', padding: '40px 0' } }, [h(RowProgressControls, { project, frame: frameIdIn(project), compact: 'touch', drop: 1, shortCount: true, testid: 'strip' })]) })
    const { root } = await mountAt(narrow, {}, { locale: 'en', width: 390 })
    const buttons = [...root.querySelectorAll<HTMLElement>('button')]
    expect(buttons).toHaveLength(5)
    const touchTarget = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--touch-target')) * parseFloat(getComputedStyle(document.documentElement).fontSize)
    for (const button of buttons) {
      const area = getComputedStyle(button, '::before')
      const name = button.getAttribute('aria-label') ?? button.textContent!.trim()
      expect(parseFloat(area.height), name).toBeCloseTo(touchTarget, 0)
      // The area is measured inside the button's border.
      expect(parseFloat(area.width), name).toBeCloseTo(button.clientWidth, 0)
    }
  })
})
