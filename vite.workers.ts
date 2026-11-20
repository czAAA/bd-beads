import { readFileSync } from 'node:fs'
import { availableParallelism, platform, totalmem } from 'node:os'

/** What a machine has for the tests: its cores, and its memory in GB (free on Linux, all of it on macOS). */
export interface Machine {
  cores: number
  memoryGb: number
}

/** Whether `machine` can afford the heavy runs: at least 8 cores and 8 GB. `npm run test:full` runs only here. */
export function isCapable(machine: Machine): boolean {
  return machine.cores >= 8 && machine.memoryGb >= 8
}

/** The memory one worker is given room for, in GB: the suite peaks near 1 GB a worker, and a second session may run. */
const GB_A_WORKER = 3

/** How many workers Vitest runs on `machine`: two unless it is capable, then half its cores, as far as its memory goes.
 * `byHand` (`BD_TEST_WORKERS`) sets the count on any machine. */
export function testWorkers(machine: Machine, byHand?: string): number {
  if (byHand && /^[1-9]\d*$/.test(byHand)) return Number(byHand)
  return isCapable(machine) ? Math.min(Math.floor(machine.cores / 2), Math.floor(machine.memoryGb / GB_A_WORKER)) : 2
}

/** This machine. Linux counts the memory free now (`MemAvailable`); macOS reports none, so all of it stands in. */
export function thisMachine(): Machine {
  let bytes = totalmem()
  if (platform() === 'linux') {
    const free = /^MemAvailable:\s+(\d+) kB/m.exec(readFileSync('/proc/meminfo', 'utf8'))
    if (free) bytes = Number(free[1]) * 1024
  }
  return { cores: availableParallelism(), memoryGb: Math.floor(bytes / 2 ** 30) }
}
