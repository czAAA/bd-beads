import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { createProject } from '../../domain/createProject'
import type { Project } from '../../domain/project'
import type { Selection } from '../../domain/selection'
import type { Tool } from '../../domain/tool'
import { en } from '../../i18n/en'
import { withLayers } from '../../testUtils/layerFields'
import { useBeadCursor } from './useBeadCursor'

const blank = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 6, height: 6, unit: 'beads' } })
const framed = withLayers(blank, { frame: { technique: 'loom' as const, row: 2, column: 3, rows: 6, columns: 6, beads: {} } })

function setup(project: Project = framed, tool: Tool = 'paint') {
  const current = ref<Project | undefined>(project)
  const selection = ref<Selection>()
  const said: string[] = []
  const deps = {
    currentProject: () => current.value,
    messages: () => en,
    activeTool: () => tool,
    selectedColorHex: () => '#000000',
    visibleCentre: () => ({ row: 10, column: 20 }),
    showBead: vi.fn(),
    tapsBeads: vi.fn(() => true),
    // A tap that paints, as the pointer's press does: one bead of the Canvas changes.
    press: vi.fn((row: number, column: number) => {
      current.value = withLayers(current.value!, { beads: { [row]: { [column]: '#000000' } } })
    }),
    release: vi.fn(),
    beginSelect: vi.fn(),
    extendSelect: vi.fn((row: number, column: number) => {
      selection.value = { top: 2, left: 3, rows: row - 1, columns: column - 2 } as Selection
      return true
    }),
    refuseSelection: vi.fn(),
    leavePasteMode: vi.fn(),
    selection: () => selection.value,
    hover: vi.fn(),
    hoverEnd: vi.fn(),
    colorWords: (hex: string | null) => (hex ? 'Black' : 'empty'),
    announce: (text: string) => said.push(text),
  }
  const cursor = effectScope().run(() => useBeadCursor(deps))!
  return { current, deps, said, cursor }
}

function key(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, cancelable: true, bubbles: true, ...init })
}

