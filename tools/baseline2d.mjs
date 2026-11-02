#!/usr/bin/env node
// Guard the 2D effects while adding 3D: hash every 2D effect's frames (and its act), then compare later.
// Each effect renders in a process of its own, so what ran before it can't change its pixels.
//
//   node tools/baseline2d.mjs write [ids...]    records/baseline2d.json
//   node tools/baseline2d.mjs check [ids...]    exit 1 if any 2D effect renders differently

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { ROOT, FX_DIR, allIds, resolveIds, loadEffect, renderFrames, renderAct, save } from "./lib/fxlib.mjs";

const [mode, ...pats] = process.argv.slice(2);
if (mode === "--one") {
  const fx = await loadEffect(pats[0]), h = createHash("sha1");
  for (const f of renderFrames(fx).frames) h.update(f.color), h.update(f.clear);
  if (fx.mod.act) for (const f of renderAct(fx, { fps: 30 }).frames) h.update(f.color);
  process.stdout.write(h.digest("hex"));
  process.exit(0);
}
if (mode !== "write" && mode !== "check") {
  console.error("usage: node tools/baseline2d.mjs write|check [ids...]");
  process.exit(1);
}
const file = join(ROOT, "records", "baseline2d.json"), self = fileURLToPath(import.meta.url), run = promisify(execFile);
const ids = [];
for (const id of pats.length ? resolveIds(pats) : allIds(FX_DIR, { variants: false }))
  if (!id.endsWith("@3d") && !(await loadEffect(id)).meta.camera) ids.push(id);
const hashes = {};
let next = 0;
await Promise.all(Array.from({ length: Math.max(1, availableParallelism() - 2) }, async () => {
  while (next < ids.length) {
    const id = ids[next++];
    hashes[id] = (await run(process.execPath, [self, "--one", id], { maxBuffer: 1 << 20 })).stdout;
  }
}));
if (mode === "write") {
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  save(file, JSON.stringify({ ...all, ...hashes }, null, 1));
  console.log(`${ids.length} 2D effects -> ${file}`);
} else {
  const base = JSON.parse(readFileSync(file, "utf8")), changed = ids.filter((id) => base[id] && base[id] !== hashes[id]);
  const missing = ids.filter((id) => !base[id]);
  for (const id of changed) console.log(`CHANGED  ${id}`);
  for (const id of missing) console.log(`no baseline  ${id}`);
  console.log(`${ids.length} 2D effects: ${changed.length} changed`);
  process.exit(changed.length ? 1 : 0);
}
