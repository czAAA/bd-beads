# LongerText

How controls make room for longer strings (Russian runs about a quarter longer): drop to icons by priority, wrap, or cut only user text.

- **The header fits by priority, not by breakpoint.** When it does not fit: 1) Import a file and Import QR code become icon buttons (`is-iconly`; the name as tooltip and `aria-label`); 2) the Pattern name is cut with an ellipsis; 3) the imports move into More. Russian at 1440px needs step 1.
- **SegmentedControl labels wrap** to two lines; every segment keeps the same height. Never cut or shrink the text.
- **The ContextBar drops labels right to left** (Remove line, then Rotate, then Copy) and keeps Cancel's label.
- **Saved Pattern names are one line**, cut with an ellipsis at 58px, the full name in the tooltip.
- **Dock and BottomToolbar buttons share the width equally**, so a label may use all of it.
- The Mirror summary uses arrows in both languages: "↔ 1 · ↕ 0".

Hand-written from the Phase E sign-off (Russian check).
