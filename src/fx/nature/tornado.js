import { cycle, fit, rand, rng, smooth, clamp, lerp, space, TAU, WHITE, mix, tileNoise, bolt } from "../../core/index.js";
import { drawRock, stoneShape, drawLeaf, leaf3, hull, stone3, turn, axis3 } from "./_lib.js";

export const meta = {
  name: "Tornado",
  desc: "A snaking funnel of spinning wind bands under a flared, churning top that flickers with lightning; leaves and debris whirl round it front and back, dust boils at its foot.",
  tags: ["nature", "wind", "tornado", "storm", "hazard", "ground", "loop"],
  size: [196, 168],
  origin: [98, 152],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#141221", "#231f33", "#36314a", "#4d4762", "#68617d", "#8a839e", "#b3adc4", "#e2def0"],
    dust: ["#2a2018", "#4e3e2e", "#76624a", "#a08a6a", "#cbb894"],
    leaves: ["#4a200c", "#a8541c", "#e8962e", "#ffd27a", "#123818", "#2f7a2a", "#6cb83a", "#c8f070"],
    height: 112,
    seed: 4,
  },
};

const SY = 0.28;

// the funnel at time t: its axis snakes (a wave running up it), its radius flares at the top
function geo(o, t) {
  const ph = (TAU * t) / meta.duration, FH = o.height;
  return {
    FH,
    ph,
    ax: (u) => 8.5 * Math.sin(ph - 2.6 * u) * (0.2 + 0.8 * u) + 3 * Math.sin(2 * ph + 1.3 - 4.5 * u) * u,
    rad: (u) => 3 + 20 * Math.pow(u, 1.5) + 17 * Math.pow(smooth(0.78, 1, u), 2),
  };
}

// the body: a translucent column, thicker through its middle, lit from the left, with streaks of dust that
// shear past each other as rows spin at different speeds
function body(p, C, Dst, g, t, seed) {
  const { FH, ax, rad } = g;
  for (let y = -Math.ceil(FH) + 2; y <= 0; y++) {
    const u = -y / FH, cx = ax(u), r = rad(u), K = 2 + (rand(y, seed) < 0.35 ? 1 : 0), rot = (TAU * K * t) / meta.duration;
    const fade = Math.min(1, u * 8 + 0.25) * (1 - smooth(0.9, 1.02, u));
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const c = (x + 0.5 - cx) / r;
      if (Math.abs(c) > 1) continue;
      const n = tileNoise(((Math.acos(c) + rot) * 6) / TAU, y * 0.34, 6, 0, seed), v = -c * 0.55 + 0.15 + n * 0.55;
      let col = v > 0.6 ? C[6] : v > 0.28 ? C[5] : v > -0.05 ? C[4] : v > -0.4 ? C[3] : C[2];
      if (u < 0.3) col = mix(col, Dst[v > 0.3 ? 3 : v > -0.2 ? 2 : 1], 0.7 * (1 - u / 0.3));
      p.blend(x, y, col, (0.14 + 0.36 * Math.sqrt(1 - c * c)) * fade);
    }
  }
}

// wind bands: 1 px streaks wrapped round the funnel, bright at the head, fading along the tail; the far half
// goes behind, dimmer
function bands(p, C, g, t, seed, back) {
  const { FH, ax, rad } = g;
  for (let j = 0; j < 58; j++) {
    const R = rng(seed, j), u = (j + R.range(0.1, 0.9)) / 58, K = R.int(2, 4), span = R.range(0.7, 2.1), lvl = R.next();
    const cx = ax(u), r = rad(u) * R.range(1.0, 1.1), y0 = -u * FH, head = R.range(0, TAU) + (TAU * K * t) / meta.duration;
    if (u > 0.97) continue;
    for (let s = 0; s <= span; s += 0.5 / Math.max(2, r)) {
      const th = head - s, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const k = s / span, x = cx + r * Math.cos(th), y = y0 + r * SY * sn, lit = Math.cos(th) < 0.2;
      let i = lvl < 0.18 ? 2 : k < 0.15 && lvl > 0.55 ? 7 : k < 0.45 ? (lit ? 6 : 5) : lit ? 5 : 4;
      if (back) i = Math.max(1, i - 2);
      if (k < 0.5) p.dot(x, y, C[i]);
      else p.blend(x, y, C[i], 2 * (1 - k));
    }
    if (!back && lvl > 0.6 && Math.sin(head) > 0) {
      const hx = cx + r * Math.cos(head), hy = y0 + r * SY * Math.sin(head);
      p.dot(hx, hy, WHITE);
      p.glow(hx, hy, 5, C[6], 0.3);
    }
  }
}

