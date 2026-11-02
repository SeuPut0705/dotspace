---
name: dotspace
description: Pixel art effects and sprite animations as code, in 2D and 3D, with the dotspace library (248 ready-made effects acted out by a character, from fire and slashes to UI and critters). Use when someone wants pixel art VFX, sprite animations, sprite sheets or game juice; a specific effect ("a frost nova for my mage"); a pixel effect that lives in 3D (seen from any camera angle, wrapping round a character, directional billboards, normal or emission maps so a 3D engine lights it); or to use, export, recolor or make one for Godot, Unity, three.js, Phaser or a canvas game.
license: MIT
compatibility: Node 18 or newer. ffmpeg is optional (GIF and MP4 previews).
---

# dotspace

Pixel art effects as code. Each effect is one file, `src/fx/<category>/<name>.js`, that draws into two buffers:
**color** (pixels: opaque, dithered or truly translucent) and **light** (additive glow). No images, so an effect
can be played live, recolored, mirrored, reseeded and rendered to a sprite sheet for any engine.

Every effect plays in 3D. A 2D effect (drawn in screen pixels) also exports its **3D variant** `three` in the same
file, addressed as `<id>@3d` (`fire/torch@3d`) and built with `in3d(mod)`; the effects in `src/fx/3d/` are 3D only
(`meta.camera` set). 3D draws in world space through a camera with a depth for every pixel, still pixel art on one
grid. `docs/3D.md` is the reference.

