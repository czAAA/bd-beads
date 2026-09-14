import type { Pattern } from './pattern'

const STORAGE_KEY = 'bd-beads:pattern'

export function savePattern(pattern: Pattern): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pattern))
}

export function loadPattern(): Pattern | undefined {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return undefined
  }

  try {
    return JSON.parse(raw) as Pattern
  } catch {
    return undefined
  }
}
