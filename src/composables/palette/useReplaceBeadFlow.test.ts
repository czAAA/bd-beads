import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { replaceBead, resolveProjectBead } from '../../domain/projectBead'
import { setPalette } from '../../domain/paletteEdits'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useReplaceBeadFlow } from './useReplaceBeadFlow'
import { canvasOf, frameOf } from '../../domain/layerRecord'
import { withLayers } from '../../testUtils/layerFields'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const other = BEAD_CATALOG.find((bead) => bead.id !== canvasOf(base).beadId)!
const noFrame = withLayers(base, { frame: undefined })

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
  it('offers each layer every catalog Bead but its own', () => {
    const differing = replaceBead(base, other, undefined, 'canvas')
    const { replaceBeadChoices } = setup(differing)
    expect(replaceBeadChoices.value.canvas.candidates.map((bead) => bead.id)).not.toContain(other.id)
    expect(replaceBeadChoices.value.frame.candidates.map((bead) => bead.id)).not.toContain(canvasOf(base).beadId)
    expect(replaceBeadChoices.value.frame.candidates).toHaveLength(BEAD_CATALOG.length - 1)
    expect(setup(null).replaceBeadChoices.value.canvas.candidates).toEqual([])
    expect(setup(noFrame).replaceBeadChoices.value.frame.candidates).toEqual([])
  })

  it('opens the confirmation for a picked Bead', () => {
    const { replaceBeadPendingBead, onRequestReplaceBead } = setup()

    onRequestReplaceBead('frame', other.id)

    expect(replaceBeadPendingBead.value?.id).toBe(other.id)
  })

  it('ignores a pick with no Project open', () => {
    const none = setup(null)
    none.onRequestReplaceBead('canvas', other.id)
    expect(none.replaceBeadPendingBead.value).toBeUndefined()
  })

  it('cancelling closes the modal and changes nothing', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onCancelReplaceBead } = setup()
    onRequestReplaceBead('frame', other.id)
    onCancelReplaceBead()
    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming with nothing pending does nothing', () => {
    const { harness, onConfirmReplaceBead } = setup()
    onConfirmReplaceBead()
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })
})

describe('each layer’s panel replaces its own Bead (ticket 0687)', () => {
  const tall = createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 15, height: 30, unit: 'mm' } }) // 10x20

  it("tells the Frame's Bead sizes and the Frame's Estimated size with the new Bead and the old, in mm however large", () => {
    const { replaceBeadConfirmMessage, onRequestReplaceBead } = setup(tall)
    expect(replaceBeadConfirmMessage.value).toBe('')

    onRequestReplaceBead('frame', 'toho/round/11-0')

    // The same 10x20 Frame at Round (1.65 x 2.2mm): 16.5 x 44mm.
    expect(replaceBeadConfirmMessage.value).toBe(
      "The Frame's Bead changes from 1.5 × 1.5 mm to 1.7 × 2.2 mm, so the Frame will be about 16.5 × 44 mm instead of 15 × 30 mm. It will look different in proportion, but your design and its bead count stay exactly the same. You can undo this.",
    )
  })

  it("tells only the Canvas's Bead sizes for the Canvas, with or without a Frame", () => {
    const expected = "The Canvas's Bead changes from 1.5 × 1.5 mm to 1.7 × 2.2 mm. The Canvas will look different in proportion, but your design and its bead count stay exactly the same. You can undo this."
    for (const project of [tall, withLayers(tall, { frame: undefined })]) {
      const { replaceBeadConfirmMessage, onRequestReplaceBead } = setup(project)
      onRequestReplaceBead('canvas', 'toho/round/11-0')
      expect(replaceBeadConfirmMessage.value).toBe(expected)
    }
  })

  it('confirming replaces the Frame’s Bead as one undo step that brings the old Bead back, the Canvas’s staying', async () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onConfirmReplaceBead } = setup()
    onRequestReplaceBead('frame', other.id)
    await onConfirmReplaceBead()

    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(frameOf(harness.project)!.beadId).toBe(other.id)
    expect(canvasOf(harness.project).beadId).toBe(canvasOf(base).beadId)

    harness.history.onUndo()
    expect(frameOf(harness.project)!.beadId).toBe(canvasOf(base).beadId)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it("replaces the Canvas's Bead under a Frame, the Frame's and the Palette staying, in one Undo step", async () => {
    const { harness, onRequestReplaceBead, onConfirmReplaceBead } = setup()
    onRequestReplaceBead('canvas', other.id)
    await onConfirmReplaceBead()
    expect(canvasOf(harness.project).beadId).toBe(other.id)
    expect(frameOf(harness.project)!.beadId).toBe(canvasOf(base).beadId)
    expect(harness.project.palette).toBe(base.palette)
    harness.history.onUndo()
    expect(canvasOf(harness.project).beadId).toBe(canvasOf(base).beadId)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it("replaces the Canvas's Bead on a Project with no Frame", async () => {
    const { harness, onRequestReplaceBead, onConfirmReplaceBead } = setup(noFrame)
    onRequestReplaceBead('canvas', other.id)
    await onConfirmReplaceBead()
    expect(canvasOf(harness.project).beadId).toBe(other.id)
  })
})

describe('a layer whose Bead the catalog has changed (ticket 534, ADR 0072)', () => {
  const current = findBead(canvasOf(base).beadId)!
  const older = withLayers(base, { bead: { ...current, widthMm: current.widthMm + 0.2 } })

  it('is not out of date when its copy equals the catalog’s, even if only a name differs', () => {
    const renamed = withLayers(base, { bead: { ...current, brand: { ...current.brand, name: 'Other name' } } })
    expect(setup(base).replaceBeadChoices.value.frame.outdated).toBe(false)
    expect(setup(renamed).replaceBeadChoices.value.frame.outdated).toBe(false)
  })

  it('offers the catalog’s current Bead of the same id when they differ', () => {
    const { frame } = setup(older).replaceBeadChoices.value
    expect(frame.outdated).toBe(true)
    expect(frame.candidates).toContain(current)
  })

  it('is not out of date for a Bead the catalog does not offer', () => {
    const gone = withLayers(base, { beadId: 'brand/gone/1', bead: { ...current, id: 'brand/gone/1' } })
    const { frame } = setup(gone).replaceBeadChoices.value
    expect(frame.outdated).toBe(false)
    expect(frame.candidates).toHaveLength(BEAD_CATALOG.length)
  })

  it('replaces to the catalog’s current Bead as an ordinary Replace Bead: sizes before and after, one Undo step', async () => {
    const { harness, replaceBeadConfirmMessage, onRequestReplaceBead, onConfirmReplaceBead } = setup(older)
    onRequestReplaceBead('frame', current.id)
    expect(replaceBeadConfirmMessage.value).not.toBe('')

    await onConfirmReplaceBead()

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
