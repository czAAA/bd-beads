import { describe, expect, it } from 'vitest'
import { fixtureProject } from '../../e2e/support/projects'
import { en } from '../i18n/en'
import { estimatePngBytes } from './exportEstimate'
import { printText } from './printText'
import { exportProjectPng } from './projectExport'

// The estimate each stop shows is checked against real exports, as it was fitted (ticket 576): a Frame of each size and
// Technique at each bead size. Banded pictures; a noisier one comes out larger than its estimate.
const FRAMES = [['loom', 20, 30], ['loom', 100, 100], ['peyote', 150, 150], ['brick', 60, 80], ['loom', 200, 200], ['peyote', 250, 250]] as const

describe('estimatePngBytes against real PNG exports (QualitySlider card)', () => {
  it.each(FRAMES)('is within a quarter of the file for %s %s × %s at each bead size', async (technique, columns, rows) => {
    const project = fixtureProject({ technique, columns, rows })
    const off: string[] = []
    for (const beadPx of [45, 60, 90]) {
      const real = (await exportProjectPng(project, printText(project, en, 'en', new Date()), beadPx)).size
      const ratio = estimatePngBytes(project, beadPx) / real
      if (ratio < 0.75 || ratio > 1.25) off.push(`${beadPx} px: estimate is ${ratio.toFixed(2)} × the ${real} B file`)
    }
    expect(off).toEqual([])
  }, 120_000)
})
