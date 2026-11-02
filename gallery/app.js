// The gallery: every effect playing live from its own code, in 2D or in 3D. Tiles start when they scroll into view;
// a click opens one effect with its options, a sprite sheet and the code to use it.

import { effects, categories } from "../src/fx/index.js";
import { createFrame, clearFrame, createFx, createAct, actBounds, composite, backdrop, floorGrid, space, CAMERA, drawActor, painterFor, stockActor, actorAlphaOf, PAL, BACKDROPS } from "../src/core/index.js";

const REPO = "https://github.com/SeuPut0705/dotspace";
const record = (id, mod) => {
  const meta = { fps: 30, bg: "dark", loop: false, duration: 1, tags: [], options: {}, ...mod.meta };
  return { id, base: id.replace(/@3d$/, ""), cat: id.split("/")[0], name: meta.name, mod: { ...mod, meta }, meta };
};
// one entry per effect: its 2D version (v2) and its 3D one (v3), either of which may be missing
const FX = Object.entries(effects)
  .filter(([id]) => !id.endsWith("@3d"))
  .map(([id, mod]) => {
    const r = record(id, mod), v3 = effects[id + "@3d"];
    return { id, cat: r.cat, name: r.name, v2: mod.meta?.camera ? null : r, v3: mod.meta?.camera ? r : v3 ? record(id + "@3d", v3) : null };
  });
// what a tile shows in a dimension: that version, or the other one when it has only one
const shown = (fx, dim) => (dim === "3d" ? fx.v3 ?? fx.v2 : fx.v2 ?? fx.v3);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// full-screen effects (transitions, weather, impact frames) fill a 16:9 stage edge to edge instead of floating in it
const isScreen = (fx) => fx.meta.size[0] >= 320 && Math.abs(fx.meta.size[0] / fx.meta.size[1] - 16 / 9) < 0.05;
const $ = (s) => document.querySelector(s);
function el(tag, props = {}, kids = []) {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) e.append(k);
  return e;
}

