// What the build tells the app about itself (ticket 1045, spec 1043, ADR 0096): its Version, its build mark (the short
// commit hash) and the date of its newest note or release. The package file's version is not read.
import type { Plugin } from 'vite';
import { numberUnreleased, readNoteFiles } from './scripts/notes.ts';
import { git } from './scripts/release.ts';

export interface BuildVersion {
  version: string;
  /** The commit's hash, seven characters; `dev` outside git. */
  mark: string;
  /** The day of the newest note or release, `YYYY-MM-DD`. */
  date: string;
}

/** The Build's Version from the release record and the note files in `root`. A note git can't place (no git, a shallow
 * checkout) fails a build that `ships`; elsewhere (the dev server, the unit tests) it goes last, by file name, as does
 * one not yet committed. */
export function buildVersion(root: string, ships: boolean): BuildVersion {
  const files = readNoteFiles(root);
  const numbered = numberUnreleased(root, files, ships);
  if (!numbered) {
    throw new Error(`The Version can't be worked out without git's whole history: fetch it (\`git fetch --unshallow\`, or \`fetch-depth: 0\` in CI) and build again (spec 1043).`);
  }
  const unreleased = new Set(numbered.notes.map((note) => note.name));
  const dates = [...files.notes.filter((note) => unreleased.has(note.name)), ...files.record].map((dated) => dated.date);
  return { version: numbered.build, mark: commitMark(root, ships), date: dates.sort().at(-1) ?? '' };
}

function commitMark(root: string, ships: boolean): string {
  try {
    return git(root, ['rev-parse', 'HEAD']).slice(0, 7);
  } catch (error) {
    if (ships) throw error;
    return 'dev';
  }
}

/** Fails a build that ships when git can't place a note (spec 1043): only `vite build`, never the dev server, knip
 * reading the config, or a build inside the unit tests (vite.pwa.test.ts), which place such a note last. */
export function versionGuard(): Plugin {
  return {
    name: 'openbeads-version-guard',
    apply: 'build',
    // Before anything is bundled, so no later plugin's error hides this one.
    configResolved(config) {
      if (!process.env.VITEST) buildVersion(config.root, true);
    },
  };
}
