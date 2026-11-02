// The flame-puff, smoke and spark recipe is adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, mix, hex, clamp, smooth, space, TAU, WHITE } from "../../core/index.js";
import { noiseFor, pnoise, hotFirst, flameTongue, firePuff, smokePuff, spark, drift, looped, solid, soft, LAYERS, floorGlow, spark3, drift3 } from "./_lib.js";

export const meta = {
  name: "Flamethrower",
  desc: "A pressurised jet shooting right: a blue pilot at the nozzle, a tight stream with surges racing down it, a sputter, burning drops falling off, a tip that curls up into smoke.",
  tags: ["fire", "flamethrower", "stream", "weapon", "directional", "loop"],
  size: [184, 104],
  origin: [30, 60],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    pilot: ["#1b2a8a", "#3a62e0", "#a8d4ff"],
    reach: 112,
    speed: 280,
    seed: 3,
  },
};

const D = meta.duration, NL = noiseFor(D), SOOT = hex("#2a2430");
// the sputter: the jet coughs once a loop, then surges back
const COUGH = 0.55;
const flow = (te) => {
  const u = ((te % D) + D) % D;
  return 1 - smooth(COUGH, COUGH + 0.04, u) * (1 - smooth(COUGH + 0.1, COUGH + 0.16, u)) + 0.25 * Math.exp(-(((u - COUGH - 0.2) / 0.05) ** 2));
};

