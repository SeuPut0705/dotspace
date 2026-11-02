// The flame-puff, smoke and ember recipe is adapted from Sprite Fusion's open-source fire
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, mix, hex, clamp, rand, space, WHITE, TAU } from "../../core/index.js";
import { noiseFor, pnoise, hotFirst, flameTongue, firePuff, smokePuff, looped, drift, floorLight, floorGlow, spark3, LAYERS, BACK_LAYERS } from "./_lib.js";

export const meta = {
  name: "Fire tornado",
  desc: "A spinning funnel of fire: spiral bands turning round it, licks flung off its sides, a ring of flame whirling at its foot, embers orbiting it in and out of view.",
  tags: ["fire", "tornado", "vortex", "spell", "aoe", "loop"],
  size: [120, 152],
  origin: [60, 136],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    height: 80,
    seed: 4,
  },
};

const D = meta.duration, NL = noiseFor(D), SMOKE1 = hex("#5b5566"), SPIN = 3; // turns of the surface a loop

export function draw(p, t, o) {
  const F = fit(o.palette, 9), H = hotFirst(F), S = o.seed, HT = o.height, ph = t / D;
  const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), SMOKE = mix(SMOKE1, H[6], 0.25), EMB = [H[1], H[2], H[4], H[6]];
  // the funnel: narrow at the foot, flaring at the top, its spine snaking as it turns
  const cx = (v, tt = t) => 3.2 * Math.sin(v * 4.2 - (tt / D) * TAU * 2) * v + 2 * Math.sin((tt / D) * TAU) * v;
  const rad = (v) => 3.5 + 15 * Math.pow(v, 1.35);
  const spin = (v, tt = t) => (tt / D) * TAU * SPIN + v * 5.5; // the surface turns, twisted up the column

  // embers orbiting: behind the column first, in front after it
  const orbit = [];
  looped(t, D, 30, S + 500, (r) => ({ v0: r.range(0.02, 0.7), rise: r.range(0.12, 0.3), a: r.range(0, TAU), w: r.range(4, 7), out: r.range(4, 12), life: r.range(1.2, 2.4), big: r.chance(0.2) }), (q, age) => {
    const v = q.v0 + q.rise * age, R = rad(Math.min(1, v)) + q.out + age * 4, a = q.a + q.w * age, k = 1 - age / q.life;
    const x = cx(Math.min(1, v), t) + Math.cos(a) * R, y = -v * HT + Math.sin(a) * R * 0.28, z = Math.sin(a);
    orbit.push({ x, y, z, k, vx: -Math.sin(a) * R * q.w, vy: Math.cos(a) * R * q.w * 0.28, big: q.big });
  });
  const embers = (front) => {
    for (const e of orbit) {
      if (e.z >= 0 !== front || e.k <= 0) continue;
      const sp = Math.hypot(e.vx, e.vy) || 1, L = Math.min(5, 1 + sp * 0.025), c = e.k > 0.6 ? EMB[0] : e.k > 0.3 ? EMB[1] : EMB[2];
      p.line(e.x - (e.vx / sp) * L, e.y - (e.vy / sp) * L, e.x, e.y, (u) => (u > 0.6 ? c : front ? EMB[3] : H[7]));
      if (front) p.glow(e.x, e.y, 4, c, 0.4 * e.k);
      else p.glow(e.x, e.y, 3, c, 0.15 * e.k);
    }
  };
  // the ring of flame whirling at the foot: tongues round an ellipse, the far half dimmer
  const ring = (front) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + (t / D) * TAU * 2, z = Math.sin(a);
      if (z >= 0 !== front) continue;
      const n = (S * 3 + i) * 19, R = 12 + 2 * N(2, n), x = Math.cos(a) * R, y = z * R * 0.25, h = (5 + 5 * (0.5 + 0.5 * N(5, n + 1))) * (front ? 1 : 0.8);
      flameTongue(p, x, y, h, 1.6, -Math.cos(a + Math.PI / 2) * 3, N, n, H, front ? LAYERS : BACK_LAYERS);
    }
  };

  // smoke spiralling off the top
  looped(t, D, 20, S + 300, (r) => ({ a: r.range(0, TAU), life: r.range(1.2, 2), s: r.range(2.5, 4), vy: -r.range(12, 22) }), (q, age) => {
    const R = rad(1) * (0.8 + age * 0.5), a = q.a + age * 3, x = cx(1, t - age) + Math.cos(a) * R, y = -HT - 2 + q.vy * age + Math.sin(a) * R * 0.25;
    smokePuff(p, x, y, 1 - age / q.life, q.s, SMOKE);
  });
  floorLight(p, 0, 0.5, 40, 8, GLOW, 0.4);
  embers(false);
  ring(false);

  // the column: each pixel's place round the funnel picks its heat; spiral bands turn up it; licks at its edges
  const fl = 0.85 + 0.15 * N(7, S + 1);
  for (let y = 0; y >= -HT * 1.2; y--) {
    const v = -y / HT, vv = Math.min(1, v), c = cx(vv), r = rad(vv) * (1 + 0.08 * N(3, S + 2, y * 0.1)), sp = spin(v);
    // near the top the funnel comes apart into spiral strands of flame climbing past its rim
    const cut = clamp((v - 0.72) / 0.42);
    const lickL = 0.3 * Math.max(0, pnoise(-y * 0.22 + ph * 18, 18, S + 3)), lickR = 0.3 * Math.max(0, pnoise(-y * 0.22 + ph * 18 + 9, 18, S + 4));
    for (let x = Math.floor(c - r * 1.35); x <= Math.ceil(c + r * 1.35); x++) {
      const dx = (x + 0.5 - c) / r, edge = 1 + (dx < 0 ? lickL : lickR);
      if (Math.abs(dx) > edge) continue;
      const th = Math.asin(clamp(dx, -1, 1)), depth = Math.cos(th), tear = 0.18 * pnoise(y * 0.45 + dx * 2 - ph * 30, 30, S + 6);
      const band = 0.5 + 0.5 * Math.sin((th + sp + tear) * 3), streak = band * band * band;
      if (cut > 0 && band < 0.35 + cut * 0.6 + 0.1 * pnoise(x * 0.7 + ph * 20, 20, S + 5)) continue;
      // a darker body with thin bright streaks spiralling up it, hottest where it faces us, cooling up the column
      let heat = 0.22 + 0.36 * depth + 0.5 * streak - 0.22 * vv + 0.1 * (1 - vv) - 0.25 * cut;
      if (Math.abs(dx) > 1) heat = 0.3 - (Math.abs(dx) - 1) * 1.5;
      heat *= fl;
      const col = heat > 0.95 ? H[0] : heat > 0.82 ? H[1] : heat > 0.7 ? H[2] : heat > 0.58 ? H[3] : heat > 0.46 ? H[4] : heat > 0.34 ? H[5] : heat > 0.2 ? H[6] : H[7];
      p.px(x, y, col);
    }
    if (y % 10 === 0 && v <= 1) p.glow(c, y, r * 2 + 8, GLOW, 0.22 * fl);
  }

  // flame flung off the spinning sides, cooling as it flies, some into smoke
  looped(t, D, 70, S + 200, (r) => ({ v: r.range(0.05, 0.95), side: r.sign(), sp: r.range(20, 50), life: r.range(0.25, 0.5), s: r.range(1.4, 2.8), f: r.next() }), (q, age) => {
    const tb = t - age, x0 = cx(q.v, tb) + q.side * rad(q.v), y0 = -q.v * HT;
    const [x, y] = drift(x0, y0, q.side * q.sp, -q.sp * 0.6, age, 0, -60, 3, 3);
    firePuff(p, x, y, 1 - age / q.life, q.s, q.f, H, 0.1, -q.side * 0.6, -0.8);
  });
  ring(true);
  embers(true);
  // light: the column's own glow and a wash round it
  p.glow(0, -HT * 0.5, 80, GLOW, 0.28 * fl);
  p.glow(0, -6, 18, H[2], 0.3 * fl);
}

