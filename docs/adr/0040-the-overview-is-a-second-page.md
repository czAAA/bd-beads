# The Overview is a second page, shown first only to a newcomer

**Status: accepted.** Ticket 77.

The **Overview** (CONTEXT.md), the page that shows what bd-beads does, is a second Vite entry: its own folder with its own `index.html` (`overview/`), built beside the editor. A static host serves it as it is, with no rewrite rules ([ADR 0022](0022-self-hosted-deploy-to-the-flint-2-over-tailscale.md)), and the editor has no client-side router to add one to.

The main address sends a visitor to the Overview instead of the editor only when this device's Project library is empty, the Tour has been neither finished nor turned off, and they haven't just chosen the editor from the Overview in this tab. Anyone with work on the device lands straight in the editor. The Overview draws its examples with the Project renderer ([ADR 0018](0018-pattern-drawn-by-one-renderer-not-a-dom-cell-per-bead.md)), so they look like the editor.