export function draw(p, t, o) {
  const F = fit(o.palette, 9), H = hotFirst(F), PL = fit(o.pilot, 3), S = o.seed, L = o.reach, V = o.speed;
  const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), SPARKS = [H[1], H[2], H[4], H[5]], SMOKE = mix(SOOT, H[7], 0.3);
  // the stream's centre line: dead straight at the nozzle, sagging and wavering as it runs out
  const cy = (x) => 5 * (x / L) ** 2 + N(1.2, S + 9, x * 0.02) * 2.2 * (x / L) ** 1.5;
  const width = (x) => (2.1 + 5 * Math.pow(x / L, 0.7)) * flow(t - x / V);

  // the curl: where the stream runs out of push, burning fuel rolls up and back on itself and turns to smoke
  const fire = [], smoke = [];
  looped(t, D, 80, S + 100, (r) => ({ a0: r.range(-0.3, 0.5), R: r.range(9, 15), w: r.range(5, 7.5), up: r.range(4, 12), dx: r.range(-6, 2), fl: r.range(0.38, 0.62), sl: r.range(0.6, 1.0), s: r.range(2.4, 4.4), f: r.next(), life: 1.6 }), (q, age) => {
    const tb = t - age, k = flow(tb - L / V);
    if (k < 0.4) return;
    // round a curl: forward, up and back over the top, rising as it goes
    const x0 = L + q.dx, y0 = cy(L), a = Math.min(age, q.fl) * q.w + q.a0;
    const x = x0 + q.R * Math.sin(a), y = y0 - q.R * (1 - Math.cos(a)) - q.up * age;
    if (age < q.fl) return fire.push([age / q.fl, x, y, q, k]);
    if (age - q.fl < q.sl) smoke.push([(age - q.fl) / q.sl, x - (age - q.fl) * 6, y - (age - q.fl) * 16, q]);
  });
  for (const [u, x, y, q] of smoke) smokePuff(p, x, y, 1 - u, q.s * 1.2, SMOKE, true, 0.85);
  fire.sort((a, b) => b[0] - a[0]);
  for (const [u, x, y, q, k] of fire) firePuff(p, x, y, 1 - u, q.s * (0.8 + 1.1 * u) * k, q.f, H, 0.1);

  // flames licking up off the burning fuel, riding along the stream, swept back by the wind of it
  for (let i = 0; i < 13; i++) {
    const n = (S * 3 + i) * 19, ph = ((i * 0.618 + t / D) % 1), x = 10 + ph * (L - 14), k = flow(t - x / V);
    if (k < 0.35) continue;
    const h = (2 + 11 * (x / L)) * (0.55 + 0.6 * (0.5 + 0.5 * N(5, n + 1))) * k * Math.min(1, (1 - ph) * 6);
    flameTongue(p, x, cy(x) - width(x) * 0.6, h, 1.1 + 1.6 * (x / L), -h * 0.55, N, n, H, LAYERS);
  }
  // the stream: a white core in yellow, orange and a red skin, surges racing down it
  const P = Math.round(D * 3);
  for (let x = 0; x <= L; x++) {
    const c = cy(x), w = width(x) * (1 + 0.15 * pnoise(x * 0.4 - (t / D) * 24, 24, S + 4));
    if (w < 0.4) continue;
    const surge = ((x * 0.035 - (t / D) * P) % 1 + 1) % 1 < 0.12 ? 1 : 0;
    for (let y = Math.floor(c - w - 1); y <= Math.ceil(c + w + 1); y++) {
      const q = Math.abs(y + 0.5 - c) / w;
      if (q > 1.15) continue;
      // a white core near the nozzle cooling to yellow down the stream; ragged red skin
      let lvl = (q < 0.3 ? 0 : q < 0.55 ? 1 : q < 0.78 ? 2 : q < 1 ? 3 : 4) + (x > L * 0.45 && q < 0.55 ? 1 : 0);
      lvl = Math.max(0, Math.min(4, lvl - surge));
      if (lvl === 4 && pnoise(x * 0.5 + y * 7.3 - (t / D) * 40, 40, S + 6) < 0) continue;
      p.px(x, y, [H[0], H[2], H[4], H[6], H[7]][lvl]);
    }
    // two hot strands twisting through the fuel, racing downstream
    for (const ph of [0, Math.PI]) {
      const a = x * 0.22 - (t / D) * Math.PI * 2 * 9 + ph, sy = c + Math.sin(a) * w * 0.55;
      if (Math.cos(a) > -0.1 && w > 1.2) p.px(x, sy, Math.cos(a) > 0.55 ? H[0] : H[1]);
    }
  }
  // the pilot at the nozzle: a blue cone of gas where it lights
  const pk = flow(t);
  for (let x = 0; x < 6; x++) for (let y = -2; y <= 2; y++) if (Math.abs(y) <= 2 - x * 0.3) p.px(x, y, Math.abs(y) < 1 ? (x < 2 ? PL[2] : PL[1]) : PL[0]);
  solid(p, 1, 0, 1.6 * pk, WHITE);

  // burning drops shaken off the stream: they arc down trailing flame and burn out
  looped(t, D, 10, S + 200, (r) => ({ d: r.range(20, 95), vx: r.range(0.3, 0.6), vy: r.range(-25, 15), life: r.range(0.35, 0.6) }), (q, age) => {
    const tb = t - age;
    if (flow(tb - q.d / V) < 0.5) return;
    const at = (a) => drift(q.d, cy(q.d), V * q.vx, q.vy, a, 0, 260, 1.2, 0.5);
    for (let j = 4; j >= 1; j--) {
      const a = age - j * 0.035;
      if (a < 0) continue;
      const [x, y] = at(a);
      firePuff(p, x, y, 1 - Math.min(0.99, j * 0.18 + age / q.life * 0.4), 1.8 - j * 0.25, 0.3, H, 0.06);
    }
    const [x, y] = at(age), k = 1 - age / q.life;
    p.px(x, y, k > 0.5 ? H[0] : H[2]);
    p.px(x + 1, y, H[3]);
    p.glow(x, y, 6, H[3], 0.45 * k);
  });
  // the cough: when the jet sputters the nozzle spits sparks and a puff of smoke
  looped(t, D, 12, S + 300, (r) => ({ born: COUGH + r.range(0, 0.08), a: r.range(-0.8, 0.8), v: r.range(120, 240), life: r.range(0.2, 0.45) }), (q, age) => {
    const u = ((t - age) % D + D) % D;
    if (Math.abs(u - q.born) > 0.06) return;
    const [x, y, vx, vy] = drift(4, 0, Math.cos(q.a) * q.v, Math.sin(q.a) * q.v, age, 0, 300, 2.5, 2.5);
    spark(p, x, y, vx, vy, 1 - age / q.life, SPARKS);
  });
  // and spits a few blobs of burning fuel that fall short
  looped(t, D, 5, S + 350, (r) => ({ born: COUGH + r.range(0.01, 0.1), v: r.range(90, 170), vy: r.range(-30, 10), life: r.range(0.25, 0.4), s: r.range(1.6, 2.6) }), (q, age) => {
    const u = ((t - age) % D + D) % D;
    if (Math.abs(u - q.born) > 0.05) return;
    const [x, y] = drift(4, 0, q.v, q.vy, age, 0, 200, 2, 1);
    firePuff(p, x, y, 1 - age / q.life, q.s, 0.2, H, 0.1, -0.86, -0.5);
  });
  {
    const u = ((t % D) + D) % D, a = u - COUGH;
    if (a > 0 && a < 0.7) smokePuff(p, 8 + a * 20, -a * 18, 1 - a / 0.7, 3, SMOKE, false, 0.8);
  }

  // light: the pilot, the stream, the burning tip
  p.glow(2, 0, 34 * pk, GLOW, 0.8 * pk);
  p.glow(2, 0, 9, PL[2], 0.45 * pk);
  for (let d = 8; d <= L; d += 8) p.glow(d, cy(d), 12 + d * 0.16, GLOW, 0.3 * flow(t - d / V));
  p.glow(L, cy(L) - 10, 52, GLOW, 0.34 * flow(t - L / V));
}

