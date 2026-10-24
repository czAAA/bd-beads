import { nextTick } from 'vue'
import { findBead } from '../domain/beads'

type Wrapper = { get: (selector: string) => { trigger: (event: string) => Promise<unknown> }; find: (selector: string) => { exists: () => boolean } }

/** Picks a Bead in a Bead picker (ticket 535) the way a person does: opens it if collapsed, then Brand, Form factor and
 * Bead size in turn, stopping once a pick has closed it. `testid` is the picker's own (`bead-picker` in New Project). */
export async function chooseBead(wrapper: Wrapper, beadId: string, testid = 'bead-picker'): Promise<void> {
  const bead = findBead(beadId)
  if (!bead) throw new Error(`no Bead ${beadId}`)
  if (!wrapper.find(`[data-testid="${testid}-steps"]`).exists()) {
    await wrapper.get(`[data-testid="${testid}-toggle"]`).trigger('click')
  }
  const steps: [string, string][] = [
    ['brand', bead.brand.id],
    ['form-factor', bead.formFactor.id],
    ['size', bead.id],
  ]
  for (const [step, id] of steps) {
    if (!wrapper.find(`[data-testid="${testid}-steps"]`).exists()) return // a step with one choice took it and closed
    await wrapper.get(`[data-testid="${testid}-${step}"]`).trigger('click')
    await nextTick()
    await wrapper.get(`[data-testid="${testid}-${step}-${id}"]`).trigger('click')
    await nextTick()
  }
}
