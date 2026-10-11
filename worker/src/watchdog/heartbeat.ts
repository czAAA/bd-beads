/** Where the watchdog reports each run (spec 385, "How it alerts"). */
export interface Heartbeat {
  /** Every measure under its warn level, and the run itself worked. */
  success(report: string): Promise<void>
  /** A measure over its level, or the run failed; `report` says which. */
  fail(report: string): Promise<void>
}

/**
 * One Healthchecks.io check per Worker (`watchdog-dev`, `watchdog-production`), whose ping URL is the secret
 * `HEALTHCHECK_URL`. Healthchecks emails only when the check changes state, so a day over a level brings one email
 * when it starts and one when it ends, with no state kept here; a run that never comes is noticed after the grace
 * period. The report goes in the ping's body, which Healthchecks shows in the email. Without a URL (a local run, or
 * before step H3d) the report is only logged.
 */
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
