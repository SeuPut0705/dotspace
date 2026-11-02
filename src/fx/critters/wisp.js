// The flame tail, puffs and embers are adapted from Sprite Fusion's open-source fire
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, wrap, lerp, cycle, fly, space, P, TAU } from "../../core/index.js";
import { Swarm, shift, lnoise, tongue, firePuff, shadow, floorShadow, floorPool } from "./_lib.js";

export const meta = {
  name: "Wisp",
  desc: "A will-o'-the-wisp loops a figure-eight over the floor: a little soul-flame with a face, its flame tail licking up and streaming behind, shedding puffs and sparks.",
  tags: ["critter", "wisp", "spirit", "flame", "magic", "flying", "loop"],
  size: [128, 104],
  origin: [64, 96],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#0a1f2e", "#0f3d52", "#14707e", "#1fa8a8", "#4fe0c8", "#a8fff0", "#ffffff"], hover: 36, seed: 1 },
};

const D = meta.duration, SWARM = new Swarm();
function at(t, hover) {
  const a = (t / D) * TAU;
  return { x: 34 * Math.sin(a), y: -hover - 10 * Math.sin(2 * a), vx: ((34 * TAU) / D) * Math.cos(a), vy: ((-20 * TAU) / D) * Math.cos(2 * a) };
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), S = at(t, o.hover);
  const heat = [C[6], C[6], C[5], C[5], C[4], C[4], C[3], C[3], C[3]];
  const lean = clamp(-S.vx / 80, -0.9, 0.9), stretch = clamp(S.vy / 120, -0.3, 0.4), X = S.x, Y = S.y;
  // flame puffs shed along its path, cooling down the ramp as they drift up
  cycle(t, D, 30, o.seed * 7 + 1, (r) => r.range(0.3, 0.6), (age, L, r) => {
    const S0 = at(wrap(t - age, D), o.hover), [x, y] = fly(S0.x + r.range(-3, 3), S0.y - r.range(0, 4), r.range(-8, 8), -r.range(6, 16), age, -40, 2.5);
    firePuff(p, x, y, 1 - age / L, r.range(1.2, 2.6), r.next() * 100, heat);
  });
  // the tail: three tongues off the top of its head, streaming back as it flies
  const tails = [[-3.5, 13, 2.5, 3], [3.5, 14, 2.5, 7], [0, 20, 3.2, 11]];
  for (let li = 0; li < 4; li++)
    for (const [dx, h, w, n] of tails) {
      const hh = (h + 0.25 * h * lnoise(t, D, 9, n, 5)) * (1 + stretch);
      tongue(p, X + dx, Y - 2, hh, w, lnoise(t, D, 6, n, 40) * 1.5 + lean * hh * 0.9, t, D, n, heat, li);
    }
  // the head: a ball of cold fire, white at the heart, its rim flickering
  const R = 7.5;
  p.shade(X - R - 2, Y - R - 2, X + R + 2, Y + R + 2, (x, y, out) => {
    const dx = x - X, dy = y - Y, ang = Math.atan2(dy, dx), rr = R + 0.7 * lnoise(t, D, 16, ang * 1.6 + 10, 3) + (dy > 0 ? -0.6 : 0);
    const d = Math.hypot(dx, dy) / rr;
    if (d > 1) return 0;
    return d < 0.42 ? C[6] : d < 0.68 ? C[5] : d < 0.88 ? C[4] : C[3];
  });
  // its face: eyes looking where it's going, a blink, a little mouth
  const look = Math.round(clamp(S.vx / 60, -1, 1)), blink = wrap(t, D) > 2.2 && wrap(t, D) < 2.28;
  for (const s of [-1, 1]) {
    const ex = Math.round(X) + s * 2 - (s > 0 ? 0 : 1) + look, ey = Math.round(Y) - 1;
    if (blink) p.px(ex, ey + 1, C[1]), p.px(ex + 1, ey + 1, C[1]);
    else {
      for (let k = 0; k < 3; k++) p.px(ex, ey + k, C[1]), p.px(ex + 1, ey + k, C[1]);
      p.px(ex + (look > 0 ? 1 : 0), ey, C[6]);
    }
  }
  p.px(Math.round(X) + look, Math.round(Y) + 3, C[2]); p.px(Math.round(X) - 1 + look, Math.round(Y) + 3, C[2]);
  // sparks wander up off it
  const sw = SWARM.begin(t);
  sw.ps.sparks = [C[6], C[5], C[4], C[3]];
  cycle(t, D, 26, o.seed * 7 + 2, (r) => r.range(0.8, 1.6), (age, L, r) => {
    const S0 = at(wrap(t - age, D), o.hover), s = r.next() * 100, [x, y] = fly(S0.x + r.range(-5, 5), S0.y - r.range(4, 12), r.range(-20, 20), -r.range(20, 45), age, -15, 1.6);
    sw.add(P.EMBER, x + Math.sin(age * 2.3 + s) * 3 * Math.min(1, age), y, 0, 0, age, L, C[4], r.chance(0.3) ? 2 : 1, 0, s);
  });
  sw.draw(p);
  // light: a cold glow round it, a hot heart
  const fl = 0.85 + 0.15 * lnoise(t, D, 22, 0, 9);
  p.glow(X + lean * 3, Y - 6, 46 * fl, C[4], 0.38);
  p.glow(X, Y - 1, 13, C[5], 0.35 * fl);
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed), C = fit(o.palette, 7), S = at(t, o.hover), near = clamp(1 - (-S.y - 24) / 30);
  // the floor lit cold beneath it, brighter as it dips
  shadow(p, S.x, 0, 7, 1.2, C[0], 0.4);
  for (let x = -24; x <= 24; x += 6) p.glow(S.x + x, -1, 16, C[4], (0.08 + 0.1 * near) * (1 - Math.abs(x) / 32));
}