The method is Hugo Duprez's ([How to make (good) pixel art effects with
Claude](https://www.spritefusion.com/blog/how-to-make-good-pixel-art-effects-with-claude)): code is clay, trust
your eyes, feed your references. One-shot prompts make mediocre effects. Drafts you render, look at and refine
make good ones.

## Before anything

1. Work in a dotspace checkout. If the working directory has no `tools/render.mjs`, clone one next to the
   project: `git clone https://github.com/SeuPut0705/dotspace`. No install step: the tools use only Node.
2. Check it runs: `node tools/render.mjs fire/torch` writes `records/fire/torch/contact.png`. Open that PNG with
   your image-reading tool. That contact sheet is how you see every effect from now on. A 3D effect
   (`node tools/render.mjs 3d/shockwave`) also writes `views.png`: the same moments from 8 directions.

## 1. Look for an existing effect first

`node tools/list.mjs <words>` searches ids, names, tags and descriptions (`node tools/list.mjs frost`,
`node tools/list.mjs slash loop`, `node tools/list.mjs 3d`). `docs/CATALOG.md` lists everything by category. Render
the candidates and look at them before choosing. Most requests are an existing effect with different options:

- `palette`: the main ramp, dark to bright, as hex strings. Any `PAL` ramp in `src/core/color.js` (fire ember
  lava smoke dust ice water electric volt poison holy heal arcane shadow blood earth stone gold leaf wood metal
  bone neon cyber matrix candy night) or your own. A blue fire is `{"palette": PAL.ice}`.
- `seed` for a different but equivalent take; `flip` to face left; `angle` to rotate; `light` (0..1+) for glow
  strength; plus each effect's own knobs in its `meta.options` (size, count, radius, text, height...).
- A 3D effect takes `camera` too (`yaw`, `pitch` in radians, `dist` for perspective): `--yaw 90 --pitch 40` on the
  command line, in degrees.
- Try options without editing code: `node tools/render.mjs fire/torch --opts '{"palette":["#102","#215","#43a","#8cf","#fff"]}'`.

## 2. Put it in the game

**Canvas or WebGL games in JS or TS** (plain canvas, Phaser, PixiJS, Kaplay, three.js): use the code directly. It
has no dependencies; copy `src/core` and the effect files you need, or depend on the repo
(`npm i github:SeuPut0705/dotspace`, imported as `dotspace`).

```js
import { createFrame, clearFrame, createFx, composite } from "dotspace";   // src/core/index.js
import * as frostNova from "dotspace/fx/ice/frost-nova";                   // src/fx/ice/frost-nova.js

const frame = createFrame(320, 180);            // the game's pixel resolution; ox, oy scroll it with the camera
const img = new ImageData(320, 180);
const fx = createFx(frostNova, { x: hero.x, y: hero.y, flip: hero.facing < 0 });

// every tick
fx.update(dt);
clearFrame(frame);
fx.draw(frame, "back");    // what goes behind characters
drawCharacters();          // your own sprites, or draw them into frame.color yourself
fx.draw(frame, "front");
composite(frame, img.data, background);   // color over the background plus light; or null for transparent
ctx.putImageData(img, 0, 0);              // then scale the canvas up with image-rendering: pixelated
if (fx.done()) removeIt();               // one-shots end on their own; fx.stop() fades a loop out
```

A 3D effect wants a frame with depth, `createFrame(w, h, 0, 0, true)`, characters drawn before it (they stand at
depth 0) and one `fx.draw(frame)` with no layer. In a 3D JS engine, set `fx.options.camera` from the game camera
every frame with `cameraToward(dx, up, dz)` and draw the frame on a camera-facing quad: `docs/3D.md`, "Put it in a game".

**Any engine** (Godot, Unity, GameMaker, Defold, LÖVE, Bevy, Construct): export sprite sheets.
`node tools/render.mjs ice/frost-nova --sheet` writes `records/ice/frost-nova/frost-nova.png` (transparent
frames in a grid) and `frost-nova.json` (Aseprite-style frames, so Phaser's atlas loader, Godot and Unity Aseprite
importers and most tools read it; `meta.dotspace` has fps, loop, frame size, columns and the pivot). Set the
pivot to `meta.dotspace.pivot` (the effect's origin, e.g. the feet), import with nearest-neighbour filtering and no
compression, and play at `meta.dotspace.fps`. Glow is baked into the sheet as color with alpha, which reads as
additive over dark scenes; for bright scenes, render a recolored version or keep the effect on a dark layer.

For a 3D game, choose by what the scene needs:

- **Directional billboard** (a 3D effect seen from wherever the player stands): `--sheet --views 8` lays one row
  per direction with a frame tag each (`<name>@yaw45`); play the row nearest the camera's angle to the effect.
- **Lit by the scene's lights** (2D or 3D effect): add `--maps` for albedo, emission, normal and (3D) depth sheets
  laid out the same. Albedo goes in the material's albedo, emission in emission, the normal map in normal.

For the full library: `node tools/render.mjs <category> --sheet` does a whole category.

**A hit needs a body behind it.** An effect alone looks like a sticker. Effects with a character carry an `act`: when the body winds
up, when to freeze, how the target reacts. Use it whichever way the game is built:

- With the stock character: `createAct(slash, { x, y })` instead of `createFx`. `act.update(dt)`, `act.draw(frame)`, and throw the
  picture by `act.shake`. It holds still by itself during a freeze. `node tools/act.mjs <id> --sheet` bakes the lot into a sprite sheet.
- With the game's own character: read the timing, `slash.act` or `meta.dotspace.act` in a sheet's JSON (`windup`, `recovery`, `hits`
  with `t` and `freeze`). Play the character's attack animation `windup` seconds before the effect, and at each hit stop updating
  everything, effect and characters both, for `freeze` seconds. Host-side hit-stop works on any effect, with or without an act.

`src/fx/moves/` has whole attacks chained from the effects, wind-up to recovery: start there when someone asks for a move, not an effect.

## 3. Make a new one

Read `docs/AUTHORING.md` first: it is the contract (meta, `draw(p, t, o)` for pure effects or `create(o)` for
simulated ones, local coordinates, seamless loops, ending empty), the toolkit, the painter API and the quality bar.
For a 3D effect read `docs/3D.md` too: world space, the Space (`q = space(p, o)`), particles in 3D, depth rules, and
"Give a 2D effect its 3D variant".

A new 2D effect gets its `three` variant in the same file before it is done: `node tools/check.mjs <id>` checks both
`<id>` and `<id>@3d`. Make an effect 3D only when it has no sensible 2D form. Then:

1. **Say it in one line** with art direction: what it is, how it moves, its palette, its timing. "A frost nova:
   crystals erupt in a ring from the feet outward, a white flash at the center, shards spin off, the floor stays
   frosted and fades." For 3D, say where the camera sits and what happens in depth.
2. **Find references** in the library: `node tools/list.mjs <words>`, then read the two or three closest effect
   files and borrow their techniques (`Particles` and `Bits` in `src/core/sim.js` for sparks, smoke and debris,
   `p.disc` for translucent volumes, `cycle` for seamless particles, `tileFbm` scrolls for flames and water; in 3D
   `q.plane`, `q.ring` and `q.arc` for anything on a plane, `q.ball` with `lit()` for solid volumes, `q.at` to
   reuse any 2D drawing as a billboard). Look at the closest of [Hugo Duprez's effects](https://www.spritefusion.com/pixel-art-vfx)
   too: they are the quality bar. If his has more detail, light or life at the same size on screen, yours isn't done.
3. **Draft.** `node tools/new.mjs <category>/<name>` (add `--loop` for a loop, `--3d` for 3D) gives a working file.
   When the direction is open, write 3 to 5 genuinely different drafts (`<name>-a.js` .. `-e.js`), render them all
   (`node tools/render.mjs "<category>/<name>-*"`) and look at every contact sheet before choosing. Show the user
   the strongest two or three if they're around (`--gif` makes animations to share).
4. **Look, judge, fix.** Render, open `records/<id>/contact.png`, and judge like a picky pixel artist. Fix the
   worst thing, render again. Three rounds minimum; a showpiece takes more. `--all` shows every frame,
   `--mp4` shows motion at full speed. For 3D, judge `views.png` every round as well, and watch
   `node tools/orbit.mjs <id>` (the camera goes once round while it plays) before calling it done.
5. **Act it out** if a character is involved: add `export const act` (see "Acts" in `docs/AUTHORING.md`), with a wind-up before t = 0,
   a pose change on the release frame, a freeze on contact and a recovery. `node tools/act.mjs <id>` shows consecutive 12 fps steps:
   judge motion from those and from `--mp4`, not from a contact sheet's samples.
6. **Check.** `node tools/check.mjs <id>` catches drawing outside the canvas (from all 8 sides for 3D), one-shots
   that don't end empty, loop seams, unseeded randomness and slow frames, and in an act: keys out of order, unknown
   pose fields and hands that teleport. Fix until it passes clean. Delete the drafts you didn't keep.

What to look for, and the usual fix:

| you see | fix |
|---|---|
| it reads as mush at 1x | fewer colors, a clear silhouette, one focal point, bigger shapes |
| speckle: lone noise pixels inside shapes | threshold noise less, quantize with `at()`, no noise on small shapes |
| floaty, no punch | fast in, slow out (`ease.outQuart`/`outExpo`), a 1 to 2 frame white hero frame, shorter total time |
| stiff or mechanical | vary every particle (size, speed, delay, life), add secondary motion (sparks, smoke, debris) |
| washed out | less glow (k 0.2 to 0.5), darker edge steps, keep white for the hottest core only |
| flat | light from one side: brighter top-left, darker bottom-right step; a darker ramp step at the base |
| smooth gradients, vector look | hard ramp steps in color; softness only in light and in translucent smoke |
| a checkerboard where smoke should be | `SMOKE`, `VAPOUR` or `DUST` particles, or `p.disc` / `q.disc`: truly translucent, lit on top |
| seam when a loop wraps | `cycle`, `loopNoise(phase)`, whole-cell `tileNoise` scrolls, `sin(phase * TAU * n)` |
| a one-shot that pops off | let it shrink, dither out or fall away before t = duration |
| a great effect on a dead character | give it an act: wind-up, release pose, freeze on contact, a target that reacts, recovery |
| the act feels weightless | a wind-up the opposite way to the blow, a longer freeze (up to 0.2 s), a bigger silhouette change, shake |
| the hit lands out of sync | move the hit key to the effect's own constant, not to a time you eyeballed |
| he holds the weapon badly | keep a bend in the elbow, shafts in front of the chest; on a swing the blade lags the hand; arms reach about 15 px and don't stretch, so step the body in |
| his arms cross or the pose looks flat | he faces three-quarters towards us: for open arms the near hand goes left (`fx < 0`), far hand right, with `turn: 1`; `yaw` really turns him |
| 3D: right from the front, a flat card from the side | spread it in z: `spawn3` with vz, rings and arcs on planes, `q.ball` volumes instead of 2D circles |
| 3D: smoke vanishes in front of something solid | draw solid things first, translucent ones after, far to near (`q.sort`); particle systems do this already |
| 3D: a hard line cuts a glow off | a glow hides behind what is more than r in front of it: give it a radius that reaches the surface it should light |
| 3D: spills from one side only | grow `size` or move `origin` until `tools/check.mjs` is clean from all 8 directions |

Directional effects face right, ground effects stand on y = 0, actor effects wrap `o.actor` (a 24 x 38 stock
character's mask and pixels), and nothing uses `Math.random`. Generic motifs are fine; never recreate a specific game's
sprites, characters or logos.

## 4. Native code instead of JS

If the game can't run JS and a sprite sheet isn't enough (an effect that follows a moving target, or needs
per-instance colors at runtime), port the effect. Pure effects are a function of time; simulated ones step the particles in
`src/core/sim.js`; a 3D one projects through `src/core/space.js` and depth-tests in the painter. Keep the two-buffer
idea, the 4x4 Bayer threshold for dithered alpha and the palette ramp lookups. Render the JS original and your port
side by side to check they match.
