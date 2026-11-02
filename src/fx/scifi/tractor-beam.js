// Rocks torn out of the floor with a puff of dust, then hauled up spinning, and matter drawn in as streaks,
// follow Sprite Fusion's open-source black hole (https://www.spritefusion.com/pixel-art-vfx/black-hole),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { P, Rng, fit, sparkle, cycle, space, lit, clamp, smooth, lerp, ease, rand, mix, scale, TAU, WHITE } from "../../core/index.js";
import { Ghosts, flash, flash3, since, cone } from "./_lib.js";

export const meta = {
  name: "Tractor beam",
  desc: "A hovering pod projects a cone of light to the floor; rocks tear loose in puffs of dust and spiral up spinning into the lens while rings of light climb the beam.",
  tags: ["scifi", "beam", "tractor", "lift", "abduct", "debris", "ground", "loop"],
  size: [120, 132],
  origin: [60, 114],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#06161a", "#0b2e33", "#11505a", "#1a7f84", "#2bb5a8", "#7ef0c8", "#d6fff0", "#ffffff"],
    hull: ["#0d0f17", "#1c2030", "#2e3448", "#4a5470", "#7a86a8", "#b8c4e0"],
    stone: ["#1a1622", "#2e2838", "#4a4258", "#6d6480", "#9a90aa"],
    seed: 9,
  },
};

const D = meta.duration, LENS = -84, TOPW = 5.5, BOTW = 32;
// the cone's half width at height y
const half = (y) => lerp(BOTW, TOPW, clamp(y / LENS));

// where something hauled up the beam is at progress k (0 on the floor, 1 in the lens): quickening as it
// rises, winding round the axis and in toward it. [x, y, depth (> 0 on the near side)]
function haul(r0, th0, dir, turns, k) {
  const s = Math.pow(clamp(k), 1.8), y = lerp(-2, LENS + 5, s), th = th0 + dir * TAU * turns * s, rr = r0 * (half(y) / BOTW) * (1 - 0.5 * s);
  return [Math.cos(th) * rr, y, Math.sin(th)];
}

// a rock's life: it pops out of the floor, wobbles a beat, then spirals up into the lens
const POP = 0.1, HOVER = 0.32, RISE = 1.4, LIFE = POP + HOVER + RISE;
function rockAt(r, age) {
  const lift = clamp((age - POP - HOVER) / RISE);
  if (lift > 0) {
    const [x, y, z] = haul(r.r0, r.th0, r.dir, 1.3, lift), [x1, y1] = haul(r.r0, r.th0, r.dir, 1.3, lift - 0.07);
    return { x, y, z, px: x1, py: y1, size: r.s * (1 - 0.6 * lift ** 2.5), a: r.a0 + r.va * age * (0.3 + lift * 2), lift };
  }
  const y = age < POP ? lerp(3, -2, age / POP) : -2 - 2 * smooth(0, HOVER, age - POP), wob = age > POP ? Math.sin(age * 55 + r.th0 * 9) * 0.7 : 0;
  return { x: Math.cos(r.th0) * r.r0 + wob, y, z: 1, size: r.s, a: r.a0 + r.va * age * 0.3, lift: 0 };
}

// a tumbling chunk of stone: an uneven outline, lit from above by the lens, shaded underneath
function rock(p, q, r, S, C, back) {
  const n = 6, R = Math.max(0.9, q.size), ca = Math.cos(q.a), sa = Math.sin(q.a), lit = mix(S[4], C[6], 0.3 + 0.6 * q.lift);
  const rad = (ang) => {
    const f = ((((ang / TAU) * n) % n) + n) % n, i = Math.floor(f), k = f - i;
    return R * (0.75 + 0.35 * lerp(rand(r.id, i), rand(r.id, (i + 1) % n), k));
  };
  // a faint trail of its rush up the beam
  if (q.lift > 0.15 && !back) {
    p.line(q.px, q.py, q.x, q.y, (u) => (u > 0.6 ? C[5] : C[3]), (u) => 0.7 * u);
    for (let i = 1; i <= 3; i++) p.disc(lerp(q.x, q.px, i / 3), lerp(q.y, q.py, i / 3) + 1, R * (0.5 + 0.25 * i), mix(S[3], C[5], 0.4), 0.22 * (1 - i / 4) * q.lift);
  }
  p.shade(q.x - R - 2, q.y - R - 2, q.x + R + 2, q.y + R + 2, (x, y, out) => {
    const dx = x - q.x, dy = y - q.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca, d = Math.hypot(u, v), e = rad(Math.atan2(v, u));
    if (d > e + 0.8) return;
    out.c = d > e ? S[0] : back ? (dy < -0.3 * R ? S[3] : S[1]) : dy < -0.45 * R ? (q.lift > 0.35 && d > e - 1 ? C[6] : lit) : dy < -0.1 * R ? (dx < 0 ? S[4] : S[3]) : dy > 0.35 * R ? S[1] : S[2];
  });
  if (!back && q.lift > 0) p.glow(q.x, q.y - R, 5 + R, C[5], 0.25 * q.lift);
}

