# The performance check

Part of the testing docs; the rules every test follows are in [`docs/testing.md`](../testing.md). Moved here from the README. Run by hand, never in CI ([`ci.md`](ci.md)).

`npm run perf` builds the app and drives it at a chosen CPU slowdown, printing frames per second and main-thread time for hovering, painting a stroke, scrolling, a zoom step, opening a Project and dragging the Convert image framing preview, at 60×90, 70×250 and 250×250. It reports at 4× slowdown (a midrange Android tablet or Core i3 laptop, "the floor") and at 6×. Options are environment variables: `PERF_SLOWDOWNS=4`, `PERF_SIZES=70x250`, `PERF_ONLY=hover,paint`, `PERF_TECHNIQUES=loom,peyote,brick` for the framing drag (see the top of `e2e/perf/perf.spec.ts`). Run it on an otherwise idle machine; timings vary from run to run, so compare numbers taken the same way. Targets: 60 fps for hover, paint and pan at 250×250 on an iPad Air 13″; at least 30 fps at the floor at 70×250 and 250×250; opening a Project in about 200 ms; a smooth framing drag.

## The big Canvases

The same run also measures the big Canvases (`e2e/perf/canvases.spec.ts`, ticket 0673): 50 scattered 40×40 Pieces, one 300×300 Piece unnamed and named, a 300×300 Frame over about 80,000 Canvas beads, a library of ten 300×300 Projects, a 300×300 Piece-shaped Selection and a 300×300 copied block, each in loom and peyote. It times a two-second Paint stroke, panning at fit and at 100%, one Fill, Paste and Undo, hovering the Paste and dragging across the shaped Selection, and counts the long animation frames (over 50 ms, with the scripts that took the time; Chromium only). Each line is printed against its budget: no long frame in a stroke, under 8 ms of script a pointer move, under 100 ms an edit. Options: `PERF_TECHNIQUES` (default `loom,peyote` here), `PERF_FIXTURES='piece,frame over canvas'`, `PERF_ONLY=stroke,edits`; `npm run perf -- canvases` runs it alone, and `PERF_ONLY` takes either spec's scenario names. Set `E2E_PORT` when another worktree's preview is running. The first run's output is the baseline later perf work compares against, kept in the docs repo next to the report ("Canvas performance for large patterns").

## Fill reach

Fill reach (`e2e/perf/fillReach.spec.ts`, ticket 0715) times a Fill tool press flooding a Piece as big as the Fill cap, with its redraw, save and Piece recount, and a press on empty space a screen away from the scattered Pieces at the Zoom floor, which must be refused and leave the saved beads as they were; each against the 100 ms an edit has. Options: `PERF_SLOWDOWNS` (default `4` here), `PERF_TECHNIQUES`, and `PERF_FILL_SIDE` to time a Piece of another side when looking for where the cap fits; `npm run perf -- fillReach` runs it alone.

## A Project that won't open

A Project that won't open (`e2e/perf/hugeProject.spec.ts`, ticket 0716) stores a synthetic Project of one solid layer of millions of beads (never the maintainer's own library) and times opening the Projects library subpanel with it in the library, its open from the pick (Open anyway, over the size gate) to the first drawn frame, and a stroke, a Fill of an enclosed patch and Undo on it, against one second for the open and 100 ms a click. Options: `PERF_SLOWDOWNS` (default `4`), `PERF_HUGE_MILLIONS` (default `9`; a list such as `1,2,9,12` shows where the open passes a second); `npm run perf -- hugeProject` runs it alone.

## A carried Piece

