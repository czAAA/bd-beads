# FeedbackSheet

The one modal through which a beader sends a **Report** to the maintainer, with no account (ADR 0081, spec 0698, ticket 0700). It is the Modal card at the `panel` width (560px; the screen less 24 a side on a phone, scrolling inside), in the confirm dialogs' shell: focus is trapped, Escape and the scrim cancel, focus returns to what opened it. Nothing of a Project and no device id is ever sent; text only, no attachments.

## Three Report kinds, three ways in

| Kind | Opened from | Title | Fields, in order |
|---|---|---|---|
| general | Menu, Help: **Send feedback** (`message` icon, after Keyboard shortcuts; on the Homepage too) | Send feedback | Message (required) |
| translation | Menu, Preferences: the link **Report a translation problem** under the Language row | Report a translation problem | Language (the app's language, changeable), Text as shown (required), Should say, Note |
| bead-color | The Bead colors list's foot row **Wrong or missing color?** (BeadColors card) | Report a bead color | Problem (Wrong color \| Missing color), Brand and catalog (read-only), Code, Looks like, Note |

Every kind then has **Email** (optional, prefilled from the account once there are accounts, and clearable), then **Also sent**.

## Layout

- Under the title, one `body` sentence saying what to write for the kind; then the fields, 16 apart, each a TextField card field with its label, "optional" where it is, hint and error.
- **Message** and **Note** are multiline TextFields that start `--feedback-message-height` (7.5rem, about five lines) and `--feedback-note-height` (4.5rem, about three lines) tall and can be pulled taller. Message and Note take up to 2,000 characters, every other field 200, the email 320.
- **Language** is a ChipRadioGroup of the seven languages, each by its own name. **Problem** is a SegmentedControl. **Brand and catalog** is plain `control` text: what the Bead is, not typed. **Code** starts from the highlighted catalog swatch (the row last focused in the list) or else the active Palette color's code; **Looks like** takes words or a hex, its hint says so.
- **Also sent** is a small `in-box` button with a chevron (`aria-expanded`), folded when the sheet opens. Open, it shows on `surface`, `radius-md`, padding 8 12, one row per value the Report carries, the label in `meta` / `muted` and the value in `meta` / `ink` at the right: Version, App language, Browser, System, Window size; a translation adds its Language; a color adds Brand, Catalog, Code, Stored hex and Swatch letter (those it has). The values are exactly what is sent. Under them, in `small` / `muted`: "Nothing from your Projects, and nothing that identifies this device."
- Actions: Cancel (`in-box`) and **Send** (primary), which reads "Sending…" and is disabled while it sends.

## Sending

- Turnstile renders invisibly as the sheet opens (it shows only if Cloudflare asks the person something), so its token is ready by Send.
- Send with a required field empty, or an email not shaped like one, sends nothing and puts the field's error under it ("Write a message.", "Enter the text as it shows.", "Enter an email such as name@example.com.").
- **Sent:** the sheet closes and a toast says "Thanks, your report was sent". No issue number: the reporter cannot follow it.
- **Not sent:** every field is kept, and a `danger` Message (notice placement, no close) says why, with **Copy report** as its link action:
  - switched off: "Sending reports is switched off for now. Try again in 15 min." (the Worker's `Retry-After`);
  - offline: "You are offline. Your report stays here: send it once you are back online, or copy it.";
  - too many: "Too many reports at once. Try again in 60 s." (its `Retry-After`);
  - anything else: "The report could not be sent. Try again later, or copy it."
- **Copy report** puts the full Markdown the issue would have held on the clipboard (its title as a heading, then the body), built by the same function the Worker uses, so the two never differ. A `small` line under the Message says "Report copied." (or that the browser refused).

## Copy

English above; every language in `writing.md` (Feedback sheet copy).

Hand-written from spec 0698 and ticket 0700; the Vue component `FeedbackSheet.vue` is the real thing.
