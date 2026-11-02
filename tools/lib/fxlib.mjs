// Shared by the tools: find effects, render their frames, lay frames out, write PNG, GIF and MP4.

import { readdirSync, existsSync, statSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createFrame, clearFrame, createFx, createAct, actBounds, actTiming, composite, painterFor, drawActor, stockActor, backdrop, floorGrid, space, actorAlphaOf, CAMERA, in3d } from "../../src/core/index.js";
import { rasterText, textWidth } from "../../src/core/font.js";
import { encodePNG } from "./png.mjs";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FX_DIR = join(ROOT, "src", "fx");

/**
 * Every effect id ("fire/torch"), sorted. Files starting with _ are helpers, not effects. With variants, an effect
 * that also exports a 3D variant (`export const three`) is listed twice: "fire/torch" and "fire/torch@3d".
 */
export function allIds(dir = FX_DIR, { variants = true } = {}) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const cat of readdirSync(dir).sort()) {
    const d = join(dir, cat);
    if (cat.startsWith("_") || !statSync(d).isDirectory()) continue;
    for (const f of readdirSync(d).sort()) {
      if (!f.endsWith(".js") || f.startsWith("_")) continue;
      const id = `${cat}/${f.slice(0, -3)}`;
      out.push(id);
      if (variants && /^export const three\b/m.test(readFileSync(join(d, f), "utf8"))) out.push(id + VARIANT);
    }
  }
  return out;
}
/** The suffix of an effect's 3D variant id. */
export const VARIANT = "@3d";

/** Ids matching patterns: "fire/torch", "fire" (a category), "fire/*", "*torch*", "fire/torch@3d", or a file path. */
export function resolveIds(patterns, dir = FX_DIR) {
  const all = allIds(dir), out = new Set();
  for (let p of patterns) {
    if (p.endsWith(".js")) p = relative(dir, p.startsWith("/") ? p : join(process.cwd(), p)).split(sep).join("/").replace(/\.js$/, "");
    const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    const hits = all.filter((id) => id === p || id.startsWith(p + "/") || id === p + VARIANT || re.test(id));
    if (!hits.length) console.error(`no effect matches ${p}`);
    hits.forEach((h) => out.add(h));
  }
  return [...out];
}

/** Import an effect module fresh. "fire/torch@3d" loads fire/torch's 3D variant as an effect of its own. */
export async function loadEffect(id, dir = FX_DIR) {
  const v3 = id.endsWith(VARIANT), base = v3 ? id.slice(0, -VARIANT.length) : id;
  const file = join(dir, base + ".js");
  const src = await import(pathToFileURL(file).href + `?v=${statSync(file).mtimeMs}`);
  if (!src.meta) throw new Error(`${id}: no meta export`);
  if (v3 && !src.three) throw new Error(`${id}: ${base} exports no 3D variant (export const three)`);
  const mod = v3 ? in3d(src) : src;
  const meta = { fps: 30, bg: "dark", loop: false, duration: 1, tags: [], options: {}, ...mod.meta };
  if (!mod.draw && !mod.create) throw new Error(`${id}: exports neither draw nor create`);
  return { id, file, mod: { ...mod, meta }, meta };
}

/**
 * Render an effect's frames. Returns { w, h, fps, n, frames: [{ t, color: RGBA over the backdrop,
 * clear: RGBA on transparency, raw, light, depth }] }. opts: { fps, seed, bg, margin, camera (3D effects),
 * options (passed to the effect) }.
 */