// the hovering pod: a cockpit dome on a wide hull, a rim of running lights, the lens underneath
function pod(p, t, C, H, y0) {
  const y = Math.round(y0);
  p.shade(-21, y - 12, 21, y + 6, (x, yy, out) => {
    const dy = yy - y;
    // the cockpit: a small glassy dome, a hot glint top left
    const cx = x / 8.5, cy = (dy + 5) / 6;
    if (cy < 0 && cx * cx + cy * cy <= 1) {
      const d = cx * cx + cy * cy, l = -cx * 0.6 - cy * 0.8;
      out.c = d > 0.8 ? H[0] : l > 0.85 ? WHITE : l > 0.6 ? C[6] : l > 0.2 ? C[4] : C[3];
      return;
    }
    // the hull: a flat lens shape, lit on its upper face, a dark seam, the rim
    const hx = x / 20, hy = (dy + 0.5) / 4.5;
    if (dy <= 0 && hx * hx + hy * hy <= 1) {
      const d = hx * hx + hy * hy, l = -hx * 0.55 - hy * 0.7;
      out.c = d > 0.88 ? H[0] : dy === -2 ? H[1] : l > 0.55 ? H[5] : l > 0.25 ? H[4] : l > -0.1 ? H[3] : H[2];
      return;
    }
    // the underside, tapering in toward the lens housing, lit from below by its own beam
    const w = 19.5 - dy * 2.4;
    if (dy > 0 && dy <= 5 && Math.abs(x) <= w) out.c = Math.abs(x) > w - 1 ? H[0] : dy === 1 ? H[2] : dy >= 4 && Math.abs(x) < 9 ? C[3] : H[1];
  });
  // running lights chase round the rim
  for (let i = 0; i < 6; i++) {
    const lx = -15 + i * 6, k = 0.5 + 0.5 * Math.cos(TAU * (4 * (t / D) - i / 6));
    p.px(lx, y + 1, k > 0.7 ? WHITE : k > 0.35 ? C[5] : C[2]);
    if (k > 0.5) p.glow(lx, y + 1, 5, C[5], 0.35 * k);
  }
  // the lens: a white-hot eye in a ring of light
  p.ellipse(0, y + 5.5, 7.5, 2.2, (d) => (d < 0.45 ? WHITE : d < 0.75 ? C[6] : d < 0.9 ? C[5] : C[3]));
}

// a ring of light round the beam at height y: a hard line in front, a fainter one for the far side
function hoop(p, y, rx, c, back) {
  const ry = rx * 0.17;
  for (let i = 0, n = Math.ceil(rx * 7); i < n; i++) {
    const g = (i / n) * TAU, s = Math.sin(g);
    if (s >= 0 === back) continue;
    p.px(Math.cos(g) * rx, y + s * ry, c);
  }
}

