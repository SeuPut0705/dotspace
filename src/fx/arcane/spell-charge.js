// The charge recipe (motes spiralling in, pulse rings collapsing onto a layered ball with flickering rays, short
// crackling sparks) is adapted from Sprite Fusion's open-source energy charge
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { PAL, fit, cycle, rng, loopNoise, smooth, ease, sparkle, space, scale, clamp, TAU, WHITE, READY } from "../../core/index.js";
import { mote, streak, arc, drawArc } from "./_lib.js";

const D = 1.6, HX = 15, HY = -22, RINGS = 4, RT = 0.5;

export const meta = {
  name: "Spell charge",
  desc: "Energy gathers in the caster's hand: streaks and motes spiral in, rings collapse into a swelling orb that crackles with arcs, ready to fire.",
  tags: ["arcane", "charge", "spell", "orb", "cast", "magic", "loop"],
  size: [120, 86],
  origin: [44, 80],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: PAL.arcane, seed: 5 },
};

const HOLD = { ...READY, x: -3, crouch: 4, lean: 2, fx: 18, fy: -22, bx: 11, by: -17, ffx: 10, fbx: -8 };
export const act = {
  poses: [
    [-0.46, { ...READY, x: -3 }],
    [-0.12, { ...HOLD, crouch: 3 }],
    [0, HOLD],
    [0.4, { ...HOLD, crouch: 5 }],
    [0.8, { ...HOLD, lean: 3 }],
    [1.2, { ...HOLD, crouch: 5 }],
    [1.6, HOLD],
  ],
};

// each ring is born at k * D / RINGS and lands RT later; the times it lands, wrapped into the loop
const landings = Array.from({ length: RINGS }, (_, k) => (k * D) / RINGS + RT);
const sinceLast = (t) => Math.min(...landings.map((l) => ((((t - l) % D) + D) % D)));

function orb(p, C, x, y, r, t, ph) {
  // rays flickering round the ball, turning three steps a loop
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + ph * (TAU / 8) * 3, l = (1.5 + 4.5 * Math.abs(loopNoise(ph, 3, i * 7 + 1))) * (i % 2 ? 0.7 : 1);
    const x0 = x + Math.cos(a) * (r + 1.2), y0 = y + Math.sin(a) * (r + 1.2);
    p.line(x0, y0, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, (u) => (u < 0.4 ? C[6] : i % 2 ? C[4] : C[5]), (u) => (u < 0.6 ? 1 : 1.6 - u));
  }
  // the ball: a violet rim, a bright body lit from the top left, a big white heart
  p.circle(x, y, r + 1.3, C[4]);
  p.circle(x, y, r + 0.3, C[5]);
  p.circle(x - r * 0.12, y - r * 0.12, r * 0.8, C[6]);
  p.circle(x, y, r * 0.5, WHITE);
  // filaments crackling out from the heart through the body to the shell, new ones every other frame
  const R = rng(Math.floor(t * 15), 77);
  for (let i = 0; i < 3; i++) {
    const a = R.range(0, TAU), pts = arc(R, x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, x + Math.cos(a + R.range(-0.6, 0.6)) * (r + 0.6), y + Math.sin(a + R.range(-0.6, 0.6)) * (r + 0.6), { jag: 0.45, forks: 0 })[0].pts;
    p.polyline(pts, (u) => (u < 0.6 ? WHITE : C[6]));
  }
  // a glint on the shell
  p.px(x - r * 0.5, y - r * 0.62, WHITE);
}

