# 271: Repository settings, then make the repository public

**What to build:** Make the GitHub repository public with protections in place from the first minute: pushed secrets are blocked, fork PRs can't run workflows without approval, and nothing private is left in the GitHub-side history.

**Blocked by:** 285 (scan), 268 (history decision), 269 (license and notices), 270 (deploy environment).

**Status:** done

- [x] 285's secret scan re-run against the current remote just before the switch, still clean
- [x] Old Actions runs and artifacts that 285 flagged are deleted (their logs become public with the repository)
- [x] Settings → Actions: fork pull request workflows require approval for all outside contributors; the default workflow token is read-only
- [x] Branch protection on `main`: no force pushes or deletion; no required status checks yet (272 adds them)
- [x] Repository made public
- [x] Right after the switch: secret scanning and push protection on, Dependabot alerts on, private vulnerability reporting on; unused Wiki and Projects turned off
- [x] A deploy from `main` still succeeds
