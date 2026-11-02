// The column (a banded white core, strands running through it, light down its length) and the slam with its
// floor ring follow Sprite Fusion's open-source holy-light (https://www.spritefusion.com/pixel-art-vfx/holy-light),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, clamp, smooth, ease, noise, noise2, rand, space, TAU, WHITE } from "../../core/index.js";
import { WATER, Drops, Ripples, Mist, ring, ring3, lace, billow } from "./_lib.js";

export const meta = {
  name: "Geyser",
  desc: "A pool heaves and burbles faster and faster, then blasts a white column of water skyward with a churning foam head; it rains back down in drops and steam, slumps and sputters out.",
  tags: ["water", "geyser", "eruption", "steam", "column", "nature", "one-shot"],
  size: [184, 168],
  origin: [92, 146],
  duration: 5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: WATER, height: 100, seed: 4 },
};

const SY = 0.22, G = 820, ERUPT = 1.15, FALL = 2.6, GONE = 3.3;
// small spurts while it builds, and the sputters after: [time, height]
const SPURTS = [[0.46, 7], [0.72, 12], [0.92, 9], [1.04, 15], [GONE + 0.15, 15], [GONE + 0.55, 8]];

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), HMAX = o.height, S = o.seed;
  const ps = new Particles({ rng: R }), mist = new Mist(), lights = new Lights(), rings = new Ripples({ sy: SY });
  const plinks = [], pops = [];
  const V0 = Math.sqrt(2 * G * HMAX);
  let t = 0;
  const poolR = (tt) => (12 + 7 * smooth(0, 1, tt) + 15 * ease.outCubic(clamp((tt - ERUPT) / 1.2))) * (1 - 0.25 * smooth(GONE, 4.6, tt));
  const poolK = (tt) => smooth(0, 0.2, tt) * (1 - smooth(4.0, 4.85, tt));
  const drops = new Drops({
    sy: SY,
    g: G,
    onLand: (d) => {
      const inPool = Math.hypot(d.x, d.z) < poolR(t);
      rings.add(d.x, d.z, 0.6, (inPool ? 2.5 : 1.5) + d.s * 1.6, 0.32 + d.s * 0.1, { n: 1, k: inPool ? 0.95 : 0.7, hot: 0.05 });
      plinks.push({ x: d.x, y: d.z * SY, s: d.s, age: 0 });
      if (d.s > 1 && !d.small)
        for (let i = 0; i < 2; i++) {
          const a = R.range(0, TAU), v = R.range(8, 28);
          drops.add({ x: d.x, z: d.z, h: 0.5, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(45, 95), s: 1, small: true, life: 1 });
        }
    },
  });
  // how tall the column stands: a fast blast, surging while it holds, slumping when the pressure goes
  const top = (tt) => {
    if (tt < ERUPT || tt > GONE) return 0;
    return HMAX * ease.outCubic(clamp((tt - ERUPT) / 0.3)) * (0.93 + 0.07 * noise(tt * 2.2, S)) * (1 - ease.inQuad(clamp((tt - FALL) / (GONE - FALL))));
  };
  const head = (tt) => smooth(ERUPT + 0.08, ERUPT + 0.3, tt) * (1 - smooth(FALL + 0.1, FALL + 0.45, tt));
  const spurt = (tt) => {
    let h = 0;
    for (const [s0, hs] of SPURTS) h = Math.max(h, hs * Math.sin(Math.PI * clamp((tt - s0) / 0.2)));
    return h;
  };
  const done = new Set(), once = (key, at) => !done.has(key) && t >= at && done.add(key);
  const emit = (rate, dt) => R.chance(Math.min(1, rate * dt));

  // the column: a white core banded out to blue edges, shadowed on the right; 1 px strands whose streaks run up
  // in jet time (fast and long low down, bunching where the water slows near the top); it spreads as it rises,
  // its sides ragged and running, a sway through it, light all the way up
  function column(p, H, thin) {
    if (H < 1) return;
    const tau = (h) => (V0 - Math.sqrt(Math.max(0, V0 * V0 - 2 * G * Math.min(h, HMAX * 0.96)))) / G;
    p.shade(-22, -H - 2, 22, 0, (x, y, out) => {
      const h = -y, v = h / H, sway = noise(t * 1.6 + h * 0.025, S + 5) * 2.5 * v;
      const rag = noise2(h * 0.2 - t * 11, x < sway ? 3 : 7, S + 6) * (0.5 + 1.8 * v);
      const w = (3.6 + 7.5 * Math.pow(v, 1.8)) * thin + rag, q = (x - sway) / Math.max(1, w), aq = Math.abs(q);
      if (aq > 1) return;
      const X = Math.floor(x), streak = noise2(X * 1.618 + 0.3, (tau(h) - t) * 14, S), body = noise2(Math.floor((x + 40) / 2) * 2.3, (tau(h) - t) * 5, S + 1);
      let lvl = aq < 0.42 ? 0 : aq < 0.7 ? 1 : aq < 0.9 ? 2 : 3;
      if (q > 0.38) lvl++;
      if (streak > 0.28) lvl--;
      if (body < -0.4) lvl++;
      out.c = [WHITE, C[6], C[5], C[4], C[3]][clamp(lvl, 0, 4)];
    });
    p.glowLine(0, 0, 0, -H, 16 + 8 * thin, C[5], 0.12 * thin);
  }

  // the head: water boiling over at the top and falling back round the column in an umbrella of streaks, foam
  // billows churning in it, shadowed underneath, lit on top
  function foamHead(p, H, k, back) {
    if (k <= 0.01 || H < 4) return;
    if (back) {
      // the umbrella: streaks pouring off the rim of the head, running down and thinning out
      for (let i = 0; i < 16; i++) {
        const side = i % 2 ? 1 : -1, x0 = side * (5 + 9 * rand(i, S + 20)) * k, len = (14 + 26 * rand(i, S + 21)) * k, speed = 70 + 50 * rand(i, S + 22);
        for (let j = 0; j < 3; j++) {
          const f = (t * speed / len + j / 3 + rand(i, S + 23)) % 1, y0 = -H + 2 + f * len, x = x0 + side * f * f * 6, L = 1 + 4 * f * (1 - f) * 2;
          if (f < 0.85) p.line(x, y0, x + side * 0.6, y0 + L, f < 0.4 ? C[6] : f < 0.7 ? C[5] : C[4]);
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * (i % 2 ? 1.3 : -1.1), z = Math.sin(a);
      if (z < 0 !== back) continue;
      const rho = (3 + 7 * rand(i, S)) * k, x = Math.cos(a) * rho * 1.25 + noise(t * 3 + i, S + 8) * 2.5;
      const y = -H + z * rho * 0.45 + (rho / 10) * 4 - 4 * (1 - rho / (10 * k)) + noise(t * 3 + i + 50, S + 9) * 2.5, r = (2 + 2.6 * rand(i, S + 2) + 0.7 * Math.sin(t * 7 + i)) * k;
      if (back) billow(p, x, y, r, [C[0], C[1], C[2], C[3], C[3], C[4], C[5], C[5]]);
      else {
        p.circle(x + r * 0.15, y + r * 0.25, r, C[4]);
        p.circle(x, y, r * 0.82, rho > 6 * k ? C[5] : C[6]);
        p.circle(x - r * 0.25, y - r * 0.3, r * 0.5, WHITE);
      }
    }
    if (!back) p.glow(0, -H - 2, 38, C[5], 0.34 * k);
  }

  return {
    update(dt) {
      t += dt;
      const H = top(t), hk = head(t), k = t / ERUPT;
      // building: bubbles burst on the heaving mound, faster and faster, steam starts to lift
      if (t < ERUPT && emit(1.5 + 9 * k * k, dt)) {
        const a = R.range(0, TAU), r = R.range(0, 7), x = Math.cos(a) * r, z = Math.sin(a) * r;
        pops.push({ x, y: z * SY - R.range(1, 3), age: 0, r: R.range(1, 2) });
        rings.add(x, z, 1, R.range(5, 9), 0.55, { n: 1, k: 0.85 });
        for (let i = 0; i < R.int(1, 3); i++) drops.add({ x, z, h: 2, vx: R.range(-25, 25), vz: R.range(-15, 15), vh: R.range(50, 120), s: 1, small: true, life: 1 });
      }
      if (t < ERUPT && emit(3 + 7 * k, dt)) mist.add(R.range(-8, 8), -R.range(1, 5), R.range(-10, 10), -R.range(6, 18), 2, R.range(5, 9), R.range(0.9, 1.5), C[6], 0.22);
      for (const [s0, hs] of SPURTS)
        if (once("spurt" + s0, s0 + 0.08))
          for (let i = 0; i < 3 + Math.round(hs / 4); i++) {
            const a = R.range(0, TAU), v = R.range(10, 40);
            drops.add({ x: 0, z: 0, h: hs * 0.8, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(20, 90), s: R.chance(0.3) ? 2 : 1 });
          }
      if (once("erupt", ERUPT)) {
        // the blast: light, a ring thrown across the ground, water flung high, steam rolling out
        lights.add(0, -26, 64, C[5], 0.85, 0.6);
        lights.add(0, -4, 28, WHITE, 0.75, 0.1);
        rings.add(0, 0, 6, 40, 1.2, { n: 2, gap: 3, k: 1.2, hot: 0.12, glint: 1 });
        for (let i = 0; i < 44; i++) {
          const a = R.range(0, TAU), v = R.range(30, 120);
          drops.add({ x: Math.cos(a) * 3, z: Math.sin(a) * 3, h: R.range(2, 10), vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(180, 400), s: R.chance(0.15) ? 3 : R.chance(0.35) ? 2 : 1, delay: R.range(0, 0.12) });
        }
        for (let i = 0; i < 12; i++) {
          const s = i % 2 ? 1 : -1;
          mist.add(s * R.range(3, 9), -R.range(1, 6), s * R.range(30, 80), -R.range(4, 18), 3, R.range(9, 14), R.range(1.2, 1.9), R.chance(0.5) ? C[6] : WHITE, 0.3, R.range(0, 0.15));
        }
        for (let i = 0; i < 14; i++) ps.spawn(P.STAR, R.range(-16, 16), -R.range(8, 80), R.range(-10, 10), -6, R.range(0.3, 0.7), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.6), R.range(0.05, 0.5));
      }
      // holding: the head sheds drops that rain back down, spray hangs off the column, steam pours off the top
      if (hk > 0) {
        if (emit(60 * hk, dt)) {
          const a = R.range(0, TAU), v = R.range(10, 60);
          drops.add({ x: R.range(-9, 9), z: R.range(-4, 4), h: H + R.range(-8, 3), vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(-40, 60), s: R.chance(0.08) ? 3 : R.chance(0.3) ? 2 : 1 });
        }
        if (emit(9 * hk, dt)) mist.add(R.range(-8, 8), -H + R.range(-6, 2), R.range(-34, 34), -R.range(14, 34), 3, R.range(8, 13), R.range(0.9, 1.4), R.chance(0.6) ? C[6] : WHITE, 0.2);
        if (emit(5 * hk, dt)) mist.add(R.sign() * R.range(3, 9), -R.range(1, 6), R.sign() * R.range(20, 50), -R.range(2, 10), 3, R.range(8, 12), R.range(1, 1.6), C[6], 0.22);
        if (emit(40 * hk, dt)) {
          const s = R.sign(), hh = R.range(8, H * 0.95);
          ps.spawn(P.FLAKE, s * (3 + 6 * Math.pow(hh / H, 1.8)), -hh, s * R.range(10, 45), R.range(-20, 10), R.range(0.6, 1.2), R.chance(0.5) ? WHITE : C[6], R.range(0.6, 1.3));
        }
        if (emit(4 * hk, dt)) rings.add(R.range(-2, 2), R.range(-2, 2), 4, poolR(t) * R.range(0.7, 1), 0.9, { n: 1, k: 0.8 });
        if (emit(7 * hk, dt)) ps.spawn(P.STAR, R.range(-14, 14), -R.range(10, H + 8), R.range(-6, 6), -4, R.range(0.25, 0.55), R.chance(0.4) ? WHITE : C[6], R.range(0.8, 2.2), 0);
      }
      if (once("collapse", FALL + 0.12)) {
        // the head falls apart: a heavy rain of drops all at once
        for (let i = 0; i < 40; i++) {
          const a = R.range(0, TAU), v = R.range(15, 80);
          drops.add({ x: R.range(-6, 6), z: R.range(-3, 3), h: top(t) + R.range(-8, 4), vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(-40, 60), s: R.chance(0.12) ? 3 : R.chance(0.35) ? 2 : 1, delay: R.range(0, 0.25) });
        }
        for (let i = 0; i < 6; i++) mist.add(R.range(-8, 8), -top(t) + R.range(-6, 6), R.range(-34, 34), -R.range(10, 26), 4, R.range(9, 13), R.range(0.8, 1.2), C[6], 0.18);
      }
      for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].age += dt) > 0.12) pops.splice(i, 1);
      for (let i = plinks.length - 1; i >= 0; i--) if ((plinks[i].age += dt) > 0.14) plinks.splice(i, 1);
      drops.update(dt);
      rings.update(dt);
      mist.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the pool: dark see-through water, a lit far rim
      const pr = poolR(t), pk = poolK(t);
      if (pk > 0)
        p.each(-pr, -pr * SY, pr, pr * SY, (x, y, sx, sy) => {
          const d = (x / pr) ** 2 + (y / (pr * SY)) ** 2;
          if (d > 1) return;
          p.blendPx(sx, sy, d < 0.15 ? C[2] : C[1], 0.6 * pk * Math.min(1, (1 - d) * 4));
          if (y < 0 && d > 0.78 && d < 0.95) p.blendPx(sx, sy, C[4], 0.7 * pk);
        });
      rings.draw(p, C, -1);
      const u = (t - ERUPT) / 0.4;
      if (u > 0 && u < 1) ring(p, 0, 0.5, 6 + 42 * ease.outCubic(u), SY, 1.5 * (1 - u), C, { n: 3, gap: 1.6 + 2 * u, half: -1, hot: u < 0.3, seed: 9 });
      foamHead(p, top(t), head(t), true);
      drops.draw(p, C, "back");
    },
    draw(p) {
      const H = top(t), hk = head(t), k = clamp(t / ERUPT), thin = smooth(ERUPT, ERUPT + 0.12, t) * (1 - 0.55 * smooth(FALL, GONE, t));
      rings.draw(p, C, 1);
      const u = (t - ERUPT) / 0.4;
      if (u > 0 && u < 1) ring(p, 0, 0.5, 6 + 42 * ease.outCubic(u), SY, 1.5 * (1 - u), C, { n: 3, gap: 1.6 + 2 * u, half: 1, hot: u < 0.3, seed: 9 });
      // foam rides the pool round the foot of the column
      const fk = smooth(ERUPT, ERUPT + 0.3, t) * (1 - smooth(GONE - 0.3, 4.4, t));
      if (fk > 0) lace(p, 0, 0, 8 + 10 * fk, (8 + 10 * fk) * SY + 0.5, fk, C, t, S);
      // the heaving mound while it builds, beating faster
      if (t < ERUPT + 0.05) {
        const beat = Math.pow(Math.max(0, Math.sin(t * (8 + 18 * k * k))), 3), rd = 4 + 3.5 * k + 1.5 * beat, hd = 1.5 + 3 * k + 3 * beat;
        p.shade(-rd - 1, -hd - 1, rd + 1, 0.5, (x, y, out) => {
          const dx = x / rd, dy = y / hd, d = dx * dx + dy * dy;
          if (d > 1 || y > 0.5) return;
          // water heaving up: a white rim where it faces the light, a tinted body, shadow low on the right
          const lit = -dx * 0.7 - dy * 0.7, rim = d > 0.68;
          out.c = rim ? (lit > 0.3 ? WHITE : lit > -0.15 ? C[6] : C[4]) : lit > 0.55 ? C[6] : lit > 0.12 ? C[5] : lit > -0.3 ? C[4] : C[3];
        });
        p.px(-rd * 0.35, -hd * 0.6, WHITE);
        p.glow(0, -5, 16 + 16 * k + 8 * beat, C[5], 0.06 + 0.12 * k + 0.12 * beat);
      }
      // spurts while it builds and sputters as it dies: a short white jet with a bead on top
      const sp = spurt(t);
      if (sp > 1 && H < 1) {
        p.shade(-2, -sp - 1, 2, 0, (x, y, out) => {
          const q = x / (1 + 0.8 * (1 + y / sp));
          if (Math.abs(q) > 1) return;
          out.c = q < -0.3 ? C[6] : q < 0.35 ? WHITE : C[5];
        });
        p.circle(0, -sp, 1.3, C[6]);
        p.px(0, -sp - 1, WHITE);
        p.glowLine(0, 0, 0, -sp, 8, C[5], 0.3);
      }
      column(p, H, thin);
      // the foot: billows boil out round it
      if (hk > 0 || (H > 1 && t < GONE))
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + t * 2.1, r = 4 + 2 * Math.sin(t * 5 + i * 1.7), x = Math.cos(a) * r * 1.3, y = Math.sin(a) * r * SY - 2;
          billow(p, x, y, (1.6 + 1.2 * rand(i, S + 4)) * Math.max(hk, thin * 0.6), C);
        }
      foamHead(p, H, hk, false);
      for (const q of pops) {
        const g = q.age / 0.12;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0.7, -0.7], [-0.7, -0.7], [0, -1]]) p.dot(q.x + dx * (q.r + 3 * g), q.y + dy * (q.r + 3 * g), C[6], 1 - g);
      }
      for (const q of plinks) {
        const g = q.age / 0.14;
        if (g < 0.5) p.px(q.x, q.y, WHITE);
        if (q.s > 1) p.line(q.x, q.y - 1, q.x, q.y - 1 - 3 * (1 - g), g < 0.4 ? WHITE : C[6]);
        p.glow(q.x, q.y, 4, C[5], 0.25 * (1 - g));
      }
      drops.draw(p, C, "front");
      // the blast's first two frames: a white burst at the vent
      const f = (t - ERUPT) / 0.07;
      if (f >= 0 && f < 1) {
        p.circle(0, -4, 7 * (1 - f * 0.4), WHITE);
        p.ellipse(0, 0, 12, 2.6, (d) => (d < 0.6 ? WHITE : C[6]));
      }
      ps.draw(p);
      mist.draw(p, C[5]);
      lights.draw(p);
      // light: the column and its head, the pool round its foot
      if (H > 1) p.glowLine(0, 0, 0, -H, 26, C[4], 0.2 * thin);
      p.glow(0, -2, 46, C[4], 0.24 * Math.max(hk, 0.3 * k * (t < ERUPT ? 1 : 0)));
      p.glow(0, 2, 60, C[3], 0.12 * poolK(t));
    },
  };
}