const cache = new Map();
function setup(o) {
  const key = `${o.seed}:${o.palette.join()}:${o.stone.join()}`;
  if (cache.has(key)) return cache.get(key);
  const C = fit(o.palette, 8), S = fit(o.stone, 5), rn = new Rng(o.seed);
  // rocks torn up one after another, from spots left and right of the middle
  const rocks = Array.from({ length: 7 }, (_, i) => ({
    id: i + o.seed * 31, born: (i / 7) * D + rn.range(-0.06, 0.06), r0: rn.range(8, 25), th0: (i % 2 ? 0 : Math.PI) + rn.range(-0.45, 0.45),
    dir: rn.sign(), s: rn.range(2.4, 4.4), a0: rn.range(0, TAU), va: rn.range(-7, 7),
  }));
  const g = new Ghosts(D, { ground: () => 0, box: [-58, -112, 58, 14] });
  // each rock leaves the floor in a puff of dust and a spray of grit
  for (const r of rocks) {
    const x = Math.cos(r.th0) * r.r0;
    for (let i = 0; i < 5; i++) g.add(r.born + 0.02, P.DUST, x + rn.range(-3, 3), -1, rn.range(-34, 34), -rn.range(8, 26), rn.range(0.5, 0.9), mix(S[3], C[4], 0.3), rn.range(2.2, 3.6));
    for (let i = 0; i < 6; i++) g.add(r.born + 0.02, P.GRIT, x + rn.range(-2, 2), -2, rn.range(-45, 45), -rn.range(60, 150), rn.range(0.5, 0.9), rn.pick([S[2], S[3], S[4]]), rn.chance(0.3) ? 2 : 1);
  }
  // dust always swirling round the foot of the beam
  for (let i = 0; i < 16; i++) {
    const s = rn.sign();
    g.add(rn.range(0, D), P.DUST, s * rn.range(14, 34), -rn.range(0, 3), -s * rn.range(6, 22), -rn.range(4, 14), rn.range(0.9, 1.5), mix(S[3], C[5], 0.3), rn.range(2.6, 4.4));
  }
  const v = { C, S, rocks, g };
  cache.set(key, v);
  return v;
}

export function drawBack(p, t, o) {
  const { C, S, rocks, g } = setup(o);
  // the pool of light where the beam meets the floor, and the far half of its rim
  for (let y = -6; y <= 6; y++)
    for (let x = -BOTW; x <= BOTW; x++) {
      const d = Math.hypot((x + 0.5) / BOTW, (y + 0.5) / 5.5);
      if (d <= 1) p.blend(x + 0.5, y + 0.5, d < 0.35 ? C[6] : C[5], 0.2 + 0.55 * (1 - d) ** 1.5);
    }
  hoop(p, 0, BOTW + 1, C[5], true);
  g.at(t).draw(p, "back");
  // rocks on the far side of the beam, seen through it
  for (const r of rocks) {
    const age = since(t, r.born, D);
    if (age >= LIFE) continue;
    const q = rockAt(r, age);
    if (q.z < 0 && q.lift > 0) rock(p, q, r, S, C, true);
  }
}

