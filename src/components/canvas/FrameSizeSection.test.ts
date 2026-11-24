import { frameIdIn } from '../../testUtils/frameId'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import FrameSizeSection from './FrameSizeSection.vue'
import { rotateFrame } from '../../domain/rotate'
import { HOLD_DELAY_MS } from '../../composables/ui/useHoldRepeat'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import type { FrameShapeId } from '../../domain/frameShape'
import { changeFrame } from '../../domain/changeFrame'
import { en } from '../../i18n/en'
import { withLayers } from '../../testUtils/layerFields'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function framed(frame: { row: number; column: number; rows: number; columns: number; beads: Record<number, Record<number, string>> } = { row: 2, column: 3, rows: 6, columns: 5, beads: {} }): Project {
  return withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: { ...frame, technique: 'loom' } })
}

function mountBar(project = framed()) {
  return mount(FrameSizeSection, { props: { project, frame: frameIdIn(project) }, attachTo: document.body })
}

describe('FrameSizeSection (tickets 473, 1222)', () => {
  it('shows the size as the two fields\' values, then the unit, Rotate and Remove Frame (ticket 0854)', () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    const height = wrapper.get('[data-testid="frame-size-height"]')
    expect([(width.element as HTMLInputElement).value, (height.element as HTMLInputElement).value]).toEqual(['5', '6'])
    expect(wrapper.text()).toContain('beads')
  })

  it('takes digits only, no zero, on Enter; an empty field keeps its side, its placeholder still the size', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    const height = wrapper.get('[data-testid="frame-size-height"]')
    await width.setValue('2a0-')
    expect((width.element as HTMLInputElement).value).toBe('20')
    await height.setValue('0')
    expect((height.element as HTMLInputElement).value).toBe('')
    expect(height.attributes('placeholder')).toBe('6')
    await width.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 6]])
    expect((width.element as HTMLInputElement).value).toBe('5')
    await height.setValue('12')
    await height.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[20, 6], [5, 12]])
  })

  it('drops a fraction and shows the range under a refused field, which goes with its next valid entry (ticket 0978)', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    const range = () => wrapper.find('[data-testid="frame-width-range"]')
    expect(width.attributes('aria-invalid')).toBeUndefined()
    await width.setValue('12.5')
    expect((width.element as HTMLInputElement).value).toBe('12')
    expect(range().text()).toBe('Width is 4 to 999 beads')
    expect(range().attributes('role')).toBe('alert')
    expect(width.attributes('aria-invalid')).toBe('true')
    expect(width.attributes('aria-describedby')).toBe(range().attributes('id'))
    await width.setValue('5000')
    expect((width.element as HTMLInputElement).value).toBe('500')
    expect(range().exists()).toBe(true)
    await width.setValue('50')
    expect(range().exists()).toBe(false)
    expect(width.attributes('aria-invalid')).toBeUndefined()
    expect(wrapper.find('[data-testid="frame-height-range"]').exists()).toBe(false)
  })

  it('refuses ".", "," and "-" at the key, and the digits after a point, until the caret moves (ticket 0978)', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    const input = width.element as HTMLInputElement
    const type = (data: string) => {
      const event = new InputEvent('beforeinput', { data, inputType: 'insertText', cancelable: true })
      input.dispatchEvent(event)
      return event.defaultPrevented
    }
    input.value = '12'
    input.setSelectionRange(2, 2)
    expect(type('-')).toBe(true)
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-width-range"]').exists()).toBe(true)
    expect(type('.')).toBe(true)
    expect(type('5')).toBe(true)
    await width.trigger('keydown', { key: 'Unidentified' })
    expect(type('5')).toBe(true)
    await width.trigger('keydown', { key: 'ArrowLeft' })
    expect(type('5')).toBe(false)
    expect(type(',')).toBe(true)
    input.value = '500'
    input.setSelectionRange(3, 3)
    await width.trigger('keydown', { key: 'End' })
    expect(type('0')).toBe(true)
    input.setSelectionRange(0, 3)
    expect(type('7')).toBe(false)
  })

  it('shows the range when a typed number is brought into it, and Escape takes the line away (ticket 0978)', async () => {
    const wrapper = mountBar()
    const height = wrapper.get('[data-testid="frame-size-height"]')
    await height.setValue('1')
    await height.trigger('keydown', { key: 'Enter' })
    expect(wrapper.get('[data-testid="frame-height-range"]').text()).toBe('Height is 4 to 999 beads')
    await height.setValue('2')
    height.element.closest('[data-handles-escape]')!.dispatchEvent(new CustomEvent('panel-escape'))
    await flushPromises()
    expect(wrapper.find('[data-testid="frame-height-range"]').exists()).toBe(false)
  })

  it('reads the line again when a refusal comes again (ticket 0995)', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    await width.setValue('1a')
    const first = wrapper.get('[data-testid="frame-width-range"]').element
    await width.setValue('1b')
    expect(wrapper.get('[data-testid="frame-width-range"]').element).not.toBe(first)
  })

  it('takes the size when focus leaves both fields, not when it moves between them, and ignores the size it has', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    const height = wrapper.get('[data-testid="frame-size-height"]')
    await width.setValue('9')
    await width.trigger('focusout', { relatedTarget: height.element })
    expect(wrapper.emitted('resize')).toBeUndefined()
    await height.setValue('6')
    await height.trigger('focusout')
    expect(wrapper.emitted('resize')).toEqual([[9, 6]])
    await width.setValue('5')
    await width.trigger('focusout')
    expect(wrapper.emitted('resize')).toHaveLength(1)
  })

  it('puts the size back on Escape, which its popover hands it before it closes', async () => {
    const wrapper = mountBar()
    const width = wrapper.get('[data-testid="frame-size-width"]')
    await width.setValue('9')
    width.element.closest('[data-handles-escape]')!.dispatchEvent(new CustomEvent('panel-escape'))
    await flushPromises()
    expect((width.element as HTMLInputElement).value).toBe('5')
  })

  it('has the edge cells in the order Top, Bottom, Left, Right, each with − first and + second', () => {
    const wrapper = mountBar()
    const cells = wrapper.findAll('.frame-size__cell')
    expect(cells.map((cell) => cell.get('.frame-size__edge-name').text())).toEqual([en.frame.edgeName.top, en.frame.edgeName.bottom, en.frame.edgeName.left, en.frame.edgeName.right])
    for (const edge of ['top', 'bottom', 'left', 'right'] as const) {
      const out = wrapper.get(`[data-testid="frame-edge-${edge}-out"]`)
      const inward = wrapper.get(`[data-testid="frame-edge-${edge}-in"]`)
      expect(out.attributes('aria-label')).toBe(en.frame.edgeOut[edge])
      expect(inward.attributes('aria-label')).toBe(en.frame.edgeIn[edge])
      expect(inward.text()).toBe('−')
      expect(out.text()).toBe('+')
      expect(inward.element.compareDocumentPosition(out.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('emits the edge and a bead out (1) or in (-1), and lights the last edge stepped', async () => {
    const wrapper = mountBar()
    await wrapper.get('[data-testid="frame-edge-left-out"]').trigger('click')
    await wrapper.get('[data-testid="frame-edge-top-in"]').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['left', 1], ['top', -1]])
    expect(wrapper.get('[data-testid="frame-size-cell-top"] .frame-size__glyph').classes()).toContain('frame-size__glyph--last')
    expect(wrapper.get('[data-testid="frame-size-cell-left"] .frame-size__glyph').classes()).not.toContain('frame-size__glyph--last')
  })

  it('disables the − at four beads with the reason, and a press is no step', async () => {
    const wrapper = mountBar(framed({ row: 2, column: 3, rows: 4, columns: 5, beads: {} }))
    const shrink = wrapper.get('[data-testid="frame-edge-bottom-in"]')
    expect(shrink.attributes('aria-disabled')).toBe('true')
    expect(wrapper.get('[data-testid="frame-edge-bottom-out"]').attributes('aria-disabled')).toBeUndefined()
    expect(wrapper.get('[data-testid="frame-edge-left-in"]').attributes('aria-disabled')).toBeUndefined()
    await shrink.trigger('click')
    expect(wrapper.emitted('step')).toBeUndefined()
  })

  it('repeats a held press until it is let go', async () => {
    vi.useFakeTimers()
    const wrapper = mountBar()
    const grow = wrapper.get('[data-testid="frame-edge-right-out"]')
    await grow.trigger('pointerdown', { button: 0, pointerId: 1 })
    expect(wrapper.emitted('step')).toHaveLength(1)
    vi.advanceTimersByTime(HOLD_DELAY_MS + 400)
    expect(wrapper.emitted('step')!.length).toBeGreaterThan(2)
    await grow.trigger('pointerup', { pointerId: 1 })
    const count = wrapper.emitted('step')!.length
    vi.advanceTimersByTime(1000)
    expect(wrapper.emitted('step')).toHaveLength(count)
  })

  it('turns the fields off, hides the edges and says why once a pass is done (ticket 0647)', () => {
    const wrapper = mountBar(moveToRow(framed(), 1, frameIdIn(framed())))
    expect(wrapper.get('[data-testid="frame-size-width"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="frame-edge-top-out"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-size-locked"]').text()).toBe(en.frame.sizeLockedLine)
  })

  it('offers Reset progress beside the line saying rows are marked done, which asks the shell (ticket 0848)', async () => {
    const wrapper = mountBar(moveToRow(framed(), 1, frameIdIn(framed())))
    const reset = wrapper.get('[data-testid="frame-size-locked-reset"]')
    expect(reset.text()).toBe(en.rowProgress.resetButton)
    await reset.trigger('click')
    expect(wrapper.emitted('reset-progress')).toHaveLength(1)
  })

  it('shows a turned Frame\'s size as seen and resizes it as seen (tickets 0667, 1016)', async () => {
    const wrapper = mountBar(rotateFrame(framed(), undefined, frameIdIn(framed()))!)
    const width = wrapper.get('[data-testid="frame-size-width"]')
    expect((width.element as HTMLInputElement).value).toBe('6')
    expect((wrapper.get('[data-testid="frame-size-height"]').element as HTMLInputElement).value).toBe('5')
    expect(width.attributes('disabled')).toBeUndefined()
    await width.setValue('8')
    await width.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('resize')).toEqual([[8, 5]])
    await wrapper.get('[data-testid="frame-edge-top-out"]').trigger('click')
    expect(wrapper.emitted('step')).toEqual([['top', 1]])
  })

  it('shows the Estimated size with its Tooltip (ticket 555)', () => {
    const wrapper = mountBar()
    expect(wrapper.get('[data-testid="frame-estimate"]').text()).toContain('≈')
    expect(wrapper.get('[data-testid="frame-estimate-info"]').attributes('aria-label')).toBe(en.size.estimateLabel)
    expect(wrapper.text()).toContain(en.frame.estimateInfo)
  })

  it('gives the Estimated size in the unit the margin gives it, cm from 10 mm up (ticket 0992)', () => {
    const wrapper = mountBar(framed({ row: 0, column: 0, rows: 30, columns: 40, beads: {} }))
    expect(wrapper.get('[data-testid="frame-estimate"] .frame-size__estimate-value').text()).toBe('≈ 6.0 × 4.5 cm')
  })
})

