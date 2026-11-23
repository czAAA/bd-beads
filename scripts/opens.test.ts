import { describe, expect, it } from 'vitest'
import { opensReport, type OpensRow } from './opens.ts'

const row = (day: string, opens: number, fields: Partial<OpensRow> = {}): OpensRow => ({
  day,
  first: 0,
  since: '1',
  installed: 0,
  version: '1.14.22',
  opens,
  ...fields,
})

describe('opensReport', () => {
  const rows = [
    row('2026-11-23', 5),
    row('2026-11-23', 2, { first: 1, since: '' }),
    row('2026-11-23', 3, { installed: 1, version: '1.15.0', since: '2-7' }),
    row('2026-11-16', 4),
    row('2026-09-01', 9),
  ]

  it('adds up each day: new against returning, installed against tab', () => {
    const report = opensReport('production', rows, [], '2026-11-23')
    expect(report).toContain('App opens, production Worker')
    expect(report).toMatch(/2026-11-23\s+10\s+2\s+8\s+3\s+7/)
    expect(report).toMatch(/2026-11-16\s+4\s+0\s+4\s+0\s+4/)
  })

  it('leaves days older than 30 out of the days, but not out of the months', () => {
    const report = opensReport('dev', rows, [], '2026-11-23')
    const days = report.split('Per week')[0]
    expect(days).not.toContain('2026-09-01')
    expect(report).toMatch(/2026-09\s+9/)
    expect(report).toMatch(/2026-11\s+14/)
  })

  it('groups weeks from Monday and versions and since buckets over the last 30 days', () => {
    const report = opensReport('dev', rows, [], '2026-11-23')
    expect(report).toMatch(/2026-11-23\s+10/)
    expect(report).toMatch(/1\.15\.0\s+3/)
    expect(report).toMatch(/1\.14\.22\s+11/)
    expect(report).toMatch(/2-7\s+3/)
  })

  it('marks a day whose total passed its rows as junk', () => {
    const report = opensReport('dev', rows, [{ day: '2026-11-23', opens: 11 }, { day: '2026-11-16', opens: 4 }], '2026-11-23')
    expect(report).toMatch(/2026-11-23.*ceiling reached: junk/)
    expect(report).not.toMatch(/2026-11-16.*junk/)
  })

  it('says so when there is nothing', () => {
    expect(opensReport('dev', [], [], '2026-11-23')).toContain('(none)')
  })
})
