#!/usr/bin/env node
// Watch 3D effects from every side: each plays on repeat while the camera goes once round it.
//
//   node tools/orbit.mjs 3d/meteor                       records/orbit/3d-meteor.gif
//   node tools/orbit.mjs 3d --mp4 --seconds 8            every 3D effect in one grid, as a video
//   node tools/orbit.mjs 3d/shockwave 3d/orbit-orbs --out docs/readme/orbit.gif --cols 2
//
// Options: --gif (default) | --mp4, --seconds S (one turn, default 6), --pitch DEG, --dist PX (perspective),
// --cols N, --scale N, --fps N, --rest S (pause before a one-shot replays), --out FILE

import { join } from "node:path";
import { ROOT, resolveIds, loadEffect, writeVideo } from "./lib/fxlib.mjs";
import { createFrame, clearFrame, createFx, createAct, composite, backdrop, floorGrid, space, drawActor, painterFor, stockActor, actorAlphaOf, CAMERA } from "../src/core/index.js";

const args = process.argv.slice(2), flags = {}, pats = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith("--")) pats.push(a);
  else if (["gif", "mp4"].includes(a.slice(2))) flags[a.slice(2)] = true;
  else flags[a.slice(2)] = args[++i];
}
const fxs = [];
for (const id of resolveIds(pats.length ? pats : ["3d"])) {
  const fx = await loadEffect(id);
  if (fx.meta.camera) fxs.push(fx);
  else console.error(`${id} is 2D (no meta.camera): skipped`);
}
if (!fxs.length) process.exit(1);

const fps = +(flags.fps ?? 30), seconds = +(flags.seconds ?? 6), rest = +(flags.rest ?? 0.4), n = Math.round(seconds * fps);
const cols = +(flags.cols ?? Math.min(fxs.length, 3)), rows = Math.ceil(fxs.length / cols);
const CW = Math.max(...fxs.map((f) => f.meta.size[0])), CH = Math.max(...fxs.map((f) => f.meta.size[1])), gap = 2;
const W = cols * CW + (cols - 1) * gap, H = rows * CH + (rows - 1) * gap;
const deg = (v) => (v === undefined ? undefined : (+v * Math.PI) / 180);

const cells = fxs.map((fx, i) => {
  const m = fx.meta, cam = { ...CAMERA, ...m.camera, ...(flags.pitch ? { pitch: deg(flags.pitch) } : {}), ...(flags.dist ? { dist: +flags.dist } : {}) };
  const x = Math.floor((CW - m.size[0]) / 2) + m.origin[0], y = Math.floor((CH - m.size[1]) / 2) + m.origin[1];
  const frame = createFrame(CW, CH, 0, 0, true), floor = m.bg === "ground";
  const make = () => (fx.mod.act ? createAct : createFx)(fx.mod, { x, y, camera: { ...cam } });
  return { fx, m, cam, x, y, frame, floor, bg: backdrop(floor ? "dark" : m.bg, CW, CH, y), inst: make(), make, wait: 0, ox: (i % cols) * (CW + gap), oy: Math.floor(i / cols) * (CH + gap) };
});

const frames = [];
for (let f = 0; f < n; f++) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (const c of cells) {
    if (f) {
      const over = c.fx.mod.act ? c.inst.done() : !c.m.loop && c.inst.t >= c.m.duration;
      if (over && (c.wait += 1 / fps) > rest) (c.inst = c.make()), (c.wait = 0);
      else if (!over) c.inst.update(1 / fps);
    }
    const yaw = c.cam.yaw + (f / n) * Math.PI * 2, o = c.fx.mod.act ? c.inst.fx.options : c.inst.options;
    o.camera.yaw = yaw;
    const fr = clearFrame(c.frame);
    if (c.floor) floorGrid(space(painterFor(fr).place(c.x, c.y), o), Math.max(...c.m.size) * 0.75);
    if (c.fx.mod.act) c.inst.draw(fr);
    else {
      const tt = c.m.loop ? c.inst.t % c.m.duration : Math.min(c.inst.t, c.m.duration);
      if (c.m.actor) drawActor(painterFor(fr).place(c.x, c.y), o.actor ?? stockActor(), actorAlphaOf(c.fx.mod, tt, o));
      c.inst.draw(fr);
    }
    const px = composite(fr, new Uint8ClampedArray(CW * CH * 4), c.bg);
    for (let y = 0; y < CH; y++) out.set(px.subarray(y * CW * 4, (y + 1) * CW * 4), ((c.oy + y) * W + c.ox) * 4);
  }
  frames.push({ color: out });
}

const ext = flags.mp4 ? "mp4" : "gif";
const file = flags.out ?? join(ROOT, "records", "orbit", `${fxs.length === 1 ? fxs[0].id.replace("/", "-") : "grid"}.${ext}`);
const k = +(flags.scale ?? Math.max(2, Math.min(6, Math.floor(960 / W))));
if (!writeVideo(file, { w: W, h: H, fps, frames }, k)) {
  console.error("ffmpeg is needed for GIF and MP4");
  process.exit(1);
}
console.log(`${fxs.map((f) => f.id).join(", ")}  ${n} frames, one turn in ${seconds} s  ->  ${file}`);
