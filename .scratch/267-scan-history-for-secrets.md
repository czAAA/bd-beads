# 267: Scan the full history for secrets and personal data

**What to build:** Before the repository goes public, prove that no secret was ever committed on any ref, and list everything personal or internal that would become public along with it. The output is a findings report that ticket 268 decides on.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

Known so far (from a quick grep, not a real scan): the only `.env` files ever committed held a feature flag; the tailnet hostname `tailnet-host.example` appears in the README, ADR 0022, ticket 64 and their history; commits carry the author's full name and personal email (some with an empty email).

- [ ] A real secret scanner (gitleaks or trufflehog) runs over every ref and every commit, including branches only on the remote and the open worktree branches; the exact command is recorded so it can be re-run just before the switch to public
- [ ] Every finding is classified as a live secret, a revoked or dead secret, or a false positive; any live secret is rotated before this ticket closes, and the ticket says what was rotated
- [ ] The report also lists what isn't a secret but would become public: hostnames and IPs, personal names and emails in commits, internal notes in tickets and agent files, and anything the `.gitignore` once missed
- [ ] The report covers what lives on GitHub rather than in git: past Actions run logs and artifacts, PR titles, descriptions and comments, and the repository's variables (secrets themselves never become public)
- [ ] The report is added to this ticket, ready for 268
