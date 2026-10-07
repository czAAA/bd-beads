# 346 One 6px gap around the header, the Toolbox and the canvas box

**Status:** done

After 345 the Toolbox sat 6px from the left window edge, but the header, the canvas box and the right edge kept the old 14-32px gaps. Now the gap between header and body, window edge and Toolbox, Toolbox and canvas box, and canvas box and window edge is 6px at every docked tier (1024px and up). The body's page padding is `space-6` and its grid gap is gone; the column's scrollbar gutter shrinks from 14px to 6px (`column-width` 358px, tablet 292px, desktop 350px), so the boxes keep their width. Bottom edge follows the same 6px so the canvas box doesn't sit lopsided.
