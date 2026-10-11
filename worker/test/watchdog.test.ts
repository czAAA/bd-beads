import { afterEach, describe, expect, it } from 'vitest'
import { startWorker, type Outbound, type RunningWorker, type StartOptions } from './harness.ts'

/**
 * Seam 2 (spec 385): the watchdog's scheduled run, black-box. Today's usage is the D1 counters (the Worker's default
 * source), set by the test; Telegram and Healthchecks.io are the harness's outbound calls. With the D1 counters the
 * levels are halved, so requests warn at 27,500 and stop at 40,000.
 */
const HEARTBEAT = 'https://hc-ping.example/watchdog-dev'
const TELEGRAM = 'https://api.telegram.org/bottoken123/sendMessage'

const at = (time: string) => new Date(`2026-10-12T${time}:00Z`)
const nextDay = (time: string) => new Date(`2026-10-13T${time}:00Z`)

describe('the watchdog', () => {
  let worker: RunningWorker

  async function start(options: StartOptions = {}): Promise<void> {
    worker = await startWorker({
      entry: 'fixture',
      vars: {
        TELEGRAM_BOT_TOKEN: 'token123',
        TELEGRAM_CHAT_ID: '42',
        HEALTHCHECK_URL: HEARTBEAT,
        SWITCHES_CACHE_SECONDS: '0',
        ...options.vars,
      },
      reply: options.reply,
    })
  }
  afterEach(() => worker.dispose())

  const setUsage = (day: string, measure: string, value: number) =>
    worker.db
      .prepare(
        'INSERT INTO usage_counters (day, measure, value) VALUES (?, ?, ?) ' +
          'ON CONFLICT (day, measure) DO UPDATE SET value = excluded.value',
      )
      .bind(day, measure, value)
      .run()

  const messages = () =>
    worker.outbound.filter((call) => call.url === TELEGRAM).map((call) => (JSON.parse(call.body) as { text: string }).text)
  const pings = () => worker.outbound.filter((call) => call.url.startsWith(HEARTBEAT)).map((call) => call.url)
  const forget = () => worker.outbound.splice(0)
  const isOff = async (feature: string) => (await worker.fetch(`/api/test/feature/${feature}`)).status === 503

  it('sends nothing below the warn level, and pings its heartbeat', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 27_000)
    expect(await worker.scheduled(at('10:00'))).toBe('ok')
    expect(messages()).toEqual([])
    expect(pings()).toEqual([HEARTBEAT])
  })

  it('warns once a day per measure, naming the Worker, the measure and the value', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 30_000)
    await worker.scheduled(at('10:00'))
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toContain('bd-beads dev')
    expect(messages()[0]).toContain('requests')
    expect(messages()[0]).toContain('30,000')
    expect(await isOff('view-links')).toBe(false)

    forget()
    await worker.scheduled(at('10:15'))
    expect(messages()).toEqual([])
    expect(pings()).toEqual([HEARTBEAT])
  })

  it('past the stop level switches off the most exposed feature first, then the next if usage stays over', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 41_000)
    await worker.scheduled(at('10:00'))
    expect(await isOff('view-links')).toBe(true)
    expect(await isOff('sign-up')).toBe(false)
    expect(await isOff('sync')).toBe(false)
    const stop = messages().find((text) => text.includes('Switched off'))
    expect(stop).toContain('view-links')
    expect(stop).toContain('41,000')
    expect(stop).toContain('00:00 UTC')
    expect(stop).toContain('sign-up is next')

    await worker.scheduled(at('10:15'))
    expect(await isOff('sign-up')).toBe(true)
    expect(await isOff('sync')).toBe(false)
    expect(messages().filter((text) => text.includes('Switched off'))).toHaveLength(2)

    forget()
    await worker.scheduled(at('10:30'))
    expect(messages()).toEqual([])
    expect(await isOff('sync')).toBe(false)
  })

  it('keeps the app loading and /api/health answering while it has switched features off', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 41_000)
    await worker.scheduled(at('10:00'))
    expect((await worker.fetch('/api/health')).status).toBe(200)
    expect((await worker.fetch('/')).status).toBe(200)
  })

  it('lifts its own switches at the first run of the next UTC day, and not the maintainer’s', async () => {
    await start({ vars: { DISABLED_FEATURES: 'sync' } })
    await setUsage('2026-10-12', 'requests', 41_000)
    await worker.scheduled(at('23:45'))
    expect(await isOff('view-links')).toBe(true)

    forget()
    await worker.scheduled(nextDay('00:00'))
    expect(await isOff('view-links')).toBe(false)
    expect(await isOff('sync')).toBe(true)
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toContain('view-links')
    expect(messages()[0]).toContain('new UTC day')

    // Still under the day's levels, so nothing is switched off again.
    forget()
    await worker.scheduled(nextDay('00:15'))
    expect(messages()).toEqual([])
    expect(await isOff('view-links')).toBe(false)
  })

  it('makes up a missed 00:00 run at the next run', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 41_000)
    await worker.scheduled(at('23:45'))
    await worker.scheduled(nextDay('00:45'))
    expect(await isOff('view-links')).toBe(false)
  })

  it('warns again on a new day', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 30_000)
    await setUsage('2026-10-13', 'requests', 30_000)
    await worker.scheduled(at('10:00'))
    await worker.scheduled(nextDay('10:00'))
    expect(messages()).toHaveLength(2)
  })

  it('reports a failed run to Healthchecks.io and to Telegram, and tries the warning again next run', async () => {
    let telegramUp = false
    await start({
      reply: ({ url }) => (url === TELEGRAM && !telegramUp ? new Response('down', { status: 502 }) : new Response('OK')),
    })
    await setUsage('2026-10-12', 'requests', 30_000)
    expect(await worker.scheduled(at('10:00'))).toBe('exception')
    expect(pings()).toEqual([`${HEARTBEAT}/fail`])

    telegramUp = true
    forget()
    await worker.scheduled(at('10:15'))
    expect(messages().some((text) => text.includes('past the warn level'))).toBe(true)
    expect(pings()).toEqual([HEARTBEAT])
  })

  it('still switches off every measure’s feature when a message cannot be sent', async () => {
    await start({ reply: ({ url }) => (url === TELEGRAM ? new Response('down', { status: 502 }) : new Response('OK')) })
    await setUsage('2026-10-12', 'requests', 41_000)
    await setUsage('2026-10-12', 'magic-link-emails', 95)
    expect(await worker.scheduled(at('10:00'))).toBe('exception')
    expect(await isOff('view-links')).toBe(true)
    expect(await isOff('magic-link')).toBe(true)
  })

  it('does not lift a switch the maintainer set by hand in D1 at the new day', async () => {
    await start()
    await worker.db
      .prepare("INSERT INTO switches (feature, reason, set_at, source) VALUES ('sync', 'by hand', 0, 'manual')")
      .run()
    await worker.scheduled(at('10:00'))
    await worker.scheduled(nextDay('00:00'))
    expect(await isOff('sync')).toBe(true)
  })

  it('halves the request levels when it keeps its own counters', async () => {
    await start()
    // 28,000 requests is past half the 55,000 warn level.
    await setUsage('2026-10-12', 'requests', 28_000)
    await worker.scheduled(at('10:00'))
    expect(messages()).toHaveLength(1)
    expect(messages()[0]).toContain('requests')
    expect(messages()[0]).toContain('27,500')
  })

  it('keeps magic-link and requests escalating independently when both are over their stop levels', async () => {
    await start()
    await setUsage('2026-10-12', 'requests', 41_000)
    await setUsage('2026-10-12', 'magic-link-emails', 95)
    await worker.scheduled(at('10:00'))
    expect(await isOff('view-links')).toBe(true)
    expect(await isOff('sign-up')).toBe(false)
    expect(await isOff('magic-link')).toBe(true)
  })

  it('switches a feature off even when Telegram is down', async () => {
    await start({ reply: ({ url }) => (url === TELEGRAM ? new Response('down', { status: 502 }) : new Response('OK')) })
    await setUsage('2026-10-12', 'requests', 41_000)
    expect(await worker.scheduled(at('10:00'))).toBe('exception')
    expect(await isOff('view-links')).toBe(true)
  })

  it('lowers its levels with WATCHDOG_LEVEL_FACTOR, to try the alerts on dev', async () => {
    await start({ vars: { WATCHDOG_LEVEL_FACTOR: '0.001' } })
    await setUsage('2026-10-12', 'requests', 30)
    await worker.scheduled(at('10:00'))
    expect(await isOff('view-links')).toBe(false)
    expect(messages()).toHaveLength(1)
    await setUsage('2026-10-12', 'requests', 45)
    await worker.scheduled(at('10:15'))
    expect(await isOff('view-links')).toBe(true)
  })
})

