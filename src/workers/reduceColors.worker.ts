import { reduceRequested, type ReductionRequest } from '../domain/convertColors'

/** The color reduction off the main thread (ticket 1163): a noisy photo's takes seconds, and the page keeps painting
 * meanwhile. Answers each request with the id it came with. */
interface Scope {
  onmessage: ((event: { data: { id: number; request: ReductionRequest } }) => void) | null
  postMessage(message: unknown): void
}
const scope = self as unknown as Scope

scope.onmessage = ({ data }) => {
  scope.postMessage({ id: data.id, reduced: reduceRequested(data.request) })
}
