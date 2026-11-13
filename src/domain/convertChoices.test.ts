import { describe, expect, it } from 'vitest'
import { findBead, offeredBeads } from './beads'
import { converterStart, FIRST_CONVERT_CHOICES, parseConvertChoices, writeConvertChoices, type ConvertChoices } from './convertChoices'
import { NEW_PROJECT_DEFAULTS } from './createProject'

const lastUsed: ConvertChoices = { beadId: 'miyuki/round/8-0', technique: 'brick', techniqueSettings: { brickDrop: 2 }, source: 'exact' }

describe('the converter’s remembered choices (ticket 0893, ADR 0010 D-3)', () => {
  it('start, on a device that has converted nothing, on Miyuki Delica 11/0 in peyote', () => {
    const bead = findBead(FIRST_CONVERT_CHOICES.beadId)
    expect(bead && offeredBeads().includes(bead)).toBe(true)
    expect(bead).toMatchObject({ brand: { id: 'miyuki' }, formFactor: { id: 'delica' }, size: '11/0' })
    expect(FIRST_CONVERT_CHOICES.technique).toBe('peyote')
    expect(FIRST_CONVERT_CHOICES.source).toBeUndefined()
  })

  it('read back what was written', () => {
    expect(parseConvertChoices(writeConvertChoices(lastUsed))).toEqual(lastUsed)
  })

  it('read back My beads as the last source (ticket 0902)', () => {
    expect(parseConvertChoices(writeConvertChoices({ ...lastUsed, source: 'my-beads' }))?.source).toBe('my-beads')
  })

  it('read nothing from a saved string that is not choices', () => {
    expect(parseConvertChoices('peyote')).toBeUndefined()
    expect(parseConvertChoices('[1,2]')).toBeUndefined()
    expect(parseConvertChoices('null')).toBeUndefined()
  })

  it('fall back part by part to the first-time choice: a Bead that left the catalog, an unknown Technique, a source that is none', () => {
    const saved = JSON.stringify({ beadId: 'old-maker/cube/2mm', technique: 'knit', techniqueSettings: { brickDrop: 2 }, source: 'my-shop' })
    expect(parseConvertChoices(saved)).toEqual(FIRST_CONVERT_CHOICES)
  })

  it('keep the parts that are fine beside one that is not, and put a Drop out of range back within it', () => {
    const saved = JSON.stringify({ beadId: 'gone/bead/1', technique: 'peyote', techniqueSettings: { peyoteDrop: 999 }, source: 'default' })
    const read = parseConvertChoices(saved)
    expect(read).toMatchObject({ beadId: FIRST_CONVERT_CHOICES.beadId, technique: 'peyote', source: 'default' })
    expect(read!.techniqueSettings.peyoteDrop).toBeLessThan(999)
  })

  it('tolerate fields a later build adds (the Finish filter, ticket 0901) and fields an earlier one left out', () => {
    expect(parseConvertChoices(JSON.stringify({ ...lastUsed, finish: 'matte' }))).toEqual(lastUsed)
    expect(parseConvertChoices(JSON.stringify({ beadId: lastUsed.beadId }))).toEqual({ ...FIRST_CONVERT_CHOICES, beadId: lastUsed.beadId })
  })
})

describe('where the converter opens (ticket 0893)', () => {
  const form = { ...NEW_PROJECT_DEFAULTS, name: 'Fox', makerName: 'Ann' }

  it('opens on the remembered Bead, Technique with its Drop and source when the form was left alone', () => {
    expect(converterStart(form, lastUsed)).toEqual({
      start: { name: 'Fox', makerName: 'Ann', beadId: lastUsed.beadId, technique: 'brick', techniqueSettings: { brickDrop: 2 } },
      source: 'exact',
    })
  })

  it('takes a Bead changed on the form over the remembered one, and keeps the remembered Technique', () => {
    const { start } = converterStart({ ...form, beadId: 'toho/round/11-0' }, lastUsed)
    expect(start).toMatchObject({ beadId: 'toho/round/11-0', technique: 'brick', techniqueSettings: { brickDrop: 2 } })
  })

  it('takes a Technique or a Drop changed on the form over the remembered one, and keeps the remembered Bead', () => {
    expect(converterStart({ ...form, technique: 'peyote' }, lastUsed).start).toMatchObject({ beadId: lastUsed.beadId, technique: 'peyote' })
    const dropOnly = { ...form, technique: 'brick' as const, techniqueSettings: { brickDrop: 3 } }
    expect(converterStart(dropOnly, lastUsed).start).toMatchObject({ technique: 'brick', techniqueSettings: { brickDrop: 3 } })
  })
})
