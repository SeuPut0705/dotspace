#!/usr/bin/env node
// Start a new effect from a template: node tools/new.mjs <category>/<name> [--loop] [--3d]
// Writes src/fx/<category>/<name>.js and renders it once. --3d starts one that lives in 3D (src/core/space.js).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { FX_DIR } from "./lib/fxlib.mjs";

const id = process.argv[2], loop = process.argv.includes("--loop"), d3 = process.argv.includes("--3d");
if (!id || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(id)) {
  console.error("usage: node tools/new.mjs <category>/<name> [--loop] [--3d]   (kebab-case)");
  process.exit(1);
}
const file = join(FX_DIR, id + ".js");
if (existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}
const name = id.split("/")[1].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
const body2d = loop
  ? `  // a loop: everything is a function of the phase, so t = 0 and t = duration match
  const C = ramp(o.palette), ph = t / meta.duration;
  cycle(t, meta.duration, 12, o.seed, 0.8, (age, life, r) => {
    const k = age / life, a = r.range(0, TAU) + ph * TAU, rad = 6 + k * 12;
    p.px(Math.cos(a) * rad, Math.sin(a) * rad - 8, at(C.slice(2), 1 - k));
  });
  p.circle(0, -8, 4 + Math.sin(ph * TAU) * 1.5, C[5]);
  p.glow(0, -8, 20, C[4], 0.35);`
  : `  // a one-shot: a hero frame, then everything falls away and is gone by t = duration
  const C = ramp(o.palette);
  if (t < 0.06) p.circle(0, -8, 6, WHITE);
  burst(14, o.seed, (r) => {
    const a = r.range(0, TAU), sp = r.range(40, 90), life = r.range(0.3, 0.6);
    if (t > life) return;
    const [x, y] = fly(0, -8, Math.cos(a) * sp, Math.sin(a) * sp, t, 120, 2);
    p.px(x, y, at(C.slice(2), 1 - t / life));
    p.light(x, y, C[4], 0.5 * (1 - t / life));
  });
  p.glow(0, -8, 24, C[4], 0.5 * (1 - seg(t, 0, 0.4)));`;
const body3d = loop
  ? `  // a loop in 3D: q draws in world space (x right, y down, z towards the camera) and depth sorts it
  const q = space(p, o), C = ramp(o.palette), ph = t / meta.duration;
  q.ring(0, 0, 0, 15, 1, C[3], 0.7);
  for (let i = 0; i < 3; i++) {
    const a = ph * TAU + (i * TAU) / 3;
    q.ball(Math.cos(a) * 14, -10 + Math.sin(a * 2) * 2, Math.sin(a) * 14, 2.5, lit(C));
    q.glow(Math.cos(a) * 14, -10, Math.sin(a) * 14, 10, C[5], 0.3);
  }`
  : `  // a one-shot in 3D: q draws in world space (x right, y down, z towards the camera) and depth sorts it
  const q = space(p, o), C = ramp(o.palette);
  if (t < 0.06) q.ball(0, -10, 0, 5, WHITE);
  q.ring(0, 0, 0, 6 + 20 * seg(t, 0, 0.5), 2, C[5], 1 - seg(t, 0.2, 0.6));
  burst(18, o.seed, (r) => {
    const a = r.range(0, TAU), e = r.range(-0.7, 0.4), sp = r.range(40, 80), life = r.range(0.3, 0.6);
    if (t > life) return;
    const d = sp * t;
    q.px(Math.cos(a) * Math.cos(e) * d, -10 + Math.sin(e) * d + 90 * t * t, Math.sin(a) * Math.cos(e) * d, at(C.slice(2), 1 - t / life));
  });
  q.glow(0, -10, 0, 24, C[4], 0.5 * (1 - seg(t, 0, 0.4)));`;
const names = d3 ? (loop ? "space, lit" : "space, burst, seg, WHITE") : loop ? "cycle" : "burst, fly, seg, WHITE";
const src = `import { PAL, ramp, at, ${names}, TAU } from "../../core/index.js";

export const meta = {
  name: "${name}",
  desc: "One line: what it is, how it moves.",
  tags: ["${id.split("/")[0]}"${d3 ? ', "3d"' : ""}],
  size: [${d3 ? "76, 68" : "48, 48"}],
  origin: [${d3 ? "38, 46" : "24, 32"}],
  duration: ${loop ? 1.2 : 0.7},
  loop: ${loop},
  fps: 30,
  bg: "${d3 ? "ground" : "dark"}",${d3 ? "\n  camera: { pitch: 0.3 },   // makes it 3D: any yaw, pitch or perspective (dist) at render time" : ""}
  options: { palette: PAL.arcane, seed: 1 },
};

export function draw(p, t, o) {
${d3 ? body3d : body2d}
}
`;
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, src);
console.log(`wrote ${file}\nnext: node tools/render.mjs ${id}   then look at records/${id}/contact.png\na character in it? give it an act: see "Acts" in docs/AUTHORING.md, then node tools/act.mjs ${id}`);
