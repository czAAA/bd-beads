import { describe, expect, it } from 'vitest'
import { withColors } from './canvas'
import { keepAllowedEdits } from './allowedEdits'
import { createProject } from './createProject'
import { beadsOfLayer } from './layerRecord'
import { withFields } from '../testUtils/flatFields'

const open = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm' })

describe('what a drawing edit may leave', () => {
  it('does nothing with no Frame', () => {
    const painted = withFields(open, { beads: withColors(beadsOfLayer(open, 'canvas'), [{ row: 1, column: 1, color: '#ff0000' }]) })
    expect(beadsOfLayer(keepAllowedEdits(open, painted), 'canvas')).toEqual(painted.beads)
  })
})