export function renderFrames(fx, opts = {}) {
  const { meta } = fx, [W, H] = meta.size, [OX, OY] = meta.origin, m = opts.margin ?? 0;
  const w = W + m * 2, h = H + m * 2, fps = opts.fps ?? meta.fps;
  const n = Math.max(1, Math.round(meta.duration * fps) + (meta.loop ? 0 : 1));
  const is3d = !!meta.camera, shown = createFrame(w, h, -m, -m, is3d), bare = createFrame(w, h, -m, -m, is3d);
  const bgKind = opts.bg ?? meta.bg;
  // a 3D effect's "ground" is a floor that turns with the camera, drawn with depth instead of a backdrop
  const floor = is3d && bgKind === "ground";
  const bg = bgKind === "none" ? null : backdrop(floor ? "dark" : bgKind, w, h, OY + m);
  const inst = createFx(fx.mod, { x: OX, y: OY, ...(opts.seed !== undefined ? { seed: opts.seed } : {}), ...(opts.camera ? { camera: opts.camera } : {}), ...(opts.options ?? {}) });
  const actor = meta.actor && opts.actor !== false ? inst.options.actor ?? stockActor() : null;
  const fade = m === 0 && !isScreen(meta);
  const frames = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) inst.update(1 / fps);
    // `shown` has the backdrop and the stand-in actor; `bare` is the effect alone, for sprite sheets
    clearFrame(shown);
    clearFrame(bare);
    inst.draw(bare);
    const actorAt = () => actor && drawActor(painterFor(shown).place(OX, OY, !!opts.options?.flip), actor, actorAlphaOf(fx.mod, fx.meta.loop ? inst.t % fx.meta.duration : Math.min(inst.t, fx.meta.duration), inst.options));
    if (is3d) {
      // depth sorts it all: the floor and the character go in first, so smoke in front of him stays in front
      if (floor) floorGrid(space(painterFor(shown).place(OX, OY, !!opts.options?.flip), inst.options), Math.max(W, H) * 0.75);
      actorAt();
      inst.draw(shown);
    } else {
      inst.draw(shown, "back");
      actorAt();
      inst.draw(shown, "front");
    }
    if (fade) (edgeFade(bare), edgeFade(shown));
    frames.push({
      t: i / fps,
      color: composite(shown, new Uint8ClampedArray(w * h * 4), bg),
      clear: composite(bare, new Uint8ClampedArray(w * h * 4), null),
      raw: bare.color.slice(),
      light: bare.light.slice(),
      depth: bare.depth?.slice(),
    });
  }
  return { w, h, fps, n, frames, margin: m, camera: inst.options.camera ? { ...inst.options.camera } : undefined };
}

/**
 * An effect acted out: the character, the target, the freeze, the shake, on a canvas big enough for all of it.
 * Returns { w, h, fps, n, frames: [{ t (effect time, negative before it starts), frozen, color }] }.
 */
export function renderAct(fx, opts = {}) {
  const { meta } = fx, fps = opts.fps ?? 60, b = actBounds(fx.mod), pad = opts.pad ?? 6;
  const w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2, X = pad - b.x0, Y = pad - b.y0;
  const floor = !!meta.camera && (opts.bg ?? meta.bg) === "ground";
  const frame = createFrame(w, h, 0, 0, !!meta.camera), bgKind = opts.bg ?? meta.bg, bg = bgKind === "none" ? null : backdrop(floor ? "dark" : bgKind, w, h, Y);
  const act = createAct(fx.mod, { x: X, y: Y, ...(opts.seed !== undefined ? { seed: opts.seed } : {}), ...(opts.options ?? {}) });
  const frames = [], max = Math.round((opts.seconds ?? (meta.loop ? meta.duration * 2 - act.t : 8)) * fps);
  const show = () => {
    clearFrame(frame);
    if (floor) floorGrid(space(painterFor(frame).place(X, Y, !!opts.options?.flip), act.fx.options), Math.max(w, h) * 0.75);
    act.draw(frame, { body: opts.actor !== false, target: opts.target !== false });
    const rgba = composite(frame, new Uint8ClampedArray(w * h * 4), bg), [sx, sy] = act.shake;
    frames.push({ t: act.t, frozen: act.frozen, color: sx || sy ? shifted(rgba, w, h, sx, sy) : rgba, clear: rgba });
  };
  show();
  for (let i = 0; i < max && !act.done(); i++) {
    act.update(1 / fps);
    show();
  }
  // a beat on the end, so a video doesn't cut off the last pose
  if (!meta.loop) for (let i = 0; i < fps * (opts.hold ?? 0.3); i++) {
    act.update(1 / fps);
    show();
  }
  return { w, h, fps, n: frames.length, frames, pivot: [X, Y] };
}
function shifted(rgba, w, h, sx, sy) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const X = Math.max(0, Math.min(w - 1, x - sx)), Y = Math.max(0, Math.min(h - 1, y - sy)), d = (y * w + x) * 4, s = (Y * w + X) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  return out;
}