// a soft flattened puff: rx wide, ry tall, blended
function blob(p, cx, cy, rx, ry, c, a) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) p.blend(x, y, c, a);
    }
}

// the flared top: a lid of cloud sheared into flat bands that ride round with the funnel, each thick in the
// middle and drawn out to a thin tail behind, lit along its upper rim, dark beneath; a dark mass at its core
function crown(p, C, g, t, seed, back, flash) {
  const { FH, ax, rad } = g, cx = ax(1), r = rad(1), L = (c) => mix(c, C[7], flash * 0.6), y0 = -FH - 3;
  if (back) {
    blob(p, cx, y0 + 1, r * 0.85, 6, C[1], 0.6);
    blob(p, cx - 4, y0 - 3, r * 0.6, 3.5, L(C[3]), 0.45);
  }
  for (let j = 0; j < 16; j++) {
    const R = rng(seed, j), rr = r * R.range(0.4, 1.15), K = R.int(1, 2), span = R.range(1.4, 2.8), head = R.range(0, TAU) + (TAU * K * t) / meta.duration;
    const th0 = R.range(3.2, 6), lift = R.range(-4, 3) - (1 - rr / (r * 1.15)) * 5;
    for (let s2 = 0; s2 <= span; s2 += 0.6 / rr) {
      const th = head - s2, sn = Math.sin(th);
      if (sn > 0 === back) continue;
      const k = s2 / span, th2 = th0 * Math.sin(Math.PI * Math.pow(1 - k, 0.7)), x = cx + rr * Math.cos(th), y = y0 + lift + rr * SY * sn;
      const T = Math.max(1, Math.round(th2)), d = back ? 1 : 0, lit = Math.cos(th) < 0.3;
      for (let i = 0; i < T; i++) {
        const c = i === 0 ? L(C[(lit ? 6 : 5) - d]) : i === T - 1 && T > 2 ? C[1] : L(C[(i === 1 ? 4 : 3) - d]);
        p.blend(x, y - T / 2 + i, c, (0.55 + 0.35 * (1 - k)) * (back ? 0.75 : 1));
      }
    }
  }
}

// leaves, twigs and pebbles spiralling up round it and flung off the top
function debris(p, C, L, g, t, seed, back, S) {
  const { FH, ax, rad } = g;
  cycle(t, meta.duration, 24, seed, (q) => q.range(1.3, 1.95), (age, life, R, i) => {
    // the first stretch skids in across the floor, then it spirals up and is flung off the top
    const k = age / life, sk = R.range(0.15, 0.3), q = clamp((k - sk) / (1 - sk)), u = lerp(0.03, 0.98, Math.pow(q, 0.85));
    const th = R.range(0, TAU) + R.range(2, 3.2) * TAU * k, sn = Math.sin(th);
    if (sn > 0 === back) return;
    const fling = smooth(0.78, 1, q), inward = 1 - smooth(0, sk, k), far = R.range(26, 44);
    const rr = lerp(Math.min(68, rad(u) * (1.12 + fling * 1.1) + R.range(2, 7)), far, inward), x = ax(u) + rr * Math.cos(th), y = Math.min(-1, -u * FH + rr * SY * sn - fling * 8);
    const a = Math.min(1, k * 8) * (1 - smooth(0.85, 1, k)), kind = R.next(), spin = R.range(-14, 14) * age, dk = back ? 1 : 0;
    if (kind < 0.62) {
      const o = R.next() < 0.5 ? 0 : 4, pal = [L[o], L[o + 1], L[o + 2 - dk], L[o + 3 - dk]];
      drawLeaf(p, x, y, R.range(6, 9), R.range(1.8, 2.6), spin, age * R.range(5, 10), pal, a);
    } else if (kind < 0.8) {
      const ca = Math.cos(spin) * 2.5, sa = Math.sin(spin) * 2.5;
      p.line(x - ca, y - sa, x + ca, y + sa, back ? L[0] : L[1], a);
      p.dot(x + ca, y + sa, L[2], a);
    } else drawRock(p, x, y, R.range(1.6, 2.6), spin, stoneShape(R, 5), S, a);
  });
}