function ringAt(p, C, x, y, rr, sy, rot, q) {
  const n = Math.ceil(rr * TAU * 1.4), c = Math.cos(rot), s = Math.sin(rot);
  const col = q > 0.85 ? WHITE : q > 0.55 ? C[6] : C[5], a = Math.min(1, q * 3);
  for (let j = 0; j < n; j++) {
    const g = (j / n) * TAU, lx = Math.cos(g) * rr, ly = Math.sin(g) * rr * sy, px = x + lx * c - ly * s, py = y + lx * s + ly * c;
    if (py > -0.5) continue; // the floor hides the bottom of a big ring
    p.dot(px, py, col, a);
    if (j % 10 === 0) p.glow(px, py, 5, C[5], 0.12 * a);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, S = o.seed, f = Math.floor(t * 30);
  const since = sinceLast(t), swell = Math.exp(-((since / 0.07) ** 2)) + 0.5 * Math.exp(-((since / 0.18) ** 2));
  const r = 6.1 + 0.5 * Math.sin(ph * TAU * 4) + 1.4 * swell;
  // unstable: it shivers a pixel as each ring lands
  const jit = swell > 0.4 ? (f % 2 ? 1 : -1) : 0, x = HX + jit, y = HY;

  // streaks spiralling in from all round, faster as they near the hand
  cycle(t, D, 110, S * 3 + 1, (g) => g.range(0.2, 0.34), (age, life, R) => {
    // they come from the left, above and the upper right; the swirl would carry the rest into the floor
    const a0 = R.range(2.8, 5.75), d0 = R.range(20, 52), spin = R.range(0.6, 1.3);
    const pos = (q) => {
      const a = a0 + spin * q * q, d = d0 * (1 - q * q) + r;
      return [HX + Math.cos(a) * d, HY + Math.sin(a) * d * 0.92];
    };
    const q = age / life, [px, py] = pos(q), [qx, qy] = pos(Math.min(1, q + 0.02));
    // their light dies as they reach the orb, so it isn't washed out by them
    streak(p, px, py, (qx - px) / (0.02 * life), (qy - py) / (0.02 * life), R.chance(0.55) ? C[6] : C[5], Math.min(1, q * 4) * (1 - smooth(0.9, 1, q)), 7, 0.4 * (1 - smooth(0.6, 0.9, q)));
  });
  // slower motes, drifting in on the same swirl
  cycle(t, D, 56, S * 3 + 2, (g) => g.range(0.4, 0.7), (age, life, R) => {
    const a0 = R.range(2.6, 5.2), d0 = R.range(12, 32), spin = R.range(1, 2.2), size = R.range(0.6, 1);
    const pos = (q) => {
      const a = a0 + spin * q, d = d0 * (1 - ease.inQuad(q)) + r;
      return [HX + Math.cos(a) * d, HY + Math.sin(a) * d];
    };
    const q = age / life, [px, py] = pos(q), [qx, qy] = pos(Math.min(1, q + 0.02));
    mote(p, px, py, (qx - px) / (0.02 * life), (qy - py) / (0.02 * life), R.pick([C[5], C[6], C[6], WHITE]), size, Math.min(1, q * 3) * (q > 0.9 ? (1 - q) / 0.1 : 1), 0.3 * (1 - smooth(0.55, 0.85, q)));
  });

  // rings collapsing onto the orb, each tilted its own way
  for (let k = 0; k < RINGS; k++)
    for (const off of [-D, 0]) {
      const q = (t - (k * D) / RINGS - off) / RT;
      if (q < 0 || q >= 1) continue;
      const rr = r + 1.5 + 22 * (1 - ease.inQuad(q)), shape = [[1, 0], [0.38, 0.55], [1, 0], [0.42, -0.7]][k];
      ringAt(p, C, x, y, rr, shape[0], shape[1], q);
    }

  orb(p, C, x, y, r, t, ph);

  // arcs crackling off it, new ones every other frame
  const w = Math.floor(f / 2), Rw = rng(S, w, 3), n = (Rw.next() < 0.6 ? 1 : 0) + (swell > 0.3 ? 1 : 0), fresh = f % 2 === 0 ? 0.8 : 0.4;
  for (let i = 0; i < n; i++) {
    const a = Rw.range(0, TAU), L = Rw.range(5, 10) * (1 + swell * 0.4), a1 = a + Rw.range(-0.5, 0.5);
    const x0 = x + Math.cos(a) * (r + 0.5), y0 = y + Math.sin(a) * (r + 0.5), x1 = x0 + Math.cos(a1) * L, y1 = Math.min(-2, y0 + Math.sin(a1) * L);
    drawArc(p, arc(Rw, x0, y0, x1, y1, { jag: 0.35, forks: Rw.next() < 0.5 ? 1 : 0 }), { core: WHITE, body: C[5], halo: C[3], glow: C[5] }, fresh, 0.3);
  }
  // glints winking round it
  cycle(t, D, 7, S * 3 + 4, 0.22, (age, life, R) => {
    const a = R.range(0, TAU), d = R.range(r + 5, r + 15), k = Math.sin((age / life) * Math.PI);
    sparkle(p, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, 1 + 2.5 * k, C[6], C[4], 0.4 * k);
  });
  if (since < 0.07) sparkle(p, x, y, 4 + 6 * (1 - since / 0.07), C[6], C[5], 0.5);

  // light: a wide pool that lights the caster, a hot heart, the floor beneath the hand
  const pulse = 0.85 + 0.15 * Math.sin(ph * TAU * 4) + 0.2 * swell;
  p.glow(x, y, 46, C[4], 0.26 * pulse);
  p.glowRing(x, y, r + 3, 8, C[5], 0.3 * pulse);
  p.glow(x, y, r, C[6], 0.12);
  p.glow(HX, -1, 22, C[5], 0.16 * pulse);
}

// 3D: the orb is a real ball at the hand with rays spiking out in every direction; streaks and motes spiral in from
// the whole sphere round it, four rings tilted into their own planes collapse onto it, and arcs crackle off it
// every way. Its face features (filaments, glint, glints round it) stay upright facing the camera.
const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// two unit vectors spanning the plane with normal n
const spanOf = (n) => {
  const e1 = norm3(cross3(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
  return [e1, cross3(n, e1)];
};
const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
// a point on the unit sphere; s is how far up it is (-1 straight down .. 1 straight up), a the heading round
const onSphere = (s, a) => {
  const c = Math.sqrt(1 - s * s);
  return [Math.cos(a) * c, -s, Math.sin(a) * c];
};
const NORMALS = [[0.12, -1, 0.1], [0, 0.35, 1], [1, 0.25, 0.1], [0.6, -0.5, -0.8]];

export const three = {
  meta: { size: [156, 126], origin: [78, 98], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, S = o.seed, f = Math.floor(t * 30);
    const since = sinceLast(t), swell = Math.exp(-((since / 0.07) ** 2)) + 0.5 * Math.exp(-((since / 0.18) ** 2));
    const r = 6.1 + 0.5 * Math.sin(ph * TAU * 4) + 1.4 * swell;
    const jit = swell > 0.4 ? (f % 2 ? 1 : -1) : 0, x = HX + jit, y = HY, pulse = 0.85 + 0.15 * Math.sin(ph * TAU * 4) + 0.2 * swell;
    const lights = [];

    // streaks spiralling in from the whole sphere round the orb, faster as they near it
    cycle(t, D, 190, S * 3 + 1, (g) => g.range(0.2, 0.34), (age, life, R) => {
      const a0 = R.range(0, TAU), s = R.range(-0.33, 0.97), d0 = R.range(20, 52), spin = R.range(0.6, 1.3);
      const pos = (u) => {
        const [dx, dy, dz] = onSphere(s, a0 + spin * u * u), d = d0 * (1 - u * u) + r;
        return [x + dx * d, y + dy * d * 0.92, dz * d];
      };
      const u = age / life, h = pos(u), tl = pos(Math.max(0, u - 0.02)), sp = Math.hypot(h[0] - tl[0], h[1] - tl[1], h[2] - tl[2]) / (0.02 * life);
      const L = clamp(sp / 30, 1, 7), k = Math.min(1, u * 4) * (1 - smooth(0.9, 1, u)), c = R.chance(0.55) ? C[6] : C[5];
      const m = Math.hypot(h[0] - tl[0], h[1] - tl[1], h[2] - tl[2]) || 1, e = [(h[0] - tl[0]) / m, (h[1] - tl[1]) / m, (h[2] - tl[2]) / m];
      q.line(h[0] - e[0] * L, h[1] - e[1] * L, h[2] - e[2] * L, ...h, (v) => (v > 1 - 1 / L ? WHITE : v > 0.5 ? c : scale(c, 0.6)), (v) => (v > 0.5 ? k : (0.2 + v) * k));
      const glow = 0.4 * (1 - smooth(0.6, 0.9, u));
      if (glow > 0) lights.push(() => q.glow(h[0], h[1], h[2], 4, c, glow * k));
    });
    // slower motes, drifting in on the same swirl
    cycle(t, D, 56, S * 3 + 2, (g) => g.range(0.4, 0.7), (age, life, R) => {
      const a0 = R.range(0, TAU), s = R.range(-0.33, 0.97), d0 = R.range(12, 32), spin = R.range(1, 2.2), size = R.range(0.6, 1);
      const pos = (u) => {
        const [dx, dy, dz] = onSphere(s, a0 + spin * u), d = d0 * (1 - ease.inQuad(u)) + r;
        return [x + dx * d, y + dy * d, dz * d];
      };
      const u = age / life, h = pos(u), tl = pos(Math.max(0, u - 0.02)), c = R.pick([C[5], C[6], C[6], WHITE]);
      const k = Math.min(1, u * 3) * (u > 0.9 ? (1 - u) / 0.1 : 1), m = Math.hypot(h[0] - tl[0], h[1] - tl[1], h[2] - tl[2]) || 1;
      const len = Math.min(16, 0.5 + (m / (0.02 * life)) * 0.026) * size, e = [(h[0] - tl[0]) / m, (h[1] - tl[1]) / m, (h[2] - tl[2]) / m], a = k < 0.35 ? k / 0.35 : 1;
      if (len > 1.2) q.line(h[0] - e[0] * len, h[1] - e[1] * len, h[2] - e[2] * len, h[0] - e[0] * len * 0.35, h[1] - e[1] * len * 0.35, h[2] - e[2] * len * 0.35, scale(c, 0.55), a);
      q.line(h[0] - e[0] * len * 0.4, h[1] - e[1] * len * 0.4, h[2] - e[2] * len * 0.4, ...h, c, a);
      const glow = 0.3 * (1 - smooth(0.55, 0.85, u));
      if (glow > 0) lights.push(() => q.glow(h[0], h[1], h[2], 2.5 + size, c, glow * k));
    });

    // rings collapsing onto the orb, each in its own plane, tumbling as they close
    for (let k = 0; k < RINGS; k++)
      for (const off of [-D, 0]) {
        const u = (t - (k * D) / RINGS - off) / RT;
        if (u < 0 || u >= 1) continue;
        const rr = r + 1.5 + 22 * (1 - ease.inQuad(u)), [e1, e2] = spanOf(norm3(rotY(NORMALS[k], u * 1.6 + k))), n = Math.ceil(rr * TAU * 1.4);
        const col = u > 0.85 ? WHITE : u > 0.55 ? C[6] : C[5], a = Math.min(1, u * 3);
        for (let j = 0; j < n; j++) {
          const g = (j / n) * TAU, cg = Math.cos(g) * rr, sg = Math.sin(g) * rr;
          const px = x + e1[0] * cg + e2[0] * sg, py = y + e1[1] * cg + e2[1] * sg, pz = e1[2] * cg + e2[2] * sg;
          if (py > -0.5) continue; // the floor hides the bottom of a big ring
          q.dot(px, py, pz, col, a);
          if (j % 10 === 0) lights.push(() => q.glow(px, py, pz, 5, C[5], 0.12 * a));
        }
      }

    // rays spiking out of the ball every way, turning half a loop
    for (let i = 0; i < 8; i++) {
      const ln = (1.5 + 4.5 * Math.abs(loopNoise(ph, 3, (i & 3) * 7 + 1))) * (i % 2 ? 0.7 : 1);
      const [dx, dy, dz] = onSphere(i % 2 ? -0.5 : 0.5, (i / 8) * TAU + ph * (TAU / 8) * 4);
      q.line(x + dx * (r + 1.2), y + dy * (r + 1.2), dz * (r + 1.2), x + dx * (r + 1.2 + ln), y + dy * (r + 1.2 + ln), dz * (r + 1.2 + ln),
        (v) => (v < 0.4 ? C[6] : i % 2 ? C[4] : C[5]), (v) => (v < 0.6 ? 1 : 1.6 - v));
    }
    // the ball: a violet rim, a bright body lit from the top left, a big white heart
    const R1 = r + 1.3, f1 = (r + 0.3) / R1, f2 = (r * 0.8) / R1, f3 = (r * 0.5) / R1, off = (r * 0.12) / R1;
    q.ball(x, y, 0, R1, (nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (d > f1) return C[4];
      if (d < f3) return WHITE;
      return Math.hypot(nx + off, ny + off) < f2 ? C[6] : C[5];
    });
    // face features, upright toward the camera: filaments crackling from the heart to the shell, a glint
    q.at(x, y, 0, (pp) => {
      pp.z -= r + 1;
      const R = rng(Math.floor(t * 15), 77);
      for (let i = 0; i < 3; i++) {
        const a = R.range(0, TAU), pts = arc(R, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, Math.cos(a + R.range(-0.6, 0.6)) * (r + 0.6), Math.sin(a + R.range(-0.6, 0.6)) * (r + 0.6), { jag: 0.45, forks: 0 })[0].pts;
        pp.polyline(pts, (u) => (u < 0.6 ? WHITE : C[6]));
      }
      pp.px(-r * 0.5, -r * 0.62, WHITE);
    });

    // arcs crackling off it in every direction, new ones every other frame
    const w = Math.floor(f / 2), Rw = rng(S, w, 3), n = (Rw.next() < 0.6 ? 1 : 0) + (swell > 0.3 ? 1 : 0), fresh = f % 2 === 0 ? 0.8 : 0.4;
    for (let i = 0; i < n; i++) {
      const dir = onSphere(Rw.range(-0.5, 0.95), Rw.range(0, TAU)), L = Rw.range(5, 10) * (1 + swell * 0.4), a1 = Rw.range(-0.5, 0.5);
      const [e1, e2] = spanOf(dir), phi = Rw.range(0, TAU), side = [Math.cos(phi) * e1[0] + Math.sin(phi) * e2[0], Math.cos(phi) * e1[1] + Math.sin(phi) * e2[1], Math.cos(phi) * e1[2] + Math.sin(phi) * e2[2]];
      const other = cross3(dir, side), paths = arc(Rw, 0, 0, L * Math.cos(a1), L * Math.sin(a1), { jag: 0.35, forks: Rw.next() < 0.5 ? 1 : 0 });
      const at = ([px, py], d) => [x + dir[0] * (r + 0.5 + px) + side[0] * py + d[0], Math.min(-2, y + dir[1] * (r + 0.5 + px) + side[1] * py + d[1]), dir[2] * (r + 0.5 + px) + side[2] * py + d[2]];
      const lines = (d, c, al) => { for (const path of paths) q.polyline(path.pts.map((pt) => at(pt, d)), c, al); };
      if (fresh > 0.45) for (const v of [side, other]) for (const sg of [1.5, -1.5]) lines([v[0] * sg, v[1] * sg, v[2] * sg], C[3], (fresh - 0.45) * 1.6);
      for (const v of [side, other]) lines(v, C[5], 1);
      for (const path of paths) {
        q.polyline(path.pts.map((pt) => at(pt, [0, 0, 0])), path.w >= 1 && fresh > 0.3 ? WHITE : C[5], 1);
        if (path.w >= 1) for (let j = 0; j < path.pts.length - 1; j += 3) { const g = at(path.pts[j], [0, 0, 0]); lights.push(() => q.glow(...g, 9 * (0.5 + fresh * 0.5), C[5], 0.3 * fresh * path.w)); }
      }
    }
    // glints winking round it
    cycle(t, D, 7, S * 3 + 4, 0.22, (age, life, R) => {
      const [dx, dy, dz] = onSphere(R.range(-0.8, 0.95), R.range(0, TAU)), d = R.range(r + 5, r + 15), k = Math.sin((age / life) * Math.PI);
      q.at(x + dx * d, y + dy * d * 0.9, dz * d, (pp) => sparkle(pp, 0, 0, 1 + 2.5 * k, C[6], C[4], 0.4 * k));
    });
    if (since < 0.07) q.at(x, y, 0, (pp) => ((pp.z -= r + 2), sparkle(pp, 0, 0, 4 + 6 * (1 - since / 0.07), C[6], C[5], 0.5)));

    // light: a wide pool that lights the caster, a hot heart, the floor beneath the hand
    for (const l of lights) l();
    q.glow(x, y, 0, 46, C[4], 0.26 * pulse);
    q.glow(x, y, 0, r + 6, C[5], 0.3 * pulse);
    q.glow(x, y, 0, r, C[6], 0.12);
    q.glow(HX, -1, 0, 22, C[5], 0.16 * pulse);
  },
};