/** Full-screen effects (transitions, weather, impact frames): 16:9 and at least 320 wide. They fill the screen. */
export const isScreen = (meta) => meta.size[0] >= 320 && Math.abs(meta.size[0] / meta.size[1] - 16 / 9) < 0.05;

/**
 * A glow cut off by the canvas edge shows as a box once a frame sits in a game. Ease the light out over the last
 * E pixels of the canvas, in place. Colour is left alone.
 */
export function edgeFade(f, E = 8) {
  const { w, h, light: L } = f;
  for (let y = 0; y < h; y++) {
    const ey = Math.min(y, h - 1 - y);
    for (let x = 0; x < w; x++) {
      const e = Math.min(ey, x, w - 1 - x);
      if (e >= E) { x = w - 1 - E; continue; }
      const i = y * w + x, l = L[i];
      if (!(l & 0xffffff)) continue;
      const u = (e + 0.5) / E, k = u * u * (3 - 2 * u);
      L[i] = (l & 0xff000000) | Math.round((l & 255) * k) | (Math.round(((l >>> 8) & 255) * k) << 8) | (Math.round(((l >>> 16) & 255) * k) << 16);
    }
  }
}

/** Nearest-neighbour upscale of RGBA. */
export function upscale(rgba, w, h, k) {
  if (k === 1) return rgba;
  const out = new Uint8ClampedArray(w * k * h * k * 4), src = new Uint32Array(rgba.buffer, rgba.byteOffset, w * h);
  const dst = new Uint32Array(out.buffer);
  for (let y = 0; y < h * k; y++) {
    const sy = (y / k) | 0;
    for (let x = 0; x < w * k; x++) dst[y * w * k + x] = src[sy * w + ((x / k) | 0)];
  }
  return out;
}

/** A blank RGBA canvas with helpers to paste images and write labels. */
export function canvas(w, h, fill = [12, 11, 16, 255]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(fill, i * 4);
  return {
    w, h, data,
    paste(src, sw, sh, x, y) {
      for (let yy = 0; yy < sh; yy++) {
        const ty = y + yy;
        if (ty < 0 || ty >= h) continue;
        for (let xx = 0; xx < sw; xx++) {
          const tx = x + xx;
          if (tx < 0 || tx >= w) continue;
          const s = (yy * sw + xx) * 4, d = (ty * w + tx) * 4, a = src[s + 3] / 255;
          for (let c = 0; c < 3; c++) data[d + c] = src[s + c] * a + data[d + c] * (1 - a);
          data[d + 3] = Math.max(data[d + 3], src[s + 3]);
        }
      }
    },
    text(str, x, y, k = 2, rgb = [200, 196, 214], font = "mini") {
      rasterText(str, font, (gx, gy) => {
        for (let yy = 0; yy < k; yy++)
          for (let xx = 0; xx < k; xx++) {
            const tx = x + gx * k + xx, ty = y + gy * k + yy;
            if (tx >= 0 && ty >= 0 && tx < w && ty < h) data.set([...rgb, 255], (ty * w + tx) * 4);
          }
      });
    },
    rect(x, y, rw, rh, rgba) {
      for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++) for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++) data.set(rgba, (yy * w + xx) * 4);
    },
    png() {
      return encodePNG(w, h, data);
    },
  };
}

