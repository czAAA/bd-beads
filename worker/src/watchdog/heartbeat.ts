/** Where the watchdog reports each run (spec 385, "How it alerts"). */
export interface Heartbeat {
  /** Every measure under its warn level, and the run itself worked. */
  success(report: string): Promise<void>
  /** A measure over its level, or the run failed; `report` says which. */
  fail(report: string): Promise<void>
}

/** One Healthchecks.io check per Worker, ping URL in secret `HEALTHCHECK_URL`. It emails only on state change, so a
 * day over a level is one email at start and one at end, with no state kept here. The report is the ping body;
 * without a URL it is only logged. */
export function healthchecksHeartbeat(url: string | undefined): Heartbeat {
  async function ping(suffix: string, report: string): Promise<void> {
    if (!url) {
      console.log(`Watchdog (no HEALTHCHECK_URL set)${suffix}:\n${report}`)
      return
    }
    const response = await fetch(`${url.replace(/\/$/, '')}${suffix}`, { method: 'POST', body: report })
    if (!response.ok) throw new Error(`Healthchecks answered ${response.status}`)
  }
  return {
    success: (report) => ping('', report),
    fail: (report) => ping('/fail', report),
  }
}
