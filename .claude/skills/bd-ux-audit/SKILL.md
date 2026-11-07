---
name: bd-ux-audit
description: "One session of the UX audit: audit an area (arrive, draw-export, convert-image, bead-it, keep-it, cross-cutting), consolidate the findings into root-cause groups for /bd-tickets, or verify after the fixes. Everything by docs/research/ux-audit/00-plan.md."
disable-model-invocation: true
---

The plan is `docs/research/ux-audit/00-plan.md` (docs repo, linked in): the persona, the golden paths, the rubric, the
areas, the file formats, the consolidation and verify rules. **Read it in full first; it wins over this file**, which
holds only the mechanics. Arguments: `<area>`, `consolidate` or `verify`.

Paths: the docs repo checkout is wherever `.scratch` links to, `DOCS=$(cd -P .scratch/.. && pwd)` (from the main
checkout that is `../bd-beads-docs`, from a worktree `../../bd-beads-docs`); commit there with
`git -C "$DOCS" add -A && git -C "$DOCS" commit -m "ux audit: <what>" && git -C "$DOCS" push`. Temporary crops go in
the session's scratchpad directory, never in the repos.

## Audit an area

1. **Context.** The plan; this area's earlier findings file if one exists (keep its ids). Unless the area is
   `arrive`, the calibration: `01-arrive.md`'s `**Review artifact:**` URL, read with
   `mcp__claude-artifacts__read_comments`, and what the owner called higher, lower or drop becomes your sense of each
   severity. The component cards the area touches (`docs/design/system/components/<Name>/README.md`) and
   `writing.md`, so an Off-contract finding cites a line.
2. **The walk.** `npm run ux:walk -- <area> 2>&1 | tail -n 30` (builds first; minutes). Output per device and state
   in `ux-audit-output/<area>/`: read `stops.json` (a `reached: false` with its error is a finding candidate: the
   control wasn't there or didn't work), `console.json` and `axe.json` whole. Then the PNGs **one at a time**, judging
   each before opening the next; never read a PNG twice. Crop before reading when the question is a region
   (`sips -c <height> <width> --cropOffset <top> <left> in.png --out <scratchpad>/crop.png`). Compare the two devices
   stop by stop: a defect on both is one finding with two evidence crops.
3. **Try it.** Dev server in the background (`npx vite --port 5199 --strictPort`), Claude in Chrome (load the
   `claude-in-chrome` skill first) at `http://localhost:5199/bd-beads/homepage/`, the window at device 1's size
   (1366 × 1024) and its theme (`localStorage.setItem('openbeads:theme', 'dark')` in the console, then reload). Walk
   the area's golden path once as the stranger: read every string as if new, hover, press Tab, open everything the
   path shows, and note each moment you hesitated or guessed: those are the Hard-to-use findings. Stop the server
   after (`pkill -f "vite --port 5199"`).
4. **Judge** by the plan's rubric (§3) and write the findings file in the plan's format (§6) as
   `docs/research/ux-audit/<NN>-<area>.md` (01 arrive, 02 draw-export, 03 convert-image, 04 bead-it, 05 keep-it,
   06 cross-cutting), the `main` hash from `git log -1 --format=%h origin/main`. Evidence: cropped PNGs only, under
   `docs/research/ux-audit/<NN>-<area>/F-<NN>-<nn>.png`, each well under 200 KB. Commit and push the docs repo.
5. **Publish for review.** `mcp__claude-artifacts__guide` (topic `pages`) once, then a plain HTML page built in the
   scratchpad from the findings file (the counts table, one block per finding with its evidence image inline and its
   id in the heading, the Review line last), published with `mcp__claude-artifacts__publish_files` together with the
   PNGs. Put the URL in the findings file's `**Review artifact:**` line, commit and push again, and give the owner
   the link and the counts.
6. **Left for a human:** the owner's comment per finding (`agree`, `higher`, `lower`, `drop`, or a sentence); for
   `arrive`, which Opportunities to keep.

Area notes:
- `cross-cutting` also runs the text-fit check in all seven languages (`npm run visual -- --grep "fit" 2>&1 | tail -n 30`;
  a failure there is a finding with the check's own output as evidence), reads the Russian strings the walk's `ru-*`
  stops show against `writing.md`'s Russian rules, and judges the `keyboard-*` stops for a visible focus and a sane
  order.
- `keep-it`: the Save reminder (glossary) isn't reachable by the walk; try it in Chrome.
- `arrive`: the Opportunities list (plan §3), at most five.

Context hygiene: PNGs stay in context for the session, so read each once, cropped where possible, and never the
`.playwright` folder. Don't fix anything: the audit finds, the tickets fix.

## Consolidate

Plan §7 is the rule; the mechanics: read the six findings files and every artifact's comments (each file's
`**Review artifact:**` URL); write `docs/research/ux-audit/07-consolidated.md` with the baseline counts (per area and
total, each area's `main` hash), the root-cause groups (title, severity, finding ids, evidence links, the proposed
change) and the Dropped list; commit and push the docs repo; then run `/bd-tickets` on it, each ticket's "What to
build" in the stranger's words with its finding ids and evidence linked. Tell the owner to implement with
`/bd-implement -bulk`, P0/P1 first.

## Verify

Plan §9 is the rule; the mechanics: pull `main`, `npm run ux:walk -- all 2>&1 | tail -n 40`; per prior finding (from
`07-consolidated.md`, the owner's `U-` findings included) open only the stop PNG its evidence came from, cropped to the
same region, and set its state by §9; write `docs/research/ux-audit/08-verify-<YYYY-MM-DD>.md` with the per-finding
table, the before/after counts and §9's decision; commit and push the docs repo; publish it as an artifact the same
way as a findings file and hand the owner the confirm list, each item as "do X on the iPad, see Y".
