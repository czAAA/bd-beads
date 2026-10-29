import { describe, expect, it } from 'vitest'
import { PANELS, PANEL_OPENERS } from './panels'

describe('panel descriptors (ticket 510)', () => {
  it('builds the opener selector from every panel opener, not the edit pencil', () => {
    for (const testId of ['strip-menu', 'strip-project', 'strip-frame', 'strip-export']) {
      expect(PANEL_OPENERS).toContain(`[data-testid="${testId}"]`)
    }
    expect(PANEL_OPENERS).not.toContain('frame-edit-toggle')
  })

  it('lines the Export panel up with the right edge of its button, in the strip\'s right corner, and the others with the left (ticket 0652)', () => {
    expect(PANELS.export).toMatchObject({ anchor: 'strip-export', align: 'end', width: 'var(--panel-width-small)' })
    expect([PANELS.menu.align, PANELS.project.align, PANELS.frame.align]).toEqual([undefined, undefined, undefined])
  })

  it('hangs each panel from its own opener', () => {
    for (const panel of Object.values(PANELS)) expect(panel.openers).toContain(panel.anchor)
  })
})
