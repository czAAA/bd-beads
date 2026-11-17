// The number rule (ticket 1045, spec 1043, ADR 0096), pure: the first number steps at a Production release, the second at
// a New note, the third at a Changed or Fixed one, and a step sets the numbers after it to 0. Released notes keep the
// number the release record holds; git order (scripts/noteOrder.ts) places only the notes merged since.

/** A Release note's kind: the maker can do something new, something works differently, or something wrong now works. */
export type Kind = 'new' | 'changed' | 'fixed';

/** A note with its number, as the release record holds it and as the rule gives it. */
export interface NumberedNote {
  /** The note's file name without `.json`: its day and ticket. */
  name: string;
  version: string;
  kind: Kind;
}

/** One Production release in the record, `src/data/releases.json`. */
export interface Release {
  version: string;
  /** The day it was made, `YYYY-MM-DD`. */
  date: string;
  notes: NumberedNote[];
}

function step(version: string, kind: Kind): string {
  const [first, second, third] = version.split('.').map(Number);
  return kind === 'new' ? `${first}.${second + 1}.0` : `${first}.${second}.${third + 1}`;
}

/** The Version the line was at just before the newest release: its last note's, else the release before's, else 0.0.0. */
function beforeNewest(record: readonly Release[]): string {
  return record.at(-1)?.notes.at(-1)?.version ?? record.at(-2)?.version ?? '0.0.0';
}

/** Every note's Version (the record's as it holds them, then the others in merge order) and the Build's. The first
 * `mergedBeforeNewest` of the others merged before the newest release's commit though its list doesn't hold them, so
 * they keep the number they had before it. */
export function numberNotes(
  record: readonly Release[],
  unreleased: readonly { name: string; kind: Kind }[],
  mergedBeforeNewest: number,
): { notes: NumberedNote[]; build: string } {
  const newest = record.at(-1);
  const before = newest ? mergedBeforeNewest : 0;
  const notes = record.flatMap((release) => release.notes);
  let version = beforeNewest(record);
  unreleased.forEach((note, i) => {
    if (i === before) version = newest?.version ?? version;
    version = step(version, note.kind);
    notes.push({ name: note.name, version, kind: note.kind });
  });
  const build = unreleased.length > before ? version : (newest?.version ?? version);
  return { notes, build };
}

/** The Version the next Production release gets: the newest release's first number plus one. */
export function nextRelease(record: readonly Release[]): string {
  return `${Number(record.at(-1)?.version.split('.')[0] ?? 0) + 1}.0.0`;
}
