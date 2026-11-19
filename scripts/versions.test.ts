// The number rule (ticket 1045, spec 1043, ADR 0096): a release record and the notes merged since, in merge order, in;
// every note's Version and the Build's out.
import { describe, expect, it } from 'vitest';
import { nextMajor, numberNotes, type Kind, type Release } from './versions.ts';

const release = (version: string, notes: Release['notes'] = []): Release => ({ version, date: '2026-11-17', notes });
const merged = (...kinds: Kind[]) => kinds.map((kind, i) => ({ name: `2026-11-18-${String(i + 1).padStart(4, '0')}`, kind }));
const versionsOf = (notes: { version: string }[]) => notes.map((note) => note.version);

describe('numberNotes', () => {
  it('a release with no note after it is the Build', () => {
    expect(numberNotes([release('1.0.0')], [], 0)).toEqual({ notes: [], build: '1.0.0' });
  });

  it.each([
    [['fixed'], ['1.0.1'], '1.0.1'],
    [['changed'], ['1.0.1'], '1.0.1'],
    [['new'], ['1.1.0'], '1.1.0'],
    [['fixed', 'changed', 'new', 'fixed'], ['1.0.1', '1.0.2', '1.1.0', '1.1.1'], '1.1.1'],
    [['new', 'new', 'changed'], ['1.1.0', '1.2.0', '1.2.1'], '1.2.1'],
  ] as [Kind[], string[], string][])('notes %j after release 1.0.0 get %j, and the Build is %s', (kinds, versions, build) => {
    const result = numberNotes([release('1.0.0')], merged(...kinds), 0);
    expect(versionsOf(result.notes)).toEqual(versions);
    expect(result.build).toBe(build);
  });

  it('a major release steps the first number and sets the others to 0', () => {
    const record = [
      release('1.0.0'),
      release('2.0.0', [
        { name: '2026-11-18-0001', version: '1.1.0', kind: 'new' },
        { name: '2026-11-18-0002', version: '1.1.1', kind: 'fixed' },
      ]),
    ];
    const result = numberNotes(record, merged('fixed'), 0);
    expect(result.notes).toEqual([
      { name: '2026-11-18-0001', version: '1.1.0', kind: 'new' },
      { name: '2026-11-18-0002', version: '1.1.1', kind: 'fixed' },
      { name: '2026-11-18-0001', version: '2.0.1', kind: 'fixed' },
    ]);
    expect(result.build).toBe('2.0.1');
  });

  it('a note that merged before a release but is not in its list keeps its number from before the release', () => {
    const record = [release('1.0.0'), release('2.0.0', [{ name: '2026-11-18-0001', version: '1.0.1', kind: 'fixed' }])];
    const unreleased = [
      { name: '2026-11-19-0002', kind: 'new' as const },
      { name: '2026-11-19-0003', kind: 'fixed' as const },
      { name: '2026-11-19-0004', kind: 'changed' as const },
    ];
    const result = numberNotes(record, unreleased, 2);
    expect(versionsOf(result.notes)).toEqual(['1.0.1', '1.1.0', '1.1.1', '2.0.1']);
    expect(result.build).toBe('2.0.1');
  });

  it('a release that kept its newest note’s number: the notes after go on from it', () => {
    const record = [
      release('1.0.0'),
      release('1.1.1', [
        { name: '2026-11-18-0001', version: '1.1.0', kind: 'new' },
        { name: '2026-11-18-0002', version: '1.1.1', kind: 'fixed' },
      ]),
    ];
    const result = numberNotes(record, merged('fixed', 'new'), 0);
    expect(versionsOf(result.notes).slice(2)).toEqual(['1.1.2', '1.2.0']);
    expect(result.build).toBe('1.2.0');
  });

  it('after a release that kept its number, a note not in its list keeps its number and the next never repeats it', () => {
    const record = [release('1.0.0'), release('1.0.1', [{ name: '2026-11-18-0001', version: '1.0.1', kind: 'fixed' }])];
    const unreleased = [
      { name: '2026-11-19-0002', kind: 'fixed' as const },
      { name: '2026-11-19-0003', kind: 'fixed' as const },
    ];
    expect(numberNotes(record, unreleased.slice(0, 1), 1).build).toBe('1.0.2');
    const result = numberNotes(record, unreleased, 1);
    expect(versionsOf(result.notes)).toEqual(['1.0.1', '1.0.2', '1.0.3']);
    expect(result.build).toBe('1.0.3');
  });

  it('with no release yet, notes count from 0.0.0', () => {
    expect(numberNotes([], merged('fixed', 'new'), 0).build).toBe('0.1.0');
  });
});

describe('nextMajor', () => {
  it('is the newest release’s first number plus one', () => {
    expect(nextMajor([release('1.0.0')])).toBe('2.0.0');
    expect(nextMajor([release('1.0.0'), release('1.4.2')])).toBe('2.0.0');
  });
});
