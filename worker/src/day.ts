/** The UTC day a time falls in, as `YYYY-MM-DD`: Cloudflare's daily caps reset at 00:00 UTC. */
export function utcDay(time: number | Date): string {
  return new Date(time).toISOString().slice(0, 10)
}
