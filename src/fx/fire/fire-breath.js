// The flame-puff, smoke and spark recipe is adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, mix, hex, clamp, space, TAU, WHITE } from "../../core/index.js";
import { noiseFor, hotFirst, flameBlade, flameTongue, firePuff, smokePuff, spark, ember, drift, looped, LAYERS, BACK_LAYERS, floorGlow, spark3, drift3, flameBlade3 } from "./_lib.js";

export const meta = {
  name: "Fire breath",
  desc: "A roaring cone of fire streaming right from the mouth: white-hot at the lips, billowing out and cooling to red and smoke at its edges, sparks thrown out ahead.",
  tags: ["fire", "breath", "dragon", "stream", "cone", "directional", "loop"],
  size: [160, 116],
  origin: [12, 72],
  duration: 1.5,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    spread: 0.24,
    speed: 320,
    seed: 6,
  },
};

const D = meta.duration, NL = noiseFor(D), SMOKE1 = hex("#5b5566");
// the dying licks: red and deep orange, no white heart
const COOL_LAYERS = [[1, 1, 7], [0.72, 0.82, 6], [0.44, 0.58, 5]];
// the jet at the lips: [length, half-width, angle]
const JET = [[42, 4.2, 0], [32, 3.8, -0.08], [30, 3.8, 0.08], [20, 4.6, 0]];

