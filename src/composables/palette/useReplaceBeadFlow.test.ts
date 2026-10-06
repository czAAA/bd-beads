import { describe, expect, it } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject, setRowProgressEnabled, type Project } from '../../domain/project'
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

/** A stand-in for the select: the flow reads the pick off it and puts it back on the placeholder. */
function selectWith(value: string) {
  return { value } as HTMLSelectElement
}

describe('useReplaceBeadFlow', () => {
  it('offers every catalog Bead but the Project’s own', () => {
    const { replaceBeadCandidates } = setup()
    expect(replaceBeadCandidates.value.map((bead) => bead.id)).not.toContain(base.beadId)
    expect(replaceBeadCandidates.value).toHaveLength(BEAD_CATALOG.length - 1)
    expect(setup(null).replaceBeadCandidates.value).toEqual([])
  })

  it('opens the confirmation for a picked Bead and puts the select back on its placeholder', () => {
    const { replaceBeadPendingBead, onPickReplaceBead } = setup()
    const select = selectWith(other.id)

    onPickReplaceBead(select)

    expect(select.value).toBe('')
    expect(replaceBeadPendingBead.value?.id).toBe(other.id)
  })

  it('ignores the placeholder pick and a pick with no Project open', () => {
    const open = setup()
    open.onPickReplaceBead(selectWith(''))
    expect(open.replaceBeadPendingBead.value).toBeUndefined()

    const none = setup(null)
    none.onPickReplaceBead(selectWith(other.id))
    expect(none.replaceBeadPendingBead.value).toBeUndefined()
  })

  it('describes the swap with both Beads and the Estimated size', () => {
    const { replaceBeadConfirmMessage, onPickReplaceBead } = setup()
    expect(replaceBeadConfirmMessage.value).toBe('')

    onPickReplaceBead(selectWith(other.id))

    expect(replaceBeadConfirmMessage.value).not.toContain('{')
    expect(replaceBeadConfirmMessage.value).not.toBe('')
  })

  it('cancelling closes the modal and changes nothing', () => {
    const { harness, replaceBeadPendingBead, onPickReplaceBead, onCancelReplaceBead } = setup()
    onPickReplaceBead(selectWith(other.id))
    onCancelReplaceBead()
    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(harness.replaceProject).not.toHaveBeenCalled()
    expect(harness.history.canUndo.value).toBe(false)
  })

  it('confirming swaps the Bead and nothing else, as one undo step that brings the old Bead back', () => {
    const { harness, replaceBeadPendingBead, onPickReplaceBead, onConfirmReplaceBead } = setup()
    onPickReplaceBead(selectWith(other.id))
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
    const { harness, onPickReplaceBead, onConfirmReplaceBead } = setup(setRowProgressEnabled(base, true))
    onPickReplaceBead(selectWith(other.id))
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