A carried Piece (`e2e/perf/pieceCarry.spec.ts`, ticket 1150) runs in Safari's engine at twice the pixel density, in a MacBook's window (1710×907): a full Piece on an open Canvas is dragged by the Piece tool over 90 pointer moves 8 ms apart, then cut and its paste stamp moved over the same path, and for each it prints how long the drag took, the frames drawn, the mean and the longest gap between two frames and how many gaps were over 33 ms. The Pieces are 20×20, 60×60 and 120×120 beads on loom and 60×60 on peyote, with small Pieces above, clear of the path. It has no budget yet: the paste's line is what the carry is compared with, and ticket 1151 sets one for the 120×120 Piece. Option: `PERF_CARRY` (fixture names, comma separated); `npm run perf -- pieceCarry` runs the check alone.

## Ports

The performance check never reuses a preview that is already running, since that could be another worktree's build: where port 4173 is taken, pass a free one, `E2E_PORT=4391 npm run perf`.

A twist and a pan (`e2e/perf/surfaceTwist.spec.ts`, ticket 1187) run in Safari's engine at an iPad's density (1366×1024 at 2×), over a 60×60 Frame on a full 160×160 Canvas: a 60° two-finger twist about the middle and a 360 px two-finger pan, each over 60 touch moves 16 ms apart, printing the frames drawn, the mean and the longest gap between two frames, how many gaps were over 33 ms and where the gesture left the view. It has no budget: it compares a change to the drawing with the build before it, run the same way. Option: `PERF_TECHNIQUES` (default `loom,peyote`); `npm run perf -- surfaceTwist` runs it alone.

Layers (`e2e/perf/layerBaseline.spec.ts`, ticket 1235, spec 1234) run in the same engine and size over a full Canvas with one Frame (today's Project) and with four Frames on loom, peyote, brick and loom, two by two (`PERF_FRAMES`, default `1,4`). Each gesture (Rotate Frame, Rotate canvas, the twist, the pan and a pinch zoom) prints the frames drawn, the mean and longest gap, the gaps over 33 ms and the canvas memory: the backing size (width × height × 4 bytes) of every canvas on the page, at its peak during the gesture and at rest a second after. It has no budget yet; the figures below are what ticket 1239 is held to (measured 2026-11-25 on an M-series Mac, `main` at 2c5d23c3 with the turn and fade copies released):

| Project | Gesture | Frames | Mean gap | Longest | Over 33 ms | Canvas memory peak / at rest |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Frame | open | | | | | 85 / 85 MB (8 canvases) |
| 1 Frame | Rotate Frame | 8 | 11.9 ms | 24 ms | 0 | 106 / 85 MB |
| 1 Frame | Rotate canvas | 5 | 11.4 ms | 17 ms | 0 | 85 / 85 MB |
| 1 Frame | twist | 78 | 16.7 ms | 35 ms | 1 | 131 / 131 MB |
| 1 Frame | pan | 76 | 16.6 ms | 20 ms | 0 | 131 / 131 MB |
| 1 Frame | zoom | 78 | 16.5 ms | 22 ms | 0 | 131 / 131 MB |
| 4 Frames | open | | | | | 101 / 101 MB (8 canvases) |
| 4 Frames | Rotate Frame | 7 | 14.0 ms | 26 ms | 0 | 121 / 101 MB |
| 4 Frames | Rotate canvas | 5 | 16.0 ms | 26 ms | 0 | 101 / 101 MB |
| 4 Frames | twist | 76 | 16.8 ms | 40 ms | 1 | 146 / 146 MB |
| 4 Frames | pan | 32 | 44.7 ms | 92 ms | 28 | 157 / 157 MB |
| 4 Frames | zoom | 32 | 42.2 ms | 57 ms | 30 | 157 / 157 MB |

Before the turn copy was released (same run, same Project) a Rotate Frame left 106 MB (1 Frame) and 121 MB (4 Frames) at rest, 21 and 20 MB more, one canvas more, and the press's longest gap was about 700 ms in both runs (the copy's allocation; 24 and 26 ms after). The memory grows over the run as the draft look's base follows a twist (85 to 131 MB). Run to run the gaps move by a few ms; what stands out is the pan and zoom of four Frames, which draw at about 22 frames a second.
