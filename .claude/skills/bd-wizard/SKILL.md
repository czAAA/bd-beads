---
name: bd-wizard
description: Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, or running a one-off migration or cutover. Don't invoke this for steps the agent can perform itself.
---

A **wizard** is a bash script that walks a human through a manual procedure: it opens each URL, says what to click and copy, captures values, writes them where they belong (`.env`, GitHub secrets), confirms each stage and shows progress. [template.sh](template.sh) already provides all of that; **your job is only to scope the procedure and author the stages.** Never edit the library above the `STAGES` marker.

A wizard is ephemeral by default (a scratch or `scripts/` path, deleted when the job's done). Commit it only if the user wants a repeatable setup path, and then link it from the README.

## Process

1. **Scope.** Read the repo first (setup: `.env*`, README, docker-compose, framework config, and every `secrets.*`/`vars.*` in `.github/workflows/*`; migration: current state, target state, irreversible actions between). Show the user the ordered stages and the values each produces, and confirm. For each value know where the human gets it, where it's written (`.env`, a GitHub secret, both, or nowhere), and whether it's secret.

2. **Map each stage's path**, concretely enough for a stranger: URL, what to do there, where the value is shown, which variable it fills ("Dashboard → Developers → API keys → Reveal test key → copy"). If you don't know the current UI or command, say so and ask or check the docs; never invent steps.

3. **Author.** Copy `template.sh` to the target, replace the example with one `stage` per step in dependency order, and set `TOTAL_STAGES`. Use the helpers (`stage`, `say`/`step`, `open_url`, `ask`/`ask_secret`, `write_env`, `set_secret`/`set_var`, `pause`/`confirm`). Open the URL before asking for its value, hide secrets, `write_env` every persisted value, `set_secret` only what CI needs, `confirm` before anything irreversible, and keep a stage to one task since each clears the screen.

4. **Verify and hand off.** `bash -n` (and `shellcheck` if available), `chmod +x`. Don't run it: it opens browsers and blocks on input. Check statically that every step-1 value is captured and lands where planned, and every `set_secret` name matches a `secrets.*` in CI. Tell the user how to run it.
