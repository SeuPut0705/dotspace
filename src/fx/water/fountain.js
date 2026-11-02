// The basin's caustic light (two warped sine nets, light where they cross zero) is adapted from Sprite Fusion's
// open-source bubbles (https://www.spritefusion.com/pixel-art-vfx/bubbles), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, tileNoise, clamp, smooth, rand, space, TAU, WHITE } from "../../core/index.js";
import { WATER, bead, ring, ring3, rock, tube } from "./_lib.js";

export const meta = {
  name: "Fountain",
  desc: "A stone basin; a jet rises from its spout and blooms into glassy arcs that break into beads, fall back and plink into the water with rings.",
  tags: ["water", "fountain", "jet", "basin", "prop", "ambient", "loop"],
  size: [120, 104],
  origin: [60, 96],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: WATER, seed: 3 },
};

const D = meta.duration, SY = 0.34, G = 600, RIM = 10, RX = 36, IN = 29.5, JET = 54, ARCS = 12;
// the basin stands on the floor: its base ellipse touches y = 0 at the front; heights are measured from that plane
const BY = -RX * SY, LEVEL = RIM - 1.2;

// the arcs: water thrown out of the top of the jet in every direction, each a parabola back down to the basin
const arcs = (S) =>
  Array.from({ length: ARCS }, (_, i) => {
    const a = ((i + 0.5) / ARCS) * TAU + rand(i, S) * 0.25, vr = 38 + 14 * rand(i, S + 1), vh = 30 + 26 * rand(i, S + 2);
    const tl = (vh + Math.sqrt(vh * vh + 2 * G * (JET - LEVEL))) / G;
    return { a, vr, vh, tl, ca: Math.cos(a), sa: Math.sin(a) };
  });
// a point along an arc tau seconds into its flight: screen x, y and the height above the floor
const along = (q, tau) => {
  const r = q.vr * tau, h = JET + q.vh * tau - 0.5 * G * tau * tau;
  return [q.ca * r, BY + q.sa * r * SY - h, h];
};

// the stone basin: a wide rim lit toward the light with a dark line round both edges, a wall of stone blocks
// below its near side (lit left, shaded right) standing on the floor
const inEll = (x, y, rx, cy) => (x / rx) ** 2 + ((y - cy) / (rx * SY)) ** 2 <= 1;
function basin(p, ST, half) {
  const cy = BY - RIM, ry = RX * SY;
  p.shade(-RX - 1, cy - ry - 1, RX + 1, 1, (x, y, out) => {
    if (inEll(x, y, RX, cy)) {
      if (inEll(x, y, IN, cy)) return;
      const near = y > cy;
      if (near !== half > 0) return;
      const outer = !inEll(x, y - 1, RX, cy) || !inEll(x, y + 1, RX, cy) || !inEll(x - 1, y, RX, cy) || !inEll(x + 1, y, RX, cy);
      const inner = inEll(x, y - 1, IN, cy) || inEll(x, y + 1, IN, cy) || inEll(x - 1, y, IN, cy) || inEll(x + 1, y, IN, cy);
      const a = Math.atan2((y - cy) / ry, x / RX), lit = -Math.cos(a) * 0.65 - Math.sin(a) * 0.45;
      out.c = outer ? ST[0] : inner ? (y < cy ? ST[2] : ST[1]) : lit > 0.4 ? ST[5] : lit > -0.05 ? ST[4] : lit > -0.45 ? ST[3] : ST[2];
      return;
    }
    // the wall, under the near half of the rim
    if (half < 0 || Math.abs(x) >= RX) return;
    const dx = x / RX, top = cy + Math.sqrt(1 - dx * dx) * ry, base = top + RIM;
    if (y < top || y > base) return;
    const u = Math.asin(clamp(dx)) * RX * 0.62, block = ((((u + 40) / 9) % 1) + 1) % 1, row = y - top, course = row > RIM * 0.5 ? 1 : 0;
    const joint = (((((u + 40 + course * 4.5) / 9) % 1) + 1) % 1) < 0.1;
    out.c = y > base - 1 || Math.abs(x) > RX - 1 || row < 1 ? ST[0] : joint || Math.abs(row - RIM * 0.5) < 0.5 ? ST[1] : dx < -0.4 ? ST[4] : dx < 0.3 ? ST[3] : ST[2];
    if (row >= 1 && row < 2 && !joint) out.c = dx < 0 ? ST[2] : ST[1];
  });
}

