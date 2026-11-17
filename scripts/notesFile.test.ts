// The notes files (ticket 1047, spec 1043): what the build writes for each language, and that the app reads it back.
import { describe, expect, it } from 'vitest';
import { readNotesFile } from '../src/domain/notesFile.ts';
import type { NoteFile, NoteFiles } from './notes.ts';
import { notesFile } from './notesFile.ts';
import type { NumberedNote, Release } from './versions.ts';

const file = (name: string, line: string, ru?: string): NoteFile => ({
  name,
  date: name.slice(0, 10),
  kind: 'new',
  line,
  lines: { en: line, ...(ru ? { ru } : {}) },
});

const RECORD: Release[] = [
  { version: '1.0.0', date: '2026-11-17', notes: [] },
  { version: '2.0.0', date: '2026-12-01', notes: [{ name: '2026-11-18-0001', version: '1.1.0', kind: 'new' }, { name: '2026-11-19-0002', version: '1.1.1', kind: 'fixed' }] },
  { version: '3.0.0', date: '2026-12-10', notes: [{ name: '2026-12-02-0003', version: '2.0.1', kind: 'changed' }] },
];

const FILES: NoteFiles = {
  record: RECORD,
  notes: [
    file('2026-11-18-0001', 'Mirror a Piece', 'Отразите кусочек'),
    file('2026-11-19-0002', 'Undo keeps the Frame'),
    file('2026-12-02-0003', 'The grid is lighter'),
    file('2026-12-11-0004', 'Lift a Piece'),
  ],
  before: [file('2026-10-29-0694', 'The oldest')],
};

const UNRELEASED: NumberedNote[] = [{ name: '2026-12-11-0004', version: '3.1.0', kind: 'new' }];

describe('notesFile', () => {
  it('holds the Build’s Version, the last two releases, and only the notes since the older of them, newest first', () => {
    const written = notesFile(FILES, UNRELEASED, '3.1.0', 'en');
    expect(written.version).toBe('3.1.0');
    expect(written.releases).toEqual([{ version: '2.0.0', date: '2026-12-01' }, { version: '3.0.0', date: '2026-12-10' }]);
    expect(written.notes).toEqual([
      { name: '2026-12-11-0004', version: '3.1.0', date: '2026-12-11', kind: 'new', line: 'Lift a Piece' },
      { name: '2026-12-02-0003', version: '2.0.1', date: '2026-12-02', kind: 'changed', line: 'The grid is lighter' },
    ]);
  });

  it('holds every note since the only release while there is one, and none from before 1.0.0', () => {
    const files = { ...FILES, record: RECORD.slice(0, 1), notes: FILES.notes.slice(0, 1) };
    const written = notesFile(files, [{ name: '2026-11-18-0001', version: '1.1.0', kind: 'new' }], '1.1.0', 'en');
    expect(written.releases).toEqual([{ version: '1.0.0', date: '2026-11-17' }]);
    expect(written.notes.map((note) => note.name)).toEqual(['2026-11-18-0001']);
  });

  it('writes each line in the file’s language, the English one where a note has none', () => {
    const files = { ...FILES, record: RECORD.slice(0, 2) };
    const lines = notesFile(files, [], '2.0.0', 'ru').notes.map((note) => note.line);
    expect(lines).toEqual(['Undo keeps the Frame', 'Отразите кусочек']);
  });

  it('is a file the app reads back as it was written', () => {
    const written = notesFile(FILES, UNRELEASED, '3.1.0', 'en');
    expect(readNotesFile(JSON.parse(JSON.stringify(written)))).toEqual(written);
  });

  it('fails on a released note whose file is gone', () => {
    expect(() => notesFile({ ...FILES, notes: [] }, [], '3.0.0', 'en')).toThrow('2026-12-02-0003 is in the release record but its file is gone');
  });
});
