import { describe, expect, it } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import DeleteProjectModal from './DeleteProjectModal.vue'

// Delete “{name}”? in Russian (ticket 0994, UX-094): Save Project file, Cancel and Delete Project don't fit one row of
// the dialog, so the side action keeps the first row and Cancel and Delete stay side by side on the next.
function top(testId: string): number {
  return Math.round(document.querySelector(`[data-testid="${testId}"]`)!.getBoundingClientRect().top)
}

describe('Delete “{name}”? in a browser (ticket 0994)', () => {
  it.each([1440, 768, 390])('keeps Cancel and Delete on one row in Russian at %ipx', async (width) => {
    const mounted = await mountAt(DeleteProjectModal, { name: 'Мотылёк' }, { locale: 'ru', width })
    const rows = { extra: top('confirm-modal-extra'), cancel: top('confirm-modal-cancel'), confirm: top('confirm-modal-confirm') }
    mounted.unmount()
    expect(rows.cancel).toBe(rows.confirm)
    expect(rows.extra).toBeLessThan(rows.cancel)
  })
})