// ---- a live effect on a canvas, at an integer scale that fits the stage
class Player {
  constructor(canvas, fx, aspect, pad) {
    Object.assign(this, { canvas, fx, ctx: canvas.getContext("2d"), opts: {}, flip: false, actor: true, speed: 1, playing: true });
    // a 3D effect turns slowly until someone drags it round
    this.cam = fx.meta.camera ? { ...CAMERA, ...fx.meta.camera } : null;
    this.turning = true;
    this.bg = fx.meta.bg;
    this.layout(aspect, pad);
  }
  // the art-pixel stage: the effect's canvas plus some room, stretched to the tile's aspect; CSS scales it up
  layout(aspect, pad) {
    Object.assign(this, { aspect, pad });
    // an act needs room for the whole performance, not just the effect's canvas
    const acted = this.acted, b = acted ? { ...actBounds(this.fx.mod) } : null;
    // an act happens above the floor: don't spend the tile on bricks, but keep in whatever stands nearer (3D)
    if (b) b.y1 = Math.min(b.y1, Math.max(22, b.feet + 2));
    const [w, h] = acted ? [b.x1 - b.x0, b.y1 - b.y0] : this.fx.meta.size, [ox, oy] = acted ? [-b.x0, -b.y0] : this.fx.meta.origin;
    this.W = Math.ceil(Math.max(w * (acted ? Math.min(pad, 1.1) : pad), h * (acted ? Math.min(pad, 1.1) : pad) * aspect));
    this.H = Math.ceil(this.W / aspect);
    this.x = Math.floor((this.W - w) / 2) + ox;
    // an act stands near the bottom of its tile, with the room above it
    this.y = acted ? Math.max(oy + 2, this.H - b.y1 - 2) : Math.floor((this.H - h) / 2) + oy;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    // shrinking pixel art nearest-neighbour drops whole 1 px lines; smooth it only when it has to shrink
    const shown = this.canvas.getBoundingClientRect().width * devicePixelRatio;
    this.canvas.style.imageRendering = shown && shown < this.W ? "auto" : "";
    this.frame = createFrame(this.W, this.H, 0, 0, !!this.cam);
    this.img = this.ctx.createImageData(this.W, this.H);
    this.setBg(this.bg);
    this.restart();
  }
  setBg(kind) {
    this.bg = kind;
    // a 3D effect stands on a floor that turns with the camera
    this.floor = !!this.cam && kind === "ground";
    this.bgBuf = kind === "none" ? null : backdrop(this.floor ? "dark" : kind, this.W, this.H, this.y);
    this.dirty = true;
  }
  // an effect with an act plays it, unless the character is switched off
  get acted() {
    return !!this.fx.mod.act && this.actor;
  }
  restart() {
    this.inst = (this.acted ? createAct : createFx)(this.fx.mod, { x: this.x, y: this.y, flip: this.flip, ...(this.cam ? { camera: { ...this.cam } } : {}), ...this.opts });
    this.acc = 0;
    this.wait = 0;
    this.dirty = true;
  }
  tick(dt) {
    const m = this.fx.meta, step = 1 / m.fps;
    if (this.playing) this.acc = Math.min(this.acc + dt * this.speed, 0.25);
    if (this.cam && this.turning && this.playing) (this.cam.yaw += dt * 0.5 * this.speed), (this.dirty = true);
    let moved = false;
    while (this.acc >= step) {
      this.acc -= step;
      if (!m.loop && (this.acted ? this.inst.done() : this.inst.t >= m.duration)) {
        this.wait += step;
        if (this.wait > 0.45) this.restart();
      } else this.inst.update(step);
      moved = true;
    }
    if (moved || this.dirty) this.render();
  }
  seek(t) {
    this.restart();
    this.inst.update(t);
    this.render();
  }
  render() {
    const f = clearFrame(this.frame), m = this.fx.meta;
    if (this.cam) {
      Object.assign((this.acted ? this.inst.fx : this.inst).options.camera, this.cam);
      if (this.floor) floorGrid(space(painterFor(f).place(this.x, this.y, this.flip), { camera: this.cam }), Math.max(...m.size) * 0.75);
    }
    if (this.acted) {
      this.inst.draw(f);
      composite(f, this.img.data, this.bgBuf);
      const [sx, sy] = this.inst.shake;
      if (sx || sy) this.ctx.clearRect(0, 0, this.W, this.H);
      this.ctx.putImageData(this.img, sx, sy);
      this.dirty = false;
      return;
    }
    const tt = m.loop ? this.inst.t % m.duration : Math.min(this.inst.t, m.duration);
    const body = () => m.actor && this.actor && drawActor(painterFor(f).place(this.x, this.y, this.flip), this.inst.options.actor ?? stockActor(), actorAlphaOf(this.fx.mod, tt, this.inst.options));
    if (this.cam) {
      // depth sorts a 3D effect round the character: he goes in first
      body();
      this.inst.draw(f);
    } else {
      this.inst.draw(f, "back");
      body();
      this.inst.draw(f, "front");
    }
    composite(f, this.img.data, this.bgBuf);
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty = false;
  }
}

// ---- tiles
const tiles = [];
const sections = [];
function build() {
  $("#count").textContent = FX.length;
  const main = $("#grid");
  for (const c of categories) {
    const list = FX.filter((f) => f.cat === c.id);
    if (!list.length) continue;
    const grid = el("div", { className: "grid" });
    const sec = el("section", { id: c.id }, [el("div", { className: "section-head" }, [el("h2", { textContent: c.name + "." }), el("p", { textContent: c.blurb })]), grid]);
    sections.push({ c, sec, list });
    for (const fx of list) {
      const fig = el("figure", { tabIndex: 0 });
      const t = { fx, rec: null, fig, cv: null, player: null, visible: false, hover: false };
      fig.addEventListener("click", () => openDetail(fx, t.rec));
      fig.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openDetail(fx, t.rec)));
      fig.addEventListener("pointerenter", () => (t.hover = true));
      fig.addEventListener("pointerleave", () => (t.hover = false));
      grid.append(fig);
      tiles.push(t);
      dress(t);
    }
    main.append(sec);
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const t = tiles.find((x) => x.fig === e.target);
      t.visible = e.isIntersecting;
      if (t.visible && !t.player) start(t);
    }
  }, { rootMargin: "200px" });
  tiles.forEach((t) => io.observe(t.fig));
}
// a tile's stage, caption and size for the version it shows now
function dress(t) {
  const rec = shown(t.fx, state.dim);
  if (t.rec === rec) return;
  t.rec = rec;
  t.player = null;
  t.cv = el("canvas", { ariaLabel: rec.name });
  const b = rec.mod.act ? actBounds(rec.mod) : null, [fw, fh] = b ? [b.x1 - b.x0, b.y1 - b.y0] : rec.meta.size;
  t.fig.className = isScreen(rec) ? "tile big screen" : fw > 200 || fh > 170 || (b && (fw > 130 || rec.mod.act.target || rec.mod.act.targets)) ? "tile big" : "tile";
  const tag = t.fx.v2 && t.fx.v3 ? "" : rec.meta.camera ? " · 3d" : " · 2d";
  t.fig.replaceChildren(
    el("div", { className: "stage" }, t.cv),
    el("figcaption", {}, [el("b", { textContent: rec.name }), el("small", { textContent: (rec.meta.loop ? "loop" : `${+rec.meta.duration.toFixed(2)}s`) + tag })]),
  );
  if (t.visible) start(t);
}
function start(t) {
  t.player = isScreen(t.rec) ? new Player(t.cv, t.rec, 16 / 9, 1) : new Player(t.cv, t.rec, 6 / 5, 1.25);
  if (reduced) t.player.seek(t.rec.meta.duration * 0.4);
}
function setDim(dim) {
  state.dim = dim;
  $("#dim-2d").setAttribute("aria-pressed", String(dim === "2d"));
  $("#dim-3d").setAttribute("aria-pressed", String(dim === "3d"));
  tiles.forEach(dress);
}

