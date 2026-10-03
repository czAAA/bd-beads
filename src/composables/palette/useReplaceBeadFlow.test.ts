import { describe, expect, it, vi } from 'vitest'
import { BEAD_CATALOG } from '../../domain/beads'
import { createPattern, setRowProgressEnabled, type Pattern } from '../../domain/pattern'
import { en } from '../../i18n/en'
import { useReplaceBeadFlow } from './useReplaceBeadFlow'

const base = createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 3, height: 3, unit: 'beads' } })
const other = BEAD_CATALOG.find((bead) => bead.id !== base.beadId)!

function setup(pattern: Pattern | null = base) {
  const deps = {
    currentPattern: () => pattern ?? undefined,
    replacePattern: vi.fn(),
    recordHistory: vi.fn(),
    messages: () => en,
    locale: () => 'en' as const,
  }
  return { deps, ...useReplaceBeadFlow(deps) }
}

/** A stand-in for the select: the flow reads the pick off it and puts it back on the placeholder. */
function selectWith(value: string) {
  return { value } as HTMLSelectElement
}

describe('useReplaceBeadFlow', () => {
  it('offers every catalog Bead but the Pattern’s own', () => {
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

  it('ignores the placeholder pick and a pick with no Pattern open', () => {
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
    const { deps, replaceBeadPendingBead, onPickReplaceBead, onCancelReplaceBead } = setup()
    onPickReplaceBead(selectWith(other.id))
    onCancelReplaceBead()
    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(deps.replacePattern).not.toHaveBeenCalled()
    expect(deps.recordHistory).not.toHaveBeenCalled()
  })

  it('confirming swaps the Bead and nothing else, as one undo step carrying the grid and the old Bead', () => {
    const { deps, replaceBeadPendingBead, onPickReplaceBead, onConfirmReplaceBead } = setup()
    onPickReplaceBead(selectWith(other.id))
    onConfirmReplaceBead()

    expect(replaceBeadPendingBead.value).toBeUndefined()
    expect(deps.recordHistory).toHaveBeenCalledTimes(1)
    expect(deps.recordHistory).toHaveBeenCalledWith({ beads: base.beads, beadId: base.beadId })
    const replaced = deps.replacePattern.mock.calls[0]![0] as Pattern
    expect(replaced.beadId).toBe(other.id)
    expect(replaced.beads).toBe(base.beads)
    expect(replaced.rowProgress).toEqual(base.rowProgress)
  })

  it('is not refused by the Row progress lock, since it does not draw', () => {
    const { deps, onPickReplaceBead, onConfirmReplaceBead } = setup(setRowProgressEnabled(base, true))
    onPickReplaceBead(selectWith(other.id))
    onConfirmReplaceBead()
    expect(deps.replacePattern).toHaveBeenCalledTimes(1)
  })

  it('confirming with nothing pending does nothing', () => {
    const { deps, onConfirmReplaceBead } = setup()
    onConfirmReplaceBead()
    expect(deps.recordHistory).not.toHaveBeenCalled()
    expect(deps.replacePattern).not.toHaveBeenCalled()
  })
})
