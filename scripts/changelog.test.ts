// CHANGELOG.md (ticket 1046, spec 1043): what the generator writes, and that the committed file is exactly that.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHANGELOG, changelog, newestRelease } from './changelog.ts';
import { readNoteFiles, type NoteFiles } from './notes.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const FILES: NoteFiles = {
  record: [
    { version: '1.0.0', date: '2026-11-17', notes: [] },
    {
      version: '2.0.0',
      date: '2026-12-01',
      notes: [
        { name: '2026-11-18-0001', version: '1.1.0', kind: 'new' },
        { name: '2026-11-19-0002', version: '1.1.1', kind: 'fixed' },
        { name: '2026-11-20-0003', version: '1.2.0', kind: 'new' },
      ],
    },
  ],
  notes: [
    { name: '2026-11-18-0001', date: '2026-11-18', kind: 'new', line: 'Mirror a Piece', lines: {} },
    { name: '2026-11-19-0002', date: '2026-11-19', kind: 'fixed', line: 'Undo | Redo keep the Frame', lines: {} },
    { name: '2026-11-20-0003', date: '2026-11-20', kind: 'new', line: 'Lift a Piece', lines: {} },
    { name: '2026-12-02-0004', date: '2026-12-02', kind: 'changed', line: 'The grid is lighter', lines: {} },
  ],
  before: [
    { name: '2026-10-29-0694', date: '2026-10-29', line: 'The oldest', lines: {} },
    { name: '2026-10-30-0703', date: '2026-10-30', line: 'The newer', lines: {} },
  ],
};

const released = (text: string) => text.slice(text.indexOf('\n## '));

describe('changelog', () => {
  it('lists each release newest first, its blocks newest first with a row per note, then the notes from before 1.0.0 by date', () => {
    expect(released(changelog(FILES))).toBe(`
## Release 2.0.0 · 2026-12-01

### 1.2.0 · 2026-11-20

| Version | Kind | Change | Ticket |
|---|---|---|---|
| 1.2.0 | New | Lift a Piece | 0003 |

### 1.1.1 · 2026-11-19

| Version | Kind | Change | Ticket |
|---|---|---|---|
| 1.1.1 | Fixed | Undo \\| Redo keep the Frame | 0002 |
| 1.1.0 | New | Mirror a Piece | 0001 |

## Release 1.0.0 · 2026-11-17

No Release notes.

## Before 1.0.0

| Date | Change | Ticket |
|---|---|---|
| 2026-10-30 | The newer | 0703 |
| 2026-10-29 | The oldest | 0694 |
`);
  });

  it('holds only the released part; printed, the notes the next release would hold come first', () => {
    expect(changelog(FILES)).not.toContain('The grid is lighter');
    const printed = released(changelog(FILES, [{ name: '2026-12-02-0004', version: '2.0.1', kind: 'changed' }]));
    expect(printed.startsWith('\n## Unreleased: what the next release would hold\n\n### 2.0.1 · 2026-12-02\n')).toBe(true);
    expect(printed.indexOf('| 2.0.1 | Changed | The grid is lighter | 0004 |')).toBeLessThan(printed.indexOf('## Release 2.0.0'));
    expect(changelog(FILES, [])).toContain('Nothing yet: the release command refuses until a Release note merges.');
  });

  it('refuses a released note whose file is gone', () => {
    expect(() => changelog({ ...FILES, notes: [] })).toThrow(/2026-11-20-0003 is in the release record but its file is gone/);
  });

  it('is committed as the generator writes it (after changing a released note or the record, run `npm run changelog`)', () => {
    expect(readFileSync(new URL(`../${CHANGELOG}`, import.meta.url), 'utf8')).toBe(changelog(readNoteFiles(ROOT)));
  });
});

// The GitHub Release a Production release makes (ticket 1134): its Version and its section of CHANGELOG.md.
describe('newestRelease', () => {
  it('is the newest release’s Version and its section of the changelog, without the section’s heading', () => {
    const { version, notes } = newestRelease(FILES);
    expect(version).toBe('2.0.0');
    expect(notes).toBe(`
### 1.2.0 · 2026-11-20

| Version | Kind | Change | Ticket |
|---|---|---|---|
| 1.2.0 | New | Lift a Piece | 0003 |

### 1.1.1 · 2026-11-19

| Version | Kind | Change | Ticket |
|---|---|---|---|
| 1.1.1 | Fixed | Undo \\| Redo keep the Frame | 0002 |
| 1.1.0 | New | Mirror a Piece | 0001 |
`);
    expect(changelog(FILES)).toContain(`## Release 2.0.0 · 2026-12-01\n${notes}`);
  });

  it('says so for a release with no Release notes', () => {
    expect(newestRelease({ ...FILES, record: FILES.record.slice(0, 1) })).toEqual({ version: '1.0.0', notes: '\nNo Release notes.\n' });
  });

  it('refuses a Version that is not plain X.Y.Z', () => {
    for (const version of ['2.0', 'v2.0.0', '2.0.0-rc.1', '2.0.0; echo hi', '02.0.0\n']) {
      expect(() => newestRelease({ ...FILES, record: [{ version, date: '2026-12-01', notes: [] }] })).toThrow(/is not a plain X\.Y\.Z Version/);
    }
  });

  it('refuses an empty release record', () => {
    expect(() => newestRelease({ ...FILES, record: [] })).toThrow(/no release/);
  });
});
