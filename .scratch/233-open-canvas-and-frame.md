# 233: Open canvas and Frame

**What to build:** Replace the fixed-size grid with an open canvas: the person draws anywhere on an endless field of bead positions, and marks which beads are the Pattern with a Frame, before or after drawing. Spec: design system v16 (copied in by the user beforehand), cards BeadBoard, Frame, Rulers, CanvasHint, CanvasStrip, ProgressBar, SaveBox, BeadsNeeded, NewPatternForm, ToolTabs, Toolbox, DisclosureRow, MirrorSizeControls, Dock, BottomToolbar, ContextBar, ZoomPill, Message. Mockup: claude.ai artifact 5ud5fX61NivHepEgFKdcx1 ("bd-beads · Open canvas and frame": 1 Draw anywhere, 2 Set Frame, 3 Frame set, 4 dark, 5 Export without a Frame, 6 New Pattern with size optional, 7 Rotate; plus 24″, iPad 13″, iPad mini and phone).

This is one ticket by the owner's decision. Suggested order of work inside it, each step leaving the app working: (1) ADR and CONTEXT.md; (2) store a Pattern's beads by position with a Frame, migrating old data, no visible change; (3) draw anywhere; (4) Pieces, rulers and Rulers toggle; (5) Hand tool and canvas hint; (6) Set Frame; (7) Export, Beads needed, Row progress and Rotate on the Frame; (8) New Pattern with optional size and Convert image; (9) phone and touch; (10) remove what the open canvas replaces. Commit in those steps so the PR reads in order.

**Behaviour**
- **Model:** a Pattern is an endless canvas; beads that touch by a side or corner form a Piece; one Frame per canvas marks which beads are the Pattern. It is a line only, drawing outside it stays possible. Export, Row progress and Rotate need a Frame. Save Pattern saves the whole canvas, beads outside the Frame included.
- **Draw anywhere:** no board, only the background with bead positions as dots, and the Technique word and curve behind. Wheel, two fingers and Space + drag move it; Ctrl/Cmd + wheel, pinch and zoom buttons zoom. Paint, Fill (bounded on open space), Erase, Select, Copy, Paste, Mirror, Undo and Redo work at any position. Canvas strip: "Canvas · N pieces · no Frame" ("setting Frame" while framing).
- **Pieces and rulers:** with no Frame each Piece has a rectangle and its own rulers (columns above, rows left, from 1). With a Frame, piece rulers hide and the Frame's show on all four sides. Rulers toggle (button and R, saved as a preference). Every number drawn, 5th bold, 100+ turned, zoom floor holds.
- **Hand tool (H)** and the **canvas hint** (bottom-left, iPad mini up, not on phone; Ctrl for ⌘ off Apple platforms); Keyboard shortcuts help lists Hand, Set Frame, Rulers.
- **Set Frame (F):** drag to draw, snaps to whole beads, eight handles, size tooltip ("13×13 · 2.1 × 2.1 cm"). The Frame row replaces Size in the Toolbox: icon, "Frame", "not set" or number chip (names "Frame 1, bring it into view") and measured size; open: Columns/Rows steppers, Fit to drawing, Remove Frame. Once set: empty positions inside draw as beads; header "Star · 21×19"; strip "Pattern · 21 columns · 19 rows · 3.4 × 3.0 cm" plus "2 pieces outside the Frame".
- **Export** with no Frame opens "Set Frame to export" (Fit to drawing, Set Frame); with one, QR, PNG and PDF contain only the Frame's beads and never draw its line. **Beads needed** counts the Frame only, or says "Set Frame to count beads."
- **Row progress** works on the Frame's rows; with no Frame the bar shows "Set Frame to start" and a Set Frame button. Finished-row lock covers the Frame only.
- **Rotate** turns the Frame and beads about its centre; a Piece in the way moves clear, with a Message ("Pattern rotated. 1 piece was in the way and moved outside the Frame.") and Undo. With no Frame it is disabled, named "Rotate, Set Frame first".
- **New Pattern:** size is an optional Frame (Width, Height, unit); empty creates an open canvas ("Leave it empty to draw anywhere. Set Frame later, before you export."); one field filled requires the other. Convert image needs a size and the picture lands in a Frame of that size.
- **Touch and phone:** four corner handles, ContextBar with size, Fit to drawing and Done; Dock gets Frame and Hand; ZoomPill gets Rulers; no wheel or keyboard needed.
- **Migration:** every Pattern saved before, in the library, in Pattern files and in QR codes, opens unchanged with a Frame the size of its old grid; old files and QR codes still import.
- **Removed:** the Size group, Change size, Add/remove row-column, the board and the whole-grid rulers, with their code and strings.

**Blocked by:** None (can start immediately). The user copies design system v16 into the repo first (DESIGN.md §6).

**Status:** ready-for-agent

- [ ] Design system v16 is in the repo before work starts; the ticket does not edit it by hand
- [ ] An ADR records the open canvas model, the options considered (fixed grid with a Frame on top versus an endless canvas) and what it supersedes in ADR 0017 and 0019; CONTEXT.md defines Open canvas, Piece, Frame, Set Frame, Hand tool, Rulers toggle and updates Pattern size, Resize, Rotate, Row progress, Beads needed, Convert image and the app shell layout
- [ ] Every previously saved Pattern, Pattern file and QR code opens with the same beads, name, Technique, Bead, rotation, Row progress, Image colors and library order, with a Frame the size of its old grid; a Pattern that cannot be read is reported, not dropped
- [ ] Create Pattern with no size opens an empty open canvas; painting far from the start works, survives reload, and moving or zooming never clips beads
- [ ] Select, Copy, Paste, Mirror, Fill, Undo and Redo work across Pieces and empty space; one dragged stroke is one undo step; Frame set, move, resize and removal are Undo steps that never change a bead
- [ ] Pieces form, merge and split as beads are painted and erased; rectangles, rulers, the Rulers toggle (R, persisted), ruler number styles and the zoom floor match the Rulers and BeadBoard cards; clicking a ruler number still selects that row or column
- [ ] Hand and the canvas hint match their cards; Hand never changes a bead
- [ ] Set Frame by pointer, touch and keyboard (announced to screen readers); one Frame per canvas; Fit to drawing, Remove Frame and the steppers work; beads outside the Frame stay editable and saved
- [ ] Export, Beads needed, Row progress and Rotate behave as above with and without a Frame; exports contain only Frame beads; Save keeps the whole canvas and restores the Frame
- [ ] Rotate never loses or overwrites a bead, and one Undo restores the rotation and any moved Pieces
- [ ] New Pattern and Convert image behave as above, including the phone sheet
- [ ] Correct at all five screen sizes (phone 390, iPad mini 744, iPad 1024, laptop 1440, desktop 1920) and in the light, dark and high contrast themes; fully usable with the keyboard alone
- [ ] Copy in English and Russian from the design system (v16 Russian strings are marked proposed there; flag any that read wrong)
- [ ] Design system tokens and v16 cards only; icons from the design system
- [ ] Drawing and panning with several thousand beads over a wide area is no slower than today's large-Pattern checks
- [ ] No code, string, test or doc still refers to Resize, Change size, the board or a fixed Pattern size, other than the reader for old files and an ADR note
- [ ] Overview and Tour question (CLAUDE.md): asked of the user; answer: pending (suggested: yes for both, since drawing anywhere and Set Frame change the first thing a person does; the design system says the Tour has not been checked against the open canvas, so walk it and the Overview's examples and fix what no longer matches)