describe('useBeadCursor (ticket 0942, ADR 0093)', () => {
  it('starts on the Frame\'s first bead when Tab brings focus, rings it, keeps it in view and says where it is once', () => {
    const { cursor, deps, said } = setup()
    cursor.onKeyboardFocus()

    expect(cursor.shown.value).toBe(true)
    expect(cursor.cursor.value).toEqual({ row: 2, column: 3 })
    expect(deps.hover).toHaveBeenCalledWith(2, 3)
    expect(deps.showBead).toHaveBeenCalledWith({ row: 2, column: 3 })
    expect(said).toEqual(['Row 1, column 1, empty'])
  })

  it('starts afresh on the next Project, and stays put on the same one', () => {
    const { cursor, current } = setup()
    cursor.onKeyboardFocus()
    cursor.onKey(key('ArrowRight'), false)
    cursor.onBlur()
    cursor.onKeyboardFocus()
    expect(cursor.cursor.value).toEqual({ row: 2, column: 4 })

    current.value = { ...framed, id: 'another' }
    cursor.onKeyboardFocus()
    expect(cursor.cursor.value).toEqual({ row: 2, column: 3 })
  })

  it('starts in the middle of the view on a Canvas with no Frame', () => {
    const { cursor } = setup(withLayers(blank, { frame: undefined }))
    cursor.onKeyboardFocus()
    expect(cursor.cursor.value).toEqual({ row: 10, column: 20 })
  })

  it('moves one bead per arrow, keeps it in view, and says each move once', () => {
    const { cursor, deps, said } = setup()
    cursor.onKeyboardFocus()
    said.length = 0
    const right = key('ArrowRight')
    cursor.onKey(right, false)
    cursor.onKey(key('ArrowDown'), false)

    expect(cursor.cursor.value).toEqual({ row: 3, column: 4 })
    expect(deps.showBead).toHaveBeenLastCalledWith({ row: 3, column: 4 })
    expect(said).toEqual(['Row 1, column 2, empty', 'Row 2, column 2, empty'])
    expect(right.defaultPrevented).toBe(true)
  })

  it('moves the way the arrow points on screen after a quarter turn', () => {
    const { cursor } = setup(withLayers(framed, { orientation: 90 }))
    cursor.onKeyboardFocus()
    cursor.onKey(key('ArrowDown'), false)
    expect(cursor.cursor.value).toEqual({ row: 2, column: 4 })
    cursor.onKey(key('ArrowRight'), false)
    expect(cursor.cursor.value).toEqual({ row: 1, column: 4 })
  })

  it.each([' ', 'Enter'])('taps the bead at the cursor on %j: the pointer\'s press and release, said once', (name) => {
    const { cursor, deps, said } = setup()
    cursor.onKeyboardFocus()
    said.length = 0
    const event = key(name)
    const stopped = vi.spyOn(event, 'stopPropagation')
    cursor.onKey(event, false)

    expect(deps.press).toHaveBeenCalledWith(2, 3)
    expect(deps.release).toHaveBeenCalledTimes(1)
    expect(said).toEqual(['Painted Black'])
    expect(event.defaultPrevented).toBe(true)
    expect(stopped).toHaveBeenCalled()
  })

  it('says nothing of its own for a tap that changed nothing, and taps once for a held key', () => {
    const { cursor, deps, said } = setup()
    deps.press.mockImplementation(() => {})
    cursor.onKeyboardFocus()
    said.length = 0
    cursor.onKey(key(' '), false)
    cursor.onKey(key(' ', { repeat: true }), false)

    expect(deps.press).toHaveBeenCalledTimes(1)
    expect(said).toEqual([])
  })

  it('names what Erase and Fill did', () => {
    for (const [tool, words] of [['erase', 'Erased'], ['fill', 'Filled with Black']] as const) {
      const { cursor, said } = setup(framed, tool)
      cursor.onKeyboardFocus()
      cursor.onKey(key(' '), false)
      expect(said.at(-1)).toBe(words)
    }
  })

  it('taps nothing while Edit Frame takes the press', () => {
    const { cursor, deps } = setup()
    deps.tapsBeads.mockReturnValue(false)
    cursor.onKeyboardFocus()
    cursor.onKey(key('Enter'), false)
    expect(deps.press).not.toHaveBeenCalled()
  })

  it('leaves Space to pan when a pointer press gave the Pattern focus', () => {
    const { cursor, deps } = setup()
    const space = key(' ')
    cursor.onKey(space, true)

    expect(deps.press).not.toHaveBeenCalled()
    expect(space.defaultPrevented).toBe(false)
  })

  it('grows a Selection with Shift and the arrows, the pointer\'s Select drag, and ends it when Shift is let go', () => {
    const { cursor, deps, said } = setup()
    cursor.onKeyboardFocus()
    said.length = 0
    cursor.onKey(key('ArrowRight', { shiftKey: true }), false)
    cursor.onKey(key('ArrowDown', { shiftKey: true }), false)

    expect(deps.leavePasteMode).toHaveBeenCalledTimes(1)
    expect(deps.beginSelect).toHaveBeenCalledOnce()
    expect(deps.beginSelect).toHaveBeenCalledWith(2, 3)
    expect(deps.extendSelect).toHaveBeenLastCalledWith(3, 4)
    expect(said).toEqual(['Selected 2 by 1', 'Selected 2 by 2'])
    expect(deps.release).not.toHaveBeenCalled()

    cursor.onKeyUp(new KeyboardEvent('keyup', { key: 'Shift' }))
    expect(deps.release).toHaveBeenCalledTimes(1)
  })

  it('keeps the cursor where it was, with the not-allowed cue, when the Selection cannot grow', () => {
    const { cursor, deps } = setup()
    deps.extendSelect.mockReturnValue(false)
    cursor.onKeyboardFocus()
    cursor.onKey(key('ArrowLeft', { shiftKey: true }), false)

    expect(cursor.cursor.value).toEqual({ row: 2, column: 3 })
    expect(deps.refuseSelection).toHaveBeenCalledTimes(1)
  })

  it('hides the ring and the hover when focus leaves', () => {
    const { cursor, deps } = setup()
    cursor.onKeyboardFocus()
    cursor.onBlur()
    expect(cursor.shown.value).toBe(false)
    expect(deps.hoverEnd).toHaveBeenCalledTimes(1)
  })

  it('leaves keys with Ctrl, Cmd or Alt to the shortcuts', () => {
    const { cursor, deps } = setup()
    cursor.onKeyboardFocus()
    const undo = key('ArrowLeft', { metaKey: true })
    cursor.onKey(undo, false)
    expect(cursor.cursor.value).toEqual({ row: 2, column: 3 })
    expect(undo.defaultPrevented).toBe(false)
    expect(deps.press).not.toHaveBeenCalled()
  })
})
