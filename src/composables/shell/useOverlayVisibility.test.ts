import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useOverlayVisibility } from './useOverlayVisibility'

function setup() {
  const selectProject = vi.fn()
  return { selectProject, ...useOverlayVisibility({ selectProject }) }
}

describe('useOverlayVisibility', () => {
  it('starts with every overlay closed', () => {
    const overlays = setup()
    expect(overlays.openPanel.value).toBeNull()
    expect(overlays.menuOpensOnForm.value).toBe(false)
    expect(overlays.phoneSavedProjectsOpen.value).toBe(false)
  })

  it('opens a phone sheet from its strip button, and closes it on the same button again', () => {
    const { openPanel, onSelectPhoneSheet } = setup()
    onSelectPhoneSheet('menu')
    expect(openPanel.value).toBe('menu')
    onSelectPhoneSheet('menu')
    expect(openPanel.value).toBeNull()
  })

  it('switches straight to another phone sheet from a different strip button', () => {
    const { openPanel, onSelectPhoneSheet } = setup()
    onSelectPhoneSheet('project')
    onSelectPhoneSheet('menu')
    expect(openPanel.value).toBe('menu')
  })

  it('opens Menu on the form for the bar button, and forgets it once the panel is gone or swapped', async () => {
    const { openPanel, menuOpensOnForm, openMenuOnForm } = setup()
    openMenuOnForm()
    expect(openPanel.value).toBe('menu')
    expect(menuOpensOnForm.value).toBe(true)
    openPanel.value = null
    await nextTick()
    expect(menuOpensOnForm.value).toBe(false)
  })

  it('opens the picked Project and closes both the Saved Projects sheet and the Project sheet', () => {
    const { selectProject, openPanel, phoneSavedProjectsOpen, onSelectProjectFromPhoneDrawer } = setup()
    openPanel.value = 'project'
    phoneSavedProjectsOpen.value = true

    onSelectProjectFromPhoneDrawer('abc')

    expect(selectProject).toHaveBeenCalledWith('abc', expect.any(Function))
    // The sheets stay until the selection lands (a confirmation may come first, ticket 232).
    expect(phoneSavedProjectsOpen.value).toBe(true)
    selectProject.mock.calls[0]![1]!()
    expect(phoneSavedProjectsOpen.value).toBe(false)
    expect(openPanel.value).toBeNull()
  })
})
