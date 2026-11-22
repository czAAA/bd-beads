// Ticket 1204: the worker installs all of its file list or nothing, so one listed file the host doesn't serve stops
// every device that has the app from updating. `node scripts/precache-guard.ts <dist>` fails when the build lacks a
// listed file; with a host's address after it, when the host doesn't answer 200 for one (docs/deploy.md).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { precacheOf, SERVICE_WORKER_FILE } from '../vite.pwa.ts';

/** How many times a file is asked for: a new deploy can take a few seconds to reach every location. */
const ROUNDS = 6;
const ROUND_GAP_MS = 5000;
const ASK_TIMEOUT_MS = 10_000;
/** How many files are asked for at once. */
const AT_ONCE = 10;

/** The host as the check asks it; `fetch` fits, following redirects as the worker's own fetch does. */
type Ask = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number }>;

/** The list in the build's worker; a worker with none, or an empty one, is refused. */
function listedIn(dist: string): string[] {
  const listed = precacheOf(readFileSync(join(dist, SERVICE_WORKER_FILE), 'utf8'));
  if (listed.length === 0) throw new Error(`${SERVICE_WORKER_FILE} lists no files`);
  return listed;
}

/** The files the build's worker lists that the build itself lacks. */
export function missingFromBuild(dist: string): string[] {
  return listedIn(dist).filter((path) => !existsSync(join(dist, path)));
}

/** A listed file's address on the host, each part of its path escaped. */
function addressOf(host: string, path: string): string {
  return `${host.replace(/\/$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** What is wrong with the host's answer for one file, or null for a 200. */
async function answerFor(url: string, headers: Record<string, string>, ask: Ask): Promise<string | null> {
  try {
    const { status } = await ask(url, { headers, signal: AbortSignal.timeout(ASK_TIMEOUT_MS) });
    return status === 200 ? null : String(status);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** A file the host didn't answer 200 for, with that answer. */
interface Unserved {
  path: string;
  answer: string;
}

/** One round of asking: those of `paths` the host doesn't answer 200 for, asked a few at once. */
async function askFor(paths: string[], host: string, headers: Record<string, string>, ask: Ask): Promise<Unserved[]> {
  const unserved: Unserved[] = [];
  for (let start = 0; start < paths.length; start += AT_ONCE) {
    const batch = paths.slice(start, start + AT_ONCE);
    const answers = await Promise.all(batch.map((path) => answerFor(addressOf(host, path), headers, ask)));
    answers.forEach((answer, index) => {
      if (answer !== null) unserved.push({ path: batch[index], answer });
    });
  }
  return unserved;
}

/** The listed files the host at `host` doesn't answer 200 for, each with its last answer, after asking again for a
 * while for those it lacked. */
export async function notServed(
  dist: string,
  host: string,
  headers: Record<string, string>,
  ask: Ask = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
): Promise<string[]> {
  let unserved = await askFor(listedIn(dist), host, headers, ask);
  for (let round = 2; round <= ROUNDS && unserved.length > 0; round++) {
    await wait(ROUND_GAP_MS);
    unserved = await askFor(unserved.map(({ path }) => path), host, headers, ask);
  }
  return unserved.map(({ path, answer }) => `${path}: ${answer}`);
}

async function main([dist, host]: string[]): Promise<void> {
  if (!dist) throw new Error('usage: node scripts/precache-guard.ts <dist> [host address]');
  // The Access service token, where the host answers only through Access (ticket 395).
  const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env;
  const headers: Record<string, string> = id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {};
  const problems = host ? await notServed(dist, host, headers) : missingFromBuild(dist);
  if (problems.length === 0) return;
  const what = host ? `${host} doesn't serve` : 'the build lacks';
  for (const problem of problems) console.error(`::error::${SERVICE_WORKER_FILE} lists a file ${what}: ${problem}`);
  console.error('No device that has the app could install this worker, so none would update (ticket 1204).');
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
