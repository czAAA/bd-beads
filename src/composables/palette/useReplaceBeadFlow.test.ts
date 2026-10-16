import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, type Project } from '../../domain/project'
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

  it('ignores an empty pick and a pick with no Project open', () => {
    const open = setup()
    open.onRequestReplaceBead('')
    expect(open.replaceBeadPendingBead.value).toBeUndefined()

    const none = setup(null)
    none.onRequestReplaceBead(other.id)
    expect(none.replaceBeadPendingBead.value).toBeUndefined()
  })

  it('describes the swap with both Beads and the Estimated size', () => {
    const { replaceBeadConfirmMessage, onRequestReplaceBead } = setup()
    expect(replaceBeadConfirmMessage.value).toBe('')

    onRequestReplaceBead(other.id)

    expect(replaceBeadConfirmMessage.value).not.toContain('{')
    expect(replaceBeadConfirmMessage.value).not.toBe('')
  })

  it('cancelling closes the modal and changes nothing', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onCancelReplaceBead } = setup()
    onRequestReplaceBead(other.id)
    onCancelReplaceBead()
    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming swaps the Bead and nothing else, as one undo step that brings the old Bead back', () => {
    const { harness, replaceBeadPendingBead, onRequestReplaceBead, onConfirmReplaceBead } = setup()
    onRequestReplaceBead(other.id)
    onConfirmReplaceBead()

    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.project.beadId).toBe(other.id)
    expect(harness.project.beads).toBe(base.beads)
    expect(harness.project.rowProgress).toEqual(base.rowProgress)

    harness.history.onUndo()
    expect(harness.project.beadId).toBe(base.beadId)
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('is not refused by the Row progress lock, since it does not draw', () => {
    const { harness, onRequestReplaceBead, onConfirmReplaceBead } = setup(base)
    onRequestReplaceBead(other.id)
    onConfirmReplaceBead()
    expect(harness.project.beadId).toBe(other.id)
  })

  it('confirming with nothing pending does nothing', () => {
    const { harness, onConfirmReplaceBead } = setup()
    onConfirmReplaceBead()
    expect(harness.history.canUndo.value).toBe(false)
    expect(harness.replaceProject).not.toHaveBeenCalled()
  })
})
