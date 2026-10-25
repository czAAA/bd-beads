import type { Page } from '@playwright/test'
import { MEASURE_ARGS, measureTextMisfits, settleForMeasuring, type TextMisfit } from '../../src/testUtils/textFitInPage'

export type { TextMisfit }

// Measures every visible text against the box meant to hold it and returns the misfits (ticket 229; see `measureTextMisfits`):
// text partly outside a clipping ancestor, its own box or the viewport, an ellipsized element with more content than
// room, or a one-line control wrapping. Vertical clipping by a scroll container is ignored.
export async function findTextMisfits(page: Page): Promise<TextMisfit[]> {
  await page.evaluate(settleForMeasuring)
  return page.evaluate(measureTextMisfits, MEASURE_ARGS)
}