describe('the watchdog reading Cloudflare’s analytics', () => {
  it('uses the account-wide numbers at full levels', async () => {
    const calls: Outbound[] = []
    const worker = await startWorker({
      entry: 'fixture',
      vars: {
        USAGE_SOURCE: 'graphql',
        CF_ACCOUNT_ID: 'acct1',
        CF_ANALYTICS_TOKEN: 'analytics-token',
        TELEGRAM_BOT_TOKEN: 'token123',
        TELEGRAM_CHAT_ID: '42',
      },
      reply: (call) => {
        calls.push(call)
        if (call.url !== 'https://api.cloudflare.com/client/v4/graphql') return new Response('{}')
        return Response.json({
          data: {
            viewer: {
              accounts: [
                {
                  workers: [{ sum: { requests: 40_000 } }, { sum: { requests: 17_000 } }],
                  d1Writes: [{ sum: { rowsWritten: 1_000 } }],
                  d1Storage: [{ max: { databaseSizeBytes: 5_000_000 }, dimensions: { databaseId: 'db1' } }],
                  r2Storage: [{ max: { payloadSize: 6 * 1024 ** 3, metadataSize: 0 } }],
                },
              ],
            },
          },
          errors: null,
        })
      },
    })
    try {
      expect(await worker.scheduled(at('10:00'))).toBe('ok')
      const analytics = calls.find((call) => call.url.includes('/graphql'))
      expect(analytics?.headers.authorization).toBe('Bearer analytics-token')
      expect(JSON.parse(analytics?.body ?? '{}').variables).toMatchObject({ account: 'acct1', day: '2026-10-12' })
      const texts = calls.filter((call) => call.url.includes('telegram')).map((call) => JSON.parse(call.body).text as string)
      // 57,000 requests is past the warn level (55,000) but not the stop level (80,000): nothing is switched off.
      expect(texts).toHaveLength(2)
      expect(texts[0]).toContain('requests today is 57,000')
      // R2 storage has no stop level: a paying customer's data is never refused, so it only warns.
      expect(texts[1]).toContain('r2-storage today is 6.0 GB')
      expect((await worker.db.prepare('SELECT * FROM switches').all()).results).toEqual([])
    } finally {
      await worker.dispose()
    }
  })
})
