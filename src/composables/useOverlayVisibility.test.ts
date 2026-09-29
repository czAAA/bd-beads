import { describe, expect, it, vi } from 'vitest'
import { useOverlayVisibility } from './useOverlayVisibility'

function setup() {
  const selectPattern = vi.fn()
  return { selectPattern, ...useOverlayVisibility({ selectPattern }) }
}

describe('useOverlayVisibility', () => {
  it('starts with every overlay closed', () => {
    const overlays = setup()
    expect(overlays.drawerOpen.value).toBe(false)
    expect(overlays.openPhoneSheet.value).toBeNull()
    expect(overlays.themeSheetOpen.value).toBe(false)
    expect(overlays.phoneNewPatternOpen.value).toBe(false)
    expect(overlays.phoneSavedPatternsOpen.value).toBe(false)
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

  it('opens the picked Pattern and closes both the Saved Patterns sheet and the Pattern sheet', () => {
    const { selectPattern, openPhoneSheet, phoneSavedPatternsOpen, onSelectPatternFromPhoneDrawer } = setup()
    openPhoneSheet.value = 'pattern'
    phoneSavedPatternsOpen.value = true

    onSelectPatternFromPhoneDrawer('abc')

    expect(selectPattern).toHaveBeenCalledWith('abc')
    expect(phoneSavedPatternsOpen.value).toBe(false)
    expect(openPhoneSheet.value).toBeNull()
  })
})
