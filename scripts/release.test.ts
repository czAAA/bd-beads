// The deploy's release decision (ticket 1044), on throwaway git repos: each test builds the `main` it needs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isRelease, productionCommit, RELEASE_RECORD } from './release.ts';

// The machine's own git config (signing, hooks, a default branch) stays out of the throwaway repos.
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo: string;

function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8' }).trim();
}

/** Writes the files and commits them on `main`; returns the commit's hash. */
function commit(files: Record<string, string>): string {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'change');
  return git('rev-parse', 'HEAD');
}

const record = (...versions: string[]) => ({ [RELEASE_RECORD]: JSON.stringify(versions.map((version) => ({ version, date: '2026-11-18', notes: [] }))) });
const note = (name: string) => ({ [`src/data/releaseNotes/${name}.json`]: '{}' });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'release-'));
  git('init', '-q', '-b', 'main');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('before the first release', () => {
  it('no commit is a release, and production may get main’s head', () => {
    const first = commit(note('2026-11-17-0001'));
    const empty = commit(record());
    const head = commit(note('2026-11-17-0002'));

    expect([first, empty, head].map((c) => isRelease(repo, c))).toEqual([false, false, false]);
    expect(productionCommit(repo, 'main')).toBe(head);
  });
});

describe('a commit that adds a release', () => {
  it('is a release, and production may get it even after main moved on', () => {
    commit(record());
    const release = commit(record('1.0.0'));
    const after = commit(note('2026-11-18-0003'));

    expect(isRelease(repo, release)).toBe(true);
    expect(isRelease(repo, after)).toBe(false);
    expect(productionCommit(repo, 'main')).toBe(release);
  });

  it('counts when the record is new in that commit', () => {
    commit(note('2026-11-17-0001'));
    const release = commit(record('1.0.0'));

    expect(isRelease(repo, release)).toBe(true);
  });
});

describe('a commit that changes the record without adding a release', () => {
  it('is not a release, and leaves production on the release before it', () => {
    const release = commit(record('1.0.0'));
    const edit = commit({ [RELEASE_RECORD]: JSON.stringify([{ version: '1.0.0', date: '2026-11-19', notes: [] }]) });

    expect(isRelease(repo, edit)).toBe(false);
    expect(productionCommit(repo, 'main')).toBe(release);
  });
});

describe('two releases', () => {
  it('both are releases, and production may get only the newer', () => {
    commit(record());
    const first = commit(record('1.0.0'));
    commit(note('2026-11-20-0004'));
    const second = commit(record('1.0.0', '2.0.0'));
    commit(note('2026-11-21-0005'));

    expect([first, second].map((c) => isRelease(repo, c))).toEqual([true, true]);
    expect(productionCommit(repo, 'main')).toBe(second);
    expect(productionCommit(repo, `${second}^`)).toBe(first);
  });
});

describe('the command line', () => {
  const script = join(import.meta.dirname, 'release.ts');
  const run = (...args: string[]) => execFileSync(process.execPath, [script, ...args], { cwd: repo, encoding: 'utf8' }).trim();

  it('answers both questions on standard output', () => {
    commit(record());
    const release = commit(record('1.0.0'));

    expect(run('is-release', release)).toBe('true');
    expect(run('production', 'main')).toBe(release);
  });
});

describe('a record that is not a list of releases', () => {
  it('fails rather than guess', () => {
    const broken = commit({ [RELEASE_RECORD]: JSON.stringify([{ date: '2026-11-18' }]) });

    expect(() => isRelease(repo, broken)).toThrow(/each with its version/);
  });
});
