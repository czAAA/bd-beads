---
name: bd-ux-design
description: "UX/UI design work on this Mac: a brief, the real app measured, 3-4 distinct options side by side on a local canvas with live states, a scripted WebKit audit, comment pins the owner drops in Safari, and a sign-off that updates the design system. Use when the user asks to design or redesign something, for a mockup, a prototype, variants or options of a screen or control, or asks \"how should X look\"."
---

Design happens on this Mac and stays there until sign-off. **Never call Artifact, DesignSync or Claude Docs, never
publish or upload anything** (no claude.ai, no gist, no tunnel), and never tell the owner to use them. The tailnet only
when the owner asks (`CLAUDE.md`, step 5).

The helpers are beside this file; none needs a dependency beyond the repo's Playwright:

| File | What it does |
| --- | --- |
| `init.mjs <dir> "<Title>" a b c` | Scaffolds a topic: `canvas.html`, `shared.css`, `options/<id>.html`, `comments.json`. Never overwrites. |
| `ground.mjs <url> <selector>` | Measures a real part on a dev server: box, type, colors, radius, shadow, each named by its token. |
| `audit.mjs <dir>` | Opens every option at every size, state, theme and language in WebKit at 2× and reports findings as text. |
| `serve.mjs <dir> [--open]` | The local server: the canvas, the repo's tokens, fonts and icons, the comments, live reload. |
| `canvas.js`, `canvas.css`, `option.js` | The canvas page and the helper every option loads. Don't copy them into a topic. |

Paths, once per session:

```bash
S=.claude/skills/bd-ux-design                                              # this checkout's copy of the skill
MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")   # the main checkout, also from a worktree
D=$MAIN/.scratch-design/<topic-slug>                                         # the design; a worktree would take it along when removed
grep -qx '.scratch-design/' "$MAIN/.git/info/exclude" || echo '.scratch-design/' >> "$MAIN/.git/info/exclude"
```

## Rules that hold in every step

**Storage.** Everything before sign-off is uncommitted, in `$D`: the canvas, the options, `shared.css`,
`comments.json`, `audit.txt`, `crops/`. Never in `.gitignore`, never in a commit. Old topics stay: never delete one.
Pictures you take for yourself go in the session's scratchpad or `$D/crops/`.

**Tokens (the reason this skill exists).**
- Grep the design system and the glossary; never read them whole. A card is
  `docs/design/system/components/<Name>/README.md`: `ls docs/design/system/components | grep -i <word>`, then read
  that one card with `offset`/`limit`. Copy is `docs/design/system/copy/<area>.md`; rules are `writing.md`,
  `interaction-and-motion.md`, `responsive.md`, `accessibility.md`, `forms-and-states.md` (grep them).
- Low fidelity first: while the direction is unclear, show ASCII wireframes in chat and build no HTML.
- Change files with Edit, never by rewriting them. What options share goes in `shared.css`, once.
- Pictures: at most one cropped picture per real screen while grounding, and none of your own design unless a
  judgement needs eyes. The owner looks in Safari; you trust the text audit.
- With three or more options, a Sonnet sub-agent builds the HTML and CSS (step 3). Decisions, the audit and the
  comments stay in this session.

