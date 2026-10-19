import { describe, expect, it } from 'vitest'
import { PANELS, PANEL_OPENERS } from './panels'

describe('panel descriptors (ticket 510)', () => {
  it('builds the opener selector from every panel, the edit pencil included', () => {
    for (const testId of ['strip-menu', 'strip-project', 'strip-frame', 'frame-edit-toggle']) {
      expect(PANEL_OPENERS).toContain(`[data-testid="${testId}"]`)
    }
  })

  it('hangs each panel from its own opener', () => {
    for (const panel of Object.values(PANELS)) expect(panel.openers).toContain(panel.anchor)
  })
})
