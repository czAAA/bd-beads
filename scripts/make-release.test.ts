// The release command (ticket 1046, spec 1043), on throwaway git repos: `main` and the release branch in one repo.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildVersion } from '../vite.version.ts';
import { CHANGELOG } from './changelog.ts';
import { makeRelease } from './make-release.ts';
import { NOTES_DIR } from './noteOrder.ts';
import { RELEASE_RECORD } from './release.ts';
import type { Release } from './versions.ts';

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo: string;

function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8' }).trim();
}

function commit(files: Record<string, string> = {}): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'change');
}

const note = (name: string, kind: string) => ({
  [`${NOTES_DIR}/${name}.json`]: JSON.stringify({ date: name.slice(0, 10), kind, line: { en: `Line of ${name.slice(-4)}` } }),
});
const record = (): Release[] => JSON.parse(readFileSync(join(repo, RELEASE_RECORD), 'utf8')) as Release[];
const released = (version: string) => record().find((release) => release.version === version)?.notes;

/** The squash merge of the release branch: its record and changelog land on `main` as one commit. */
function mergeRelease(): void {
  git('switch', '-q', 'main');
  git('checkout', 'release', '--', RELEASE_RECORD, CHANGELOG);
  commit();
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'make-release-'));
  git('init', '-q', '-b', 'main');
  commit({
    [RELEASE_RECORD]: '[{ "version": "1.0.0", "date": "2026-11-17", "notes": [] }]\n',
    [`${NOTES_DIR}/before-1.0.0/2026-11-01-0001.json`]: JSON.stringify({ date: '2026-11-01', line: { en: 'An old line' } }),
  });
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('makeRelease', () => {
  it('adds the next release with today’s date and the number and kind of every unreleased note; the Build after is 2.0.0', () => {
    commit(note('2026-11-18-0002', 'new'));
    commit(note('2026-11-18-0001', 'fixed'));
    git('switch', '-q', '-c', 'release');

    expect(makeRelease(repo, 'main', '2026-12-01')).toEqual({ version: '2.0.0', notes: 2 });
    expect(record().at(-1)).toEqual({
      version: '2.0.0',
      date: '2026-12-01',
      notes: [
        { name: '2026-11-18-0002', version: '1.1.0', kind: 'new' },
        { name: '2026-11-18-0001', version: '1.1.1', kind: 'fixed' },
      ],
    });
    expect(readFileSync(join(repo, RELEASE_RECORD), 'utf8')).toBe(`[
  { "version": "1.0.0", "date": "2026-11-17", "notes": [] },
  { "version": "2.0.0", "date": "2026-12-01", "notes": [
    { "name": "2026-11-18-0002", "version": "1.1.0", "kind": "new" },
    { "name": "2026-11-18-0001", "version": "1.1.1", "kind": "fixed" }
  ] }
]
`);
    expect(readFileSync(join(repo, CHANGELOG), 'utf8')).toContain('## Release 2.0.0 · 2026-12-01');
    commit();
    expect(buildVersion(repo, true).version).toBe('2.0.0');
  });

  it('refuses, writing nothing, when no note is unreleased', () => {
    const before = readFileSync(join(repo, RELEASE_RECORD), 'utf8');

    expect(() => makeRelease(repo, 'main', '2026-12-01')).toThrow(/nothing to release/);
    expect(readFileSync(join(repo, RELEASE_RECORD), 'utf8')).toBe(before);
    expect(existsSync(join(repo, CHANGELOG))).toBe(false);
  });

  it('run again after main moved, refuses until main is merged in, then makes the same release with the new note', () => {
    commit(note('2026-11-18-0001', 'fixed'));
    git('switch', '-q', '-c', 'release');
    makeRelease(repo, 'main', '2026-12-01');
    commit();
    git('switch', '-q', 'main');
    commit(note('2026-11-19-0002', 'new'));
    git('switch', '-q', 'release');

    expect(() => makeRelease(repo, 'main', '2026-12-02')).toThrow(/merge main in/);
    git('merge', '-q', '--no-edit', 'main');
    expect(makeRelease(repo, 'main', '2026-12-02')).toEqual({ version: '2.0.0', notes: 2 });
    expect(record().map((release) => release.version)).toEqual(['1.0.0', '2.0.0']);
    expect(released('2.0.0')).toEqual([
      { name: '2026-11-18-0001', version: '1.0.1', kind: 'fixed' },
      { name: '2026-11-19-0002', version: '1.1.0', kind: 'new' },
    ]);
  });

  it('a note that slips in before the merge keeps its number from before the release, and the next release writes it down', () => {
    commit(note('2026-11-18-0001', 'fixed'));
    git('switch', '-q', '-c', 'release');
    makeRelease(repo, 'main', '2026-12-01');
    commit();
    git('switch', '-q', 'main');
    commit(note('2026-11-19-0002', 'fixed'));
    mergeRelease();

    expect(buildVersion(repo, true).version).toBe('2.0.0');
    commit(note('2026-12-02-0003', 'fixed'));
    expect(buildVersion(repo, true).version).toBe('2.0.1');
    git('switch', '-q', '-c', 'release-3');
    expect(makeRelease(repo, 'main', '2026-12-03')).toEqual({ version: '3.0.0', notes: 2 });
    expect(released('3.0.0')).toEqual([
      { name: '2026-11-19-0002', version: '1.0.2', kind: 'fixed' },
      { name: '2026-12-02-0003', version: '2.0.1', kind: 'fixed' },
    ]);
  });

  it('refuses a note that is on the branch but not on main', () => {
    git('switch', '-q', '-c', 'release');
    commit(note('2026-11-18-0001', 'fixed'));

    expect(() => makeRelease(repo, 'main', '2026-12-01')).toThrow(/differ from main/);
  });
});
