import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPattern } from '../domain/pattern'
import { patternFileName } from '../domain/patternFile'
import { en } from '../i18n/en'
import { useSaveFlow } from './useSaveFlow'

/** A fake for the file hand-over, so nothing here touches the DOM. */
const downloadFile = vi.fn()

const pattern = createPattern({
  technique: 'loom',
  beadId: 'toho-cube-1.5mm',
  size: { width: 3, height: 3, unit: 'beads' },
})

function setup(options: { open?: boolean; saved?: boolean } = {}) {
  const { open = true, saved = true } = options
  const deps = {
    currentPattern: () => (open ? pattern : undefined),
    saveNow: vi.fn(() => saved),
    messages: () => en,
    showToast: vi.fn(),
    dismissToast: vi.fn(),
    downloadFile,
  }
  return { deps, ...useSaveFlow(deps) }
}

describe('useSaveFlow', () => {
  beforeEach(() => downloadFile.mockClear())

  it('writes, hands over the Pattern file and confirms once the write landed', () => {
    const { deps, onSave } = setup()
    onSave()
    expect(deps.saveNow).toHaveBeenCalled()
    expect(downloadFile).toHaveBeenCalledWith(patternFileName(pattern), expect.any(String))
    expect(deps.showToast).toHaveBeenCalledWith('save-confirmation', en.tools.savedConfirmation)
  })

  it('starts the confirmation over on a second press', () => {
    const { deps, onSave } = setup()
    onSave()
    onSave()
    expect(deps.dismissToast).toHaveBeenCalledTimes(2)
    expect(deps.dismissToast).toHaveBeenNthCalledWith(2, 'save-confirmation')
    expect(deps.showToast).toHaveBeenCalledTimes(2)
  })

  it('still hands over the file but does not claim "Saved" when the device refused the write', () => {
    const { deps, onSave } = setup({ saved: false })
    onSave()
    expect(downloadFile).toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('does nothing with no Pattern open', () => {
    const { deps, onSave } = setup({ open: false })
    onSave()
    expect(deps.saveNow).not.toHaveBeenCalled()
    expect(downloadFile).not.toHaveBeenCalled()
  })
})