describe('FrameSizeSection with a Custom frame (ticket 0592)', () => {
  /** A Project with a Custom frame of a Frame shape and size in place of its Frame. */
  function custom(shape: FrameShapeId, size: number, project = framed()): Project {
    const result = changeFrame(project, { custom: { shape, size, centre: { row: 10, column: 10 } } }, frameIdIn(project))
    if (result.kind !== 'changed') throw new Error(`expected a ${shape}`)
    return result.project
  }
  const triangle = (rounds = 4) => custom('triangle', rounds)

  it('sizes a Star and a Kaleidocycle by Part size and a Kite by Rows (ticket 0593)', () => {
    for (const [shape, size, words] of [
      ['star', 6, en.frame.sizeSettings.partSize],
      ['kaleidocycle', 9, en.frame.sizeSettings.partSize],
      ['kite', 21, en.frame.sizeSettings.rows],
    ] as const) {
      const wrapper = mountBar(custom(shape, size))
      const name = shape === 'kite' ? 'rows' : 'partSize'
      expect(wrapper.get(`[data-testid="frame-setting-${name}"]`).text()).toContain(words.label)
      expect(wrapper.get(`[data-testid="frame-setting-${name}-value"]`).text()).toBe(String(size))
      expect(wrapper.get(`[data-testid="frame-setting-${name}-less"]`).attributes('aria-label')).toBe(words.less)
    }
  })

  it('offers a Fringe earring\'s Width, Top rows and Fringe length, and its Fringe style (tickets 0597, 0814)', async () => {
    const result = changeFrame(framed(), { custom: { shape: 'fringeEarring', settings: { topWidth: 7, topRows: 6, fringeStyle: 'v', fringeLength: 12 }, centre: { row: 10, column: 10 } } }, frameIdIn(framed()))
    if (result.kind !== 'changed') throw new Error('expected an earring')
    const wrapper = mountBar(result.project)
    expect(['topWidth', 'topRows', 'fringeLength'].map((name) => wrapper.get(`[data-testid="frame-setting-${name}-value"]`).text())).toEqual(['7', '6', '12'])
    // Top rows stop at the point: 6 rows of a Width of 7 are a whole point, with no body to go on into.
    expect(wrapper.get('[data-testid="frame-setting-topWidth"]').text()).toContain('Width')
    expect(wrapper.get('[data-testid="frame-setting-topRows-more"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="frame-fringe-style"]').text()).toContain(en.starters.picks.fringeStyle.options.straight)
    await wrapper.get('[data-testid="frame-setting-fringeLength-more"]').trigger('click')
    await wrapper.get('[data-testid="frame-fringe-style"] [data-value="straight"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ fringeLength: 13 }], [{ fringeStyle: 'straight' }]])
  })

  it('shows Rounds in place of Width and Height', async () => {
    const wrapper = mountBar(triangle(4))
    expect(wrapper.find('[data-testid="frame-size-width"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="frame-setting-rounds-value"]').text()).toBe('4')
    await wrapper.get('[data-testid="frame-setting-rounds-more"]').trigger('click')
    expect(wrapper.emitted('set-settings')).toEqual([[{ rounds: 5 }]])
  })
})