**What the owner has already decided.** Read the memory index before the brief and open every memory the topic
touches; a decision recorded there, in a ticket or in an ADR is not asked again. Standing ones:
- Which devices a design covers, and which sizes a mockup shows, is in the owner's memory notes: follow them. Unless
  they say otherwise, an artboard is `desktop` (1710×907, the owner's Safari window) or `ipad` (1366×1024). A
  sub-agent can't see memory: put what the notes say in its prompt.
- Settings of a drawing tool go in a Tool pill tile with a popover, never a new panel. Panels are for the app and the
  Project. One-shot commands on a fragment go on the Selection bar; view toggles on the Canvas strip.
- Help read once goes behind an Info button's Tooltip. Inline only what changes: loading, failed, empty, counts. A
  cramped popover gets wider before it gets more rows.
- A new control for something the app already does is one more trigger of the same action: name the control id from
  `src/composables/shell/controlRegistry.ts` in the design, and say it has no code path of its own.
- A demo part looks exactly like the editor. Motion is calm: one thing moves at a time, no glow, nothing that never
  stops.
- The owner's browser is Safari at 2×. WebKit first, for measuring and for the audit; Chromium only to compare.

**The design system.** `DESIGN.md` says which source wins. Only role-named tokens: no hardcoded color, font, size,
radius or shadow (the audit fails a color or shadow that is no token). Icons, logo and cursors come from
`docs/design/system/assets/` (served at `/_ds/assets/Icons/<name>.svg`), never redrawn. Words come from the glossary
(`docs/glossary/`) and `writing.md`; every string is drawn in English and Russian.

## 1. Brief

Restate the problem in two or three lines: who is doing what, what is wrong or missing today, what done looks like.
Then ask only what changes the design: at most three questions, in one `AskUserQuestion`, with an ASCII `preview` per
option where the options are layouts. Skip any question a memory, ticket (`grep -rn <term> .scratch/`) or ADR
(`rg <term> docs/adr/`) already answers, and say in one line what you took from where. No questions is a fine brief.

## 2. Ground in the real app

Before drawing, find out what is really on the screen. Never approximate.

1. A dev server, in the background, from the checkout you are in (a worktree needs its `npm ci`):
   `npx vite --port 5231 --strictPort`. The editor is `http://localhost:5231/app/`, the Homepage `/`. Stop it when the
   grounding is done (`pkill -f "vite --port 5231"`).
2. Measure the part and what sits round it:
   `node $S/ground.mjs http://localhost:5231/app/ '[data-testid="canvas-strip"]' --depth 2`. It prints each element's
   box, type, colors, radius, padding and shadow by token name. `--size ipad`, `--theme dark`, `--lang ru`,
   `--do click:<selector>` (repeatable, to open a panel or popover first). A selector that matches nothing prints the
   page's visible `data-testid` values.
3. One cropped picture of the area only if the numbers don't tell you the layout: add `--shot $D/crops/<name>.png`
   and Read that file once.
4. Copy the real CSS: find the component (`grep -rln '<class or testid>' src/components`), read its `<style>` block
   with `offset`/`limit`, and paste it into `$D/shared.css` with its tokens and its rem values untouched. The app's
   base font size is 18px and its sizes are in rem, which `shared.css` already sets.
5. Copy the real strings from `src/i18n/en/<area>.ts` and `src/i18n/ru/<area>.ts` (grep the key). A new string is
   written by `writing.md`, in both languages.

## 3. Several distinct options

Three or four directions that differ in kind (where the thing lives, what it is, how it is reached), not tweaks of
one. Each has a letter, a short name, its idea in one line and what it costs in one line. If you can't yet name three
that differ, show ASCII wireframes in chat and ask.

```bash
node $S/init.mjs $D "<Title>" a b c
```

Then edit, in place:
- **`canvas.html`**: the whole canvas is its `<main id="canvas">`. `data-title`, `data-question`, `data-sizes`
  (`desktop ipad`), `data-themes` (`light dark contrast`: the app has all three), `data-langs` (`en ru`), and one
  `<section>` per option with `data-name="A · Name"`, `data-idea`, `data-tradeoff`, `data-src`, `data-states`. The
  canvas draws one artboard per option and size, at the device's real size.
- **`shared.css`**: the real component CSS, once.
- **`options/<id>.html`**: one page per option, the screen as it would be, at any of the sizes. Its `<style>` holds
  only what this option draws differently.

**A Sonnet sub-agent builds the pages** when there are three or more options: one `Agent` call
(`subagent_type: general-purpose`, `model: sonnet`). Its prompt holds everything it needs, because it sees neither this
conversation nor memory: the path `$D`, the brief, each option's idea, the `ground.mjs` output, which component files
to copy CSS from, the strings in both languages, the states (step 4), the sizes, the standing rules above, "edit the
scaffolded files, don't rewrite `canvas.js` or `option.js`", and "finish by running `node $S/audit.mjs $D` and fix
what it reports; return its last line". Read its result, not its files; then run the audit yourself (step 5).

## 4. Live states

Every artboard can be clicked through its states, and the canvas's chips switch them too. `option.js` writes the
state, theme and language on `<html>` (`data-state`, `data-theme`, `lang`), so a state is CSS:

```html
<button class="tile" data-goto="open" data-t-ru="Зеркало" data-t-long="Mirror, four ways">Mirror</button>
<div class="popover" data-show="open long">…</div>
```

- `data-goto="open"`: a press shows that state, a second press goes back to `default`; Escape does too.
- `data-show="open long"`: the part exists only in those states. A part that should move in is styled from
  `html[data-state="open"] .popover` instead, with the motion tokens (`grep -n -- '--duration\|--ease' src/styles/design-values.css`).
- `data-t-ru="…"`: the Russian; the element's own text is the English. `data-t-long` (and `data-t-long-ru`) is the text
  in the `long` state. Only the element's own text changes, so an icon inside it stays; put the attribute on the
  element that holds the words.
- Hover: style `.x:hover` and `html[data-state="hover"] .x` in one rule, so the state shows it without a pointer.

States every option lists unless one can't exist: `default`, each open popover or menu, `hover`, `empty`, `long`
(the longest real name or number), an error or disabled state where there is one. Themes and Russian come from the
canvas's switches, not from states.

## 5. Audit by script before showing anything

```bash
node $S/audit.mjs $D 2>&1 | tail -n 45
```

WebKit at 2×, every option × size × state × theme × language, the motion sampled on each state change, and every
`data-goto` control really pressed (a press that is covered or shows the wrong state is a finding). It reports,
grouped, one line per distinct finding: text cut off or spilling out of its box, parts off the screen, texts or
controls overlapping, a color or shadow that is no token, tap targets under 44px (24px on `desktop`, which is
mouse-first), more than one thing moving at once, endless motion, a `data-goto` to an unlisted state, a language with
no strings, console errors and files that didn't load. The full list is `$D/audit.txt`.

Fix with small edits and run again until it prints `clean: nothing found`. `data-audit-ok="clip"` (or `overlap`,
`color`, `target`, `motion`) on an element lets it off one check: use it only for a deliberate case (a bead's own
color, a panel row that is 36px by the design system), and name each use in the report. `--only a@desktop` audits one
artboard; `--browser chromium` compares. Report the audit as text: the head line, the last line, and what you let off.

## 6. Show it

```bash
node $S/serve.mjs $D --open      # run_in_background: true; prints http://127.0.0.1:<port>/canvas.html, opens Safari
```

It picks a free port from 4310, serves on 127.0.0.1 only, and reloads the open page when a file in `$D` changes (the
place, zoom and states are kept). Run again, it prints the running one's URL; `--stop` ends it. Leave it running while
the owner reviews. Give the owner the URL and, in a few lines: each option's letter, name, idea and trade-off, which
one you would pick and why, and how to comment: **C, then click an artboard, type, Enter**. Pan with two fingers,
zoom with a pinch or ⌘-scroll, `0` fits everything, a click on an option's name fits that artboard.

## 7. The comments loop

Each round, read the open comments and what the owner said in chat:

```bash
node $S/serve.mjs $D --comments          # "#4 b@ipad [open/dark/ru] at 412,96 on button.tile "Зеркало": text"
```

Each line gives the artboard, the view it was written in, the point in the artboard's own px and the element under
it. Per comment:
1. A clear ask: fix it with a small Edit (never rewrite a file), in `shared.css` when every option has the fault.
2. A judgement call (it contradicts a card, a memory or another comment, or it has two honest readings): ask first,
   and resolve nothing until answered.
3. Run the audit again. Only then mark it:
   `node $S/serve.mjs $D --resolve 4 "Tile label shortened to «Зеркало»; popover 288px."` The pin greys on the page.

Never delete a comment, and never resolve one you didn't act on: reply with the reason and leave it open. End the
round with one line per comment (number, what changed) and the audit's last line.

## 8. Sign-off

When the owner picks a direction:

1. **Cut the canvas.** `cp $D/canvas.html $D/canvas-options.html` (the round as it was), then in `canvas.html` keep
   only the chosen `<section>`, its final states, and the chosen name in `data-title`. The other options' files stay.
   Audit once more.
2. **The design system, in place, committed** (`DESIGN.md` §6). This is the only committed part, and it goes the
   normal way: a ticket in the docs repo (`docs/agents/issue-tracker.md`), a worktree from the `bd-worktree` skill, a
   PR by `docs/agents/pull-requests.md`. In it: the component's card `docs/design/system/components/<Name>/README.md`
   (a new component gets a new folder), tokens in `tokens.json` and `tokens.css` together, values that can't be tokens
   at the top of `components/bundle.css` and in `src/styles/design-values.css`, the guideline file whose rule changed,
   and `copy/<area>.md` for the strings. A look written before it is built says "approved <date>, not yet in the app"
   and names the ticket that builds it. Run the tests related to the changed files, then `npm run check`.
3. **The decisions, in tickets.** Write them into the design ticket: what was chosen and why, what was turned down
   and why, every state, the strings in both languages, the control ids reused. Then the build tickets with
   `/bd-tickets`, each pointing at the card. No ticket whose only work is a person checking something.
4. **A memory**, so later sessions don't ask again: one file with the date of the sign-off, the choice, the owner's
   own words for each rule they set, the ticket and PR numbers, and "don't re-ask"; add its line to `MEMORY.md`.
5. **Left for a human**, said explicitly: what only the owner's eyes or hands can settle (a real iPad, a real
   trackpad), and which PR waits for their merge.

Stop the server (`node $S/serve.mjs $D --stop`) once the owner is done looking.
