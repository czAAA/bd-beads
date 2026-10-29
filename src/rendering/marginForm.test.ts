import { describe, expect, it } from 'vitest'
import { marginForm } from './marginForm'

describe('the margin sheet\'s form by its band (MarginSheet card, Zoom forms, ticket 0658)', () => {
  it('is full from 68px, compact from 40px, folded from 31px and the paper alone under that', () => {
    expect([80, 68, 67.9, 40, 39.9, 31, 30.9, 8].map(marginForm)).toEqual(['full', 'full', 'compact', 'compact', 'folded', 'folded', 'bare', 'bare'])
  })
})
