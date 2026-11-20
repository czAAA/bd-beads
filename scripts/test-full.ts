// The full unit suite, before a pull request opens, on a machine that can afford it; elsewhere CI's job (docs/testing.md).
// Capable is `isCapable` (vite.workers.ts), which also sets the worker count. `BD_FULL_TESTS=1` forces the run, `=0` skips it.
import { spawnSync } from 'node:child_process'
import { isCapable, thisMachine } from '../vite.workers.ts'

const machine = thisMachine()
const mode = process.env.BD_FULL_TESTS
if (mode === '0' || (mode !== '1' && !isCapable(machine))) {
  console.log(`skip full unit suite (${machine.cores} cores, ${machine.memoryGb} GB free): CI runs it on the pull request`)
  process.exit(0)
}
process.exit(spawnSync('npx', ['vitest', 'run', '--reporter=agent', '--silent=passed-only'], { stdio: 'inherit' }).status ?? 1)
