import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG, findBead } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { resolveProjectBead } from '../../domain/projectBead'
import { setPalette } from '../../domain/paletteEdits'
import type { Project } from '../../domain/project'
import { en } from '../../i18n/en'
import { editHarness } from '../../testUtils/editHarness'
import { useReplaceBeadFlow } from './useReplaceBeadFlow'

const base = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const other = BEAD_CATALOG.find((bead) => bead.id !== base.beadId)!

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
  it('offers every catalog Bead but the Project’s own', () => {
    const { replaceBeadCandidates } = setup()
    expect(replaceBeadCandidates.value.map((bead) => bead.id)).not.toContain(base.beadId)
    expect(replaceBeadCandidates.value).toHaveLength(BEAD_CATALOG.length - 1)
    expect(setup(null).replaceBeadCandidates.value).toEqual([])
  })

  it('opens the confirmation for a picked Bead', () => {
    const { replaceBeadPendingBead, onRequestReplaceBead } = setup()

    onRequestReplaceBead(other.id)

    expect(replaceBeadPendingBead.value?.id).toBe(other.id)
  })

  it('ignores a pick with no Project open', () => {
    const none = setup(null)
    none.onRequestReplaceBead(other.id)
    expect(none.replaceBeadPendingBead.value).toBeUndefined()
  })

  it('describes the swap with the new Bead and its Estimated size before the current one, as the screen shows the Project', () => {
    const tall = createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 15, height: 30, unit: 'mm' } }) // 10x20
    const { replaceBeadConfirmMessage, onRequestReplaceBead } = setup(tall)
    expect(replaceBeadConfirmMessage.value).toBe('')

    onRequestReplaceBead('toho/round/11-0')

    // The same 10x20 grid at Round (1.65 x 2.2mm): 16.5 x 44mm.
    expect(replaceBeadConfirmMessage.value).toContain('With TOHO Round 11/0, this Project will be about 1.7 × 4.4 cm instead of 1.5 × 3.0 cm.')

    const turned = setup({ ...tall, rotation: 90 })
    turned.onRequestReplaceBead('toho/round/11-0')
    expect(turned.replaceBeadConfirmMessage.value).toContain('about 4.4 × 1.7 cm instead of 3.0 × 1.5 cm')
  })

  it('cancelling closes the modal and changes nothing', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onCancelReplaceBead } = setup()
    onRequestReplaceBead(other.id)
    onCancelReplaceBead()
    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming swaps the Bead as one undo step that brings the old Bead back', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onConfirmReplaceBead } = setup()
    onRequestReplaceBead(other.id)
    onConfirmReplaceBead()

    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.project.beadId).toBe(other.id)

    harness.history.onUndo()
    expect(harness.project.beadId).toBe(base.beadId)
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
  const current = findBead(base.beadId)!
  const older = { ...base, bead: { ...current, widthMm: current.widthMm + 0.2 } }

  it('shows no postfix entry when its copy equals the catalog’s, even if only a name differs', () => {
    const renamed = { ...base, bead: { ...current, brand: { ...current.brand, name: 'Other name' } } }
    expect(setup(base).replaceBeadOutdated.value).toBeUndefined()
    expect(setup(renamed).replaceBeadOutdated.value).toBeUndefined()
  })

  it('shows the copy beside the catalog’s current Bead of the same id when they differ', () => {
    const { replaceBeadOutdated, replaceBeadCandidates } = setup(older)
    expect(replaceBeadOutdated.value).toEqual(older.bead)
    expect(replaceBeadCandidates.value.map((bead) => bead.id)).toContain(current.id)
  })

  it('shows no copy for a Bead the catalog does not offer', () => {
    const gone = { ...base, beadId: 'brand/gone/1', bead: { ...current, id: 'brand/gone/1' } }
    const { replaceBeadOutdated, replaceBeadCandidates } = setup(gone)
    expect(replaceBeadOutdated.value).toBeUndefined()
    expect(replaceBeadCandidates.value).toHaveLength(BEAD_CATALOG.length)
  })

  it('replaces to the catalog’s current Bead as an ordinary Replace Bead: sizes before and after, one Undo step', () => {
    const { harness, replaceBeadConfirmMessage, onRequestReplaceBead, onConfirmReplaceBead } = setup(older)
    onRequestReplaceBead(current.id)
    expect(replaceBeadConfirmMessage.value).not.toBe('')

    onConfirmReplaceBead()

    expect(resolveProjectBead(harness.currentProject()!)).toEqual(current)
    expect(harness.history.canUndo.value).toBe(true)
    harness.history.onUndo()
    expect(resolveProjectBead(harness.currentProject()!)).toEqual(older.bead)
    expect(harness.history.canUndo.value).toBe(false)
  })
})

describe('Replace Bead with coded swatches (ticket 0538)', () => {
  it('loads the new Bead\'s catalog and keeps the codes it lists, in one Undo step', async () => {
    const delica = findBead('miyuki/delica/11-0')!
    const start = createProject({ technique: 'loom', beadId: delica.id, size: { width: 3, height: 3, unit: 'beads' } })
    const coded = setPalette(start, [...start.palette, 'added-123456'], { '#123456': 'DB1' })
    const { harness, onRequestReplaceBead, onConfirmReplaceBead } = setup(coded)
    onRequestReplaceBead('toho/round/11-0')
    await onConfirmReplaceBead()
    expect(harness.project.paletteCodes).toBeUndefined()
    harness.history.onUndo()
    expect(harness.project.paletteCodes).toEqual({ '#123456': 'DB1' })
    expect(harness.project.beadId).toBe(delica.id)
  })
})
