import { describe, expect, it, vi } from 'vitest'
import { NO_MIRROR_AXES } from '../../domain/mirror'
import { createPattern, type Pattern } from '../../domain/pattern'
import type { Tool } from '../../domain/tool'
import { usePaintStroke } from './usePaintStroke'

function setup(tool: Tool = 'paint') {
  let pattern: Pattern | undefined = createPattern({
    technique: 'loom',
    beadId: 'toho-cube-1.5mm',
    size: { width: 3, height: 3, unit: 'beads' },
  })
  const recordHistory = vi.fn()
  const commitGridChange = vi.fn()
  const flushPendingSave = vi.fn()
  const endSelectPress = vi.fn()
  const replacePattern = vi.fn((p: Pattern) => {
    pattern = p
  })
  const stroke = usePaintStroke({
    currentPattern: () => pattern,
    replacePattern,
    mirrorAxisCounts: () => NO_MIRROR_AXES,
    mirrorCopyMode: () => false,
    activeTool: () => tool,
    commitGridChange,
    recordHistory,
    endSelectPress,
    flushPendingSave,
  })
  return { stroke, recordHistory, commitGridChange, flushPendingSave, endSelectPress, replacePattern, get pattern() { return pattern! } }
}

describe('usePaintStroke', () => {
  it('turns a whole drag into one undo step and one save', () => {
    const ctx = setup()
    const baseline = ctx.pattern.beads

    ctx.stroke.beginOrCommitPress('paint', '#ff0000', 0, 0)
    expect(ctx.stroke.strokeMode.value).toBe('paint')
    ctx.stroke.paintStrokeCell(0, 1, '#ff0000')
    ctx.stroke.paintStrokeCell(0, 2, '#ff0000')
    expect(ctx.replacePattern).toHaveBeenCalledTimes(3)
    expect(ctx.replacePattern).toHaveBeenCalledWith(expect.anything(), { deferSave: true })
    expect(ctx.recordHistory).not.toHaveBeenCalled()

    ctx.stroke.endStroke()
    expect(ctx.recordHistory).toHaveBeenCalledTimes(1)
    expect(ctx.recordHistory).toHaveBeenCalledWith({ beads: baseline })
    expect(ctx.flushPendingSave).toHaveBeenCalledTimes(1)
    expect(ctx.stroke.strokeMode.value).toBeNull()
  })

  it('ends a Select press and flushes even when no stroke was running', () => {
    const ctx = setup()
    ctx.stroke.endStroke()
    expect(ctx.endSelectPress).toHaveBeenCalled()
    expect(ctx.recordHistory).not.toHaveBeenCalled()
  })

  it('commits Fill immediately as one grid change, without starting a stroke', () => {
    const ctx = setup('fill')
    ctx.stroke.beginOrCommitPress('paint', '#00ff00', 1, 1)
    expect(ctx.commitGridChange).toHaveBeenCalledTimes(1)
    expect(ctx.stroke.strokeMode.value).toBeNull()
    expect(ctx.replacePattern).not.toHaveBeenCalled()
  })
})