const TABLES = new Map(); // value-noise tables that repeat round the funnel, by size and seed

// 3D: a true funnel. The surface is built ring by ring (a circle of radius rad(v) at every height, its centre
// winding up the spine in x and z), the spiral bands run along the world's azimuth so the far side climbs behind
// and the near side in front; licks are flung off tangentially, embers orbit on real circles, smoke spirals off
// the top and the foot's ring of tongues is a true circle on the floor.
export const three = {
  meta: { size: [136, 172], origin: [68, 148], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), F = fit(o.palette, 9), H = hotFirst(F), S = o.seed, HT = o.height, ph = t / D;
    const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
    const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), SMOKE = mix(SMOKE1, H[6], 0.25), EMB = [H[1], H[2], H[4], H[6]];
    // the spine winds up in a helix: the 2D sway in x with its quadrature in z
    const spine = (v, tt = t) => {
      const w = (tt / D) * TAU, f = v * 4.2 - w * 2;
      return [3.2 * Math.sin(f) * v + 2 * Math.sin(w) * v, 3.2 * Math.cos(f) * v + 2 * Math.cos(w) * v];
    };
    const rad = (v) => 3.5 + 15 * Math.pow(v, 1.35);
    const spin = (v, tt = t) => (tt / D) * TAU * SPIN + v * 5.5;
    const fl = 0.85 + 0.15 * N(7, S + 1);

    // the column: a ring of surface points at every height; each point's heat from how it faces the camera and
    // the spiral band it sits in; near the top the funnel comes apart into strands. Only the half of each ring that
    // faces the camera is drawn until the funnel opens up (the far half would be hidden), and the noise comes from
    // tables, since it repeats round the ring.
    const tab = (n, seed) => {
      const key = n * 1e6 + seed;
      let T = TABLES.get(key);
      if (!T) TABLES.set(key, (T = Float64Array.from({ length: n }, (_, i) => rand(i, seed))));
      return T;
    };
    const pn = (T, n, x) => {
      const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = T[((i % n) + n) % n], b = T[(((i + 1) % n) + n) % n];
      return (a + (b - a) * u) * 2 - 1;
    };
    const T18 = tab(18, S + 3), T30 = tab(30, S + 6), T20 = tab(20, S + 5);
    const sy = q.sy, cy = q.cy, cp = q.cp, sp0 = q.sp, zm = q.zoom, ortho = q.dist === Infinity, yaw = q.camera.yaw;
    const ox = q.ax, oy = q.ay, oz = q.az, TOP = -HT * 1.2;
    for (let y = 0; y >= TOP; y--) {
      const v = -y / HT, vv = Math.min(1, v), [sx, sz] = spine(vv), r0 = rad(vv) * (1 + 0.08 * N(3, S + 2, y * 0.1)), sp = spin(v);
      const cut = clamp((v - 0.72) / 0.42), m = Math.ceil(TAU * r0 * 1.1), dth = TAU / m;
      const n = cut > 0 ? m : (m >> 1) + 2, th0 = cut > 0 ? 0 : -yaw - dth; // the half facing the camera: sin(th + yaw) > 0
      const lb = -y * 0.22 + ph * 18, tb = y * 0.45 - ph * 30, cb = y * 0.3 + ph * 20, base = 0.22 - 0.22 * vv + 0.1 * (1 - vv) - 0.25 * cut;
      for (let j = 0; j < n; j++) {
        const th = th0 + j * dth, u = th / TAU, c = Math.cos(th), s = Math.sin(th), face = (c * sy + s * cy) * cp;
        if (face < 0 && cut <= 0) continue;
        const lick = 0.3 * Math.max(0, pn(T18, 18, lb + u * 18)), tear = 0.18 * pn(T30, 30, tb + u * 30);
        const band = 0.5 + 0.5 * Math.sin((th + sp + tear) * 3);
        if (cut > 0 && band < 0.35 + cut * 0.6 + 0.1 * pn(T20, 20, cb + u * 20)) continue;
        let heat = base + 0.36 * Math.max(0, face) + 0.5 * band * band * band;
        if (lick > 0.04) heat = Math.min(heat, 0.34 - lick * 0.5);
        heat *= fl;
        const col = heat > 0.95 ? H[0] : heat > 0.82 ? H[1] : heat > 0.7 ? H[2] : heat > 0.58 ? H[3] : heat > 0.46 ? H[4] : heat > 0.34 ? H[5] : heat > 0.2 ? H[6] : H[7];
        const R = r0 * (1 + lick), X = sx + c * R, Z = sz + s * R;
        if (ortho) {
          // q.px with the orthographic projection written out
          const wx = X + ox, wy = y + oy, wz = Z + oz, vz = wx * sy + wz * cy, z0 = p.z;
          p.z = -(vz * cp - wy * sp0);
          p.px((wx * cy - wz * sy) * zm, (wy * cp + vz * sp0) * zm, col);
          p.z = z0;
        } else q.px(X, y, Z, col);
      }
    }

    // the ring of flame whirling at the foot: tongues round a true circle, the far half a step cooler
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + (t / D) * TAU * 2, n = (S * 3 + i) * 19, R = 14 + 2 * N(2, n), x = Math.cos(a) * R, z = Math.sin(a) * R;
      const behind = q.toward(x, 0, z) < -1.5, h = (6 + 6 * (0.5 + 0.5 * N(5, n + 1))) * (behind ? 0.8 : 1);
      const sw = q.view(-Math.sin(a), 0, Math.cos(a))[0] * 3;
      q.at(x, 0, z, (pp) => flameTongue(pp, 0, 0, h, 1.9, sw, N, n, H, behind ? BACK_LAYERS : LAYERS));
    }

    // flame flung off the spinning sides, tangentially, cooling as it flies
    looped(t, D, 70, S + 200, (r) => ({ v: r.range(0.05, 0.95), a: r.range(0, TAU), sp: r.range(20, 50), life: r.range(0.25, 0.5), s: r.range(1.4, 2.8), f: r.next() }), (e, age) => {
      const tb = t - age, [sx, sz] = spine(e.v, tb), R = rad(e.v), ca = Math.cos(e.a), sa = Math.sin(e.a);
      const vx = ca * e.sp * 0.45 - sa * e.sp * 0.95, vz = sa * e.sp * 0.45 + ca * e.sp * 0.95;
      const [x, y] = drift(sx + ca * R, -e.v * HT, vx, -e.sp * 0.6, age, 0, -60, 3, 3), [z] = drift(sz + sa * R, 0, vz, 0, age, 0, 0, 3, 3);
      const l = Math.hypot(vx, vz) || 1, tx = (-q.view(vx, 0, vz)[0] / l) * 0.6;
      q.at(x, y, z, (pp) => firePuff(pp, 0, 0, 1 - age / e.life, e.s, e.f, H, 0.1, tx, -0.8));
    });

    // embers in true orbits round the column (x = cos, z = sin), speeding off as streaks
    looped(t, D, 30, S + 500, (r) => ({ v0: r.range(0.02, 0.7), rise: r.range(0.12, 0.3), a: r.range(0, TAU), w: r.range(4, 7), out: r.range(4, 12), life: r.range(1.2, 2.4) }), (e, age) => {
      const v = e.v0 + e.rise * age, R = rad(Math.min(1, v)) + e.out + age * 4, a = e.a + e.w * age, k = 1 - age / e.life, [sx, sz] = spine(Math.min(1, v), t);
      spark3(q, sx + Math.cos(a) * R, -v * HT, sz + Math.sin(a) * R, -Math.sin(a) * R * e.w, 0, Math.cos(a) * R * e.w, k, EMB);
    });

    // light: the column's own glow, a wash round it, a pool on the floor
    for (let y = 0; y >= -HT; y -= 10) {
      const v = -y / HT, [sx, sz] = spine(v);
      q.glow(sx, y, sz, rad(v) * 2 + 8, GLOW, 0.22 * fl);
    }
    q.glow(0, -HT * 0.5, 0, 80, GLOW, 0.28 * fl);
    q.glow(0, -6, 0, 18, H[2], 0.3 * fl);
    floorGlow(q, 0, 0, 40, GLOW, 0.4);
    q.ring(0, 0, 0, 14.5, 2.5, H[4], 0.3);

    // smoke spiralling off the top: many overlapping puffs that swell and thin into one soft plume, far to near
    const smoke = [];
    looped(t, D, 40, S + 300, (r) => ({ a: r.range(0, TAU), life: r.range(1.3, 2.1), s: r.range(3, 5.5), vy: -r.range(12, 22), j: r.range(0.6, 1.25) }), (e, age) => {
      const R = rad(1) * (0.5 + age * 0.7) * e.j, a = e.a + age * 3, [sx, sz] = spine(1, t - age);
      smoke.push([sx + Math.cos(a) * R, -HT - 2 + e.vy * age, sz + Math.sin(a) * R, 1 - age / e.life, e.s]);
    });
    for (const [x, y, z, k, s] of q.sort(smoke, (e) => e)) q.at(x, y, z, (pp) => smokePuff(pp, 0, 0, k, s, SMOKE, true, 0.55));
  },
};
