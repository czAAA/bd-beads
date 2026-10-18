import { describe, expect, it, vi } from 'vitest'
import { findPaletteColor } from '../../domain/palette'
import { DEFAULT_PALETTE_COLOR_ID, useToolAndColor } from './useToolAndColor'

function setup() {
  const deps = { leaveSelectTool: vi.fn() }
  return { deps, ...useToolAndColor(deps) }
}

/** The two ways of picking a paint color, shared by the tests about what a pick does to the active tool. */
const colorPicks: [string, (flow: ReturnType<typeof setup>) => void][] = [
  ['a Palette swatch', (flow) => flow.onSelectColor('blue')],
  ['a Custom color', (flow) => flow.onSelectCustomColor('#123456')],
]

describe('useToolAndColor', () => {
  it('starts on Paint with the Palette’s default color', () => {
    const { activeTool, selectedColorId, selectedColorHex, previewColor } = setup()
    expect(activeTool.value).toBe('paint')
    expect(selectedColorId.value).toBe(DEFAULT_PALETTE_COLOR_ID)
    expect(selectedColorHex()).toBe(findPaletteColor(DEFAULT_PALETTE_COLOR_ID)!.hex)
    expect(previewColor.value).toBe(selectedColorHex())
  })

  describe('choosing a tool', () => {
    it('makes it active, and leaving Select forgets what it held', () => {
      const { deps, activeTool, onSelectTool } = setup()
      onSelectTool('fill')
      expect(activeTool.value).toBe('fill')
      expect(deps.leaveSelectTool).toHaveBeenCalledTimes(1)
    })

    it('keeps the Selection when switching between Select and Piece, and forgets it on leaving both (ticket 414)', () => {
      const { deps, onSelectTool } = setup()
      onSelectTool('select')
      onSelectTool('piece')
      onSelectTool('select')
      expect(deps.leaveSelectTool).not.toHaveBeenCalled()
      onSelectTool('piece')
      onSelectTool('paint')
      expect(deps.leaveSelectTool).toHaveBeenCalledTimes(1)
    })

    it('keeps the Selection and clipboard when Select is chosen again', () => {
      const { deps, activeTool, onSelectTool } = setup()
      onSelectTool('select')
      onSelectTool('select')
      expect(activeTool.value).toBe('select')
      expect(deps.leaveSelectTool).not.toHaveBeenCalled()
    })
  })

  describe('choosing a color', () => {
    it('a Palette swatch deselects the Custom color but the Custom slot keeps its hex', () => {
      const { customColor, selectedColorId, onSelectCustomColor, onSelectColor } = setup()
      onSelectCustomColor('#123456')
      onSelectColor('blue')
      expect(selectedColorId.value).toBe('blue')
      expect(customColor.value).toBe('#123456')
    })

    it('a Custom color becomes the paint color and deselects the Palette swatch', () => {
      const { selectedColorId, selectedColorHex, onSelectCustomColor } = setup()
      onSelectCustomColor('#123456')
      expect(selectedColorId.value).toBeUndefined()
      expect(selectedColorHex()).toBe('#123456')
    })

    it('has no paint color when nothing is selected', () => {
      const { selectedColorId, selectedColorHex, previewColor } = setup()
      selectedColorId.value = undefined
      expect(selectedColorHex()).toBeNull()
      expect(previewColor.value).toBeNull()
    })

    it.each(colorPicks)('picking %s while a tool that paints nothing is active switches to Paint', (_name, pick) => {
      for (const tool of ['erase', 'select', 'hand'] as const) {
        const flow = setup()
        flow.onSelectTool(tool)
        pick(flow)
        expect(flow.activeTool.value).toBe('paint')
      }
    })

    it.each(colorPicks)('picking %s while Fill is active leaves Fill active', (_name, pick) => {
      const flow = setup()
      flow.onSelectTool('fill')
      pick(flow)
      expect(flow.activeTool.value).toBe('fill')
    })

    it('stays on Paint without leaving Select when a color is picked on Paint', () => {
      const flow = setup()
      flow.onSelectColor('blue')
      expect(flow.deps.leaveSelectTool).not.toHaveBeenCalled()
    })
  })
})
