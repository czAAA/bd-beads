import { describe, expect, it } from 'vitest'
import { MAX_MAKER_NAME, normalizeMakerName, withMakerName } from './makerName'
import { createProject } from './createProject'

describe('normalizeMakerName', () => {
  it('trims and caps at the field length', () => {
    expect(normalizeMakerName('  Maria ')).toBe('Maria')
    expect(normalizeMakerName('x'.repeat(60))).toBe('x'.repeat(MAX_MAKER_NAME))
  })
})

describe('withMakerName', () => {
  const project = createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Fox', size: { width: 3, height: 3, unit: 'beads' } })

  it('sets the normalized name, and an empty one takes it off', () => {
    const named = withMakerName(project, '  Ada ')
    expect(named.makerName).toBe('Ada')
    expect('makerName' in withMakerName(named, '  ')).toBe(false)
  })
})
