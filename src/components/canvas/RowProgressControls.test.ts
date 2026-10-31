import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RowProgressControls from './RowProgressControls.vue'
import { createProject } from '../../domain/createProject'
import { withLayers } from '../../testUtils/layerFields'
import { moveToRow } from '../../domain/rowProgress'
import type { RowPress } from '../../composables/project/useRowOps'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('openbeads:locale', 'en')
})

const project = withLayers(createProject({ technique: 'loom', beadId: 'toho/cube/1.5mm', size: { width: 10, height: 10, unit: 'beads' } }), {
  frame: { technique: 'loom', row: 0, column: 0, rows: 11, columns: 40, beads: {} },
})

/** What the margin's Row progress shows, by its test ids and dividers. */
function shown(form: 'margin' | 'compact' | 'folded', drop: 0 | 1 | 2 = 0): string[] {
  const wrapper = mount(RowProgressControls, { props: { project, form, drop, testid: 'margin-progress' } })
  const parts = wrapper.findAll(':scope > *').map((part) =>
    part.classes('row-progress__divider') ? '|' : (part.attributes('data-testid') ?? part.find('[data-testid]').attributes('data-testid'))!.replace('margin-progress-', ''),
  )
  wrapper.unmount()
  return parts
}

describe('Row progress on the margin as its row runs out of room (MarginSheet card, ticket 0698)', () => {
  it('gives up its track, then its counter, keeping Row highlight with Row done to the last', () => {
    expect(shown('margin')).toEqual(['direction', 'reset', 'highlight', '|', 'compact-position', 'track', '|', 'previous'])
    expect(shown('margin', 1)).toEqual(['direction', 'reset', 'highlight', '|', 'compact-position', '|', 'previous'])
    expect(shown('margin', 2)).toEqual(['direction', 'reset', 'highlight', '|', 'previous'])
  })

  it('keeps Row highlight beside Row done in the compact and folded forms', () => {
    expect(shown('compact')).toEqual(['highlight', 'compact-position', 'track', 'next'])
    expect(shown('compact', 2)).toEqual(['highlight', 'next'])
    expect(shown('folded')).toEqual(['highlight', 'compact-position', 'next'])
    expect(shown('folded', 2)).toEqual(['highlight', 'next'])
  })
})

describe('the track’s spark (ProgressBar card, ticket 0730)', () => {
  const press = (id: number, done: boolean): RowPress => ({ id, done, from: 0, to: 1, patternDone: false })
  const spark = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="margin-progress-spark"]')

  it('is hidden before the first pass, rides the fill’s edge after it and stays at the end once every pass is done', async () => {
    const wrapper = mount(RowProgressControls, { props: { project, form: 'margin', testid: 'margin-progress' } })
    expect(spark(wrapper).attributes('hidden')).toBeDefined()

    await wrapper.setProps({ project: moveToRow(project, 1) })
    expect(spark(wrapper).attributes('hidden')).toBeUndefined()
    expect(spark(wrapper).attributes('style')).toContain(`translateX(${(1 / 11 - 1) * 100}%)`)

    await wrapper.setProps({ project: moveToRow(project, 11) })
    expect(spark(wrapper).attributes('hidden')).toBeUndefined()
    expect(spark(wrapper).attributes('style')).toContain('translateX(0%)')
  })

  it('flares on each Row done, restarting each time, and not on Row not done or on being shown', async () => {
    const wrapper = mount(RowProgressControls, { props: { project: moveToRow(project, 1), form: 'margin', testid: 'margin-progress', rowPress: press(1, true) } })
    expect(spark(wrapper).classes().filter((name) => name.includes('flaring'))).toEqual([])

    await wrapper.setProps({ rowPress: press(2, true) })
    expect(spark(wrapper).classes()).toContain('progress-track__spark--flaring')
    await wrapper.setProps({ rowPress: press(3, true) })
    expect(spark(wrapper).classes()).toContain('progress-track__spark--flaring-alt')
    await wrapper.setProps({ rowPress: press(4, false) })
    expect(spark(wrapper).classes()).toContain('progress-track__spark--flaring-alt')
    // The margin's track carries it at the compact size.
    expect(spark(wrapper).classes()).toContain('progress-track__spark--compact')
  })
})
