# Glossary: Versions and releases

What a Build is called and what changed in it (spec 1043, ADR 0096, ticket 1045). Part of the glossary; the index is [README.md](README.md).

**Version**:
A Build's number, three numbers that each mean one thing a maker can meet, written `2.1.3`. The first steps at a Production release, the second when a note of kind New merges, the third when a note of kind Changed or Fixed merges; a step sets the numbers after it to 0. It starts at 1.0.0, which is also the first Production release. It steps exactly when a Release note merges, in the order pull requests merge into `main`: a pull request states its note's kind, never a number, and no title or ticket names a Version except a release's own. A Release note also has the Version its merge gave the app. Menu › About shows it with the Build's build mark, "1.0.0 · 090fe59", and a Report carries the same text. Worked out at build time from the release record and git (`vite.version.ts`, `scripts/versions.ts`); the package file's version is not used.
_Avoid_: release number, build number, app version (in prose)

**Build**:
One build of the app from one commit. It has a Version and a **build mark**, the commit's hash in seven characters; two Builds of the same Version differ only in what nobody using the app can see, and the build mark tells them apart. A Build that ships (`vite build`) needs `main`'s whole history and fails without it; the dev server and the unit tests don't.
_Avoid_: deploy, release (for a Build that isn't a Production release)

**Release note**:
One file per ticket, `src/data/releaseNotes/YYYY-MM-DD-NNNN.json` (its day and ticket), with its kind and one short line in every shipped language, added by the pull request that makes a user-facing change. Its file name and kind are final once merged: it is never deleted or renamed, only its wording may be corrected, and taking a feature back is a new Changed note. The notes from before 1.0.0 sit apart in `before-1.0.0/`, with no kind and no number. The rules for authors are in `docs/agents/pull-requests.md`, Release notes.
_Avoid_: changelog entry, release item

**New**, **Changed**, **Fixed** (a Release note's kind):
**New**: the maker can do something they couldn't (a feature that returns is New); it steps the second number, and only with the owner's yes, a no making it Changed. **Changed**: it was there and now looks or works differently, and the old way was intended (something removed is Changed). **Fixed**: it was wrong and now works as meant (a freeze made fast is Fixed); a `fix` pull request's note is Fixed. Changed and Fixed step the third number. When two fit, the bigger wins: New, then Changed, then Fixed.
_Avoid_: feature, improvement, bugfix (as kinds)

**Production release**:
A pull request that adds a release, `X.0.0` with its date and the number and kind of every note it releases, to the release record `src/data/releases.json`. An agent opens one only when the owner says "release", and only the owner merges it; merging it deploys production, and production takes no other commit (`docs/deploy.md`). From then on its notes' numbers come from the record, not git. A note that merged while it was open, and so is not in its list, keeps the number it had before the release. Release 1.0.0, with no notes, is ticket 1045's own pull request.
_Avoid_: deploy, tag, version bump
