// What the app reads off the backend's answers the same way for every feature that asks it (spec 385's API contract;
// the Feedback sheet, signing in): whether there is internet at all, and the wait an answer asks for.

/** Whether the browser says there is no internet. */
export const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** The seconds an answer's `Retry-After` asks to wait; undefined when it names none. */
export function retryAfterSeconds(response: Response): number | undefined {
  const seconds = Number(response.headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}
