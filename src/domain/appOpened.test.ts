import { describe, expect, it } from 'vitest'
import { isUtcDay, openPing, parseOpenPing, sinceBucket, utcDay } from './appOpened'

describe('openPing', () => {
  it('is a first open with no since when this device never sent one', () => {
    expect(openPing(null, '2026-11-23', false, '1.14.22')).toEqual({ first: true, installed: false, version: '1.14.22' })
  })

  it('is nothing on a day already sent', () => {
    expect(openPing('2026-11-23', '2026-11-23', true, '1.14.22')).toBeNull()
  })

  it('names the days since the last one as a bucket', () => {
    expect(openPing('2026-11-20', '2026-11-23', true, '1.14.22')).toEqual({ first: false, since: '2-7', installed: true, version: '1.14.22' })
  })
})

describe('sinceBucket', () => {
  it.each([
    ['2026-11-22', '1'],
    ['2026-11-21', '2-7'],
    ['2026-11-16', '2-7'],
    ['2026-11-15', '8-30'],
    ['2026-10-24', '8-30'],
    ['2026-10-23', '31+'],
    ['2025-01-01', '31+'],
    ['2026-11-30', '1'],
  ])('a last day of %s is %s', (last, bucket) => {
    expect(sinceBucket(last, '2026-11-23')).toBe(bucket)
  })
})

describe('utcDay and isUtcDay', () => {
  it('takes the UTC day, not the local one', () => {
    expect(utcDay(new Date('2026-11-23T23:59:59Z'))).toBe('2026-11-23')
  })

  it.each(['2026-11-23', '2000-01-01'])('%s is a day', (raw) => expect(isUtcDay(raw)).toBe(true))
  it.each(['', '2026-11-23T00:00', 'yesterday', '2026-13-45'])('%s is not', (raw) => expect(isUtcDay(raw)).toBe(false))
})

describe('parseOpenPing', () => {
  const later = { first: false, since: '8-30', installed: false, version: '1.2.3' }

  it.each([
    [{ first: true, installed: true, version: '1.2.3' }],
    [later],
    [{ ...later, since: '31+' }],
  ])('takes %j', (body) => {
    expect(parseOpenPing(body)).toEqual(body)
  })

  it.each([
    ['nothing', null],
    ['a list', [later]],
    ['a string', 'open'],
    ['an unknown field', { ...later, locale: 'en' }],
    ['since given with first', { ...later, first: true }],
    ['since missing without first', { first: false, installed: false, version: '1.2.3' }],
    ['since outside its set', { ...later, since: '3' }],
    ['since as a number', { ...later, since: 1 }],
    ['first not a boolean', { ...later, first: 'no' }],
    ['installed missing', { first: false, since: '1', version: '1.2.3' }],
    ['installed not a boolean', { ...later, installed: 1 }],
    ['a version with a suffix', { ...later, version: '1.2.3-beta' }],
    ['a version of two parts', { ...later, version: '1.2' }],
    ['a version too long', { ...later, version: '12345.0.0' }],
    ['a version as a number', { ...later, version: 1.2 }],
  ])('refuses %s', (_, body) => {
    expect(parseOpenPing(body)).toBeNull()
  })
})