// ---- 3D: it loops a wide dipping circuit through the air, its flame an upright billboard (it burns the same from
// every side) with a ribbon of light, wound by a helix of cold fire, streaming along the path behind it
function at3(t, hover) {
  const a = (t / D) * TAU, r = 28 + 8 * Math.sin(2 * a + 1);
  return { x: r * Math.sin(a), z: r * Math.cos(a), y: -hover - 10 * Math.sin(2 * a) };
}

export const three = {
  meta: { size: [176, 156], origin: [88, 124], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, time, o) {
    const t = shift(time, D, o.seed), C = fit(o.palette, 7), q = space(p, o), S = at3(t, o.hover), ph = (t / D) * TAU;
    const heat = [C[6], C[6], C[5], C[5], C[4], C[4], C[3], C[3], C[3]];
    // its velocity, and how it runs across the screen from this camera: the flame leans and the eyes look that way
    const e = 0.01, A = at3(t + e, o.hover), B = at3(t - e, o.hover);
    const vx = (A.x - B.x) / (2 * e), vy = (A.y - B.y) / (2 * e), vz = (A.z - B.z) / (2 * e), sx = vx * q.cy - vz * q.sy;
    const lean = clamp(-sx / 80, -0.9, 0.9), stretch = clamp(vy / 120, -0.3, 0.4);

    // the floor lit cold beneath it, brighter as it dips, and along the way it has been
    const near = clamp(1 - (-S.y - 24) / 30);
    floorShadow(q, S.x, S.z, 7, C[0], 0.4);
    floorPool(q, S.x, S.z, 30, C[4], 0.14 + 0.16 * near);
    for (let k = 1; k <= 5; k++) {
      const P0 = at3(t - k * 0.12, o.hover);
      floorPool(q, P0.x, P0.z, 18, C[3], 0.1 * (1 - k / 6));
    }

    // the ribbon: a tapering beam of light along the path it flew, and two strands of cold sparks winding round it
    const N = 30, STEP = 0.03, trail = [];
    for (let k = 0; k <= N; k++) trail.push(at3(t - k * STEP, o.hover));
    const ribbon = () => {
      for (let k = 1; k <= N; k++) {
        const a0 = trail[k - 1], b0 = trail[k], u = 1 - k / (N + 1);
        q.glowLine(a0.x, a0.y - 2, a0.z, b0.x, b0.y - 2, b0.z, 5 + 5 * u, C[4], 0.2 * u);
        q.beam(a0.x, a0.y - 2, a0.z, b0.x, b0.y - 2, b0.z, 0.8 + 3 * u ** 0.8, u > 0.6 ? C[5] : u > 0.3 ? C[4] : C[3], u > 0.45 ? 1 : 1.6 * u ** 0.7);
      }
      for (let s = 0; s < 2; s++)
        for (let k = 1; k <= N; k++) {
          const P0 = trail[k], Q0 = trail[Math.min(N, k + 1)], u = 1 - k / (N + 1);
          let tx = P0.x - Q0.x, tz = P0.z - Q0.z;
          const L = Math.hypot(tx, tz) || 1;
          tx /= L; tz /= L;
          const f = k * 0.55 - ph * 3 + s * Math.PI, w = 2 + 3.6 * Math.min(1, k / 6) * u, c = Math.cos(f) * w, d = Math.sin(f) * w;
          q.dot(P0.x - tz * c, P0.y - 2 + d, P0.z + tx * c, u > 0.5 ? C[6] : C[5], 0.9 * u);
        }
    };

    // far to near: the flame puffs it sheds along its path, and the flame itself
    const items = [];
    cycle(t, D, 30, o.seed * 7 + 1, (r) => r.range(0.3, 0.6), (age, L, r) => {
      const S0 = at3(wrap(t - age, D), o.hover), ox = r.range(-3, 3), oy = r.range(0, 4), vx0 = r.range(-8, 8), vy0 = -r.range(6, 16), size = r.range(1.2, 2.6), seed = r.next() * 100;
      const oz = r.range(-3, 3), vz0 = r.range(-8, 8);
      const [x, y] = fly(S0.x + ox, S0.y - oy, vx0, vy0, age, -40, 2.5), z = fly(S0.z + oz, 0, vz0, 0, age, 0, 2.5)[0], k = 1 - age / L;
      items.push({ x, y, z, fn: () => q.at(x, y, z, (pp) => firePuff(pp, 0, 0, k, size, seed, heat)) });
    });
    items.push({
      x: S.x, y: S.y, z: S.z,
      fn: () => q.at(S.x, S.y, S.z, (pp) => {
        // the tail: three tongues off the top of its head, streaming back as it flies
        const tails = [[-3.5, 13, 2.5, 3], [3.5, 14, 2.5, 7], [0, 20, 3.2, 11]];
        for (let li = 0; li < 4; li++)
          for (const [dx, h, w, n] of tails) {
            const hh = (h + 0.25 * h * lnoise(t, D, 9, n, 5)) * (1 + stretch);
            tongue(pp, dx, -2, hh, w, lnoise(t, D, 6, n, 40) * 1.5 + lean * hh * 0.9, t, D, n, heat, li);
          }
        // the head: a ball of cold fire, white at the heart, its rim flickering
        const R = 7.5;
        pp.shade(-R - 2, -R - 2, R + 2, R + 2, (x, y, out) => {
          const ang = Math.atan2(y, x), rr = R + 0.7 * lnoise(t, D, 16, ang * 1.6 + 10, 3) + (y > 0 ? -0.6 : 0);
          const d = Math.hypot(x, y) / rr;
          if (d > 1) return 0;
          return d < 0.42 ? C[6] : d < 0.68 ? C[5] : d < 0.88 ? C[4] : C[3];
        });
        // its face: eyes looking where it's going, a blink, a little mouth
        const look = Math.round(clamp(sx / 60, -1, 1)), blink = wrap(t, D) > 2.2 && wrap(t, D) < 2.28;
        for (const s of [-1, 1]) {
          const ex = s * 2 - (s > 0 ? 0 : 1) + look, ey = -1;
          if (blink) pp.px(ex, ey + 1, C[1]), pp.px(ex + 1, ey + 1, C[1]);
          else {
            for (let k = 0; k < 3; k++) pp.px(ex, ey + k, C[1]), pp.px(ex + 1, ey + k, C[1]);
            pp.px(ex + (look > 0 ? 1 : 0), ey, C[6]);
          }
        }
        pp.px(look, 3, C[2]); pp.px(look - 1, 3, C[2]);
      }),
    });
    for (const it of q.sort(items, (it) => [it.x, it.y, it.z])) it.fn();
    ribbon();

    // sparks wander up off it, out in every direction
    const sw = SWARM.begin(t);
    sw.ps.sparks = [C[6], C[5], C[4], C[3]];
    cycle(t, D, 26, o.seed * 7 + 2, (r) => r.range(0.8, 1.6), (age, L, r) => {
      const S0 = at3(wrap(t - age, D), o.hover), s = r.next() * 100, ox = r.range(-5, 5), oy = r.range(4, 12), ang = r.range(0, TAU), sp = r.range(0, 20), vy0 = -r.range(20, 45), oz = r.range(-5, 5);
      const [x, y] = fly(S0.x + ox, S0.y - oy, Math.cos(ang) * sp, vy0, age, -15, 1.6), z = fly(S0.z + oz, 0, Math.sin(ang) * sp, 0, age, 0, 1.6)[0];
      sw.add3(P.EMBER, x + Math.sin(age * 2.3 + s) * 3 * Math.min(1, age), y, z + Math.cos(age * 2.1 + s) * 3 * Math.min(1, age), 0, 0, 0, age, L, C[4], r.chance(0.3) ? 2 : 1, 0, s);
    });
    sw.draw(q);

    // light: a cold glow round it, a hot heart
    const fl = 0.85 + 0.15 * lnoise(t, D, 22, 0, 9);
    q.glow(S.x + lean * 3, S.y - 6, S.z, 46 * fl, C[4], 0.38);
    q.glow(S.x, S.y - 1, S.z, 13, C[5], 0.35 * fl);
  },
};
