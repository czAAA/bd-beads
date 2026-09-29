import { describe, expect, it, vi } from 'vitest'
import { createPattern, type Pattern } from '../domain/pattern'
import { useImportSwitchFlow } from './useImportSwitchFlow'

function make(id: string, updatedAt: number): Pattern {
  return { ...createPattern({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 2, height: 2, unit: 'beads' } }), id, updatedAt }
}

const open = make('open', 1000)
const older = make('older', 2000)
const newer = make('newer', 3000)

function setup(options: { open?: boolean; saved?: boolean } = {}) {
  const deps = {
    currentPattern: () => (options.open === false ? undefined : open),
    addPatterns: vi.fn(),
    openPattern: vi.fn(),
    saveNow: vi.fn(() => options.saved ?? true),
    showToast: vi.fn(),
  }
  return { deps, ...useImportSwitchFlow(deps) }
}

describe('useImportSwitchFlow', () => {
  it('joins the library straight away with no Pattern open', () => {
    const { deps, pendingImport, onImportPatterns } = setup({ open: false })
    onImportPatterns([older])
    expect(deps.addPatterns).toHaveBeenCalledWith([older])
    expect(pendingImport.value).toBeUndefined()
  })

  it('joins the library straight away when nothing came in', () => {
    const { deps, pendingImport, onImportPatterns } = setup()
    onImportPatterns([])
    expect(deps.addPatterns).toHaveBeenCalledWith([])
    expect(pendingImport.value).toBeUndefined()
  })

  it('holds the import back while a Pattern is open, and offers the most recently updated one', () => {
    const { deps, pendingImport, pendingImportOpens, onImportPatterns } = setup()
    onImportPatterns([older, newer])
    expect(deps.addPatterns).not.toHaveBeenCalled()
    expect(pendingImport.value).toEqual([older, newer])
    expect(pendingImportOpens.value?.id).toBe('newer')
  })

  it('keep current adds the import and opens nothing', () => {
    const { deps, pendingImport, onImportPatterns, onKeepCurrentAfterImport } = setup()
    onImportPatterns([older])
    onKeepCurrentAfterImport()
    expect(deps.addPatterns).toHaveBeenCalledWith([older])
    expect(deps.openPattern).not.toHaveBeenCalled()
    expect(pendingImport.value).toBeUndefined()
  })

  it('switch adds the import and opens its most recent Pattern', () => {
    const { deps, pendingImport, onImportPatterns, onSwitchToImported } = setup()
    onImportPatterns([older, newer])
    onSwitchToImported()
    expect(deps.addPatterns).toHaveBeenCalledWith([older, newer])
    expect(deps.openPattern).toHaveBeenCalledWith('newer')
    expect(pendingImport.value).toBeUndefined()
  })

  it('answering with nothing pending does nothing', () => {
    const { deps, onKeepCurrentAfterImport, onSwitchToImported } = setup()
    onKeepCurrentAfterImport()
    onSwitchToImported()
    expect(deps.addPatterns).not.toHaveBeenCalled()
    expect(deps.openPattern).not.toHaveBeenCalled()
  })

  it('remembers when Save current was refused, and forgets it on the next import', () => {
    const { importSaveRefused, onImportPatterns, onSaveBeforeImportSwitch } = setup({ saved: false })
    onImportPatterns([older])
    onSaveBeforeImportSwitch()
    expect(importSaveRefused.value).toBe(true)
    onImportPatterns([newer])
    expect(importSaveRefused.value).toBe(false)
  })

  it('does not report a refusal when Save current got through', () => {
    const { importSaveRefused, onSaveBeforeImportSwitch } = setup({ saved: true })
    onSaveBeforeImportSwitch()
    expect(importSaveRefused.value).toBe(false)
  })

  it('passes an import result on as a toast', () => {
    const { deps, onImportToast } = setup()
    onImportToast('import-result', 'Imported 2', 'success')
    expect(deps.showToast).toHaveBeenCalledWith('import-result', 'Imported 2', 'success')
  })
})