export function draw(p, t, o) {
  const F = fit(o.palette, 9), H = hotFirst(F), S = o.seed, A = o.spread, V = o.speed;
  const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), SMOKE = mix(SMOKE1, H[6], 0.3), SPARKS = [H[1], H[2], H[4], H[5]], EMB = [H[1], H[2], H[4], H[6]];
  // the roar: the stream surges and the cone sways a little
  const roar = (tt) => 0.85 + 0.15 * NL(tt, 3, S + 1), sway = (tt) => NL(tt, 1.3, S + 2) * 0.05;

  // the cone: puffs of flame blown out of the mouth that slow, swell, rise and cool; those near the edges
  // cool first, and many burn out into rolling smoke
  const fire = [], smoke = [];
  looped(t, D, 260, S + 100, (r) => {
    const e = r.range(-1, 1), fl = r.range(0.42, 0.8) * (1 - 0.3 * Math.abs(e)), sm = r.chance(0.2 + 0.4 * Math.abs(e));
    return { e, sp: r.range(0.75, 1.1), fl, sm, sl: r.range(0.5, 0.85), s: r.range(3, 5.2), f: r.next(), ox: r.range(4, 10), life: fl + (sm ? 0.85 : 0) };
  }, (q, age) => {
    const tb = t - age, a = q.e * A + sway(tb) - 0.04, v = V * q.sp * roar(tb);
    const ta = Math.min(age, q.fl), [x, y, vx, vy] = drift(q.ox, q.e * 1.5, Math.cos(a) * v, Math.sin(a) * v, ta, 0, -100, 2, 2.4);
    if (age < q.fl) return fire.push([age, x, y, q]);
    if (!q.sm || age - q.fl > q.sl) return;
    const sa = age - q.fl, [sx, sy] = drift(x, y, vx * 0.5, vy * 0.6 - 8, sa, 0, -26, 1.8, 1.2);
    smoke.push([sa, sx, sy, q]);
  });
  for (const [sa, x, y, q] of smoke) smokePuff(p, x, y, 1 - sa / q.sl, q.s * 1.1, SMOKE, true, 0.7);
  fire.sort((a, b) => b[0] - a[0]);
  for (const [age, x, y, q] of fire) {
    const u = age / q.fl, edge = Math.abs(q.e), size = q.s * (0.75 + 1.6 * u);
    // the heart of the stream stays hot longer than its edges
    const heat = Math.min(0.999, Math.pow(u, 1.5) * (0.85 + 0.2 * edge) + 0.3 * edge * edge);
    // near the mouth the fire rolls in round billows; further out each billow tears into a tongue licking up
    // and back, thinning to a lick as it cools, before the smoke takes it
    const tear = clamp((u - 0.32) / 0.2);
    firePuff(p, x, y, 1 - heat, size * (1 - 0.55 * tear), q.f, H, 0.1, -0.5, -0.86);
    if (tear > 0) {
      const n = Math.floor(q.f * 1e5), h = size * (1.5 + 0.5 * N(4, n)) * (1.2 - heat * 0.6) * tear;
      flameTongue(p, x, y + size * 0.3, h, size * 0.5 * (1.1 - heat * 0.5), -h * 0.4 + N(2.5, n + 1) * 2, N, n, H, heat < 0.45 ? LAYERS : heat < 0.72 ? BACK_LAYERS : COOL_LAYERS);
    }
  }
  // licks curling off the edges of the cone
  for (let i = 0; i < 6; i++) {
    const n = (S * 3 + i) * 19, side = i % 2 ? 1 : -1, d = 18 + (i >> 1) * 16 + N(2, n) * 4, L = (9 + 5 * (0.5 + 0.5 * N(5, n + 1))) * (1 - d / 120);
    const ex = d, ey = side * d * A * 0.85 - d * 0.06;
    flameBlade(p, ex, ey, 0.75, side * 0.45 - 0.48, L, 1.6 + L * 0.08, -side * 3, N, n, H, LAYERS);
  }
  // the roar: bright streaks racing out through the heart of the cone
  looped(t, D, 70, S + 250, (r) => ({ e: r.range(-0.6, 0.6), v: r.range(330, 470), life: r.range(0.12, 0.26), l: r.range(4, 9) }), (q, age) => {
    const a = q.e * A - 0.03, [x, y, vx, vy] = drift(6, q.e * 2, Math.cos(a) * q.v, Math.sin(a) * q.v, age, 0, -60, 2, 2);
    const sp = Math.hypot(vx, vy), k = 1 - age / q.life, L = q.l * (sp / 400);
    p.line(x - (vx / sp) * L, y - (vy / sp) * L, x, y, (u) => (u > 0.6 ? (k > 0.5 ? H[0] : H[1]) : k > 0.5 ? H[2] : H[3]));
  });
  // the jet at the lips: white-hot, overlapping tongues that flutter as the breath roars
  JET.forEach(([len, w, a], i) => {
    const n = (S * 5 + i) * 17, L = len * roar(t) * (0.85 + 0.2 * N(5, n)), aa = a + sway(t);
    flameBlade(p, 0, 0, Math.cos(aa), Math.sin(aa), L, w, N(3, n + 3) * 3, N, n, H, LAYERS, 0.5, 1.5);
  });

  // sparks flung out ahead and falling; embers lifting off the far end
  looped(t, D, 40, S + 300, (r) => ({ d: r.range(4, 60), e: r.range(-1, 1), v: r.range(140, 280), life: r.range(0.25, 0.55) }), (q, age) => {
    const a = q.e * A * 1.8 - 0.12, [x, y, vx, vy] = drift(q.d, q.e * q.d * A, Math.cos(a) * q.v, Math.sin(a) * q.v - 30, age, 0, 190, 2, 2);
    spark(p, x, y, vx, vy, 1 - age / q.life, SPARKS);
  });
  looped(t, D, 18, S + 400, (r) => ({ x: r.range(50, 100), y: r.range(-14, 6), vx: r.range(10, 40), vy: -r.range(20, 50), life: r.range(0.8, 1.4), s: r.chance(0.2) ? 2 : 1, ph: r.range(0, 6.3) }), (q, age) => {
    const [x, y] = drift(q.x, q.y, q.vx, q.vy, age, 0, -30, 1.6, 1.6);
    ember(p, x + 5 * (Math.sin(age * 2.3 + q.ph) - Math.sin(q.ph)), y, 1 - age / q.life, q.s, EMB, age * 40 + q.ph);
  });

  // light: a flare at the lips, light all along the cone widening with it, a broad halo
  const k = roar(t);
  p.glow(3, 0, 34 * k, GLOW, 0.75 * k);
  p.glow(3, 0, 10, H[0], 0.55);
  for (let d = 10; d < 126; d += 8) p.glow(d, -d * 0.1, 10 + d * 0.2, GLOW, 0.32 * k * (1 - d / 150));
  p.glow(64, -12, 96, GLOW, 0.16 * k);
}

// 3D: the same breath as a true cone. Every puff keeps its e, but e is now how far out it sits in the cone's cross
// section and each puff has its own azimuth round the axis, so the cone is a solid: round billows and tongues
// (upright billboards), licks and the jet as blades winding round it, streaks and sparks thrown out in a cone.
const MY = -24; // the mouth, above the floor
// the jet's tongues round the axis: [azimuth, tilt off the axis]
const JET3 = [[0, 0], [1.0, 0.1], [3.4, 0.1], [5.3, 0.1], [2.2, 0.12], [4.3, 0.12]];

