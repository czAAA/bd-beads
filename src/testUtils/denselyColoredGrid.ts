import type { Grid } from '../domain/project'

/**
 * Every cell a different one of a handful of colors, so almost nothing run-length-compresses -- the same kind of
 * near-worst-case ADR 0009 measures its own compact encoding against. Used by QR export's tests to blow well past a
 * QR code's ~2.9KB cap without thousands of individual paintCells calls.
 */
export function denselyColoredGrid(columns: number, rows: number): Grid {
  const colors = ['#e63746', '#2f6fed', '#3ac16e', '#f4b400', '#8e44ad']
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_column, column) => ({
      color: colors[(row * columns + column) % colors.length]!,
    })),
  )
}
