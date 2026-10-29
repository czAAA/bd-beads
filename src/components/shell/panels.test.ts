import { describe, expect, it } from 'vitest'
import { PANELS, PANEL_OPENERS } from './panels'

describe('panel descriptors (ticket 510)', () => {
  it('builds the opener selector from every panel opener, not the edit pencil', () => {
    for (const testId of ['strip-menu', 'strip-project', 'strip-frame', 'strip-export']) {
      expect(PANEL_OPENERS).toContain(`[data-testid="${testId}"]`)
    }
    expect(PANEL_OPENERS).not.toContain('frame-edit-toggle')
  })

  it('hangs each panel from its own opener', () => {
    for (const panel of Object.values(PANELS)) expect(panel.openers).toContain(panel.anchor)
  })
})
