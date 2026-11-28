import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MarginRails from './MarginRails.vue'
import { createProject } from '../../domain/createProject'
import { moveToRow } from '../../domain/rowProgress'
import type { Project } from '../../domain/project'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import { frameIdIn } from '../../testUtils/frameId'
import { withLayers } from '../../testUtils/layerFields'
import { paintAt } from '../../testUtils/layers'
import { SECOND, twoFrames } from '../../testUtils/twoFrames'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
  useCanvasBackground().margin.setTitleBlock(true)
})

const mounted: ReturnType<typeof mount>[] = []
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

function framed(): Project {
  const bare = withLayers(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), { frame: { technique: 'loom', row: 0, column: 0, rows: 11, columns: 40, beads: {}, name: 'Sun band' } })
  return paintAt(bare, [{ row: 0, column: 0 }], '#c83737')
}

function mountRails(props: Partial<InstanceType<typeof MarginRails>['$props']> = {}) {
  const project = props.project ?? framed()
  const wrapper = mount(MarginRails, { props: { project, frame: frameIdIn(project), editing: false, ...props }, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}
const control = (wrapper: ReturnType<typeof mountRails>, testid: string) => wrapper.get(`[data-testid="${testid}"]`)
const has = (wrapper: ReturnType<typeof mountRails>, testid: string) => wrapper.find(`[data-testid="${testid}"]`).exists()
const press = async (wrapper: ReturnType<typeof mountRails>, testid: string) => {
  await control(wrapper, testid).trigger('click')
  await nextTick()
}

describe('the expanded Frame\'s rails (MarginSheet card, Calmer sheet 3; ticket 1260)', () => {
  it('keeps paper for the Tool pill on the side it is on, and none without a pill (ticket 1259)', async () => {
    const wrapper = mountRails({ pillEdge: 'left' })
    expect(has(wrapper, 'margin-rails-pill-place')).toBe(true)
    await wrapper.setProps({ pillEdge: undefined })
    expect(has(wrapper, 'margin-rails-pill-place')).toBe(false)
  })

  it('goes back to the Canvas from the left rail\'s first row', async () => {
    const wrapper = mountRails()
    expect(control(wrapper, 'margin-expand-frame').text()).toBe('Back to the Canvas')
    await press(wrapper, 'margin-expand-frame')
    expect(wrapper.emitted('toggle-expand')).toHaveLength(1)
  })

  it('holds the facts and Beads needed on the left, each bead disc lettered, and no ··· anywhere', () => {
    const wrapper = mountRails()
    const facts = control(wrapper, 'margin-rail-facts')
    for (const words of ['Sun band', 'Technique', 'Loom', '40 × 11', 'Bead', 'TOHO Cube 1.5mm', 'Beads needed', 'Letters']) expect(facts.text(), words).toContain(words)
    expect(facts.findAll('[data-testid="quantity-row"]')).toHaveLength(1)
    expect(facts.get('[data-testid="quantity-row"] .letter-disc').text()).toBe(framed().paletteLetters?.['#c83737'] ?? '?')
    expect(has(wrapper, 'margin-frame-tools')).toBe(false)
    expect(has(wrapper, 'frame-move-handle')).toBe(false)
  })

  it('keeps Beads needed and Letters alone with Name and size on the margin off', () => {
    useCanvasBackground().margin.setTitleBlock(false)
    const wrapper = mountRails()
    expect(has(wrapper, 'margin-identity')).toBe(false)
    expect(has(wrapper, 'margin-rail-size')).toBe(false)
    expect(has(wrapper, 'bead-quantities')).toBe(true)
    expect(has(wrapper, 'margin-letters')).toBe(true)
  })

  it('unfolds the size\'s fields under its chip, settling held steppers as they fold', async () => {
    const wrapper = mountRails()
    expect(has(wrapper, 'frame-width')).toBe(false)
    await press(wrapper, 'margin-rail-size')
    expect(control(wrapper, 'margin-rail-size').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.margin-rail-facts__sizing input').exists()).toBe(true)
    await press(wrapper, 'margin-rail-size')
    expect(wrapper.emitted('settle-settings')).toHaveLength(1)
  })

  it('names every tool with its words, each a second trigger of the band\'s', async () => {
    const wrapper = mountRails()
    const rows = control(wrapper, 'margin-rail-tools').findAll('.margin-rail-tools__row')
    expect(rows.map((row) => row.text())).toEqual(['Mirror the whole Frame', 'Rotate Frame', 'Edit Frame', 'Export', 'Margin color', 'Remove Frame'])
    for (const id of ['mirror', 'rotate', 'edit', 'remove']) await press(wrapper, `margin-rail-${id}`)
    expect([wrapper.emitted('mirror'), wrapper.emitted('rotate'), wrapper.emitted('toggle-edit'), wrapper.emitted('remove')].map((emitted) => emitted?.length)).toEqual([1, 1, 1, 1])
  })

  it('shows Mirror and Edit Frame pressed while on, Mirror saying Mirror off', () => {
    const wrapper = mountRails({ mirrorOnFrame: true, editing: true })
    expect(control(wrapper, 'margin-rail-mirror').attributes('aria-pressed')).toBe('true')
    expect(control(wrapper, 'margin-rail-mirror').text()).toBe('Mirror off')
    expect(control(wrapper, 'margin-rail-edit').attributes('aria-pressed')).toBe('true')
  })

  it('keeps Edit Frame in place, disabled, once a row is done', async () => {
    const project = framed()
    const wrapper = mountRails({ project: moveToRow(project, 1, frameIdIn(project)) })
    expect(control(wrapper, 'margin-rail-edit').attributes('aria-disabled')).toBe('true')
    await press(wrapper, 'margin-rail-edit')
    expect(wrapper.emitted('toggle-edit')).toBeUndefined()
  })

  it('unfolds Export downward as rows, never a popover, exporting its own Frame alone', async () => {
    const project = twoFrames()
    const wrapper = mountRails({ project, frame: SECOND })
    expect(has(wrapper, 'export-png')).toBe(false)
    await press(wrapper, 'margin-rail-export')
    expect(control(wrapper, 'margin-rail-export').attributes('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-testid="export-panel"]')).toBeNull()
    expect(control(wrapper, 'export-file-name').text()).toContain('.pdf')
    await press(wrapper, 'export-png')
    await press(wrapper, 'export-pdf')
    await press(wrapper, 'export-project-file')
    const [part] = wrapper.emitted('export-png')![0] as [Project]
    expect(part.layers).toHaveLength(2)
    expect(part.layers[1]!.id).toBe(SECOND)
    expect(wrapper.emitted('export-pdf')![0]).toEqual([undefined, part])
    expect(wrapper.emitted('save-project-file')).toHaveLength(1)
  })

  it('unfolds Name on exports and Export settings in place', async () => {
    const wrapper = mountRails()
    await press(wrapper, 'margin-rail-export')
    expect(has(wrapper, 'export-maker-name-add')).toBe(false)
    await press(wrapper, 'export-maker-row')
    expect(has(wrapper, 'export-maker-name-edit')).toBe(true)
    expect(has(wrapper, 'export-cover-page')).toBe(false)
    await press(wrapper, 'export-settings-row')
    for (const id of ['export-cover-page', 'export-black-and-white', 'export-empty-grid', 'export-chart-border', 'export-row-by-row']) expect(has(wrapper, id), id).toBe(true)
    await press(wrapper, 'export-settings-row')
    expect(has(wrapper, 'export-cover-page')).toBe(false)
  })

  it('unfolds Margin color under its row, with the Frame\'s Background and the name and size switch', async () => {
    const wrapper = mountRails()
    await press(wrapper, 'margin-rail-color')
    expect(has(wrapper, 'margin-color-picker')).toBe(true)
    expect(has(wrapper, 'margin-title-block-switch')).toBe(true)
    expect(has(wrapper, 'margin-color-popover')).toBe(false)
  })

  it('answers a popover asked for, everything it holds being on the sheet', () => {
    expect(mountRails({ popoverAsked: true }).emitted('popover-opened')).toHaveLength(1)
  })
})