export function draw(p, t, o) {
  const { C, S, rocks, g } = setup(o), H = fit(o.hull, 6), ph = t / D, podY = LENS - 5 + 1.5 * Math.sin(TAU * 2 * ph);
  // the beam: a glassy cone, white-hot at the lens, hard bright edges with a soft fringe, light drifting in it
  for (let y = Math.ceil(LENS + 3); y < 0; y++) {
    const w = half(y), v = (y - LENS) / -LENS, pulse = ((((v * 3.2 + ph * 6) % 1) + 1) % 1) < 0.08 ? 1 : 0;
    for (let x = Math.floor(-w) - 1; x <= Math.ceil(w); x++) {
      const q = Math.abs(x + 0.5) / w;
      if (q > 1 + 1.2 / w) continue;
      if (q > 1) p.dot(x, y, C[4], 0.6 - 0.3 * v);
      else if (q > 1 - 1 / w) p.px(x, y, v < 0.2 ? WHITE : v < 0.45 ? C[6] : C[5]);
      else {
        let curtain = 0;
        for (let s = 0; s < 4; s++) if (Math.abs((x + 0.5) / w - (rand(o.seed, s, 7) - 0.5) * 1.4 - 0.12 * Math.sin(TAU * ph + s * 1.7)) < 0.045) curtain = 1;
        const core = (1 - q) ** 2 * (1 - v) ** 1.6, a = 0.08 + 0.22 * q ** 4 + 0.6 * core + 0.12 * pulse + 0.18 * curtain;
        p.blend(x + 0.5, y + 0.5, core > 0.45 ? WHITE : curtain || pulse || v < 0.35 ? C[5] : C[4], clamp(a));
      }
    }
    if ((y & 3) === 0) for (const s of [-1, 1]) p.glow(s * w, y, 8, C[4], 0.18);
  }
  // rings climbing the beam, quickening and narrowing with it
  for (let i = 0; i < 5; i++) {
    const k = since(t, (i / 5) * D, D) / 1.1;
    if (k >= 1) continue;
    const y = lerp(0, LENS + 5, ease.inQuad(k)), w = half(y) + 1;
    hoop(p, y, w, C[3], true);
    hoop(p, y, w, k < 0.12 ? WHITE : C[6], false);
    p.glow(0, y + w * 0.17, w + 4, C[5], 0.12);
  }
  // light streaks drawn up the beam
  cycle(t, D, 22, o.seed + 1, (r) => r.range(0.6, 1), (age, life, r) => {
    const k = age / life, y = lerp(-2, LENS + 5, k * k), w = half(y), x = r.range(-0.85, 0.85) * w, L = 2 + 6 * k;
    p.line(x, y, x, y + L, (u) => (u < 0.3 ? WHITE : C[5]), Math.min(1, (1 - k) * 3));
  });
  // dust drawn up in soft puffs, thinning as it goes
  cycle(t, D, 9, o.seed + 3, (r) => r.range(1.4, 2), (age, life, r) => {
    const k = age / life, [x, y] = haul(r.range(8, 26), r.range(0, TAU), r.sign(), 0.8, k);
    p.disc(x, y, lerp(4, 1.5, k), mix(S[3], C[5], 0.25 + 0.5 * k), 0.4 * Math.min(1, k * 6) * (1 - k));
  });
  // grit and motes of light hauled up in a quick spiral, streaking as they go
  cycle(t, D, 46, o.seed + 2, (r) => r.range(0.8, 1.3), (age, life, r) => {
    const k = age / life, r0 = r.range(6, 30), th0 = r.range(0, TAU), dir = r.sign(), turns = r.range(1, 1.8), mote = r.chance(0.45);
    const [x, y, z] = haul(r0, th0, dir, turns, k), [x1, y1] = haul(r0, th0, dir, turns, k - (mote ? 0.13 : 0.06));
    const c = mote ? (r.chance(0.5) ? WHITE : C[6]) : r.pick([S[3], S[4], S[4]]);
    p.line(x1, y1, x, y, (u) => (u > 0.5 ? (z > 0 ? c : scale(c, 0.7)) : mote ? C[4] : S[2]));
    if (mote) {
      p.px(x, y, WHITE);
      p.glow(x, y, 4, C[5], 0.45);
    }
  });
  // twinkles caught in the light
  cycle(t, D, 8, o.seed + 4, 0.5, (age, life, r) => {
    const k = age / life, [x, y] = haul(r.range(4, 24), r.range(0, TAU), r.sign(), 0.6, r.range(0.1, 0.7) + k * 0.15), arm = Math.round(2 * Math.sin(Math.PI * k));
    if (arm > 0) sparkle(p, x, y, arm, C[6], C[5], 0.4);
  });
  // the rocks on the near side and those still on the floor
  for (const r of rocks) {
    const age = since(t, r.born, D);
    if (age >= LIFE) continue;
    const q = rockAt(r, age);
    if (q.z >= 0 || q.lift <= 0) rock(p, q, r, S, C, false);
    // swallowed: a glint at the lens
    if (age > LIFE - 0.1) sparkle(p, q.x, LENS + 3, 5, C[6], C[5], 0.5);
  }
  for (const r of rocks) flash(p, t, r.born + LIFE - 0.08, 0, LENS + 3, 30, C[5], 0.7, 0.28);
  g.at(t).draw(p, "front");
  hoop(p, 0, BOTW + 1, WHITE, false);
  hoop(p, 1, BOTW, C[5], false);
  // light: the lens, the beam's body, the pool on the floor
  pod(p, t, C, H, podY);
  const fl = 0.85 + 0.15 * Math.sin(TAU * 6 * ph);
  p.glow(0, LENS + 6, 36, C[5], 0.7 * fl);
  p.glow(0, LENS + 6, 12, WHITE, 0.7 * fl);
  for (let y = LENS + 16; y < -8; y += 14) p.glow(0, y, half(y) + 10, C[4], 0.16);
  for (const x of [-20, 0, 20]) p.glow(x, -2, 22, C[4], 0.26);
}

