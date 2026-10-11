import type { Env } from '../env'

/** Where the watchdog's messages go (spec 385: Telegram now; email through Cloudflare once the domain exists). */
export interface Notifier {
  notify(message: string): Promise<void>
}

/** Telegram's Bot API, with the bot token and chat id from secrets. A failed send throws, so the run is seen as failed. */
export function telegramNotifier(env: Env): Notifier {
  return {
    async notify(message) {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set')
      }
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
      })
      if (!response.ok) throw new Error(`Telegram answered ${response.status}`)
    },
  }
}

/** Pings this Worker's Healthchecks.io check, so a watchdog that stops running is noticed after one missed hour. */
export interface Heartbeat {
  ok(): Promise<void>
  fail(): Promise<void>
}

/** Healthchecks.io: `GET <url>` is a success, `<url>/fail` a failure. With no URL set (local runs) it does nothing. */
export function healthchecksHeartbeat(env: Env): Heartbeat {
  const ping = async (suffix: string) => {
    if (!env.HEALTHCHECK_URL) return
    await fetch(env.HEALTHCHECK_URL.replace(/\/+$/, '') + suffix)
  }
  return { ok: () => ping(''), fail: () => ping('/fail') }
}