// the water in the basin: dark and see-through, a lit band at the far side, caustic light swimming in it
function pool(p, C, ph) {
  const rx = IN, ry = rx * SY, cy = BY - LEVEL, T = ph * TAU;
  for (let Y = Math.floor(cy - ry); Y < cy + ry; Y++)
    for (let X = -Math.ceil(rx); X < rx; X++) {
      const x = X + 0.5, y = Y + 0.5, dx = x / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy;
      if (d > 1) continue;
      p.blend(x, y, dy < -0.55 ? C[3] : C[1], dy < -0.55 ? 0.8 : 0.85);
      const u = x * 0.25 + 1.6 * Math.sin(y * 0.6 + T), w = y * 0.7 + 1.6 * Math.sin(x * 0.14 - T * 2);
      const f = Math.max(0, 1 - Math.abs(Math.sin(u) + Math.sin(w)) * 2.6) * (1 - d);
      if (f > 0.35) p.light(x, y, C[5], 0.3 * f);
    }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, S = o.seed, ST = rock(), Q = arcs(S);
  basin(p, ST, -1);
  pool(p, C, ph);
  // the arcs on the far side, dimmer, behind the jet
  for (const q of Q) if (q.sa < 0) arc(p, C, q, ph, true);
}

// one arc: a glassy stream that thins as it falls and breaks into beads at the end; beads slide down it
function arc(p, C, q, ph, back) {
  let prev = null;
  for (let tau = 0; tau <= q.tl; tau += 0.012) {
    const [x, y] = along(q, tau), u = tau / q.tl;
    if (prev && u < 0.66) p.line(prev[0], prev[1], x, y, back ? (u < 0.25 ? C[5] : C[4]) : u < 0.2 ? WHITE : u < 0.45 ? C[6] : C[5]);
    prev = [x, y];
  }
  // the beads it breaks into, sliding down at the water's own speed
  for (let k = 0; k < 6; k++) {
    const u = ((ph * 2 + k / 6) % 1) * 0.42 + 0.58, tau = u * q.tl, [x, y] = along(q, tau), vy = (q.vh - G * tau) * -1 + q.sa * q.vr * SY;
    bead(p, x, y, q.ca * q.vr, vy, back ? 1 : k % 3 === 0 ? 2 : 1, back ? [C[0], C[1], C[2], C[2], C[3], C[4], C[5], C[5]] : C);
  }
  // and the ones sliding along the stream itself catch the light
  const g = ((ph * 4 + q.a) % 1) * 0.6, [gx, gy] = along(q, g * q.tl);
  p.px(gx, gy, WHITE);
  if (!back) p.glow(gx, gy, 3, C[5], 0.3);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, S = o.seed, ST = rock(), Q = arcs(S), T = ph * TAU;
  // the spout: a little stone stem in the middle of the basin
  p.shade(-3.5, BY - 16, 3.5, BY - LEVEL + 0.5, (x, y, out) => {
    const w = y < BY - 14 ? 3.4 : 2.2;
    if (Math.abs(x) > w) return;
    out.c = Math.abs(x) > w - 0.8 || y < BY - 15.5 ? ST[0] : x < -0.6 ? ST[4] : x < 0.8 ? ST[3] : ST[2];
  });
  // the jet: a glassy column, white down its middle, wobbling a little at the top
  p.shade(-3, BY - JET - 1, 3, BY - 16, (x, y, out) => {
    const v = (BY - 16 - y) / (JET - 16), sway = Math.sin(T * 2 + v * 5) * 0.5 * v, w = 1.3 + 0.5 * v + 0.3 * Math.sin(T * 3 + y * 0.4), q = (x - sway) / w;
    if (Math.abs(q) > 1) return;
    const n = tileNoise(x * 0.9, y * 0.15 + ph * 16, 0, 16, S);
    out.c = q < -0.4 ? C[6] : q < 0.35 ? (n > -0.3 ? WHITE : C[6]) : C[5];
  });
  // the bloom where it opens out at the top
  p.circle(0, BY - JET - 1, 2.4, C[6]);
  p.circle(-0.4, BY - JET - 1.5, 1.4, WHITE);
  p.glow(0, BY - JET, 22, C[5], 0.46 + 0.06 * Math.sin(T * 4));
  p.glow(0, BY - JET - 1, 8, WHITE, 0.3);
  // glints wink along the arcs
  cycle(t, D, 10, S + 30, (g) => g.range(0.2, 0.35), (age, life, r) => {
    const q = Q[Math.floor(r.next() * ARCS)], [x, y] = along(q, r.range(0.1, 0.7) * q.tl), k = Math.sin((Math.PI * age) / life);
    if (q.sa < -0.3) return;
    p.px(x, y, WHITE);
    if (k > 0.6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, C[6]);
    p.glow(x, y, 5, C[5], 0.4 * k);
  });
  // foam where the jet leaves the spout
  for (let i = 0; i < 4; i++) p.px(Math.sin(T * 3 + i * 1.7) * 2.5, BY - 16 - (i % 2), i % 2 ? C[6] : WHITE);
  // the arcs on the near side, in front of the jet
  for (const q of Q) if (q.sa >= 0) arc(p, C, q, ph, false);
  // where they come down: near halves of the rings, flecks and tiny crowns thrown up, light on the water
  Q.forEach((q, i) => {
    const f = (ph * 2 + rand(i, S + 9)) % 1, [x, y] = along(q, q.tl);
    ring(p, x, y, 2 + f * 8, SY, 0.8 * Math.pow(1 - f, 1.3), C, { n: 1, half: 1, seed: i });
    const g = (ph * 6 + rand(i, S + 10)) % 1;
    if (g < 0.15) p.px(x, y - 1, WHITE);
    if (g < 0.3 && q.sa > -0.2) p.line(x, y - 1, x + (rand(i, S + 11) - 0.5) * 2, y - 1 - 3 * (1 - g / 0.3), C[6]);
    p.glow(x, y, 6, C[5], 0.18 * (1 - g));
  });
  basin(p, ST, 1);
  // a fine mist hangs round the bloom
  cycle(t, D, 16, S + 20, (g) => g.range(0.8, 1.4), (age, life, r) => {
    const k = age / life, a = r.range(0, TAU), rr = r.range(4, 20) + k * 6, x = Math.cos(a) * rr, y = BY - JET + r.range(-4, 16) + k * 10;
    if (k > 0.75 && r.next() < (k - 0.75) * 4) return;
    p.px(x, y, r.next() < 0.4 ? WHITE : C[6]);
  });
  // light: the jet, and the basin water lit from above
  p.glowLine(0, BY - 16, 0, BY - JET, 10, C[5], 0.18);
  p.glow(0, BY - LEVEL - 2, 46, C[4], 0.26 + 0.03 * Math.sin(T * 2));
  p.glow(0, BY - LEVEL - 20, 30, C[5], 0.12);
}