// 3D: the pod hangs over the floor as a real saucer and the beam is a glass cone you see through from every side; the
// rocks are torn up all round it and spiral up the cone in the round, passing behind the glass and in front of it.
const rockPos = (r, age) => {
  const lift = clamp((age - POP - HOVER) / RISE);
  if (lift > 0) {
    const at = (k) => {
      const s = Math.pow(clamp(k), 1.8), y = lerp(-2, LENS + 5, s), th = r.th0 + r.dir * TAU * 1.3 * s, rr = r.r0 * (half(y) / BOTW) * (1 - 0.5 * s);
      return [Math.cos(th) * rr, y, Math.sin(th) * rr];
    };
    return { p: at(lift), prev: at(lift - 0.07), size: r.s * (1 - 0.6 * lift ** 2.5), a: r.a0 + r.va * age * (0.3 + lift * 2), lift };
  }
  const y = age < POP ? lerp(3, -2, age / POP) : -2 - 2 * smooth(0, HOVER, age - POP), wob = age > POP ? Math.sin(age * 55 + r.th0 * 9) * 0.7 : 0;
  return { p: [Math.cos(r.th0) * r.r0 + wob, y, Math.sin(r.th0) * r.r0], prev: null, size: r.s, a: r.a0 + r.va * age * 0.3, lift: 0 };
};