// ---- filters
const state = { cat: "all", q: "", dim: "2d" };
function chips() {
  const box = $("#chips");
  const mk = (id, label, n) => {
    const b = el("button", { className: "chip", type: "button" }, [label, el("span", { textContent: n })]);
    b.dataset.cat = id;
    b.addEventListener("click", () => setCat(id));
    box.append(b);
  };
  mk("all", "all", FX.length);
  for (const s of sections) mk(s.c.id, s.c.name, s.list.length);
}
function setCat(id, fromHash = false) {
  state.cat = sections.some((s) => s.c.id === id) ? id : "all";
  document.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)));
  if (!fromHash) history.replaceState(null, "", state.cat === "all" ? location.pathname : "#" + state.cat);
  filter();
  if (!fromHash) window.scrollTo({ top: 0 });
}
function filter() {
  const q = state.q.trim().toLowerCase();
  let shown = 0;
  for (const s of sections) {
    let any = false;
    for (const fx of s.list) {
      const t = tiles.find((x) => x.fx === fx);
      const r = t.rec, hit = (state.cat === "all" || state.cat === s.c.id) && (!q || [fx.id, r.name, r.meta.desc, ...r.meta.tags].join(" ").toLowerCase().includes(q));
      t.fig.hidden = !hit;
      any ||= hit;
      shown += hit;
    }
    s.sec.hidden = !any;
  }
  $("#none").hidden = shown > 0;
}

