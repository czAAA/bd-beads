import type { PixelData } from '../domain/imageConversion'

/** A picture of a few flat colours (red, blue, yellow), for the Convert image wizard to read. */
export function flatColorsPicture(): PixelData {
  const width = 16
  const height = 10
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i += 1) data.set(i % 3 === 0 ? [230, 55, 70, 255] : i % 3 === 1 ? [47, 111, 219, 255] : [250, 220, 60, 255], i * 4)
  return { width, height, data }
}

/** Waits for the picture the wizard was opened with to be read: its found colours are listed. */
export async function pictureSet(root: HTMLElement): Promise<void> {
  for (let tries = 0; tries < 50 && !root.querySelector('[data-testid="found-color"]'); tries += 1) await new Promise((done) => setTimeout(done, 20))
}
