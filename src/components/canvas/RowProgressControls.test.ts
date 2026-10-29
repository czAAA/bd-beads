import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RowProgressControls from './RowProgressControls.vue'
import { createProject } from '../../domain/createProject'
import { withLayers } from '../../testUtils/layerFields'

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