// at its foot: dust boiling round and out, grit hopping, scuffs swept round the floor
function skirt(p, D, g, t, seed, back) {
  const cx0 = g.ax(0);
  cycle(t, meta.duration, 40, seed, (q) => q.range(0.7, 1.3), (age, life, R) => {
    const k = age / life, th = R.range(0, TAU) + R.range(5, 9) * age, sn = Math.sin(th);
    if (sn > 0 === back) return;
    const rr = 4 + k * R.range(14, 28), x = cx0 + rr * Math.cos(th), y = -1.5 - k * R.range(4, 16) + rr * 0.3 * sn, s = R.range(3, 6) * (0.6 + 0.8 * k);
    const a = Math.min(1, k * 6) * (1 - k) * 0.6;
    p.disc(x, y + s * 0.2, s, D[back ? 1 : 2], a);
    p.disc(x - s * 0.2, y - s * 0.3, s * 0.55, D[back ? 2 : 3], a * 0.8);
  });
  if (back) return;
  cycle(t, meta.duration, 16, seed + 7, (q) => q.range(0.35, 0.6), (age, life, R) => {
    const th = R.range(0, TAU), v = R.range(25, 55), x = cx0 + Math.cos(th) * (4 + v * age), y = Math.sin(th) * 2 - R.range(40, 80) * age + 260 * age * age;
    if (y < 0.5) p.dot(x, Math.min(0, y), R.next() < 0.5 ? D[3] : D[4], 1 - age / life);
  });
  for (let j = 0; j < 7; j++) {
    const R = rng(seed + 3, j), rr = R.range(12, 28), th0 = R.range(0, TAU) + (TAU * 3 * t) / meta.duration, span = R.range(0.5, 1.1);
    for (let s = 0; s < span; s += 0.6 / rr) {
      const th = th0 - s;
      p.dot(cx0 + rr * Math.cos(th), 0.5 + rr * 0.18 * Math.sin(th), D[s < span * 0.4 ? 3 : 2], 1 - s / span);
    }
  }
}

// once a loop the crown lights up from inside
function flashAt(t) {
  const q = t / meta.duration;
  return Math.max(0, 1 - Math.abs(q - 0.62) / 0.025) + 0.6 * Math.max(0, 1 - Math.abs(q - 0.69) / 0.015);
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), D = fit(o.dust, 5), g = geo(o, t), f = flashAt(t);
  skirt(p, D, g, t, o.seed * 5 + 1, true);
  crown(p, C, g, t, o.seed * 7 + 2, true, f);
  bands(p, C, g, t, o.seed * 3 + 5, true);
  debris(p, C, fit(o.leaves, 8), g, t, o.seed * 11 + 3, true, C);
  body(p, C, D, g, t, o.seed);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), D = fit(o.dust, 5), g = geo(o, t), f = flashAt(t), cx = g.ax(1);
  bands(p, C, g, t, o.seed * 3 + 5, false);
  crown(p, C, g, t, o.seed * 7 + 2, false, f);
  skirt(p, D, g, t, o.seed * 5 + 1, false);
  debris(p, C, fit(o.leaves, 8), g, t, o.seed * 11 + 3, false, C);
  // light: a soft pale column, a cold pool at its foot, the crown's lightning
  p.glowLine(g.ax(0.1), -g.FH * 0.1, cx, -g.FH * 0.9, 26, C[5], 0.08);
  p.glow(g.ax(0), -2, 30, D[3], 0.12);
  if (f > 0.05) {
    const R = rng(o.seed, 99, Math.floor(t / meta.duration * 7)), path = bolt(R, cx - 18, -g.FH - 6, cx + 16, -g.FH + 2, { jag: 0.3, depth: 3 });
    p.polyline(path, f > 0.6 ? WHITE : C[7], Math.min(1, f * 1.5));
    p.glow(cx, -g.FH - 2, 70, C[7], 0.45 * f);
  }
}

