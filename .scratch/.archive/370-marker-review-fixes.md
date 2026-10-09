# 370: The Row progress marker's drawing code shares its clamp and stroke setup, and the last peyote row is tested

**What to build:** follow-up to the review of ticket 369's marker. Nothing changes for the person using the app. In `overlayRenderer.ts` the two paths that stroke the Row progress marker share one clamp (`clampAcross`) and one stroke setup (`beginMarkerStroke`), their radius names say what they are, a line with no beads draws nothing instead of throwing, and a test holds the outline of the last peyote row inside the Project.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The stepped and the rounded marker paths use one clamp and one stroke setup
- [x] A marker line with no beads draws nothing
- [x] A test covers the rounded outline of the last peyote row staying inside the Project
- [x] The ticket is archived in the same change
