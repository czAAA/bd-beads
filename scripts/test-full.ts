// The full unit suite, then the whole visual check (`scripts/visual.sh`), before a pull request opens, on a capable
// machine (`isCapable`, vite.workers.ts); elsewhere CI's job (docs/testing.md). `BD_FULL_TESTS=1` forces the run, `=0`
// skips it; `BD_FULL_VISUAL=0` leaves the visual check out, for a change nothing on screen can see.
import { spawnSync } from 'node:child_process'
import { isCapable, thisMachine } from '../vite.workers.ts'

const machine = thisMachine()
const mode = process.env.BD_FULL_TESTS
if (mode === '0' || (mode !== '1' && !isCapable(machine))) {
  console.log(`skip full suite (${machine.cores} cores, ${machine.memoryGb} GB free): CI runs it on the pull request`)
  process.exit(0)
}
const run = (command: string, args: string[]) => spawnSync(command, args, { stdio: 'inherit' }).status ?? 1
const unit = run('npx', ['vitest', 'run', '--reporter=agent', '--silent=passed-only'])
// The `line` reporter prints the failures and one summary, not a line per test.
const visual = process.env.BD_FULL_VISUAL === '0' ? 0 : run('bash', ['scripts/visual.sh', '--reporter=line'])
if (unit !== 0) console.log('full suite: the unit tests failed')
// scripts/visual.sh exits 2 when it can't draw as CI does (a Mac with Docker stopped): not run, not passed.
if (visual === 2) console.log('full suite: the visual check did not run: start Docker and run it again')
else if (visual !== 0) console.log('full suite: the visual check failed (docs/testing.md, Visual baselines)')
process.exit(unit || visual)
