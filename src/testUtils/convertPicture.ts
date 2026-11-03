import type { PixelData } from '../domain/imageConversion'

/** A picture of a few flat colours (red, blue, yellow), for the Convert image wizard to read. */
export function flatColorsPicture(): PixelData {
  const width = 16
  const height = 10
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) data.set(i % 3 === 0 ? [230, 55, 70, 255] : i % 3 === 1 ? [47, 111, 219, 255] : [250, 220, 60, 255], i * 4)
  return { width, height, data }
}

/** Waits for the picture the wizard was opened with to be read: its result line shows. */
export async function pictureSet(root: HTMLElement): Promise<void> {
  for (let tries = 0; tries < 50 && !root.querySelector('[data-testid="convert-result"]'); tries += 1) await new Promise((done) => setTimeout(done, 20))
}

/** How tall each step of Convert image's pane is laid out by `layOutConvertPane`, and how much of the pane shows. */
export const CONVERT_STEP_PX = 400

/** jsdom lays nothing out (ticket 0780): gives Convert image's pane five steps CONVERT_STEP_PX tall with one of them on
 * screen, so it scrolls four of them, for a test of the Progress bar following its scroll. */
export function layOutConvertPane(root: Element): HTMLElement {
  const pane = root.querySelector<HTMLElement>('[data-testid="convert-step-pane"]')!
  Object.defineProperties(pane, { scrollHeight: { value: CONVERT_STEP_PX * 5 }, clientHeight: { value: CONVERT_STEP_PX } })
  pane.querySelectorAll<HTMLElement>(':scope > .convert-section').forEach((section, index) =>
    Object.defineProperties(section, { offsetTop: { value: index * CONVERT_STEP_PX }, offsetHeight: { value: CONVERT_STEP_PX } }),
  )
  return pane
}
