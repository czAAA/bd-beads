import { parseOpeningAddress, type OpeningAddress } from '../domain/openingAddress'

/** Reads what the address the editor opened at asks for (ticket 0716), then puts the plain address back, so a reload
 * after the person has moved on opens as usual; a bookmark still asks again. */
export function takeOpeningAddress(): OpeningAddress {
  const address = parseOpeningAddress(location.search)
  if (address.savedProjects || address.project) {
    try {
      history.replaceState(history.state, '', location.pathname + location.hash)
    } catch {
      // The address stays as it was: a reload asks the same again, which is harmless.
    }
  }
  return address
}
