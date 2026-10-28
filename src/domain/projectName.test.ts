import { describe, expect, it } from 'vitest'
import { createProject } from './createProject'
import { duplicateProject, normalizeProjectName, suggestCopyName, withProjectName } from './projectName'

const moth = () => createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 4, height: 4, unit: 'beads' } })

describe('suggestCopyName', () => {
  it('adds 2 to a name, then the next free number', () => {
    expect(suggestCopyName('Moth', ['Moth'])).toBe('Moth 2')
    expect(suggestCopyName('Moth', ['Moth', 'Moth 2'])).toBe('Moth 3')
    expect(suggestCopyName('Moth', ['Moth', 'Moth 2', 'moth 3'])).toBe('Moth 4')
  })

  it('gives a name ending in a number the next free one', () => {
    expect(suggestCopyName('Moth 2', ['Moth', 'Moth 2'])).toBe('Moth 3')
    expect(suggestCopyName('Moth 2', ['Moth 2', 'Moth 3'])).toBe('Moth 4')
    expect(suggestCopyName('2024', [])).toBe('2024 2')
  })

  it('keeps the suggestion inside 40 characters', () => {
    expect(suggestCopyName('x'.repeat(40), [])).toBe(`${'x'.repeat(38)} 2`)
  })
})

describe('naming a Project', () => {
  it('trims and cuts a name, and an empty one stays empty', () => {
    expect(normalizeProjectName('  Fox  ')).toBe('Fox')
    expect(normalizeProjectName('y'.repeat(50))).toHaveLength(40)
    expect(normalizeProjectName('   ')).toBe('')
    expect(withProjectName(moth(), ' Owl ').name).toBe('Owl')
  })

  it('duplicates under a new id and name and keeps everything else, Row progress included', () => {
    const original = { ...moth(), rowProgress: { direction: 'rows' as const, currentRow: 3, currentColumn: 0 }, makerName: 'Maria' }
    const copy = duplicateProject(original, 'Moth 2', 'copy-id', 5)
    expect(copy).toEqual({ ...original, id: 'copy-id', name: 'Moth 2', createdAt: 5, updatedAt: 5 })
    expect(copy.rowProgress).not.toBe(original.rowProgress)
  })
})