export { textWidth };

/** Which frames a contact sheet shows: all of them up to max, else evenly spaced. */
export function pickFrames(n, max = 16) {
  if (n <= max) return [...Array(n).keys()];
  if (max <= 1) return [Math.floor((n - 1) / 2)];
  return Array.from({ length: max }, (_, i) => Math.round((i * (n - 1)) / (max - 1)));
}

/** A contact sheet: frames in a grid, labelled, scaled to stay readable. Returns a PNG buffer. */
export function contactSheet(fx, r, { max = 16, width = 1600, title, zoom } = {}) {
  const { w, h, frames, fps } = r, idx = pickFrames(frames.length, max);
  const k = zoom ?? Math.max(1, Math.min(6, Math.floor((width - 16) / Math.min(idx.length, 6) / (w + 6))));
  const cw = w * k, ch = h * k, pad = 8, label = 16;
  const cols = Math.max(1, Math.min(idx.length, Math.floor((Math.max(width, cw + pad * 2) - pad) / (cw + pad))));
  const rows = Math.ceil(idx.length / cols), head = 30;
  const img = canvas(pad + cols * (cw + pad), head + rows * (ch + label + pad) + pad);
  const m = fx.meta;
  img.text(title ?? `${fx.id}  ${m.size[0]}x${m.size[1]}  ${m.duration}S  ${frames.length}F @${fps}  ${m.loop ? "LOOP" : "ONE-SHOT"}`, pad, 8, 3);
  idx.forEach((fi, j) => {
    const x = pad + (j % cols) * (cw + pad), y = head + Math.floor(j / cols) * (ch + label + pad);
    img.text(`${fi}  ${frames[fi].t.toFixed(2)}`, x, y, 2, [140, 134, 160]);
    img.paste(upscale(frames[fi].color, w, h, k), cw, ch, x, y + label);
  });
  return img.png();
}

/**
 * A 3D effect seen from `count` directions round it: [{ name, yaw, pitch, r }], r as renderFrames returns. The
 * camera starts at opts.camera (over the effect's own) and turns round in equal steps; names count degrees from it.
 */
export function renderViews(fx, { count = 8, camera, ...opts } = {}) {
  const cam = { ...CAMERA, ...fx.meta.camera, ...camera };
  return Array.from({ length: count }, (_, i) => {
    const deg = Math.round((i * 360) / count), yaw = cam.yaw + (deg * Math.PI) / 180;
    return { name: `yaw${deg}`, yaw, pitch: cam.pitch, r: renderFrames(fx, { ...opts, camera: { ...cam, yaw } }) };
  });
}

/** A contact sheet of views: one row per direction, the same moments in each column. Returns a PNG buffer. */
export function viewSheet(fx, views, { cols = 8, width = 1600, zoom } = {}) {
  const { w, h, n } = views[0].r, idx = pickFrames(n, cols);
  const k = zoom ?? Math.max(1, Math.min(6, Math.floor((width - 120) / idx.length / (w + 6))));
  const pad = 8, label = 96, head = 30, img = canvas(label + idx.length * (w * k + pad) + pad, head + views.length * (h * k + pad) + pad);
  img.text(`${fx.id}  VIEWS  PITCH ${Math.round((views[0].pitch * 180) / Math.PI)}`, pad, 8, 3);
  idx.forEach((fi, c) => img.text(views[0].r.frames[fi].t.toFixed(2), label + c * (w * k + pad), head - 12, 2, [140, 134, 160]));
  views.forEach((v, row) => {
    const y = head + row * (h * k + pad);
    img.text(v.name.toUpperCase(), pad, y + 4, 2);
    idx.forEach((fi, c) => img.paste(upscale(v.r.frames[fi].color, w, h, k), w * k, h * k, label + c * (w * k + pad), y));
  });
  return img.png();
}

