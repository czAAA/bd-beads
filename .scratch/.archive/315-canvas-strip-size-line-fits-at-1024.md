# 315: The Canvas strip's size line fits at 1024px

**What to build:** Ticket 300 made the strip's zoom cluster `flex: none` and the size line truncate with an ellipsis, so at 1024px (a strip about 630px wide) the size line was cut: "16 columns · 10 rows · 2.4 × 1.5 cm" in the editor and "16 columns · 10 rows" in Convert image, in English and Russian. The text-fit check (ticket 229) reports it, and every pull request's visual check failed on it (the check runs only on pull requests, so `main` looked green).

A narrow strip now gives up the printed-size estimate first (below 800px), then the grid icon and some spacing (below 700px), so the size line is always whole.

**Status:** done

- [x] At 1024px in English and Russian the size line is not clipped in the editor or in Convert image
- [x] The text-fit check passes at 1024px with no new pending entry
- [x] The CanvasStrip card and the Version changelog say what a narrow strip gives up
