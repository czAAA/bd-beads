import { describe, expect, it, vi } from 'vitest'
import { createProject } from '../../domain/project'
import type { Tool } from '../../domain/tool'
import { en } from '../../i18n/en'
import { useToolAtCursor } from './useToolAtCursor'

function setup(tool: Tool = 'paint', changesGrid = true) {
  let project = createProject({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: 3, height: 3, unit: 'beads' },
  })
  const deps = {
    messages: () => en,
    currentProject: () => project,
    activeTool: () => tool,
    selectedColorHex: () => '#123457',
    pressCell: vi.fn(() => {
      if (changesGrid) project = { ...project, beads: { ...project.beads } }
    }),
    endStroke: vi.fn(),
    beginSelectPress: vi.fn(),
    extendSelection: vi.fn(),
    announce: vi.fn(),
    colorWords: () => 'Custom',
  }
  return { deps, ...useToolAtCursor(deps) }
}

describe('useToolAtCursor', () => {
  it('presses and releases at the cursor, then announces the paint', () => {
    const { deps, invokeToolAt } = setup()
    invokeToolAt({ row: 1, column: 2 })
    expect(deps.pressCell).toHaveBeenCalledWith(1, 2)
    expect(deps.endStroke).toHaveBeenCalled()
    expect(deps.announce).toHaveBeenCalledWith(en.a11y.painted.replace('{color}', 'Custom'))
  })

  it('announces erase and fill with their own words', () => {
    const erase = setup('erase')
    erase.invokeToolAt({ row: 0, column: 0 })
    expect(erase.deps.announce).toHaveBeenCalledWith(en.a11y.erased)
    const fill = setup('fill')
    fill.invokeToolAt({ row: 0, column: 0 })
    expect(fill.deps.announce).toHaveBeenCalledWith(en.a11y.filled.replace('{color}', 'Custom'))
  })

  it('stays silent when the grid did not change', () => {
    const { deps, invokeToolAt } = setup('paint', false)
    invokeToolAt({ row: 0, column: 0 })
    expect(deps.announce).not.toHaveBeenCalled()
  })

  it('begins a Selection once at the starting bead, then extends and finishes it', () => {
    const { deps, extendSelectionTo, finishExtending } = setup()
    extendSelectionTo({ row: 0, column: 0 }, { row: 0, column: 1 })
    extendSelectionTo({ row: 0, column: 1 }, { row: 0, column: 2 })
    expect(deps.beginSelectPress).toHaveBeenCalledTimes(1)
    expect(deps.beginSelectPress).toHaveBeenCalledWith(0, 0)
    expect(deps.extendSelection).toHaveBeenLastCalledWith(0, 2)
    finishExtending()
    finishExtending()
    expect(deps.endStroke).toHaveBeenCalledTimes(1)
  })
})
