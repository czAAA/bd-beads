import { describe, expect, it } from 'vitest'
import { useDialogs } from './useDialogs'

describe('useDialogs', () => {
  it('shows no dialog at first', () => {
    expect(useDialogs().open.value).toBeUndefined()
  })

  it('opens a dialog that asks about nothing when its flag is raised, and closes it when lowered', () => {
    const dialogs = useDialogs()
    const deleteAll = dialogs.flag('delete-all')
    deleteAll.value = true
    expect(dialogs.open.value).toBe('delete-all')
    expect(deleteAll.value).toBe(true)

    deleteAll.value = false
    expect(dialogs.open.value).toBeUndefined()
    expect(deleteAll.value).toBe(false)
  })

  it('holds what a dialog asks about while it is open, and closes when that is cleared', () => {
    const dialogs = useDialogs()
    const removeColor = dialogs.question<string>('remove-color')
    removeColor.value = 'c1'
    expect(dialogs.open.value).toBe('remove-color')
    expect(removeColor.value).toBe('c1')

    removeColor.value = 'c2'
    expect(removeColor.value).toBe('c2')

    removeColor.value = undefined
    expect(dialogs.open.value).toBeUndefined()
    expect(removeColor.value).toBeUndefined()
  })

  it('keeps a dialog asked while another shows waiting behind it, still pending for its flow, until that one closes', () => {
    const dialogs = useDialogs()
    const deleteAll = dialogs.flag('delete-all')
    const keepNote = dialogs.flag('keep-note')
    deleteAll.value = true
    keepNote.value = true
    expect(dialogs.open.value).toBe('delete-all')
    expect(keepNote.value).toBe(true)

    deleteAll.value = false
    expect(dialogs.open.value).toBe('keep-note')
  })

  it('drops a waiting dialog that is closed before its turn, leaving the one showing', () => {
    const dialogs = useDialogs()
    const deleteAll = dialogs.flag('delete-all')
    const keepNote = dialogs.flag('keep-note')
    deleteAll.value = true
    keepNote.value = true
    keepNote.value = false
    expect(dialogs.open.value).toBe('delete-all')

    deleteAll.value = false
    expect(dialogs.open.value).toBeUndefined()
  })
})
