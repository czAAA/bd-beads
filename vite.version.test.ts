// The Version the build gives the app (ticket 1045, spec 1043), on throwaway git repos.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTES_DIR } from './scripts/noteOrder.ts';
import { RELEASE_RECORD } from './scripts/release.ts';
import { buildVersion } from './vite.version.ts';

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();
}

function write(files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
}

function commit(files: Record<string, string>): void {
  write(files);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'change');
}

const note = (name: string, kind: string) => ({ [`${NOTES_DIR}/${name}.json`]: JSON.stringify({ date: name.slice(0, 10), kind, line: {} }) });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'build-version-'));
  git(repo, 'init', '-q', '-b', 'main');
  commit({ [RELEASE_RECORD]: JSON.stringify([{ version: '1.0.0', date: '2026-11-17', notes: [] }]), [`${NOTES_DIR}/before-1.0.0/2026-11-01-0001.json`]: '{}' });
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('buildVersion', () => {
  it('is the release’s own Version, mark and date when no note followed it', () => {
    expect(buildVersion(repo, true)).toEqual({ version: '1.0.0', mark: git(repo, 'rev-parse', 'HEAD').slice(0, 7), date: '2026-11-17' });
  });

  it('steps for each note in merge order, a note not yet committed last', () => {
    commit(note('2026-11-19-0002', 'new'));
    commit(note('2026-11-18-0003', 'fixed'));
    write(note('2026-11-18-0001', 'new'));

    expect(buildVersion(repo, true)).toMatchObject({ version: '1.2.0', date: '2026-11-19' });
  });

  it('fails a build that ships from a shallow checkout, saying to fetch the whole history; the dev server goes on', () => {
    commit(note('2026-11-18-0001', 'fixed'));
    const shallow = mkdtempSync(join(tmpdir(), 'build-version-shallow-'));
    try {
      execFileSync('git', ['clone', '-q', '--depth=1', `file://${repo}`, shallow], { env: GIT_ENV });
      expect(() => buildVersion(shallow, true)).toThrow(/whole history/);
      expect(buildVersion(shallow, false).version).toBe('1.0.1');
    } finally {
      rmSync(shallow, { recursive: true, force: true });
    }
  });

  it('outside git, the dev server places the notes by file name and marks the Build dev', () => {
    commit(note('2026-11-18-0001', 'new'));
    rmSync(join(repo, '.git'), { recursive: true, force: true });

    expect(buildVersion(repo, false)).toMatchObject({ version: '1.1.0', mark: 'dev' });
    expect(() => buildVersion(repo, true)).toThrow(/whole history/);
  });
});
