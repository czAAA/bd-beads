# 345 Shrink the empty space left of the Toolbox

**Status:** done

The left column sat 32px (24px / 40px on other tiers) from the window edge. The left page padding is now 6px (`space-6`) at every docked tier (1024px and up). Tooltips need no change: `AppTooltip` already clamps to an 8px screen margin.