// ---- 3D: a funnel in space, built of translucent rings of wind that really turn, its axis snaking round in a spiral;
// the bands are helices wrapped round it with the far side dimmer, the crown a flared lid you can see under and over,
// leaves, twigs and stones really circling it, dust boiling round its foot all the way round.
export const three = {
  meta: { size: [208, 180], origin: [104, 158], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), Dst = fit(o.dust, 5), L = fit(o.leaves, 8), g = geo(o, t), { FH, rad, ax } = g, D = meta.duration, seed = o.seed;
    const az = (u) => 7 * Math.cos(g.ph - 2.6 * u) * (0.2 + 0.8 * u) + 2.5 * Math.cos(2 * g.ph + 1.3 - 4.5 * u) * u;
    const f = flashAt(t), yaw = q.camera.yaw, cx1 = ax(1), cz1 = az(1);
    // which way a point on a ring at world angle th faces: across the view (-1 left, 1 right) and towards or away from the viewer
    const across = (th) => Math.cos(th + yaw), near = (th) => Math.sin(th + yaw);
    // the body: translucent rings of dust, shearing past each other, thicker through the middle, lit from the left
    const NR = 34;
    for (let j = 1; j <= NR; j++) {
      const u = j / NR, y = -u * FH, r = rad(u), fade = Math.min(1, u * 8 + 0.25) * (1 - smooth(0.9, 1.02, u)), K = 2 + (rand(j, seed) < 0.35 ? 1 : 0), rot = (TAU * K * t) / D;
      if (fade < 0.02) continue;
      q.plane(ax(u), y, az(u), null, r + 3, (pu, pv, out) => {
        const d = Math.hypot(pu, pv), e = d - r;
        if (e > 2 || e < -2) return;
        const th = Math.atan2(pv, pu), c = across(th), n = tileNoise(((th + rot) * 6) / TAU, y * 0.34, 6, 0, seed), v = -c * 0.55 + 0.15 + n * 0.55;
        let col = v > 0.6 ? C[6] : v > 0.28 ? C[5] : v > -0.05 ? C[4] : v > -0.4 ? C[3] : C[2];
        if (u < 0.3) col = mix(col, Dst[v > 0.3 ? 3 : v > -0.2 ? 2 : 1], 0.7 * (1 - u / 0.3));
        out.c = col;
        out.a = (0.2 + 0.18 * Math.abs(near(th))) * fade * (1 - Math.abs(e) * 0.2);
        out.blend = true;
      });
    }
    // wind bands: 1 px streaks wrapped round the funnel, bright at the head, fading along the tail; the far half dimmer
    for (let j = 0; j < 58; j++) {
      const R = rng(seed * 3 + 5, j), u = (j + R.range(0.1, 0.9)) / 58, K = R.int(2, 4), span = R.range(0.7, 2.1), lvl = R.next();
      if (u > 0.97) continue;
      const cx = ax(u), cz = az(u), r = rad(u) * R.range(1.0, 1.1), y0 = -u * FH, head = R.range(0, TAU) + (TAU * K * t) / D;
      for (let s = 0; s <= span; s += 0.5 / Math.max(2, r)) {
        const th = head - s, k = s / span, lt = across(th) < 0.2;
        let i = lvl < 0.18 ? 2 : k < 0.15 && lvl > 0.55 ? 7 : k < 0.45 ? (lt ? 6 : 5) : lt ? 5 : 4;
        if (near(th) < 0) i = Math.max(1, i - 2);
        const x = cx + r * Math.cos(th), z = cz + r * Math.sin(th);
        if (k < 0.5) q.dot(x, y0, z, C[i]);
        else q.blend(x, y0, z, C[i], 2 * (1 - k));
      }
      if (lvl > 0.6 && near(head) > 0) {
        const hx = cx + r * Math.cos(head), hz = cz + r * Math.sin(head);
        q.dot(hx, y0, hz, WHITE);
        q.glow(hx, y0, hz, 5, C[6], 0.3);
      }
    }
    // the crown: a lid of cloud sheared into flat bands that ride round with the funnel, thick in the middle and drawn
    // out to a thin tail behind; a dark underside, a lit top
    {
      const r = rad(1), y0 = -FH - 3, Lf = (c) => mix(c, C[7], f * 0.6);
      q.plane(cx1, y0 + 3, cz1, null, r * 0.95, (pu, pv, out) => {
        const d = Math.hypot(pu, pv) / (r * 0.95);
        if (d > 1) return;
        out.c = d < 0.5 ? C[0] : C[1];
        out.a = 0.62 * (1 - d * d * 0.7);
        out.blend = true;
      });
      for (let j = 0; j < 18; j++) {
        const R = rng(seed * 7 + 2, j), rr = r * R.range(0.4, 1.15), K = R.int(1, 2), span = R.range(1.4, 2.8), head = R.range(0, TAU) + (TAU * K * t) / D;
        const th0 = R.range(3.2, 6), lift = R.range(-4, 3) - (1 - rr / (r * 1.15)) * 5;
        for (let s2 = 0; s2 <= span; s2 += 0.6 / rr) {
          const th = head - s2, k = s2 / span, th2 = th0 * Math.sin(Math.PI * Math.pow(1 - k, 0.7)), x = cx1 + rr * Math.cos(th), z = cz1 + rr * Math.sin(th);
          const T = Math.max(1, Math.round(th2)), lt = across(th) < 0.3, dim = near(th) < 0 ? 1 : 0;
          for (let i = 0; i < T; i++) {
            const c = i === 0 ? Lf(C[(lt ? 6 : 5) - dim]) : i === T - 1 && T > 2 ? C[1] : Lf(C[(i === 1 ? 4 : 3) - dim]);
            q.blend(x, y0 + lift - T / 2 + i, z, c, (0.55 + 0.35 * (1 - k)) * (dim ? 0.75 : 1));
          }
        }
      }
      q.plane(cx1, y0 - 3, cz1, null, r * 0.7, (pu, pv, out) => {
        const d = Math.hypot(pu, pv) / (r * 0.7);
        if (d > 1) return;
        out.c = Lf(d < 0.45 ? C[3] : C[4]);
        out.a = 0.4 * (1 - d);
        out.blend = true;
      });
    }
    // leaves, twigs and pebbles spiralling up round it and flung off the top
    cycle(t, D, 24, seed * 11 + 3, (R) => R.range(1.3, 1.95), (age, life, R) => {
      // the first stretch skids in across the floor, then it spirals up and is flung off the top
      const k = age / life, sk = R.range(0.15, 0.3), qq = clamp((k - sk) / (1 - sk)), u = lerp(0.03, 0.98, Math.pow(qq, 0.85));
      const th = R.range(0, TAU) + R.range(2, 3.2) * TAU * k, fling = smooth(0.78, 1, qq), inward = 1 - smooth(0, sk, k), far = R.range(26, 44);
      const rr = lerp(Math.min(68, rad(u) * (1.12 + fling * 1.1) + R.range(2, 7)), far, inward);
      const x = ax(u) + rr * Math.cos(th), z = az(u) + rr * Math.sin(th), y = Math.min(-1, -u * FH - fling * 8);
      const a = Math.min(1, k * 8) * (1 - smooth(0.85, 1, k)), kind = R.next(), spin = R.range(-14, 14) * age, dk = near(th) < 0 ? 1 : 0;
      if (kind < 0.62) {
        const o4 = R.next() < 0.5 ? 0 : 4, b = th + Math.PI / 2 + Math.sin(spin * 0.3) * 0.8, e = Math.sin(spin * 0.5) * 0.9;
        leaf3(q, x, y, z, [Math.cos(b) * Math.cos(e), Math.sin(e), Math.sin(b) * Math.cos(e)], R.range(6, 9), R.range(1.8, 2.6), age * R.range(5, 10), [L[o4], L[o4 + 1], L[o4 + 2 - dk], L[o4 + 3 - dk]], a);
      } else if (kind < 0.8) {
        const b = th + Math.PI / 2 + spin * 0.2, e = Math.sin(spin) * 1.2, dx = Math.cos(b) * Math.cos(e) * 2.5, dy = Math.sin(e) * 2.5, dz = Math.sin(b) * Math.cos(e) * 2.5;
        q.line(x - dx, y - dy, z - dz, x + dx, y + dy, z + dz, dk ? L[0] : L[1], a);
        q.dot(x + dx, y + dy, z + dz, L[2], a);
      } else {
        const s = R.range(1.6, 2.6);
        if (a > 0.5) hull(q, x, y, z, turn(stone3(R, 7, 0.8), axis3(R), spin, s), C.slice(0, 7), { R: s * 1.3, a: 1 });
      }
    });
    // at its foot: dust boiling round and out, grit hopping, scuffs swept round the floor
    const x0 = ax(0), z0 = az(0), puffs = [];
    cycle(t, D, 44, seed * 5 + 1, (R) => R.range(0.7, 1.3), (age, life, R) => {
      const k = age / life, th = R.range(0, TAU) + R.range(5, 9) * age, rr = 4 + k * R.range(14, 28), s = R.range(3, 6) * (0.6 + 0.8 * k);
      puffs.push([x0 + rr * Math.cos(th), -1.5 - k * R.range(4, 16), z0 + rr * Math.sin(th), s, Math.min(1, k * 6) * (1 - k) * 0.6, th]);
    });
    for (const [x, y, z, s, a, th] of q.sort(puffs, (v) => v)) {
      const back = near(th) < 0;
      q.disc(x, y + s * 0.2, z, s, Dst[back ? 1 : 2], a);
      q.disc(x - s * 0.2, y - s * 0.3, z, s * 0.55, Dst[back ? 2 : 3], a * 0.8);
    }
    cycle(t, D, 18, seed * 5 + 8, (R) => R.range(0.35, 0.6), (age, life, R) => {
      const th = R.range(0, TAU), v = R.range(25, 55), y = Math.sin(th * 3) * 2 - R.range(40, 80) * age + 260 * age * age;
      if (y < 0.5) q.dot(x0 + Math.cos(th) * (4 + v * age), Math.min(0, y), z0 + Math.sin(th) * (4 + v * age), R.next() < 0.5 ? Dst[3] : Dst[4], 1 - age / life);
    });
    for (let j = 0; j < 8; j++) {
      const R = rng(seed * 5 + 3, j), rr = R.range(12, 28), th0 = R.range(0, TAU) + (TAU * 3 * t) / D, span = R.range(0.5, 1.1);
      for (let s = 0; s < span; s += 0.6 / rr) q.dot(x0 + rr * Math.cos(th0 - s), 0.5, z0 + rr * Math.sin(th0 - s), Dst[s < span * 0.4 ? 3 : 2], 1 - s / span);
    }
    // light: a soft pale column, a cold pool at its foot, the crown's lightning
    q.glowLine(ax(0.1), -FH * 0.1, az(0.1), cx1, -FH * 0.9, cz1, 26, C[5], 0.08);
    q.glow(x0, -2, z0, 30, Dst[3], 0.12);
    if (f > 0.05) {
      const R = rng(seed, 99, Math.floor((t / D) * 7)), path = bolt(R, -18, -FH - 6, 16, -FH + 2, { jag: 0.3, depth: 3 }), a0 = R.range(0, TAU), ca = Math.cos(a0), sa = Math.sin(a0);
      const pts = path.map(([x, y], i) => [cx1 + x * ca + (i % 2 ? 3 : -3) * sa, y, cz1 + x * sa - (i % 2 ? 3 : -3) * ca]);
      q.polyline(pts, f > 0.6 ? WHITE : C[7], Math.min(1, f * 1.5));
      q.glow(cx1, -FH - 2, cz1, 70, C[7], 0.45 * f);
    }
  },
};