// the maps an engine lights a sprite with, one RGBA image per frame
function albedoOf(f, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = f.raw[i];
    out[i * 4] = c & 255; out[i * 4 + 1] = (c >>> 8) & 255; out[i * 4 + 2] = (c >>> 16) & 255; out[i * 4 + 3] = c >>> 24;
  }
  return out;
}
function emissionOf(f, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const l = f.light[i];
    out[i * 4] = l & 255; out[i * 4 + 1] = (l >>> 8) & 255; out[i * 4 + 2] = (l >>> 16) & 255; out[i * 4 + 3] = 255;
  }
  return out;
}
/**
 * A tangent-space normal map (OpenGL convention, green up, as Godot and three.js read it). Pixels with a depth
 * bend with it; translucent and 2D pixels bulge with their alpha, so smoke and flat sprites shade round. Empty
 * pixels face the viewer.
 */
function normalOf(f, w, h) {
  const H = new Float32Array(w * h), kind = new Uint8Array(w * h), out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = f.raw[i] >>> 24;
    if (f.depth && Number.isFinite(f.depth[i])) (H[i] = -f.depth[i]), (kind[i] = 2);
    else if (a) (H[i] = (a / 255) * 3), (kind[i] = 1);
  }
  const at = (i, x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return kind[i] === 2 ? H[i] : 0;
    const j = y * w + x;
    return kind[j] === kind[i] ? H[j] : kind[i] === 2 ? H[i] : 0;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let nx = 0, ny = 0, nz = 1;
      if (kind[i]) {
        nx = -(at(i, x + 1, y) - at(i, x - 1, y)) / 2;
        ny = (at(i, x, y + 1) - at(i, x, y - 1)) / 2;
        const l = Math.hypot(nx, ny, 1);
        (nx /= l), (ny /= l), (nz = 1 / l);
      }
      out[i * 4] = (nx * 0.5 + 0.5) * 255; out[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; out[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; out[i * 4 + 3] = 255;
    }
  return out;
}
function depthOf(f, w, h, near, far) {
  const out = new Uint8ClampedArray(w * h * 4), span = far - near || 1;
  for (let i = 0; i < w * h; i++) {
    const d = f.depth[i];
    if (!Number.isFinite(d)) continue;
    const g = 255 * (1 - (d - near) / span);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g; out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * A sprite sheet (transparent frames in a grid) plus Aseprite-style JSON that most engines import.
 * views: renderViews' result for one row per direction, with a frame tag each. maps: also the albedo (color
 * without glow), emission (glow alone), normal and, for 3D effects, depth sheets, laid out the same, so an engine
 * can light the effect: returns them as pngs { albedo, emission, normal, depth }.
 */
export function spriteSheet(fx, r, name, { views, maps } = {}) {
  const runs = views ?? [{ name: null, r }], { w, h, fps } = runs[0].r, n = runs[0].r.frames.length;
  const cols = views ? n : Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * h) / w)))), rows = views ? views.length : Math.ceil(n / cols);
  const cells = [];
  runs.forEach((v, row) => v.r.frames.forEach((f, i) => cells.push({ f, i, v, x: (views ? i : i % cols) * w, y: (views ? row : Math.floor(i / cols)) * h })));
  const img = canvas(cols * w, rows * h, [0, 0, 0, 0]);
  const json = { frames: [], meta: {} }, tags = [];
  for (const c of cells) {
    // cells don't overlap: copy each frame's RGBA as it is, so a PNG keeps straight alpha (pasting over transparency
    // would multiply color by alpha and darken every translucent pixel)
    for (let y = 0; y < h; y++) img.data.set(c.f.clear.subarray(y * w * 4, (y + 1) * w * 4), ((c.y + y) * cols * w + c.x) * 4);
    json.frames.push({
      filename: c.v.name ? `${name} ${c.v.name} ${c.i}` : `${name} ${c.i}`, frame: { x: c.x, y: c.y, w, h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h }, duration: Math.round(1000 / fps),
    });
  }
  runs.forEach((v, row) => tags.push({ name: v.name ? `${name}@${v.name}` : name, from: row * n, to: row * n + n - 1, direction: "forward" }));
  const m = fx.meta, out = {};
  const info = { id: fx.id, name: m.name, fps, loop: m.loop, frames: n, frameSize: [w, h], pivot: m.origin.map((v) => v + (runs[0].r.margin ?? 0)), columns: cols, ...(fx.mod.act ? { act: actTiming(fx.mod) } : {}) };
  if (views) info.views = views.map((v, row) => ({ name: v.name, yaw: +v.yaw.toFixed(4), pitch: +v.pitch.toFixed(4), row }));
  if (m.camera) {
    const { dist, ...camera } = { ...CAMERA, ...m.camera, ...runs[0].r.camera };
    info.space = { axes: "x right, y down (up is -y), z towards the camera at yaw 0", unit: "px", camera: Number.isFinite(dist) ? { ...camera, dist } : camera };
  }
  if (maps) {
    const sheetOf = (fn) => {
      const im = canvas(cols * w, rows * h, [0, 0, 0, 0]);
      for (const c of cells) {
        const px = fn(c.f);
        for (let y = 0; y < h; y++) im.data.set(px.subarray(y * w * 4, (y + 1) * w * 4), ((c.y + y) * cols * w + c.x) * 4);
      }
      return im.png();
    };
    out.albedo = sheetOf((f) => albedoOf(f, w, h));
    out.emission = sheetOf((f) => emissionOf(f, w, h));
    out.normal = sheetOf((f) => normalOf(f, w, h));
    info.maps = { albedo: `${name}.albedo.png`, emission: `${name}.emission.png`, normal: `${name}.normal.png` };
    let near = Infinity, far = -Infinity;
    for (const c of cells) if (c.f.depth) for (const d of c.f.depth) if (Number.isFinite(d)) (near = Math.min(near, d)), (far = Math.max(far, d));
    if (near <= far) {
      out.depth = sheetOf((f) => depthOf(f, w, h, near, far));
      info.maps.depth = `${name}.depth.png`;
      info.depth = { near: +near.toFixed(2), far: +far.toFixed(2), encoding: "white is near, black is far, alpha 0 where nothing solid" };
    }
  }
  json.meta = {
    app: "https://github.com/SeuPut0705/dotspace", version: "1", image: `${name}.png`, format: "RGBA8888",
    size: { w: cols * w, h: rows * h }, scale: "1", frameTags: tags, dotspace: info,
  };
  return { png: img.png(), json, ...out };
}

