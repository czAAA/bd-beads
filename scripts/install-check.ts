// Ticket 1205: `node scripts/install-check.ts <dist> <address>` opens the editor at `<address>/app/` in headless Chromium
// and fails unless this build's worker is active, in control and the editor opens offline. CI's other browser checks
// run on `vite preview`, which has none of the host's 404s or Access; this one meets the host itself (docs/deploy.md).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { SERVICE_WORKER_FILE } from '../vite.pwa.ts';

/** How long the worker has to install and take over: a new deploy can take a few seconds to reach every location, and
 * the worker fetches about a hundred files. Waited for once; the check is never run again until it passes.
 * `INSTALL_CHECK_TIMEOUT_MS` only shortens the wait, to read a failure's report sooner. */
const WORKER_TIMEOUT_MS = Number(process.env.INSTALL_CHECK_TIMEOUT_MS ?? 120_000);
const OFFLINE_TIMEOUT_MS = 30_000;
/** The editor's canvas, as the other browser checks wait for it. */
const EDITOR = '[data-testid="app-canvas"], [data-testid="app-canvas-placeholder"]';

/** The cache name this build's worker opens: `const CACHE = "bd-beads-…"`. */
export function cacheNameOf(source: string): string {
  const match = /^const CACHE = (["'])(bd-beads-[^"']+)\1/m.exec(source);
  if (!match) throw new Error(`no cache name in ${SERVICE_WORKER_FILE}`);
  return match[2];
}

/** What the browser saw, kept to print when the check fails. */
interface Seen {
  failed: string[];
  console: string[];
}

function watch(context: BrowserContext, page: Page): Seen {
  const seen: Seen = { failed: [], console: [] };
  context.on('requestfailed', (request) => seen.failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  context.on('response', (response) => {
    if (response.status() >= 300) seen.failed.push(`${response.request().method()} ${response.url()}: ${response.status()}`);
  });
  const note = (text: string) => seen.console.push(text);
  page.on('console', (message) => message.type() === 'error' && note(message.text()));
  page.on('pageerror', (error) => note(error.message));
  return seen;
}

/** The registration's workers by state: what a device would have. */
async function workerStates(page: Page): Promise<string> {
  try {
    return await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const log = (window as unknown as { workerLog?: string[] }).workerLog ?? [];
      const history = `states seen: ${log.join(' > ') || 'none'}`;
      if (registrations.length === 0) return `no registration (${history})`;
      return `${history} | ` + registrations
        .map((r) => `${r.scope}: ` + ([['installing', r.installing], ['waiting', r.waiting], ['active', r.active]] as const)
          .map(([name, worker]) => `${name}=${worker ? worker.state : 'none'}`).join(' '))
        .join('; ') + ` | controller=${navigator.serviceWorker.controller ? 'yes' : 'no'}`;
    });
  } catch (error) {
    return `unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Waits, once and generously, for an active worker that controls the page; throws when it never does. */
async function untilInControl(page: Page): Promise<void> {
  const deadline = Date.now() + WORKER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const inControl = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.active?.state === 'activated' && navigator.serviceWorker.controller !== null;
    });
    if (inControl) return;
    await page.waitForTimeout(500);
  }
  throw new Error(`no worker was active and in control of the page after ${WORKER_TIMEOUT_MS / 1000} s`);
}

const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

/** Runs the check; resolves with the problem, or null when the build installs and opens offline. */
async function installCheck(dist: string, address: string, headers: Record<string, string>): Promise<string | null> {
  const cache = cacheNameOf(readFileSync(join(dist, SERVICE_WORKER_FILE), 'utf8'));
  const origin = new URL(address).origin;
  const editor = new URL('app/', address.endsWith('/') ? address : `${address}/`).href;
  // The worker's own fetches show up in the context's events with this on.
  const browser = await chromium.launch({ env: { ...process.env, PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: '1' } as Record<string, string> });
  let page: Page | undefined;
  let seen: Seen = { failed: [], console: [] };
  try {
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    // The token goes to the address's own origin and nowhere else. The page's requests carry it; the worker's own
    // fetches may not, so Access's cookie, set by the first answer, is what they ride on.
    if (Object.keys(headers).length > 0) {
      await context.route(`${origin}/**`, (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
    }
    // Every state a worker passes through, for the report: a worker whose install fails is `redundant` and leaves no
    // registration to read afterwards.
    await context.addInitScript(() => {
      const log: string[] = [];
      (window as unknown as { workerLog: string[] }).workerLog = log;
      const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = async (...args) => {
        const registration = await register(...args);
        const worker = registration.installing ?? registration.waiting ?? registration.active;
        if (worker) {
          log.push(worker.state);
          worker.addEventListener('statechange', () => log.push(worker.state));
        }
        return registration;
      };
    });
    page = await context.newPage();
    seen = watch(context, page);
    await page.goto(editor, { waitUntil: 'load' });
    await untilInControl(page);
    const names = await cacheNames(page);
    if (!names.includes(cache)) throw new Error(`the worker is in control, but ${cache} (this build's cache) is not among the page's caches: ${names.join(', ') || 'none'}`);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load', timeout: OFFLINE_TIMEOUT_MS });
    await page.waitForSelector(EDITOR, { timeout: OFFLINE_TIMEOUT_MS });
    return null;
  } catch (error) {
    const lines = [`${error instanceof Error ? error.message.split('\n')[0] : String(error)}`];
    if (page) lines.push(`worker: ${await workerStates(page)}`);
    lines.push(`failed or non-2xx requests (${seen.failed.length}):`, ...seen.failed.slice(0, 50).map((line) => `  ${line}`));
    lines.push(`console errors (${seen.console.length}):`, ...seen.console.slice(0, 50).map((line) => `  ${line}`));
    return lines.join('\n');
  } finally {
    await browser.close();
  }
}

async function main([dist, address]: string[]): Promise<void> {
  if (!dist || !address) throw new Error('usage: node scripts/install-check.ts <dist> <address>');
  // The Access service token, for the address's origin alone (ticket 395). Never printed.
  const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = process.env;
  const headers: Record<string, string> = id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {};
  const problem = await installCheck(dist, address, headers);
  if (problem === null) {
    console.log(`${address}/app/: this build's worker is active, in control, and the editor opens offline`);
    return;
  }
  console.error(`::error::A browser could not install the app from ${address}`);
  console.error(problem);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