const cache3 = new Map();
function setup3(o) {
  const key = `${o.seed}:${o.palette.join()}:${o.stone.join()}`;
  if (cache3.has(key)) return cache3.get(key);
  const { C, S, rocks } = setup(o), rn = new Rng(o.seed + 77);
  // the rocks come from all round the beam, not just left and right
  const r3 = rocks.map((r, i) => ({ ...r, th0: (i * TAU * 3) / 7 + r.th0 * 0.2 }));
  const g = new Ghosts(D, { ground: () => 0, box: [-90, -112, 90, 14] });
  for (const r of r3) {
    const ox = Math.cos(r.th0) * r.r0, oz = Math.sin(r.th0) * r.r0;
    for (let i = 0; i < 5; i++) g.add(r.born + 0.02, P.DUST, rn.range(-3, 3), -1, rn.range(-34, 34), -rn.range(8, 26), rn.range(0.5, 0.9), mix(S[3], C[4], 0.3), rn.range(2.2, 3.6), 0, rn.range(0, TAU), ox, oz);
    for (let i = 0; i < 6; i++) g.add(r.born + 0.02, P.GRIT, rn.range(-2, 2), -2, rn.range(-45, 45), -rn.range(60, 150), rn.range(0.5, 0.9), rn.pick([S[2], S[3], S[4]]), rn.chance(0.3) ? 2 : 1, 0, rn.range(0, TAU), ox, oz);
  }
  // dust always swirling round the foot of the beam, all the way round
  for (let i = 0; i < 20; i++) {
    const a = rn.range(0, TAU), rr = rn.range(14, 34);
    g.add(rn.range(0, D), P.DUST, 0, -rn.range(0, 3), rn.chance(0.5) ? -rn.range(6, 22) : rn.range(6, 22), -rn.range(4, 14), rn.range(0.9, 1.5), mix(S[3], C[5], 0.3), rn.range(2.6, 4.4), 0, a, Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const v = { C, S, rocks: r3, g };
  cache3.set(key, v);
  return v;
}

// a tumbling chunk of stone: a few lumps, lit from above by the lens
function rock3(q, k, r, S, C) {
  const [x, y, z] = k.p, R = Math.max(1.3, k.size * 1.3), lit = mix(S[4], C[6], 0.3 + 0.6 * k.lift);
  const shade = (nx, ny, nz) => {
    if (nz < 0.3) return S[0];
    const l = -ny * 0.75 - nx * 0.25 + nz * 0.3;
    return l > 0.6 ? (k.lift > 0.35 ? C[6] : lit) : l > 0.3 ? S[4] : l > 0 ? S[3] : l > -0.45 ? S[2] : S[1];
  };
  for (let i = 0; i < 3; i++) {
    const a = k.a + i * 2.1, f = i === 0 ? 0 : 0.55, lr = R * (i === 0 ? 0.8 : 0.6 + 0.12 * rand(r.id, i));
    q.ball(x + Math.cos(a) * R * f, y + Math.sin(a * 0.7 + 1.5 * i) * R * f * 0.8, z + Math.sin(a) * R * f * 0.7, lr, shade);
  }
}

export const three = {
  meta: { size: [136, 136], origin: [68, 118], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const { C, S, rocks, g } = setup3(o), H = fit(o.hull, 6), ph = t / D, podY = LENS - 5 + 1.5 * Math.sin(TAU * 2 * ph), q = space(p, o);
    const fl = 0.85 + 0.15 * Math.sin(TAU * 6 * ph);
    // ---- solids first
    // the saucer: a lens of hull lit from above, a dark seam, running lights round the rim, the lens hanging under it
    const hull = (h, out) => {
      if (!h.front) return;
      const l = -h.ny * 0.7 - h.nx * 0.4 + h.nz * 0.25, dy = h.y - podY;
      out.c = dy < 0.4 && dy > -0.4 ? H[0] : dy > 0 ? (dy > 3.6 && Math.hypot(h.x, h.z) < 10.5 ? C[3] : dy < 1.2 ? H[2] : H[1]) : l > 0.65 ? H[4] : l > 0.4 ? H[3] : l > 0.1 ? H[2] : H[1];
    };
    cone(q, 0, 0, podY - 4.5, podY, 8.5, 20, hull);
    cone(q, 0, 0, podY, podY + 5, 20, 9, hull);
    q.plane(0, podY - 4.5, 0, null, 8.6, (u, v, out) => {
      const d = Math.hypot(u, v) / 8.5;
      out.c = d > 0.9 ? H[0] : (-u * 0.4 - v * 0.5) / 8.5 > 0.2 ? H[5] : H[4];
    });
    q.ball(0, podY - 5, 0, 6.2, lit([C[2], C[3], C[4], C[6], WHITE]));
    q.at(0, podY - 5, 0, (pp) => ((pp.z -= 6.4), pp.px(-2, -3, WHITE)));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, k = 0.5 + 0.5 * Math.cos(TAU * (4 * ph - i / 9)), x = Math.cos(a) * 18.6, z = Math.sin(a) * 18.6;
      q.ball(x, podY + 0.3, z, 1.15, k > 0.7 ? WHITE : k > 0.35 ? C[5] : C[2]);
      if (k > 0.5) q.glow(x, podY + 0.3, z, 5, C[5], 0.35 * k);
    }
    q.ball(0, podY + 5.5, 0, 3.4, (nx, ny, nz) => (nz > 0.7 ? WHITE : nz > 0.4 ? C[6] : C[5]));
    // the rocks
    for (const r of rocks) {
      const age = since(t, r.born, D);
      if (age >= LIFE) continue;
      const k = rockPos(r, age);
      rock3(q, k, r, S, C);
    }
    // the pool where the beam lands: light on the floor, a hard rim to it
    q.decal(0, 0, 0, null, BOTW + 3, (pp) => {
      pp.ring(0, 0, BOTW + 1, 1.2, C[5]);
      pp.ring(0, 0, BOTW, 1, WHITE, 0.9);
    });
    q.plane(0, 0, 0, null, BOTW, (u, v, out) => {
      const d = Math.hypot(u, v) / BOTW;
      if (d > 1) return;
      out.blend = true;
      out.c = d < 0.35 ? C[6] : C[5];
      out.a = 0.2 + 0.55 * (1 - d) ** 1.5;
      out.l = C[4];
      out.k = 0.3 * (1 - d) ** 2;
    });
    // rings of light climbing the beam, quickening and narrowing with it
    for (let i = 0; i < 5; i++) {
      const k = since(t, (i / 5) * D, D) / 1.1;
      if (k >= 1) continue;
      const y = lerp(0, LENS + 5, ease.inQuad(k)), w = half(y) + 1;
      q.decal(0, y, 0, null, w + 2, (pp) => {
        pp.ring(0, 0, w, 1.2, k < 0.12 ? WHITE : C[6]);
        pp.ring(0, 0, w - 1.2, 1, C[3], 0.8);
      });
      q.glow(0, y, 0, w + 4, C[5], 0.12);
    }
    // grit and motes of light hauled up in a quick spiral, streaking as they go
    const hauled = (r0, th0, dir, turns, k) => {
      const s = Math.pow(clamp(k), 1.8), y = lerp(-2, LENS + 5, s), th = th0 + dir * TAU * turns * s, rr = r0 * (half(y) / BOTW) * (1 - 0.5 * s);
      return [Math.cos(th) * rr, y, Math.sin(th) * rr];
    };
    cycle(t, D, 46, o.seed + 2, (r) => r.range(0.8, 1.3), (age, life, r) => {
      const k = age / life, r0 = r.range(6, 30), th0 = r.range(0, TAU), dir = r.sign(), turns = r.range(1, 1.8), mote = r.chance(0.45);
      const a = hauled(r0, th0, dir, turns, k), b = hauled(r0, th0, dir, turns, k - (mote ? 0.13 : 0.06));
      const c = mote ? (r.chance(0.5) ? WHITE : C[6]) : r.pick([S[3], S[4], S[4]]);
      q.line(...b, ...a, (u) => (u > 0.5 ? c : mote ? C[4] : S[2]));
      if (mote) {
        q.px(...a, WHITE);
        q.glow(...a, 4, C[5], 0.45);
      }
    });
    // light streaks drawn up the beam
    cycle(t, D, 22, o.seed + 1, (r) => r.range(0.6, 1), (age, life, r) => {
      const k = age / life, y = lerp(-2, LENS + 5, k * k), w = half(y), a = r.range(0, TAU), rr = r.range(0.2, 0.85) * w, L = 2 + 6 * k;
      q.line(Math.cos(a) * rr, y, Math.sin(a) * rr, Math.cos(a) * rr, y + L, Math.sin(a) * rr, (u) => (u < 0.3 ? WHITE : C[5]), Math.min(1, (1 - k) * 3));
    });
    // twinkles caught in the light
    cycle(t, D, 8, o.seed + 4, 0.5, (age, life, r) => {
      const k = age / life, [x, y, z] = hauled(r.range(4, 24), r.range(0, TAU), r.sign(), 0.6, r.range(0.1, 0.7) + k * 0.15), arm = Math.round(2 * Math.sin(Math.PI * k));
      if (arm > 0) q.at(x, y, z, (pp) => sparkle(pp, 0, 0, arm, C[6], C[5], 0.4));
    });
    // dust drawn up in soft puffs, thinning as it goes
    const puffs = [];
    cycle(t, D, 9, o.seed + 3, (r) => r.range(1.4, 2), (age, life, r) => {
      const k = age / life;
      puffs.push([...hauled(r.range(8, 26), r.range(0, TAU), r.sign(), 0.8, k), k]);
    });
    for (const [x, y, z, k] of q.sort(puffs, (e) => e)) q.disc(x, y, z, lerp(4, 1.5, k), mix(S[3], C[5], 0.25 + 0.5 * k), 0.4 * Math.min(1, k * 6) * (1 - k));
    // ---- the beam: a glassy cone, white-hot at the lens, hard bright edges, light drifting in it
    cone(q, 0, 0, LENS + 3, 0, TOPW, BOTW, (h, out) => {
      const v = (h.y - LENS) / -LENS, pulse = ((((v * 3.2 + ph * 6) % 1) + 1) % 1) < 0.08 ? 1 : 0, edge = Math.sqrt(1 - (1 - h.rim) ** 2);
      let curtain = 0;
      const ang = Math.atan2(h.z, h.x) / TAU;
      for (let s = 0; s < 4; s++) if (Math.abs(((((ang - rand(o.seed, s, 7) - 0.12 * Math.sin(TAU * ph + s * 1.7)) % 1) + 1.5) % 1) - 0.5) < 0.02) curtain = 1;
      const core = (1 - edge) ** 2 * (1 - v) ** 1.6;
      out.blend = true;
      if (edge > 0.93) {
        out.c = v < 0.2 ? WHITE : v < 0.45 ? C[6] : C[5];
        out.a = 0.95;
      } else {
        out.c = core > 0.45 ? WHITE : curtain || pulse || v < 0.35 ? C[5] : C[4];
        out.a = clamp(0.06 + 0.2 * edge ** 4 + 0.45 * core + 0.1 * pulse + 0.16 * curtain);
      }
    });
    g.at3(t).draw(q);
    // swallowed: a glint at the lens
    for (const r of rocks) {
      const age = since(t, r.born, D);
      if (age > LIFE - 0.1 && age < LIFE) q.at(0, LENS + 3, 0, (pp) => sparkle(pp, 0, 0, 5, C[6], C[5], 0.5));
      flash3(q, t, r.born + LIFE - 0.08, 0, LENS + 3, 0, 30, C[5], 0.7, 0.28);
    }
    // light: the lens, the beam's body, the pool on the floor
    q.glow(0, LENS + 8, 0, 26, C[5], 0.5 * fl);
    q.glow(0, LENS + 6, 0, 12, WHITE, 0.7 * fl);
    for (let y = LENS + 16; y < -8; y += 14) q.glow(0, y, 0, half(y) + 10, C[4], 0.16);
    q.glow(0, -2, 0, 36, C[4], 0.28);
  },
};
