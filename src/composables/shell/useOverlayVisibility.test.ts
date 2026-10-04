import { describe, expect, it, vi } from 'vitest'
import { useOverlayVisibility } from './useOverlayVisibility'

function setup() {
  const selectProject = vi.fn()
  return { selectProject, ...useOverlayVisibility({ selectProject }) }
}

describe('useOverlayVisibility', () => {
  it('starts with every overlay closed', () => {
    const overlays = setup()
    expect(overlays.drawerOpen.value).toBe(false)
    expect(overlays.openPhoneSheet.value).toBeNull()
    expect(overlays.themeSheetOpen.value).toBe(false)
    expect(overlays.phoneNewProjectOpen.value).toBe(false)
    expect(overlays.phoneSavedProjectsOpen.value).toBe(false)
  })

  it('opens a phone sheet from its Dock button, and closes it on the same button again', () => {
    const { openPhoneSheet, onSelectPhoneSheet } = setup()
    onSelectPhoneSheet('tool')
    expect(openPhoneSheet.value).toBe('tool')
    onSelectPhoneSheet('tool')
    expect(openPhoneSheet.value).toBeNull()
  })

  it('switches straight to another phone sheet from a different Dock button', () => {
    const { openPhoneSheet, onSelectPhoneSheet } = setup()
    onSelectPhoneSheet('tool')
    onSelectPhoneSheet('color')
    expect(openPhoneSheet.value).toBe('color')
  })

  it('opens the picked Project and closes both the Saved Projects sheet and the Project sheet', () => {
    const { selectProject, openPhoneSheet, phoneSavedProjectsOpen, onSelectProjectFromPhoneDrawer } = setup()
    openPhoneSheet.value = 'project'
    phoneSavedProjectsOpen.value = true

    onSelectProjectFromPhoneDrawer('abc')

    expect(selectProject).toHaveBeenCalledWith('abc', expect.any(Function))
    // The sheets stay until the selection lands (a confirmation may come first, ticket 232).
    expect(phoneSavedProjectsOpen.value).toBe(true)
    selectProject.mock.calls[0]![1]!()
    expect(phoneSavedProjectsOpen.value).toBe(false)
    expect(openPhoneSheet.value).toBeNull()
  })
})
