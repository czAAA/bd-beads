import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { resolveProjectBead } from '../../domain/projectBead'
import { setPalette } from '../../domain/paletteEdits'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useReplaceBeadFlow } from './useReplaceBeadFlow'
import { canvasOf, frameOf } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const other = BEAD_CATALOG.find((bead) => bead.id !== canvasOf(base).beadId)!

function setup(project: Project | null = base) {
  const harness = editHarness(project ?? undefined)
  const deps = {
    currentProject: harness.currentProject,
    edit: harness.edit,
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, harness, ...useReplaceBeadFlow(deps) }
}

describe('useReplaceBeadFlow', () => {
  it('opens the confirmation for a picked Bead', () => {
    const { replaceBeadPendingBead, onRequestReplaceBead } = setup()

    onRequestReplaceBead('frame', other.id)

    expect(replaceBeadPendingBead.value?.id).toBe(other.id)
  })

  it('ignores a pick with no Project open', () => {
    const none = setup(null)
    none.onRequestReplaceBead('frame', other.id)
    expect(none.replaceBeadPendingBead.value).toBeUndefined()
  })

  it('describes the swap with the new Bead and its Estimated size before the current one, as the screen shows the Project', () => {
    const tall = createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 15, height: 30, unit: 'mm' } }) // 10x20
    const { replaceBeadConfirmMessage, onRequestReplaceBead } = setup(tall)
    expect(replaceBeadConfirmMessage.value).toBe('')

    onRequestReplaceBead('frame', 'toho/round/11-0')

    // The same 10x20 grid at Round (1.65 x 2.2mm): 16.5 x 44mm.
    expect(replaceBeadConfirmMessage.value).toContain('With TOHO Round 11/0, this Project will be about 1.7 × 4.4 cm instead of 1.5 × 3.0 cm.')

    const turned = setup(withLayers(tall, { orientation: 90 }))
    turned.onRequestReplaceBead('frame', 'toho/round/11-0')
    expect(turned.replaceBeadConfirmMessage.value).toContain('about 4.4 × 1.7 cm instead of 3.0 × 1.5 cm')
  })

  it('cancelling closes the modal and changes nothing', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onCancelReplaceBead } = setup()
    onRequestReplaceBead('frame', other.id)
    onCancelReplaceBead()
    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming swaps the Bead as one undo step that brings the old Bead back', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onConfirmReplaceBead } = setup()
    onRequestReplaceBead('frame', other.id)
    onConfirmReplaceBead()

    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(frameOf(harness.project)!.beadId).toBe(other.id)

    harness.history.onUndo()
    expect(frameOf(harness.project)!.beadId).toBe(canvasOf(base).beadId)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming with nothing pending does nothing', () => {
    const { harness, onConfirmReplaceBead } = setup()
    onConfirmReplaceBead()
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })
})

describe('a Project whose Bead the catalog has changed (ticket 534, ADR 0072)', () => {
  const current = findBead(canvasOf(base).beadId)!
  const older = withLayers(base, { bead: { ...current, widthMm: current.widthMm + 0.2 } })

  it('replaces to the catalog’s current Bead as an ordinary Replace Bead: sizes before and after, one Undo step', () => {
    const { harness, replaceBeadConfirmMessage, onRequestReplaceBead, onConfirmReplaceBead } = setup(older)
    onRequestReplaceBead('frame', current.id)
    expect(replaceBeadConfirmMessage.value).not.toBe('')

    onConfirmReplaceBead()

    expect(resolveProjectBead(harness.currentProject()!)).toEqual(current)
    expect(harness.history.canUndo.value).toBe(true)
    harness.history.onUndo()
    expect(resolveProjectBead(harness.currentProject()!)).toEqual(canvasOf(older).bead)
    expect(harness.history.canUndo.value).toBe(false)
  })
})

describe('Replace Bead with coded swatches (ticket 0538)', () => {
  it('loads the new Bead\'s catalog and keeps the codes it lists, in one Undo step', async () => {
    const delica = findBead('miyuki/delica/11-0')!
    const start = createProject({ technique: 'loom', beadId: delica.id, size: { width: 3, height: 3, unit: 'beads' } })
    const coded = setPalette(start, [...start.palette, 'added-123456'], { '#123456': 'DB1' })
    const { harness, onRequestReplaceBead, onConfirmReplaceBead } = setup(coded)
    onRequestReplaceBead('frame', 'toho/round/11-0')
    await onConfirmReplaceBead()
    expect(harness.project.paletteCodes).toBeUndefined()
    harness.history.onUndo()
    expect(harness.project.paletteCodes).toEqual({ '#123456': 'DB1' })
    expect(canvasOf(harness.project).beadId).toBe(delica.id)
  })
})

describe('Replace Bead on the layer whose Layer settings asked (tickets 0665, 0670, ADR 0079)', () => {
  it("replaces the Canvas's Bead under a Frame, the Frame's and the Palette staying, in one Undo step", async () => {
    const { harness, replaceBeadConfirmMessage, onRequestReplaceBead, onConfirmReplaceBead } = setup()
    onRequestReplaceBead('canvas', other.id)
    expect(replaceBeadConfirmMessage.value).toContain('the Canvas is drawn at that bead')
    await onConfirmReplaceBead()
    expect(canvasOf(harness.project).beadId).toBe(other.id)
    expect(frameOf(harness.project)!.beadId).toBe(canvasOf(base).beadId)
    expect(harness.project.palette).toBe(base.palette)
    harness.history.onUndo()
    expect(canvasOf(harness.project).beadId).toBe(canvasOf(base).beadId)
  })

  it("replaces the Canvas's Bead on a Project with no Frame, with its Estimated size", async () => {
    const { harness, replaceBeadConfirmMessage, onRequestReplaceBead, onConfirmReplaceBead } = setup(withLayers(base, { frame: undefined }))
    onRequestReplaceBead('canvas', other.id)
    expect(replaceBeadConfirmMessage.value).not.toContain('the Canvas is drawn at that bead')
    await onConfirmReplaceBead()
    expect(canvasOf(harness.project).beadId).toBe(other.id)
  })
})