export const three = {
  meta: { size: [320, 180], origin: [160, 140], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), F = fit(o.palette, 9), H = hotFirst(F), S = o.seed, A = o.spread, V = o.speed;
    const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
    const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), SMOKE = mix(SMOKE1, H[6], 0.3), SPARKS = [H[1], H[2], H[4], H[5]], EMB = [H[1], H[2], H[4], H[6]];
    const roar = (tt) => 0.85 + 0.15 * NL(tt, 3, S + 1), sway = (tt) => NL(tt, 1.3, S + 2) * 0.05, swayZ = (tt) => NL(tt, 1.1, S + 8) * 0.05;
    // the direction a thing leaves the mouth: the cone angle for its place in the cross section, turned round the
    // axis by its azimuth, plus the breath's sway (up and sideways)
    const dir = (rho, az, tb, lift = 0.04, spread = 1) => {
      const a = rho * A * spread, s = Math.sin(a);
      return [Math.cos(a), s * Math.sin(az) + Math.sin(sway(tb) - lift), s * Math.cos(az) + Math.sin(swayZ(tb))];
    };

    const fire = [], smoke = [];
    looped(t, D, 260, S + 100, (r) => {
      const e = r.range(-1, 1), fl = r.range(0.42, 0.8) * (1 - 0.3 * Math.abs(e)), sm = r.chance(0.2 + 0.4 * Math.abs(e));
      return { e, sp: r.range(0.75, 1.1), fl, sm, sl: r.range(0.5, 0.85), s: r.range(3, 5.2), f: r.next(), ox: r.range(4, 10), az: r.range(0, TAU), life: fl + (sm ? 0.85 : 0) };
    }, (c, age) => {
      const tb = t - age, rho = Math.sqrt(Math.abs(c.e)), [dx, dy, dz] = dir(rho, c.az, tb), v = V * c.sp * roar(tb), ta = Math.min(age, c.fl);
      const [x, y, z, vx, vy, vz] = drift3([c.ox, MY + Math.sin(c.az) * rho * 1.5, Math.cos(c.az) * rho * 1.5], [dx * v, dy * v, dz * v], ta, [0, -100, 0], 2, 2.4);
      if (age < c.fl) return fire.push([age, x, y, z, c]);
      if (!c.sm || age - c.fl > c.sl) return;
      const sa = age - c.fl, [sx, sy, sz] = drift3([x, y, z], [vx * 0.5, vy * 0.6 - 8, vz * 0.5], sa, [0, -26, 0], 1.8, 1.2);
      smoke.push([sa, sx, sy, sz, c]);
    });

    // the billows and the tongues torn off them, nearest first (they are opaque and write depth)
    const near = fire.map((f) => [q.depth(f[1], f[2], f[3]), f]).sort((a, b) => a[0] - b[0]);
    for (const [, [age, x, y, z, c]] of near) {
      const u = age / c.fl, edge = Math.abs(c.e), size = c.s * (0.75 + 1.6 * u);
      const heat = Math.min(0.999, Math.pow(u, 1.5) * (0.85 + 0.2 * edge) + 0.3 * edge * edge), tear = clamp((u - 0.32) / 0.2);
      q.at(x, y, z, (pp) => {
        firePuff(pp, 0, 0, 1 - heat, size * (1 - 0.55 * tear), c.f, H, 0.1, -0.5, -0.86);
        if (tear > 0) {
          const n = Math.floor(c.f * 1e5), h = size * (1.5 + 0.5 * N(4, n)) * (1.2 - heat * 0.6) * tear;
          const sx = q.view(-h * 0.4 + N(2.5, n + 1) * 2, 0, N(2.1, n + 2) * 2)[0];
          flameTongue(pp, 0, size * 0.3, h, size * 0.5 * (1.1 - heat * 0.5), sx, N, n, H, heat < 0.45 ? LAYERS : heat < 0.72 ? BACK_LAYERS : COOL_LAYERS);
        }
      });
    }
    // licks winding round the cone: each lies along the outside of it, pointing out and on, swept round the axis
    for (let i = 0; i < 8; i++) {
      const n = (S * 3 + i) * 19, side = i % 2 ? 1 : -1, d = 18 + (i >> 1) * 15 + N(2, n) * 4, L = (9 + 5 * (0.5 + 0.5 * N(5, n + 1))) * (1 - d / 120);
      const az = (i / 8) * TAU + 0.4 + N(1.5, n + 2) * 0.3, sa = Math.sin(az), ca = Math.cos(az), rad = d * A * 0.85;
      flameBlade3(q, d, MY + sa * rad - d * 0.06, ca * rad, 0.75, -0.48 + 0.45 * sa, 0.45 * ca, L, 1.6 + L * 0.08, [0, side * 3 * ca, -side * 3 * sa], N, n, H, LAYERS);
    }
    // streaks racing through the heart of the cone
    looped(t, D, 70, S + 250, (r) => ({ e: r.range(-0.6, 0.6), v: r.range(330, 470), life: r.range(0.12, 0.26), l: r.range(4, 9), az: r.range(0, TAU) }), (c, age) => {
      const rho = Math.sqrt(Math.abs(c.e)), sa = Math.sin(c.az), ca = Math.cos(c.az), [dx, dy, dz] = dir(rho, c.az, t - age, 0.03);
      const [x, y, z, vx, vy, vz] = drift3([6, MY + sa * rho * 2, ca * rho * 2], [dx * c.v, dy * c.v, dz * c.v], age, [0, -60, 0], 2, 2);
      const sp = Math.hypot(vx, vy, vz), k = 1 - age / c.life, L = c.l * (sp / 400) / sp;
      q.line(x - vx * L, y - vy * L, z - vz * L, x, y, z, (u) => (u > 0.6 ? (k > 0.5 ? H[0] : H[1]) : k > 0.5 ? H[2] : H[3]));
    });
    // the jet at the lips: white-hot tongues overlapping round the axis
    JET.concat([[26, 3.6, 0], [24, 3.6, 0]]).forEach(([len, w], i) => {
      const n = (S * 5 + i) * 17, L = len * roar(t) * (0.85 + 0.2 * N(5, n)), [az, tilt] = JET3[i];
      const sa = Math.sin(az), ca = Math.cos(az), [dx, dy, dz] = [Math.cos(tilt), Math.sin(tilt) * sa + Math.sin(sway(t)), Math.sin(tilt) * ca + Math.sin(swayZ(t))];
      flameBlade3(q, 0.5, MY + sa * 1.4, ca * 1.4, dx, dy, dz, L, w, [0, N(3, n + 3) * 3, N(2.6, n + 4) * 3], N, n, H, LAYERS, 0.5, 1.5);
    });

    // sparks flung out ahead and falling; embers lifting off the far end
    looped(t, D, 40, S + 300, (r) => ({ d: r.range(4, 60), e: r.range(-1, 1), v: r.range(140, 280), life: r.range(0.25, 0.55), az: r.range(0, TAU) }), (c, age) => {
      const rho = Math.sqrt(Math.abs(c.e)), sa = Math.sin(c.az), ca = Math.cos(c.az), [dx, dy, dz] = dir(rho, c.az, t - age, 0.12, 1.8);
      const [x, y, z, vx, vy, vz] = drift3([c.d, MY + sa * rho * c.d * A, ca * rho * c.d * A], [dx * c.v, dy * c.v - 30, dz * c.v], age, [0, 190, 0], 2, 2);
      if (y < -0.5) spark3(q, x, y, z, vx, vy, vz, 1 - age / c.life, SPARKS);
    });
    looped(t, D, 18, S + 400, (r) => ({ x: r.range(50, 100), y: r.range(-14, 6), z: r.range(-16, 16), vx: r.range(10, 40), vy: -r.range(20, 50), vz: r.range(-14, 14), life: r.range(0.8, 1.4), s: r.chance(0.2) ? 2 : 1, ph: r.range(0, 6.3) }), (c, age) => {
      const [x, y, z] = drift3([c.x, MY + c.y, c.z], [c.vx, c.vy, c.vz], age, [0, -30, 0], 1.6, 1.6);
      q.at(x + 5 * (Math.sin(age * 2.3 + c.ph) - Math.sin(c.ph)), y, z + 5 * (Math.cos(age * 2.1 + c.ph) - Math.cos(c.ph)), (pp) => ember(pp, 0, 0, 1 - age / c.life, c.s, EMB, age * 40 + c.ph));
    });

    // light: a flare at the lips, light all along the cone widening with it, a broad halo, a pool on the floor
    const k = roar(t);
    q.glow(3, MY, 0, 34 * k, GLOW, 0.75 * k);
    q.glow(3, MY, 0, 10, H[0], 0.55);
    for (let d = 10; d < 126; d += 8) q.glow(d, MY - d * 0.1, 0, 10 + d * 0.2, GLOW, 0.32 * k * (1 - d / 150));
    q.glow(64, MY - 12, 0, 96, GLOW, 0.16 * k);
    floorGlow(q, 55, 0, 80, GLOW, 0.26 * k);

    // smoke rolling off the cone, far to near, over everything
    for (const [sa, x, y, z, c] of q.sort(smoke, (e) => [e[1], e[2], e[3]])) q.at(x, y, z, (pp) => smokePuff(pp, 0, 0, 1 - sa / c.sl, c.s * 1.1, SMOKE, true, 0.7));
  },
};