// 3D: the basin as a real stone drum standing on the floor (a wall of blocks, a rim ring, an inner wall, a pool plane),
// the jet a column of water, the arcs real curves thrown out in a full circle and landing as true rings on the water.
const arcAt = (q, tau) => {
  const r = q.vr * tau, h = JET + q.vh * tau - 0.5 * G * tau * tau;
  return [q.ca * r, -h, q.sa * r];
};

export const three = {
  meta: { size: [100, 104], origin: [50, 80], camera: { pitch: 0.4 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, S = o.seed, ST = rock(), Q = arcs(S), T = ph * TAU;
    const yaw = q.camera.yaw, SYW = q.sy, CYW = q.cy, DIM = [C[0], C[1], C[2], C[2], C[3], C[4], C[5], C[5]];
    // the stone: the floor of the basin, its inner wall, the wall of blocks outside, the rim on top (lit from the camera's far left)
    q.plane(0, 0, 0, null, IN, () => ST[1]);
    tube(q, 0, 0, 0, IN, RIM, (a, v) => (v < 0.12 ? (Math.sin(a + yaw) < 0 ? ST[2] : ST[1]) : v > 0.94 ? ST[0] : ST[1]));
    tube(q, 0, 0, 0, RX, RIM, (a, v) => {
      const row = v * RIM, dx = Math.cos(a + yaw), course = row > RIM * 0.5 ? 1 : 0;
      if (row < 1 || v > 0.93 || Math.abs(dx) > 0.975) return ST[0];
      const joint = ((((a / TAU) * 16 + course * 0.5) % 1) + 1) % 1 < 0.07;
      if (joint || Math.abs(row - RIM * 0.5) < 0.5) return ST[1];
      if (row < 2) return dx < 0 ? ST[2] : ST[1];
      return dx < -0.4 ? ST[4] : dx < 0.3 ? ST[3] : ST[2];
    });
    q.plane(0, -RIM, 0, null, RX, (u, v, out) => {
      const d = Math.hypot(u, v);
      if (d < IN) return;
      const a = Math.atan2(v, u), ac = a + yaw, lit = -Math.cos(ac) * 0.65 - Math.sin(ac) * 0.45;
      if (d > RX - 1) return ST[0];
      if (d < IN + 1) return Math.sin(ac) < 0 ? ST[2] : ST[1];
      if ((((a / TAU) * 14) % 1 + 1) % 1 < 0.05) return ST[1];
      return lit > 0.4 ? ST[5] : lit > -0.05 ? ST[4] : lit > -0.45 ? ST[3] : ST[2];
    });
    // the spout: a little stone stem, a cap on it
    tube(q, 0, 0, 0, 2.2, 14, (a, v) => (Math.abs(Math.cos(a + yaw)) > 0.64 ? ST[0] : Math.cos(a + yaw) < -0.27 ? ST[4] : Math.cos(a + yaw) < 0.36 ? ST[3] : ST[2]));
    tube(q, 0, -14, 0, 3.4, 2, (a, v) => (v < 0.25 || Math.abs(Math.cos(a + yaw)) > 0.76 ? ST[0] : Math.cos(a + yaw) < -0.2 ? ST[4] : Math.cos(a + yaw) < 0.4 ? ST[3] : ST[2]));
    q.plane(0, -16, 0, null, 3.4, (u, v) => (Math.hypot(u, v) > 2.6 ? ST[0] : ST[4]));
    // the jet: a glassy column, white down its middle, wobbling a little at the top, streaks running up it
    for (let h = 16; h <= JET; h += 0.7) {
      const v = (h - 16) / (JET - 16), w = 1.3 + 0.5 * v + 0.3 * Math.sin(T * 3 + h * 0.4), sx = Math.sin(T * 2 + v * 5) * 0.5 * v, sz = Math.cos(T * 2 + v * 5) * 0.5 * v;
      const m = Math.ceil(w * TAU * 1.4);
      for (let i = 0; i < m; i++) {
        const a = (i / m) * TAU, cs = Math.cos(a + yaw), n = tileNoise((a / TAU) * 5, -h * 0.15 + ph * 16, 5, 16, S);
        q.px(sx + Math.cos(a) * w, -h, sz + Math.sin(a) * w, cs < -0.4 ? C[6] : cs < 0.35 ? (n > -0.3 ? WHITE : C[6]) : C[5]);
      }
    }
    // the bloom where it opens out at the top
    q.ball(0, -JET - 1, 0, 2.4, (nx, ny) => (nx < -0.1 && ny < 0 ? WHITE : C[6]));
    // foam where the jet leaves the spout
    for (let i = 0; i < 4; i++) q.px(Math.sin(T * 3 + i * 1.7) * 2.5, -16 - (i % 2), Math.cos(T * 3 + i * 1.7) * 2.5, i % 2 ? C[6] : WHITE);
    // the arcs: glassy streams that thin as they fall and break into beads; the far side dimmer; beads slide down them
    for (const a of Q) {
      const back = Math.sin(a.a + yaw) < 0;
      let prev = null;
      for (let tau = 0; tau <= a.tl; tau += 0.012) {
        const pt = arcAt(a, tau), u = tau / a.tl;
        if (prev && u < 0.66) q.line(...prev, ...pt, back ? (u < 0.25 ? C[5] : C[4]) : u < 0.2 ? WHITE : u < 0.45 ? C[6] : C[5]);
        prev = pt;
      }
      for (let k = 0; k < 6; k++) {
        const u = ((ph * 2 + k / 6) % 1) * 0.42 + 0.58, tau = u * a.tl, [x, y, z] = arcAt(a, tau), [vx, vy] = q.view(a.ca * a.vr, G * tau - a.vh, a.sa * a.vr);
        q.at(x, y, z, (pp) => bead(pp, 0, 0, vx, vy, back ? 1 : k % 3 === 0 ? 2 : 1, back ? DIM : C));
      }
      const g = ((ph * 4 + a.a) % 1) * 0.6, [gx, gy, gz] = arcAt(a, g * a.tl);
      q.px(gx, gy, gz, WHITE);
    }
    // the pool: dark and see-through, a lit band at the far side, caustic light swimming in it
    q.plane(0, -LEVEL, 0, null, IN, (u, v, out) => {
      const d = (u * u + v * v) / (IN * IN);
      if (d > 1) return;
      const band = (u * SYW + v * CYW) / IN < -0.55;
      out.c = band ? C[3] : C[1];
      out.a = band ? 0.8 : 0.85;
      out.blend = true;
      const a = u * 0.25 + 1.6 * Math.sin(v * 0.22 + T), b = v * 0.24 + 1.6 * Math.sin(u * 0.14 - T * 2), f = Math.max(0, 1 - Math.abs(Math.sin(a) + Math.sin(b)) * 2.6) * (1 - d);
      if (f > 0.42) {
        out.l = C[5];
        out.k = 0.24 * f;
      }
    });
    // where the arcs come down: rings on the water, flecks and tiny crowns thrown up, light
    Q.forEach((a, i) => {
      const f = (ph * 2 + rand(i, S + 9)) % 1, [x, , z] = arcAt(a, a.tl);
      ring3(q, x, z, 2 + f * 8, 0.8 * Math.pow(1 - f, 1.3), C, { n: 1, seed: i, y: -LEVEL });
      const g = (ph * 6 + rand(i, S + 10)) % 1;
      if (g < 0.15) q.px(x, -LEVEL - 1, z, WHITE);
      if (g < 0.3) q.line(x, -LEVEL - 1, z, x + (rand(i, S + 11) - 0.5) * 2, -LEVEL - 1 - 3 * (1 - g / 0.3), z + (rand(i, S + 12) - 0.5) * 2, C[6]);
    });
    // glints wink along the arcs
    cycle(t, D, 10, S + 30, (g) => g.range(0.2, 0.35), (age, life, r) => {
      const a = Q[Math.floor(r.next() * ARCS)], [x, y, z] = arcAt(a, r.range(0.1, 0.7) * a.tl), k = Math.sin((Math.PI * age) / life);
      q.at(x, y, z, (pp) => {
        pp.px(0, 0, WHITE);
        if (k > 0.6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(dx, dy, C[6]);
      });
      q.glow(x, y, z, 5, C[5], 0.4 * k);
    });
    // a fine mist hangs round the bloom, all the way round it
    cycle(t, D, 16, S + 20, (g) => g.range(0.8, 1.4), (age, life, r) => {
      const k = age / life, a = r.range(0, TAU), rr = r.range(4, 20) + k * 6, y = -JET + r.range(-4, 16) + k * 10;
      if (k > 0.75 && r.next() < (k - 0.75) * 4) return;
      q.px(Math.cos(a) * rr, y, Math.sin(a) * rr, r.next() < 0.4 ? WHITE : C[6]);
    });
    // light: the bloom and the jet, the basin water lit from above
    q.glow(0, -JET, 0, 22, C[5], 0.46 + 0.06 * Math.sin(T * 4));
    q.glow(0, -JET - 1, 0, 8, WHITE, 0.3);
    q.glowLine(0, -16, 0, 0, -JET, 0, 10, C[5], 0.18);
    q.glow(0, -LEVEL - 2, 0, 46, C[4], 0.26 + 0.03 * Math.sin(T * 2));
    q.glow(0, -LEVEL - 20, 0, 30, C[5], 0.12);
  },
};
