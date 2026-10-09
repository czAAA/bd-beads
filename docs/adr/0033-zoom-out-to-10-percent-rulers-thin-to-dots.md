# Zoom out to 10% everywhere; the rulers thin to dots instead of stopping the zoom

**Status: accepted.** Tickets 298–301, 303, 322.

Zoom used to stop at the smallest bead that kept every ruler number clear (85% or 90% by screen). That made the main reason to zoom out, seeing a Project wider or taller than the screen whole, impossible on the screens where it matters most.

- **One Zoom floor of 10% on every screen**, for zoom out, pinch, wheel, the zoom buttons and Fit. Fit is still capped at 100% and only shrinks. The zoom buttons step 10% at a time; pinch and wheel stay continuous at whole-percent precision.
- **The rulers adapt to the zoom instead of setting it.** From 50% up, the **Ruler step** is the smallest of 5, 10, 50, 100… that leaves every number clear, and beads between numbers get a **Ruler dot**, every 5th bolder; below about 6px of bead pitch only the 5th-bead dots remain. Below 50%, a ruler shows only its last number (the column count along the columns, the row count along the rows), on every Piece ruler and Frame side.
- **A ruler picks the nearest bead under the pointer**, not a hit box per number: a dot selects its row or column like a number, the last number stays clickable below 50%, and hidden numbers can't be clicked. The cursor and Row progress highlights show only on a drawn number. Drawing and picking read one Ruler layout per view, so they cannot drift apart.
- Two number sizes stay (12px at phone widths, 11px above, the `bead-min-phone` and `bead-min-tablet` tokens), and now set where numbers turn to dots.

**Considered options**: keeping the floors (rejected: caps what one screen can show); keeping every number at any zoom (rejected: numbers collide below about 15px); hiding the rulers below the old floor (rejected: loses the counts and selection by ruler exactly when a large Project needs them).

**Consequences.** The rulers are redrawn on every zoom change and must stay cheap at 999 columns. Saved zoom levels below the old floor become reachable.