/** Animated preview through ffmpeg (GIF or MP4), scaled k times. Returns false if ffmpeg is missing. */
export function writeVideo(file, r, k, { loops = 1 } = {}) {
  const { w, h, frames, fps } = r, W = w * k, H = h * k;
  const evenW = W + (W % 2), evenH = H + (H % 2), mp4 = file.endsWith(".mp4");
  const parts = [];
  for (let l = 0; l < loops; l++) for (const f of frames) parts.push(Buffer.from(upscale(f.color, w, h, k).buffer));
  const vf = mp4
    ? `pad=${evenW}:${evenH}:0:0:black,format=yuv420p`
    : "split[a][b];[a]palettegen=max_colors=255:stats_mode=full[p];[b][p]paletteuse=dither=none";
  const args = ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(fps), "-i", "-", "-vf", vf];
  if (mp4) args.push("-c:v", "libx264", "-crf", "14", "-preset", "slow", "-movflags", "+faststart");
  else args.push("-loop", "0");
  args.push(file);
  mkdirSync(dirname(file), { recursive: true });
  const res = spawnSync("ffmpeg", args, { input: Buffer.concat(parts), maxBuffer: 1 << 30 });
  if (res.error) return false;
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${res.stderr}`);
  return true;
}

export function save(file, buf) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof buf === "string" ? buf : buf);
  return file;
}