// 3D: the stream is a real tube along +x (a capsule chain, white core to red skin, surges racing down it, two
// hot strands winding round it as a helix), flames lick up off its top, the tip's curl rolls up as a helix, burning
// drops fly off in every direction and fall to the floor where they splash and leave a scorch.
const MY = -22; // the nozzle, above the floor

export const three = {
  meta: { size: [300, 192], origin: [150, 134], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), F = fit(o.palette, 9), H = hotFirst(F), PL = fit(o.pilot, 3), S = o.seed, L = o.reach, V = o.speed;
    const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);
    const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), SPARKS = [H[1], H[2], H[4], H[5]], SMOKE = mix(SOOT, H[7], 0.3);
    // the stream's centre line: sagging and wavering as it runs out, in height and sideways
    const cyAt = (x, tt) => 5 * (x / L) ** 2 + NL(tt, 1.2, S + 9, x * 0.02) * 2.2 * (x / L) ** 1.5;
    const czAt = (x, tt) => NL(tt, 1.1, S + 19, x * 0.02) * 2.6 * (x / L) ** 1.5;
    const cy = (x) => MY + cyAt(x, t), cz = (x) => czAt(x, t);
    const width = (x) => (2.1 + 5 * Math.pow(x / L, 0.7)) * flow(t - x / V);
    const pk = flow(t);
    const bills = [], smoke = [], scorch = [];
    const bill = (x, y, z, fn) => bills.push([q.depth(x, y, z), x, y, z, fn]);

    // the stream: a white core in yellow, orange and a red skin, surges racing down it
    const P = Math.round(D * 3), RAMP = [H[0], H[2], H[4], H[6], H[7]];
    for (let x = 0; x < L; x += 2) {
      const xm = x + 1, w = width(xm) * (1 + 0.15 * pnoise(xm * 0.4 - (t / D) * 24, 24, S + 4));
      if (w < 0.4) continue;
      const surge = ((xm * 0.035 - (t / D) * P) % 1 + 1) % 1 < 0.12 ? 1 : 0, late = xm > L * 0.45 ? 1 : 0;
      q.beam(x, cy(x), cz(x), x + 2, cy(x + 2), cz(x + 2), 2 * w * (1 + 0.1 * surge), (u, v) => RAMP[Math.max(0, Math.min(4, (v < 0.3 ? 0 : v < 0.55 ? 1 : v < 0.78 ? 2 : 3) + (late && v < 0.55 ? 1 : 0) - surge))]);
    }
    // two hot strands winding round the fuel, racing downstream: a true helix on the tube's skin
    for (const ph of [0, Math.PI]) {
      let prev = null;
      for (let x = 0; x <= L; x++) {
        const w = width(x), a = x * 0.22 - (t / D) * TAU * 9 + ph;
        if (w <= 1.2) {
          prev = null;
          continue;
        }
        const pt = [x, cy(x) + Math.sin(a) * w * 1.1, cz(x) + Math.cos(a) * w * 1.1];
        if (prev) q.line(...prev, ...pt, Math.cos(a) > 0.55 ? H[0] : H[1]);
        prev = pt;
      }
    }
    // the pilot at the nozzle: a blue cone of gas where it lights
    q.beam(0, MY, 0, 2, MY, 0, 4, (u, v) => (v < 0.5 ? PL[2] : PL[0]));
    q.beam(2, MY, 0, 4, MY, 0, 2.8, (u, v) => (v < 0.5 ? PL[1] : PL[0]));
    q.beam(4, MY, 0, 6, MY, 0, 1.6, (u, v) => (v < 0.5 ? PL[1] : PL[0]));
    q.ball(1, MY, 0, 1.6 * pk, WHITE);

    // flames licking up off the burning fuel, riding along the stream, swept back by the wind of it
    for (let i = 0; i < 13; i++) {
      const n = (S * 3 + i) * 19, ph = ((i * 0.618 + t / D) % 1), x = 10 + ph * (L - 14), k = flow(t - x / V);
      if (k < 0.35) continue;
      const h = (2 + 11 * (x / L)) * (0.55 + 0.6 * (0.5 + 0.5 * N(5, n + 1))) * k * Math.min(1, (1 - ph) * 6), w = width(x), a = (((i * 0.618) % 1) * 2 - 1) * 1.5;
      bill(x, cy(x) - w * 0.8 * Math.cos(a), cz(x) + w * 0.85 * Math.sin(a), (pp) => {
        pp.z -= w;
        flameTongue(pp, 0, 0, h, 1.1 + 1.6 * (x / L), q.view(-h * 0.55, 0, 0)[0], N, n, H, LAYERS);
      });
    }

    // the curl: where the stream runs out of push, burning fuel rolls up and back on itself, a helix, and turns to smoke
    looped(t, D, 80, S + 100, (r) => ({ a0: r.range(-0.3, 0.5), R: r.range(9, 15), w: r.range(5, 7.5), up: r.range(4, 12), dx: r.range(-6, 2), fl: r.range(0.38, 0.62), sl: r.range(0.6, 1.0), s: r.range(2.4, 4.4), f: r.next(), psi: r.range(-1.2, 1.2), life: 1.6 }), (c, age) => {
      const tb = t - age, k = flow(tb - L / V);
      if (k < 0.4) return;
      const a = Math.min(age, c.fl) * c.w + c.a0, rr = c.R * (1 - Math.cos(a)), ps = c.psi + a * 0.8;
      const x = L + c.dx + c.R * Math.sin(a), y = cy(L) - rr * (0.8 + 0.2 * Math.cos(ps)) - c.up * age, z = cz(L) + rr * 1.1 * Math.sin(ps);
      if (age < c.fl) {
        const u = age / c.fl;
        return bill(x, y, z, (pp) => firePuff(pp, 0, 0, 1 - u, c.s * (0.8 + 1.1 * u) * k, c.f, H, 0.1));
      }
      const sa = age - c.fl;
      if (sa < c.sl) smoke.push([x - sa * 6, y - sa * 16, z + Math.sin(ps) * sa * 8, (pp) => smokePuff(pp, 0, 0, 1 - sa / c.sl, c.s * 1.3, SMOKE, true, 1.15)]);
    });

    // burning drops shaken off the stream: they fly out round the stream, fall trailing flame, land on the floor,
    // splash into a flicker of fire and leave a scorch
    looped(t, D, 10, S + 200, (r) => ({ d: r.range(20, 95), vx: r.range(0.3, 0.6), vy: r.range(-25, 15), vz: r.range(-55, 55), oz: r.range(-1.5, 1.5), life: 1.4 }), (c, age) => {
      const tb = t - age;
      if (flow(tb - c.d / V) < 0.5) return;
      const y0 = MY + cyAt(c.d, tb), z0 = czAt(c.d, tb) + c.oz;
      const at = (a) => drift3([c.d, y0, z0], [V * c.vx, c.vy, c.vz], a, [0, 260, 0], 1.2, 0.5);
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) {
        const m = (lo + hi) / 2;
        if (at(m)[1] < -1.5) lo = m;
        else hi = m;
      }
      const tl = hi;
      if (age < tl) {
        for (let j = 4; j >= 1; j--) {
          const a = age - j * 0.035;
          if (a < 0) continue;
          const [x, y, z] = at(a), heat = 1 - Math.min(0.99, j * 0.18 + (age / tl) * 0.4);
          bill(x, y, z, (pp) => firePuff(pp, 0, 0, heat, 1.8 - j * 0.25, 0.3, H, 0.06));
        }
        const [x, y, z] = at(age), k = 1 - (age / tl) * 0.5;
        q.ball(x, y, z, 1.2, k > 0.7 ? H[0] : H[2]);
        q.glow(x, y, z, 6, H[3], 0.45 * k);
        return;
      }
      const la = age - tl, [lx, , lz] = at(tl);
      if (la < 0.55) {
        const u = la / 0.55;
        bill(lx, -2, lz, (pp) => {
          firePuff(pp, 0, 0, 1 - u, 2.8 * (0.8 + 0.5 * u), 0.3, H, 0.1);
          flameTongue(pp, 0, 1, 7 * (1 - u * u) + 1, 1.5 * (1 - u * 0.6), 0, N, Math.floor(c.d * 7), H, LAYERS);
        });
        q.glow(lx, -3, lz, 12, H[3], 0.4 * (1 - u));
      }
      if (la < 1.1) scorch.push([lx, lz, la / 1.1, Math.min(1, la * 12)]);
    });
    // the cough: when the jet sputters the nozzle spits sparks in a cone and a puff of smoke
    looped(t, D, 12, S + 300, (r) => ({ born: COUGH + r.range(0, 0.08), a: r.range(-0.8, 0.8), v: r.range(120, 240), life: r.range(0.2, 0.45), az: r.range(0, TAU) }), (c, age) => {
      const u = ((t - age) % D + D) % D;
      if (Math.abs(u - c.born) > 0.06) return;
      const pol = Math.abs(c.a), [x, y, z, vx, vy, vz] = drift3([4, MY, 0], [Math.cos(pol) * c.v, Math.sin(pol) * Math.sin(c.az) * c.v, Math.sin(pol) * Math.cos(c.az) * c.v], age, [0, 300, 0], 2.5, 2.5);
      if (y < -0.5) spark3(q, x, y, z, vx, vy, vz, 1 - age / c.life, SPARKS);
    });
    // and spits a few blobs of burning fuel that fall short
    looped(t, D, 5, S + 350, (r) => ({ born: COUGH + r.range(0.01, 0.1), v: r.range(90, 170), vy: r.range(-30, 10), life: r.range(0.25, 0.4), s: r.range(1.6, 2.6), vz: r.range(-30, 30) }), (c, age) => {
      const u = ((t - age) % D + D) % D;
      if (Math.abs(u - c.born) > 0.05) return;
      const [x, y, z] = drift3([4, MY, 0], [c.v, c.vy, c.vz], age, [0, 200, 0], 2, 1);
      bill(x, y, z, (pp) => firePuff(pp, 0, 0, 1 - age / c.life, c.s, 0.2, H, 0.1, -0.86, -0.5));
    });
    {
      const u = ((t % D) + D) % D, a = u - COUGH;
      if (a > 0 && a < 0.7) smoke.push([8 + a * 20, MY - a * 18, 0, (pp) => smokePuff(pp, 0, 0, 1 - a / 0.7, 3, SMOKE, false, 0.8)]);
    }

    // everything upright, nearest first (opaque, it writes depth)
    bills.sort((a, b) => a[0] - b[0]);
    for (const [, x, y, z, fn] of bills) q.at(x, y, z, fn);

    // light: the pilot, the stream, the burning tip, a pool on the floor
    q.glow(2, MY, 0, 34 * pk, GLOW, 0.8 * pk);
    q.glow(2, MY, 0, 9, PL[2], 0.45 * pk);
    for (let d = 8; d <= L; d += 8) q.glow(d, cy(d), cz(d), 12 + d * 0.16, GLOW, 0.3 * flow(t - d / V));
    q.glow(L, cy(L) - 10, cz(L), 52, GLOW, 0.34 * flow(t - L / V));
    floorGlow(q, L * 0.5, 0, 66, GLOW, 0.2 * flow(t - (L * 0.5) / V));
    // scorches where the fuel landed, then the smoke, far to near, over everything
    for (const [x, z, u, a] of scorch) q.decal(x, 0, z, null, 7, (pp) => soft(pp, 0, 0, 2.6 + 2.2 * u, SOOT, 0.55 * a * (1 - u)));
    for (const [x, y, z, fn] of q.sort(smoke, (e) => [e[0], e[1], e[2]])) q.at(x, y, z, fn);
  },
};
