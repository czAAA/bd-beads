import { unreached } from './hoverReach'

/** Runs once after the whole visual run (playwright.config.ts): the reachability guard of the hover text check (ticket 264). */
export default function globalTeardown(): void {
  const problems = unreached()
  if (problems === null) {
    console.log('hover text check: part of the language and width matrix ran, so the reachability guard was not checked')
    return
  }
  if (problems.length > 0) throw new Error(`Hover text check, reachability guard:\n${problems.map((problem) => `  ${problem}`).join('\n')}`)
}
