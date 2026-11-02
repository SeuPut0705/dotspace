# Every effect in 3D

**Asked.** After the first 3D release only 4 effects were 3D; the owner wanted all of them, keeping the 2D ones.

**Decision.** Every 2D effect file also exports `three`, its 3D variant, addressed as `<id>@3d`. The 2D exports stay
byte-identical, so games using them see no change.

| question | chosen | why | rejected |
|---|---|---|---|
| where the 3D version lives | `export const three` in the same file | it reuses the file's 2D helpers, palette and timing; one id per effect | a parallel `src/fx3d/` tree (doubles every file); replacing 2D (breaks existing users) |
| how 2D art goes into space | three kinds of part: upright billboards (`q.at`), 2D drawing laid on a plane (`q.decal`, added for this), real x, y, z for what spreads out | keeps the hand-tuned pixel art where a part looks the same from every side, real depth everywhere else | auto-billboarding the whole 2D effect (flat card, fails the 8-view check by eye) |
| guarding 2D | `tools/baseline2d.mjs`: a hash of every 2D effect's frames and act, each rendered in its own process, written from the untouched upstream commit | a single process gave different pixels for the same effect depending on what ran before it (see below), which made the gate lie | hashing in one process |
| doing 244 effects | one agent per category, each owning only its category's files, with the same gates | categories don't share files except through `_lib.js`, which each owns; 20 ran in parallel | one agent for all (hours serial) |

**Gates every category passed.** `node tools/check.mjs <category>`: every `@3d` id `ok`, no warnings, which includes
fitting the canvas from 8 directions. `node tools/baseline2d.mjs check <category>`: `0 changed`. Every effect file
exports `three`. Each agent rendered `views.png` (8 directions) for every variant and looked at it at least twice.

**Found on the way.** `src/core/rig.js` caches posed bodies under a key that rounds the pose, so two poses that differ
by less than a pixel share whatever rendered first. A body's pixels therefore depend on which effects played before
it. This is upstream behaviour (reproduced on pixelfx a841596: `holy/resurrection` renders three different ways
depending on its predecessors). Fixed by giving each act its own pose cache (`posed(pose, cache)`), which keeps every
effect's pixels exactly what upstream draws for it alone and stops effects changing each other. Rendering the rounded
pose instead was tried and rejected: it removes the order dependence too but changes 68 acted 2D effects by about 90 px
a frame, and the 2D effects were to stay as they are.
