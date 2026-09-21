# 108: Renderer becomes the default, and the cap goes

**What to build:** The Pattern renderer is what the app uses to draw and edit a Pattern, and the 10,000-cell cap is gone. From here a Pattern such as 70×250 (a bracelet-sized target, 17,500 cells) or 250×250 (62,500 cells) can be created, edited and opened, and its performance can be tested for real. The DOM grid and the temporary switch still exist (removed in 111) so the remaining tests can be migrated, but they are no longer what runs.

The cap comes out everywhere ADR 0017 put it: the New Pattern form, Convert image and Resize, including the refusal messages that speak of it. What limits a Pattern instead (browser storage space, memory) is not designed here: the point is to test big sizes and then decide, from what is measured, whether any cap is wanted at all or whether large projects should simply be allowed. A new ADR supersedes the cap paragraph of ADR 0017 and records that decision as it stands after testing.

**Blocked by:** 104 (Convert image framing on the renderer), 107 (Overlay layer on the renderer)

**Status:** ready-for-agent

- [ ] The renderer path is the default for opening and editing a Pattern; the DOM grid is used only where the temporary switch is turned on
- [ ] No cell cap applies when creating a Pattern (any unit), converting an image, or growing one with Resize; the refusal messages and their translations for it are removed
- [ ] A 70×250 and a 250×250 Pattern can be created, edited, saved, reloaded, exported as a Pattern file and undone
- [ ] Targets are measured with ticket 103's performance check and recorded in this ticket: at 4× CPU slowdown at least 30 fps for hover and paint at 70×250 and 250×250, opening in about 200 ms at 70×250; and a manual pass on the iPad Air 13″ for 60 fps at 250×250
- [ ] Storage behaviour with very large Patterns is checked: a full-storage save still shows the existing "couldn't save" message and keeps the edit on screen (ADR 0012)
- [ ] A new ADR supersedes the cap paragraph of ADR 0017, and CONTEXT.md and ADR 0017's own header are updated to say so
- [ ] Existing Patterns still open unchanged (ticket 103's compatibility test passes)