// 3D: the same eruption standing in the round. The pool is a disc of water on the floor, the column a real cylinder of
// water (shaded round it, ragged, spreading), the head a cap of foam balls with an umbrella of streaks all the way
// round it, every drop, mote of steam and flake of spray flung out in a full circle, rings and foam laid flat on the water.
export const three = {
  meta: { size: [196, 172], origin: [98, 132], camera: { pitch: 0.4 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), HMAX = o.height, S = o.seed;
    const ps = new Particles({ rng: R }), mist = new Mist(), lights = new Lights(), rings = new Ripples({ sy: SY });
    const plinks = [], pops = [];
    const V0 = Math.sqrt(2 * G * HMAX);
    const BRI = [WHITE, C[6], C[5], C[4]], MID = [C[6], C[5], C[4], C[3]], DIM = [C[5], C[4], C[3], C[2]];
    let t = 0;
    const poolR = (tt) => (12 + 7 * smooth(0, 1, tt) + 15 * ease.outCubic(clamp((tt - ERUPT) / 1.2))) * (1 - 0.25 * smooth(GONE, 4.6, tt));
    const poolK = (tt) => smooth(0, 0.2, tt) * (1 - smooth(4.0, 4.85, tt));
    const drops = new Drops({
      sy: SY,
      g: G,
      onLand: (d) => {
        const inPool = Math.hypot(d.x, d.z) < poolR(t);
        rings.add(d.x, d.z, 0.6, (inPool ? 2.5 : 1.5) + d.s * 1.6, 0.32 + d.s * 0.1, { n: 1, k: inPool ? 0.95 : 0.7, hot: 0.05 });
        plinks.push({ x: d.x, z: d.z, s: d.s, age: 0 });
        if (d.s > 1 && !d.small)
          for (let i = 0; i < 2; i++) {
            const a = R.range(0, TAU), v = R.range(8, 28);
            drops.add({ x: d.x, z: d.z, h: 0.5, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(45, 95), s: 1, small: true, life: 1 });
          }
      },
    });
    const top = (tt) => {
      if (tt < ERUPT || tt > GONE) return 0;
      return HMAX * ease.outCubic(clamp((tt - ERUPT) / 0.3)) * (0.93 + 0.07 * noise(tt * 2.2, S)) * (1 - ease.inQuad(clamp((tt - FALL) / (GONE - FALL))));
    };
    const head = (tt) => smooth(ERUPT + 0.08, ERUPT + 0.3, tt) * (1 - smooth(FALL + 0.1, FALL + 0.45, tt));
    const spurt = (tt) => {
      let h = 0;
      for (const [s0, hs] of SPURTS) h = Math.max(h, hs * Math.sin(Math.PI * clamp((tt - s0) / 0.2)));
      return h;
    };
    const done = new Set(), once = (key, at) => !done.has(key) && t >= at && done.add(key);
    const emit = (rate, dt) => R.chance(Math.min(1, rate * dt));
    // a random point in a disc of radius rad: [x, z]
    const circ = (rad) => {
      const a = R.range(0, TAU), r = rad * Math.sqrt(R.next());
      return [Math.cos(a) * r, Math.sin(a) * r];
    };
    const foam = (q, x, y, z, r, ramp) =>
      q.ball(x, y, z, r, (nx, ny) => {
        const d = -(nx * 0.45 + ny * 0.55);
        return ramp[d > 0.6 ? 0 : d > -0.2 ? 1 : d > -0.6 ? 2 : 3];
      });

    // the column: a cylinder of white water banded out to blue edges and shadowed on the right, 1 px strands whose
    // streaks run up in jet time; it spreads as it rises, its sides ragged and running, a sway through it
    function column(q, H, thin) {
      if (H < 1) return;
      const yaw = q.camera.yaw, tau = (h) => (V0 - Math.sqrt(Math.max(0, V0 * V0 - 2 * G * Math.min(h, HMAX * 0.96)))) / G;
      const rows = Math.ceil(H * 1.1);
      for (let j = 0; j <= rows; j++) {
        const h = (j / rows) * H, v = h / H, sx = noise(t * 1.6 + h * 0.025, S + 5) * 2.5 * v, sz = noise(t * 1.3 + h * 0.025 + 40, S + 15) * 2.5 * v;
        const w = (3.6 + 7.5 * Math.pow(v, 1.8)) * thin, m = Math.max(4, Math.ceil(Math.PI * (w + 2) * 1.5)), tt = (tau(h) - t) * 14, tb = (tau(h) - t) * 5;
        for (let i = 0; i <= m; i++) {
          // only the half that faces the camera: the rest is behind it
          const a = -yaw - 0.1 + ((Math.PI + 0.2) * i) / m, cs = Math.cos(a + yaw);
          const rag = noise2(h * 0.2 - t * 11, 3 + a * 2, S + 6) * (0.5 + 1.8 * v), r = Math.max(1, w + rag), aq = Math.abs(cs);
          const streak = noise2(Math.floor((a / TAU) * 24) * 1.618 + 0.3, tt, S), body = noise2(Math.floor((a / TAU) * 10) * 2.3, tb, S + 1);
          let lvl = aq < 0.42 ? 0 : aq < 0.7 ? 1 : aq < 0.9 ? 2 : 3;
          if (cs > 0.38) lvl++;
          if (streak > 0.28) lvl--;
          if (body < -0.4) lvl++;
          q.px(sx + Math.cos(a) * r, -h, sz + Math.sin(a) * r, [WHITE, C[6], C[5], C[4], C[3]][clamp(lvl, 0, 4)]);
        }
      }
    }

    // the head: foam balls churning in a cap on top of the column, an umbrella of streaks pouring off its rim all the way round
    function foamHead(q, H, k) {
      if (k <= 0.01 || H < 4) return;
      const yaw = q.camera.yaw;
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * TAU + 0.15 * rand(i, S + 19), far = Math.sin(a + yaw) < 0, r0 = (9 + 8 * rand(i, S + 20)) * k, len = (14 + 26 * rand(i, S + 21)) * k, speed = 70 + 50 * rand(i, S + 22);
        for (let j = 0; j < 3; j++) {
          const f = ((t * speed) / len + j / 3 + rand(i, S + 23)) % 1, y0 = -H + 2 + f * len, r = r0 + f * f * 8, L = 1 + 4 * f * (1 - f) * 2, ca = Math.cos(a), sa = Math.sin(a);
          if (f < 0.85) q.line(ca * r, y0, sa * r, ca * (r + 0.7), y0 + L, sa * (r + 0.7), f < 0.4 ? (far ? C[5] : C[6]) : f < 0.7 ? (far ? C[4] : C[5]) : far ? C[3] : C[4]);
        }
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU * 2.4 + t * (i % 2 ? 1.3 : -1.1), rho = (2 + 8 * rand(i, S)) * k, rad = rho * 1.15 + noise(t * 3 + i, S + 8) * 1.2;
        const y = -H + (rho / 10) * 4 - 4 * (1 - rho / (10 * k)) + noise(t * 3 + i + 50, S + 9) * 2.5, r = (1.8 + 2.4 * rand(i, S + 2) + 0.6 * Math.sin(t * 7 + i)) * k;
        foam(q, Math.cos(a) * rad, y, Math.sin(a) * rad, r, Math.sin(a + yaw) < 0 ? DIM : rho > 6 * k ? MID : BRI);
      }
    }

    return {
      update(dt) {
        t += dt;
        const H = top(t), hk = head(t), k = t / ERUPT;
        // building: bubbles burst on the heaving mound, faster and faster, steam starts to lift
        if (t < ERUPT && emit(1.5 + 9 * k * k, dt)) {
          const a = R.range(0, TAU), r = R.range(0, 7), x = Math.cos(a) * r, z = Math.sin(a) * r;
          pops.push({ x, z, h: R.range(1, 3), age: 0, r: R.range(1, 2) });
          rings.add(x, z, 1, R.range(5, 9), 0.55, { n: 1, k: 0.85 });
          for (let i = R.int(1, 3); i > 0; i--) drops.add({ x, z, h: 2, vx: R.range(-25, 25), vz: R.range(-25, 25), vh: R.range(50, 120), s: 1, small: true, life: 1 });
        }
        if (t < ERUPT && emit(3 + 7 * k, dt)) {
          const [x, z] = circ(8), [vx, vz] = circ(10);
          mist.add(x, -R.range(1, 5), vx, -R.range(6, 18), 2, R.range(5, 9), R.range(0.9, 1.5), C[6], 0.22, 0, z, vz);
        }
        for (const [s0, hs] of SPURTS)
          if (once("spurt" + s0, s0 + 0.08))
            for (let i = 0; i < 3 + Math.round(hs / 4); i++) {
              const a = R.range(0, TAU), v = R.range(10, 40);
              drops.add({ x: 0, z: 0, h: hs * 0.8, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(20, 90), s: R.chance(0.3) ? 2 : 1 });
            }
        if (once("erupt", ERUPT)) {
          // the blast: light, a ring thrown across the ground, water flung high, steam rolling out
          lights.add(0, -26, 64, C[5], 0.85, 0.6);
          lights.add(0, -4, 28, WHITE, 0.75, 0.1);
          rings.add(0, 0, 6, 40, 1.2, { n: 2, gap: 3, k: 1.2, hot: 0.12, glint: 1 });
          for (let i = 0; i < 44; i++) {
            const a = R.range(0, TAU), v = R.range(30, 120);
            drops.add({ x: Math.cos(a) * 3, z: Math.sin(a) * 3, h: R.range(2, 10), vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(180, 400), s: R.chance(0.15) ? 3 : R.chance(0.35) ? 2 : 1, delay: R.range(0, 0.12) });
          }
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + R.range(-0.2, 0.2), r = R.range(3, 9), v = R.range(30, 80);
            mist.add(Math.cos(a) * r, -R.range(1, 6), Math.cos(a) * v, -R.range(4, 18), 3, R.range(9, 14), R.range(1.2, 1.9), R.chance(0.5) ? C[6] : WHITE, 0.3, R.range(0, 0.15), Math.sin(a) * r, Math.sin(a) * v);
          }
          for (let i = 0; i < 14; i++) {
            const [x, z] = circ(16), [vx, vz] = circ(10);
            ps.spawn3(P.STAR, x, -R.range(8, 80), z, vx, -6, vz, R.range(0.3, 0.7), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.6), R.range(0.05, 0.5));
          }
        }
        // holding: the head sheds drops that rain back down, spray hangs off the column, steam pours off the top
        if (hk > 0) {
          if (emit(60 * hk, dt)) {
            const a = R.range(0, TAU), v = R.range(10, 60), [x, z] = circ(9);
            drops.add({ x, z, h: H + R.range(-8, 3), vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(-40, 60), s: R.chance(0.08) ? 3 : R.chance(0.3) ? 2 : 1 });
          }
          if (emit(9 * hk, dt)) {
            const [x, z] = circ(8), [vx, vz] = circ(34);
            mist.add(x, -H + R.range(-6, 2), vx, -R.range(14, 34), 3, R.range(8, 13), R.range(0.9, 1.4), R.chance(0.6) ? C[6] : WHITE, 0.2, 0, z, vz);
          }
          if (emit(5 * hk, dt)) {
            const a = R.range(0, TAU), r = R.range(3, 9), v = R.range(20, 50);
            mist.add(Math.cos(a) * r, -R.range(1, 6), Math.cos(a) * v, -R.range(2, 10), 3, R.range(8, 12), R.range(1, 1.6), C[6], 0.22, 0, Math.sin(a) * r, Math.sin(a) * v);
          }
          if (emit(40 * hk, dt)) {
            const a = R.range(0, TAU), hh = R.range(8, H * 0.95), rc = 3 + 6 * Math.pow(hh / H, 1.8), v = R.range(10, 45);
            ps.spawn3(P.FLAKE, Math.cos(a) * rc, -hh, Math.sin(a) * rc, Math.cos(a) * v, R.range(-20, 10), Math.sin(a) * v, R.range(0.6, 1.2), R.chance(0.5) ? WHITE : C[6], R.range(0.6, 1.3));
          }
          if (emit(4 * hk, dt)) rings.add(R.range(-2, 2), R.range(-2, 2), 4, poolR(t) * R.range(0.7, 1), 0.9, { n: 1, k: 0.8 });
          if (emit(7 * hk, dt)) {
            const [x, z] = circ(14), [vx, vz] = circ(6);
            ps.spawn3(P.STAR, x, -R.range(10, H + 8), z, vx, -4, vz, R.range(0.25, 0.55), R.chance(0.4) ? WHITE : C[6], R.range(0.8, 2.2), 0);
          }
        }
        if (once("collapse", FALL + 0.12)) {
          // the head falls apart: a heavy rain of drops all at once
          for (let i = 0; i < 40; i++) {
            const a = R.range(0, TAU), v = R.range(15, 80), [x, z] = circ(6);
            drops.add({ x, z, h: top(t) + R.range(-8, 4), vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(-40, 60), s: R.chance(0.12) ? 3 : R.chance(0.35) ? 2 : 1, delay: R.range(0, 0.25) });
          }
          for (let i = 0; i < 6; i++) {
            const [x, z] = circ(8), [vx, vz] = circ(34);
            mist.add(x, -top(t) + R.range(-6, 6), vx, -R.range(10, 26), 4, R.range(9, 13), R.range(0.8, 1.2), C[6], 0.18, 0, z, vz);
          }
        }
        for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].age += dt) > 0.12) pops.splice(i, 1);
        for (let i = plinks.length - 1; i >= 0; i--) if ((plinks[i].age += dt) > 0.14) plinks.splice(i, 1);
        drops.update(dt);
        rings.update(dt);
        mist.update(dt);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), yaw = q.camera.yaw, H = top(t), hk = head(t), k = clamp(t / ERUPT), thin = smooth(ERUPT, ERUPT + 0.12, t) * (1 - 0.55 * smooth(FALL, GONE, t));
        // the pool: dark see-through water, a lit far rim
        const pr = poolR(t), pk = poolK(t);
        if (pk > 0)
          q.plane(0, 0, 0, null, pr, (u, v, out) => {
            const d = (u * u + v * v) / (pr * pr);
            if (d > 1) return;
            out.c = d < 0.15 ? C[2] : C[1];
            out.a = 0.6 * pk * Math.min(1, (1 - d) * 4);
            out.blend = true;
            if (u * q.sy + v * q.cy < 0 && d > 0.78 && d < 0.95) {
              out.c = C[4];
              out.a = 0.7 * pk;
            }
          });
        rings.draw3(q, C, 0);
        const u = (t - ERUPT) / 0.4;
        if (u > 0 && u < 1) ring3(q, 0, 0, 6 + 42 * ease.outCubic(u), 1.5 * (1 - u), C, { n: 3, gap: 1.6 + 2 * u, hot: u < 0.3, seed: 9, y: 0 });
        // foam rides the pool round the foot of the column
        const fk = smooth(ERUPT, ERUPT + 0.3, t) * (1 - smooth(GONE - 0.3, 4.4, t));
        if (fk > 0) {
          const rr = 8 + 10 * fk;
          q.decal(0, 0, 0, null, rr + 1, (pp) => lace(pp, 0, 0, rr, rr, fk, C, t, S));
        }
        // the heaving mound while it builds, beating faster: a dome of water, white where it faces the light, shadow low on the right
        if (t < ERUPT + 0.05) {
          const beat = Math.pow(Math.max(0, Math.sin(t * (8 + 18 * k * k))), 3), rd = 4 + 3.5 * k + 1.5 * beat, hd = 1.5 + 3 * k + 3 * beat, nr = Math.ceil(rd / 0.6);
          for (let i = 0; i <= nr; i++) {
            const rr = (rd * i) / nr, s = rr / rd, m = i ? Math.max(6, Math.ceil(rr * TAU * 1.6)) : 1, y = -hd * Math.sqrt(1 - s * s);
            for (let j = 0; j < m; j++) {
              const a = (j / m) * TAU + i * 0.7, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
              const [vr, vd, vt] = q.view(x / (rd * rd), y / (hd * hd), z / (rd * rd)), len = Math.hypot(vr, vd, vt) || 1, lit = -(vr + vd) * 0.7 / len;
              const c = vt / len < 0.57 ? (lit > 0.3 ? WHITE : lit > -0.15 ? C[6] : C[4]) : lit > 0.55 ? C[6] : lit > 0.12 ? C[5] : lit > -0.3 ? C[4] : C[3];
              q.px(x, y, z, c);
            }
          }
          q.px(-rd * 0.35 * q.cy, -hd * 0.93, rd * 0.35 * q.sy, WHITE);
          q.glow(0, -5, 0, 16 + 16 * k + 8 * beat, C[5], 0.06 + 0.12 * k + 0.12 * beat);
        }
        // spurts while it builds and sputters as it dies: a short white jet with a bead on top
        const sp = spurt(t);
        if (sp > 1 && H < 1) {
          q.beam(0, 0, 0, 0, -sp, 0, 2.4, (_, v) => (v < 0.4 ? WHITE : v < 0.8 ? C[6] : C[5]));
          q.ball(0, -sp, 0, 1.3, C[6]);
          q.px(0, -sp - 1.4, 0, WHITE);
          q.glowLine(0, 0, 0, 0, -sp, 8, C[5], 0.3);
        }
        column(q, H, thin);
        // the foot: billows boil out round it
        if (hk > 0 || (H > 1 && t < GONE))
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU + t * 2.1, r = 5 + 2 * Math.sin(t * 5 + i * 1.7), amt = Math.max(hk, thin * 0.6);
            foam(q, Math.cos(a) * r * 1.3, -2, Math.sin(a) * r * 1.3, (1.6 + 1.4 * rand(i, S + 4)) * amt, Math.sin(a + yaw) < 0 ? MID : BRI);
          }
        foamHead(q, H, hk);
        for (const c of pops) {
          const g = c.age / 0.12;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + 0.4, d = c.r + 3 * g;
            q.dot(c.x + Math.cos(a) * d, -c.h - 2 * g, c.z + Math.sin(a) * d, C[6], 1 - g);
          }
        }
        for (const c of plinks) {
          const g = c.age / 0.14;
          if (g < 0.5) q.px(c.x, -0.5, c.z, WHITE);
          if (c.s > 1) q.line(c.x, -1, c.z, c.x, -1 - 3 * (1 - g), c.z, g < 0.4 ? WHITE : C[6]);
          q.glow(c.x, 0, c.z, 4, C[5], 0.25 * (1 - g));
        }
        drops.draw3(q, C, 0);
        // the blast's first two frames: a white burst at the vent
        const f = (t - ERUPT) / 0.07;
        if (f >= 0 && f < 1) {
          q.ball(0, -4, 0, 7 * (1 - f * 0.4), WHITE);
          q.plane(0, 0, 0, null, 12, (a, b) => (Math.hypot(a, b) < 7.2 ? WHITE : C[6]));
        }
        ps.draw(q);
        mist.draw3(q, C[5]);
        lights.draw(q);
        // light: the column and its head, the pool round its foot
        if (H > 1) {
          q.glowLine(0, 0, 0, 0, -H, 0, 26, C[4], 0.2 * thin);
          q.glow(0, -H - 2, 0, 38, C[5], 0.34 * hk);
        }
        q.glow(0, -2, 0, 46, C[4], 0.24 * Math.max(hk, t < ERUPT ? 0.3 * k : 0));
        q.glow(0, 2, 0, 60, C[3], 0.12 * poolK(t));
      },
    };
  },
};