// ---- detail
let detail = null;
function openDetail(fx, rec) {
  const d = $("#detail");
  const big = $("#big"), screen = isScreen(rec);
  big.parentElement.classList.toggle("screen", screen);
  detail = screen ? new Player(big, rec, 16 / 9, 1) : new Player(big, rec, 16 / 10, 1.6);
  detail.entry = fx;
  // on a 3D stage a touch drag turns the camera; elsewhere it scrolls the sheet
  big.style.touchAction = detail.cam ? "none" : "";
  const m = rec.meta;
  $("#d-name").textContent = m.name;
  $("#d-id").textContent = rec.id;
  $("#d-desc").textContent = m.desc;
  const frames = Math.round(m.duration * m.fps) + (m.loop ? 0 : 1);
  $("#d-facts").replaceChildren(
    ...[["kind", m.loop ? "loop" : "one-shot"], ...(m.camera ? [["space", "3D: drag it, or use the arrow keys, to turn the camera"]] : []), ["length", `${+m.duration.toFixed(2)} s, ${frames} frames at ${m.fps} fps`], ...(rec.mod.act ? [["acted", actFacts(rec.mod)]] : []), ["canvas", `${m.size[0]} × ${m.size[1]} px`], ["tags", m.tags.join(", ")]].flatMap(([k, v]) => [el("dt", { textContent: k }), el("dd", { textContent: v })]),
  );
  // controls
  for (const [b, v] of [[$("#d-2d"), fx.v2], [$("#d-3d"), fx.v3]]) {
    b.disabled = !v;
    b.setAttribute("aria-pressed", String(v === rec));
  }
  $("#d-bg").replaceChildren(...BACKDROPS.concat("none").map((b) => btn(b, () => detail.setBg(b), b === m.bg, "bg")));
  $("#d-speed").replaceChildren(...[0.25, 0.5, 1].map((s) => btn(`${s}×`, () => (detail.speed = s), s === 1, "speed")));
  const pal = $("#d-pal");
  pal.replaceChildren(el("option", { value: "", textContent: "its own" }), ...Object.keys(PAL).map((k) => el("option", { value: k, textContent: k })));
  pal.value = "";
  $("#d-actor").hidden = !m.actor;
  $("#d-actor").setAttribute("aria-pressed", "true");
  $("#d-flip").setAttribute("aria-pressed", "false");
  $("#d-play").setAttribute("aria-pressed", "true");
  $("#d-play").textContent = "pause";
  $("#d-sheet").replaceChildren();
  code(rec);
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
// what the body does around the effect, in a line: the wind-up, the freeze, the recovery
function actFacts(mod) {
  const k = mod.act.poses, lead = Math.max(0, -k[0][0]), end = k[k.length - 1][0] - mod.meta.duration, hits = (mod.act.hits ?? []).filter((h) => h.stop);
  const parts = [];
  if (lead > 0) parts.push(`${lead.toFixed(2)} s wind-up`);
  if (hits.length) parts.push(`${hits.length === 1 ? `${Math.round(hits[0].stop * 1000)} ms freeze` : `${hits.length} freezes`} at ${hits[0].t.toFixed(2)} s`);
  if (!mod.meta.loop && end > 0.02) parts.push(`${end.toFixed(2)} s recovery`);
  return parts.join(", ") || "the body moves with it";
}
function btn(label, fn, on, group) {
  const b = el("button", { className: "btn", type: "button", textContent: label });
  b.setAttribute("aria-pressed", String(!!on));
  b.addEventListener("click", () => {
    if (group) b.parentElement.querySelectorAll(".btn").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    fn();
  });
  return b;
}
function code(rec) {
  const v = rec.base.split("/")[1].replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const variant = rec.id !== rec.base, use = variant ? `in3d(${v})` : v;
  const cam = detail.cam ? { camera: { yaw: +detail.cam.yaw.toFixed(2), pitch: +detail.cam.pitch.toFixed(2) } } : {};
  const opts = { x: 160, y: 120, ...(detail.opts.palette ? { palette: "[…]" } : {}), ...(detail.flip ? { flip: true } : {}), ...cam };
  const acted = !!rec.mod.act, make = acted ? "createAct" : "createFx";
  $("#d-code").textContent = [
    `import { createFrame, ${make}, composite${variant ? ", in3d" : ""} } from "dotspace";`,
    `import * as ${v} from "dotspace/fx/${rec.base}";`,
    ``,
    detail.cam ? `const frame = createFrame(320, 180, 0, 0, true);   // with depth, for a 3D effect` : `const frame = createFrame(320, 180);`,
    `const fx = ${make}(${use}, ${JSON.stringify(opts).replace(/"\[…\]"/, "[…]").replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ")});`,
    ``,
    `// every tick`,
    `fx.update(dt);`,
    `fx.draw(frame);          // color + light buffers`,
    `composite(frame, imageData.data, null);`,
    ...(acted ? [``, `// your own character? read the timing: ${v}.act (poses, hits, freezes)`] : []),
  ].join("\n");
  $("#d-src").href = `${REPO}/blob/main/src/fx/${rec.base}.js`;
}
function sheet() {
  const fx = detail.fx, m = fx.meta, [w, h] = m.size, n = Math.max(1, Math.round(m.duration * m.fps) + (m.loop ? 0 : 1));
  const cols = Math.min(n, Math.max(1, Math.ceil(Math.sqrt((n * h) / w)))), rows = Math.ceil(n / cols);
  const cv = el("canvas", { width: cols * w, height: rows * h }), ctx = cv.getContext("2d");
  const frame = createFrame(w, h, 0, 0, !!detail.cam), img = ctx.createImageData(w, h);
  // a 3D effect's sheet is seen from where the stage's camera is now, as the code below the stage says
  const inst = createFx(fx.mod, { x: m.origin[0], y: m.origin[1], ...detail.opts, flip: detail.flip, ...(detail.cam ? { camera: { ...detail.cam } } : {}) });
  for (let i = 0; i < n; i++) {
    if (i) inst.update(1 / m.fps);
    inst.draw(clearFrame(frame));
    composite(frame, img.data, null);
    ctx.putImageData(img, (i % cols) * w, Math.floor(i / cols) * h);
  }
  const k = Math.max(1, Math.min(4, Math.floor(1100 / (cols * w))));
  const pic = el("img", { src: cv.toDataURL("image/png"), alt: `${m.name} sprite sheet`, width: cols * w * k, height: rows * h * k });
  $("#d-sheet").replaceChildren(pic, el("p", { textContent: `${n} frames of ${w} × ${h} px, ${cols} across, ${m.fps} fps, ${m.loop ? "loops" : "plays once"}. Save the image, or run: node tools/render.mjs ${fx.id} --sheet` }));
}
function wireDetail() {
  const d = $("#detail");
  $("#d-close").addEventListener("click", () => d.close());
  d.addEventListener("close", () => (detail = null));
  d.addEventListener("click", (e) => e.target === d && d.close());
  // a 3D effect: drag the stage, or press the arrow keys on it, to turn the camera round and tilt it
  const big = $("#big");
  big.tabIndex = 0;
  const turn = (dyaw, dpitch) => {
    if (!detail?.cam) return false;
    detail.turning = false;
    detail.cam.yaw += dyaw;
    detail.cam.pitch = Math.max(-0.2, Math.min(1.4, detail.cam.pitch + dpitch));
    detail.dirty = true;
    code(detail.fx);
    return true;
  };
  let drag = null;
  big.addEventListener("pointerdown", (e) => {
    if (!detail?.cam) return;
    drag = { x: e.clientX, y: e.clientY };
    big.setPointerCapture(e.pointerId);
  });
  big.addEventListener("pointermove", (e) => {
    if (!drag) return;
    turn((e.clientX - drag.x) * -0.01, (e.clientY - drag.y) * 0.006);
    drag = { x: e.clientX, y: e.clientY };
  });
  big.addEventListener("pointerup", () => (drag = null));
  big.addEventListener("pointercancel", () => (drag = null));
  big.addEventListener("keydown", (e) => {
    const k = { ArrowLeft: [0.2, 0], ArrowRight: [-0.2, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (k && turn(...k)) e.preventDefault();
  });
  $("#d-play").addEventListener("click", (e) => {
    detail.playing = !detail.playing;
    e.target.setAttribute("aria-pressed", String(detail.playing));
    e.target.textContent = detail.playing ? "pause" : "play";
  });
  $("#d-again").addEventListener("click", () => detail.restart());
  $("#d-flip").addEventListener("click", (e) => {
    detail.flip = !detail.flip;
    e.target.setAttribute("aria-pressed", String(detail.flip));
    detail.restart();
    code(detail.fx);
  });
  $("#d-actor").addEventListener("click", (e) => {
    detail.actor = !detail.actor;
    e.target.setAttribute("aria-pressed", String(detail.actor));
    // with an act, the character is the performance: off shows the effect alone, as a sprite sheet has it
    if (detail.fx.mod.act) detail.layout(detail.aspect, detail.pad);
    detail.dirty = true;
  });
  $("#d-seed").addEventListener("click", () => {
    detail.opts.seed = 1 + Math.floor(Math.random() * 9999);
    detail.restart();
  });
  $("#d-pal").addEventListener("change", (e) => {
    if (e.target.value) detail.opts.palette = PAL[e.target.value];
    else delete detail.opts.palette;
    detail.restart();
    code(detail.fx);
  });
  $("#d-make").addEventListener("click", sheet);
  // the other version of the same effect, in the same sheet
  $("#d-2d").addEventListener("click", () => detail.entry.v2 && openDetail(detail.entry, detail.entry.v2));
  $("#d-3d").addEventListener("click", () => detail.entry.v3 && openDetail(detail.entry, detail.entry.v3));
  $("#d-copy").addEventListener("click", async (e) => {
    const text = $("#d-code").textContent;
    try {
      await navigator.clipboard.writeText(text);
      e.target.textContent = "copied";
    } catch {
      getSelection().selectAllChildren($("#d-code"));
      e.target.textContent = "selected";
    }
    setTimeout(() => (e.target.textContent = "copy"), 1400);
  });
}

// ---- the clock
let last = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (detail) detail.tick(dt);
  else for (const t of tiles) if (t.visible && t.player && !t.fig.hidden && (!reduced || t.hover)) t.player.tick(dt);
  requestAnimationFrame(frameLoop);
}

build();
chips();
wireDetail();
$("#dim-2d").addEventListener("click", () => setDim("2d"));
$("#dim-3d").addEventListener("click", () => setDim("3d"));
$("#q").addEventListener("input", (e) => {
  state.q = e.target.value;
  filter();
});
setCat(location.hash.slice(1) || "all", true);
addEventListener("hashchange", () => setCat(location.hash.slice(1) || "all", true));
requestAnimationFrame(frameLoop);
