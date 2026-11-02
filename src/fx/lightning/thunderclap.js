// The flash and flare, the bolts and their flicker, the plasma spray, the scorch where bolts land and the dust
// thrown along the floor follow Sprite Fusion's open-source lightning and explosion
// (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, band, flare, sparkle, clamp, smooth, ease, rng, space, TAU, WHITE, hex, mix, READY } from "../../core/index.js";
import { VOLT, PLASMA, zigzag, stroke, crackle, scorch, zigzag3, stroke3, crackle3, scorchDisc, nearer, pool } from "./_lib.js";

export const meta = {
  name: "Thunderclap",
  desc: "A thunderclap round the caster: a white flash, forked bolts burst out and stab the floor, a heavy shock ring tears across the ground raising dust and grit, sparks streak away.",
  tags: ["lightning", "electric", "nova", "aoe", "spell", "shockwave", "one-shot"],
  size: [288, 156],
  origin: [144, 124],
  duration: 1.9,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: VOLT, sparks: PLASMA, reach: 104, seed: 6 },
};

const WIDE = { turn: 1.15, crouch: 5, lean: -1, fx: -15, fy: -33, bx: 15, by: -33, ffx: -7, fbx: 8 };
const CLAP_ = { turn: 1.15, y: -2, crouch: 0, fx: -1, fy: -45, bx: 1, by: -45, ffx: -3, ffy: -5, fbx: 4, fby: -5 };
export const act = {
  onBody: true,
  follow: 0,
  target: { x: 104 },
  poses: [
    [-0.46, READY],
    [-0.18, WIDE],
    [0.08, { ...WIDE, crouch: 6 }],
    [0.12, CLAP_, "snap"],
    [0.55, { ...CLAP_, y: 0, ffy: -4, fby: -4, crouch: 1 }],
    [1.05, { turn: 1, crouch: 3, fx: -10, fy: -28, bx: 11, by: -28, ffx: -4, fbx: 5 }],
    [1.7, READY],
  ],
  hits: [
    { t: 0.12, stop: 0.13, shake: 0.3, amp: 3, target: false },
    { t: 0.42, push: 2, straw: 14, y: -8, skin: "shock", shiver: 0.5 },
    { t: 1.2, push: 0, straw: 0, flash: 0, skin: null },
  ],
};

const CLAP = 0.12, CY = -22, BK = [1, 0.7, 0.95, 0.5, 0.8, 0.3];
const DUST = hex("#6e6382"), STONE = ["#655b7a", "#4a4263", "#342d45"].map(hex), ASH = hex("#5b5566");

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), REACH = o.reach, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: o.sparks }), hot = new Particles({ rng: R, ground: floor }), lights = new Lights();
  // eight bolts: the lower ones stab the floor, the upper ones tear into the air
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const down = i % 2 === 0, side = i % 4 < 2 ? -1 : 1, a = down ? (side > 0 ? R.range(0.35, 0.75) : Math.PI - R.range(0.35, 0.75)) : side > 0 ? -R.range(0.15, 1.2) : Math.PI + R.range(0.15, 1.2);
    const L = down ? -CY / Math.sin(a) : R.range(40, 62), x1 = Math.cos(a) * L, y1 = down ? 0 : CY + Math.sin(a) * L;
    return { down, x1, y1, t0: CLAP + R.range(0, 0.06) };
  });
  const front = (t) => (t < CLAP ? 0 : 8 + (REACH - 8) * ease.outCubic(clamp((t - CLAP) / 0.5)));
  let t = 0, clapped = false;
  const landed = bolts.map(() => false);
  return {
    update(dt) {
      t += dt;
      // the breath before: sparks rush in to the caster's chest
      if (t < CLAP && R.chance(60 * dt)) {
        const a = R.range(0, TAU), d = R.range(16, 30), T = R.range(0.07, 0.1), v = (d * 3) / (Math.exp(3 * T) - 1);
        ps.spawn(P.STREAK, Math.cos(a) * d, CY + Math.sin(a) * d * 0.8, -Math.cos(a) * v, -Math.sin(a) * v * 0.8, T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (t >= CLAP && !clapped) {
        clapped = true;
        lights.add(0, CY - 10, 100, C[4], 0.65, 0.45);
        lights.add(0, CY, 26, WHITE, 0.5, 0.07);
        for (let i = 0; i < 64; i++) {
          const a = R.range(0, TAU), sp = R.range(170, 380) * (Math.sin(a) > 0.4 ? 0.5 : 1);
          ps.spawn(P.SPARK, Math.cos(a) * 6, CY + Math.sin(a) * 6, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.2, 0.55));
        }
        for (let i = 0; i < 8; i++) ps.spawn(P.SMOKE, R.range(-8, 8), CY + R.range(-6, 6), R.range(-25, 25), -R.range(10, 30), R.range(0.8, 1.3), mix(ASH, C[4], 0.3), R.range(4, 7), R.range(0.05, 0.2));
      }
      for (const [i, b] of bolts.entries())
        if (b.down && !landed[i] && t >= b.t0) {
          landed[i] = true;
          lights.add(b.x1, -4, 46, C[4], 0.7, 0.25);
          for (let j = 0; j < 12; j++) {
            const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(70, 240);
            ps.spawn(P.SPARK, b.x1, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.5));
          }
          for (let j = 0; j < 5; j++) hot.spawn(P.SPARK, b.x1 + R.range(-2, 2), -1, R.range(-80, 80), -R.range(60, 180), R.range(0.4, 0.8));
        }
      // the ring tears the floor up as it passes: dust rolling out, grit tossed
      const fr = front(t);
      if (t > CLAP && t < CLAP + 0.5)
        for (const s of [-1, 1]) {
          if (R.chance(70 * dt)) ps.spawn(P.SMOKE, s * fr + R.range(-3, 3), -R.range(1, 4), s * R.range(10, 40), -R.range(5, 20), R.range(0.6, 1.1), DUST, R.range(3, 6) * (1 - 0.4 * (fr / REACH)), 0, PF.BIG);
          if (R.chance(50 * dt)) ps.spawn(P.GRIT, s * fr, -1, s * R.range(10, 60), -R.range(60, 180), R.range(0.8, 1.3), R.pick(STONE), R.chance(0.3) ? 2 : 1);
        }
      ps.update(dt);
      hot.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // scorch where the bolts struck, and the far half of the shock ring
      for (const b of bolts) if (b.down && t >= b.t0) scorch(p, b.x1, 0, 9, Math.pow(clamp(1 - (t - b.t0) / 1.1), 1.3), 1 - smooth(1.4, 1.85, t));
      const u = (t - CLAP) / 0.5;
      if (u > 0 && u < 1) band(p, 0, 0.5, front(t), 0.18, Math.max(2, 16 * (1 - u)), 1.25 - u, [C[1], C[2], C[4], C[6]], (g) => Math.sin(g) < 0, u < 0.15);
      ps.draw(p, "back");
      hot.draw(p, "back");
    },
    draw(p) {
      const f = Math.floor(t * 30 + 1e-4), u = (t - CLAP) / 0.5, A = o.actor;
      // the flash: the caster lit white for a frame, a flare, a core
      const a = t - CLAP;
      if (a >= 0 && a < 0.07) p.mask(A.mask, A.x, A.y, a < 0.035 ? WHITE : C[6]);
      if (a >= 0 && a < 0.2) {
        const q = a / 0.2;
        flare(p, 0, CY, 44 * Math.pow(1 - q, 1.4), 1 - q, C);
        if (q < 0.35) p.circle(0, CY, 10 * (1 - q * 2) + 2, WHITE);
        p.glow(0, CY, 44, C[5], 0.32 * (1 - q));
      }
      // the bolts: struck, flickering, re-struck every other frame
      for (const [i, b] of bolts.entries()) {
        const ba = Math.floor((t - b.t0) * 30 + 1e-4);
        if (t < b.t0 || ba >= BK.length) continue;
        const r = rng(o.seed, 3, i, ba >> 1);
        stroke(p, zigzag(r, 0, CY, b.x1, b.y1, 0.25, b.down ? 0.5 : 0.8), BK[ba], C, ba === 0 ? 1 : 0.8, { hero: ba === 0 });
        if (b.down) {
          p.circle(b.x1, -1, 3 * BK[ba] + 1, C[5]);
          p.px(b.x1, -1, WHITE);
          p.glow(b.x1, -3, 20, C[5], 0.5 * BK[ba]);
        } else if (ba < 2) sparkle(p, b.x1, b.y1, 4, C[6], C[4], 0.4);
      }
      // the shock: the near half of the floor ring, and a ring in the air that bursts out from the clap
      if (u > 0 && u < 1) {
        band(p, 0, 0.5, front(t), 0.18, Math.max(2, 16 * (1 - u)), 1.25 - u, [C[1], C[2], C[4], C[6]], (g) => Math.sin(g) >= 0, u < 0.15);
        for (const s of [-1, 1]) p.glow(s * front(t), -3, 28, C[4], 0.45 * (1 - u));
        const ua = (t - CLAP) / 0.26;
        const ra = 8 + 60 * ease.outCubic(ua);
        if (ua < 1) p.ring(0, CY, ra, Math.max(1, 2 * (1 - ua)), ua < 0.25 ? C[5] : ua < 0.6 ? C[4] : C[3], (v, g) => (CY + Math.sin(g) * ra > -1 ? 0 : 0.85 - 0.85 * ua));
      }
      // the hum after: small arcs crackle round the caster as the charge bleeds away
      if (a > 0.2 && a < 0.9) {
        const r = rng(o.seed, 9, f), k = 1 - (a - 0.2) / 0.7;
        if (r.next() < 0.8) {
          const x0 = r.range(-14, 14), y0 = r.range(-34, -4), b = r.range(0, TAU), l = r.range(6, 13);
          crackle(p, zigzag(r, x0, y0, x0 + Math.cos(b) * l, y0 + Math.sin(b) * l, 0.4, 0.3), 0.85 * k + 0.1, C, 0.35);
        }
      }
      ps.draw(p, "front");
      hot.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: the clap in the round. Eight bolts burst out of the caster's chest all the way round, the ones low enough
// stab the floor and scorch it, the shock ring is a true circle tearing across the ground (the far half behind him, the
// near half in front), a ring of light spreads through the air at chest height, dust and grit roll out every way.
export const three = {
  meta: { size: [272, 184], origin: [136, 142], bg: "ground", camera: { pitch: 0.34 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), REACH = o.reach, floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: o.sparks }), hot = new Particles({ rng: R, ground: floor }), lights = new Lights();
    // eight bolts spaced round the caster: the lower ones stab the floor, the upper ones tear into the air
    const bolts = Array.from({ length: 8 }, (_, i) => {
      const down = i % 2 === 0, az = (i / 8) * TAU + R.range(-0.2, 0.2), el = down ? R.range(0.35, 0.75) : -R.range(0.15, 1.2);
      const L = down ? -CY / Math.sin(el) : R.range(40, 62), h = Math.cos(el) * L;
      return { down, end: [Math.cos(az) * h, down ? 0 : CY + Math.sin(el) * L, Math.sin(az) * h], t0: CLAP + R.range(0, 0.06) };
    });
    const front = (t) => (t < CLAP ? 0 : 8 + (REACH - 8) * ease.outCubic(clamp((t - CLAP) / 0.5)));
    const dir3 = (sp0, sp1) => {
      const a = R.range(0, TAU), c = R.range(-1, 1), s = Math.sqrt(1 - c * c), sp = R.range(sp0, sp1);
      return [Math.cos(a) * s * sp, -c * sp, Math.sin(a) * s * sp, c];
    };
    let t = 0, clapped = false;
    const landed = bolts.map(() => false);
    return {
      update(dt) {
        t += dt;
        // the breath before: sparks rush in to the caster's chest from every side
        if (t < CLAP && R.chance(60 * dt)) {
          const a = R.range(0, TAU), c = R.range(-0.8, 0.8), s = Math.sqrt(1 - c * c), d = R.range(16, 30), T = R.range(0.07, 0.1), v = (d * 3) / (Math.exp(3 * T) - 1);
          ps.spawn3(P.STREAK, Math.cos(a) * s * d, Math.min(-3, CY - c * d * 0.8), Math.sin(a) * s * d, -Math.cos(a) * s * v, c * v * 0.8, -Math.sin(a) * s * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
        if (t >= CLAP && !clapped) {
          clapped = true;
          lights.add(0, CY - 10, 100, C[4], 0.65, 0.45);
          lights.add(0, CY, 26, WHITE, 0.5, 0.07);
          for (let i = 0; i < 64; i++) {
            const [vx, vy, vz, c] = dir3(170, 380), k = c < -0.4 ? 0.5 : 1;
            ps.spawn3(P.SPARK, vx * 0.015, CY + vy * 0.015, vz * 0.015, vx * k, vy * k - 40, vz * k, R.range(0.2, 0.55));
          }
          for (let i = 0; i < 8; i++) ps.spawn3(P.SMOKE, R.range(-8, 8), CY + R.range(-6, 6), R.range(-8, 8), R.range(-25, 25), -R.range(10, 30), R.range(-25, 25), R.range(0.8, 1.3), mix(ASH, C[4], 0.3), R.range(4, 7), R.range(0.05, 0.2));
        }
        for (const [i, b] of bolts.entries())
          if (b.down && !landed[i] && t >= b.t0) {
            landed[i] = true;
            const [bx, , bz] = b.end;
            lights.add(bx, -4, 46, C[4], 0.7, 0.25, bz);
            for (let j = 0; j < 12; j++) {
              const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(70, 240), phi = R.range(0, TAU);
              ps.spawn3(P.SPARK, bx, -1, bz, Math.cos(a) * Math.cos(phi) * sp, Math.sin(a) * sp, Math.cos(a) * Math.sin(phi) * sp, R.range(0.2, 0.5));
            }
            for (let j = 0; j < 5; j++) hot.spawn3(P.SPARK, bx + R.range(-2, 2), -1, bz + R.range(-2, 2), R.range(-80, 80), -R.range(60, 180), R.range(-80, 80), R.range(0.4, 0.8));
          }
        // the ring tears the floor up as it passes: dust rolling out, grit tossed, all the way round
        const fr = front(t);
        if (t > CLAP && t < CLAP + 0.5)
          for (let n = 0; n < 2; n++) {
            if (R.chance(70 * dt)) {
              const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), v = R.range(10, 40);
              ps.spawn3(P.SMOKE, ca * fr + R.range(-3, 3), -R.range(1, 4), sa * fr + R.range(-3, 3), ca * v, -R.range(5, 20), sa * v, R.range(0.6, 1.1), DUST, R.range(3, 6) * (1 - 0.4 * (fr / REACH)), 0, PF.BIG);
            }
            if (R.chance(50 * dt)) {
              const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), v = R.range(10, 60);
              ps.spawn3(P.GRIT, ca * fr, -1, sa * fr, ca * v, -R.range(60, 180), sa * v, R.range(0.8, 1.3), R.pick(STONE), R.chance(0.3) ? 2 : 1);
            }
          }
        ps.update(dt);
        hot.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), f = Math.floor(t * 30 + 1e-4), u = (t - CLAP) / 0.5, A = o.actor, a = t - CLAP;
        // scorch where the bolts struck
        for (const b of bolts) if (b.down && t >= b.t0) {
          const T0 = Math.pow(clamp(1 - (t - b.t0) / 1.1), 1.3), fade = 1 - smooth(1.4, 1.85, t);
          if (T0 > 0.02 && fade > 0) q.decal(b.end[0], 0, b.end[2], null, 12, (pp) => scorchDisc(pp, 9, T0, fade));
        }
        // the flash: the caster lit white for a frame, a flare, a core
        if (a >= 0 && a < 0.07) p.mask(A.mask, A.x, A.y, a < 0.035 ? WHITE : C[6]);
        if (a >= 0 && a < 0.2) {
          const k = a / 0.2;
          q.at(...nearer(q, 0, CY, 0, 30), (pp) => {
            flare(pp, 0, 0, 44 * Math.pow(1 - k, 1.4), 1 - k, C);
            if (k < 0.35) pp.circle(0, 0, 10 * (1 - k * 2) + 2, WHITE);
          });
          if (k < 0.35) q.ball(...nearer(q, 0, CY, 0, 14), 5 * (1 - k * 2) + 1, WHITE);
          q.glow(0, CY, 0, 44, C[5], 0.32 * (1 - k));
        }
        // the bolts: struck, flickering, re-struck every other frame
        for (const [i, b] of bolts.entries()) {
          const ba = Math.floor((t - b.t0) * 30 + 1e-4);
          if (t < b.t0 || ba >= BK.length) continue;
          const r = rng(o.seed, 3, i, ba >> 1);
          stroke3(q, zigzag3(r, [0, CY, 0], b.end, 0.25, b.down ? 0.5 : 0.8), BK[ba], C, ba === 0 ? 1 : 0.8, { hero: ba === 0 });
          if (b.down) {
            q.plane(b.end[0], -0.5, b.end[2], null, 3 * BK[ba] + 1, (uu, vv) => (Math.hypot(uu, vv) < 1 ? WHITE : C[5]));
            q.glow(b.end[0], -3, b.end[2], 20, C[5], 0.5 * BK[ba]);
          } else if (ba < 2) q.at(...b.end, (pp) => sparkle(pp, 0, 0, 4, C[6], C[4], 0.4));
        }
        // the shock: a ring of light tearing across the floor, and a ring in the air that bursts out from the clap
        if (u > 0 && u < 1) {
          const r = front(t), w = Math.max(2, 16 * (1 - u)), k = 1.25 - u, hotRim = u < 0.15;
          q.plane(0, 0, 0, null, r, (x, z, out) => {
            const b = (r - Math.hypot(x, z)) / w;
            if (b < 0 || b > 1) return;
            out.c = b < 0.15 ? (hotRim ? WHITE : C[6]) : b < 0.4 ? C[4] : b < 0.7 ? C[2] : C[1];
            out.a = k * (b < 0.4 ? 1.2 : 1.15 - b);
            out.l = C[4];
            out.k = 0.45 * (1 - u) * (1 - b);
          });
          const ua = a / 0.26;
          if (ua < 1) q.ring(0, CY, 0, 8 + 60 * ease.outCubic(ua), Math.max(1, 2 * (1 - ua)), ua < 0.25 ? C[5] : ua < 0.6 ? C[4] : C[3], 0.85 - 0.85 * ua);
        }
        // the hum after: small arcs crackle round the caster as the charge bleeds away
        if (a > 0.2 && a < 0.9) {
          const r = rng(o.seed, 9, f), k = 1 - (a - 0.2) / 0.7;
          if (r.next() < 0.8) {
            const az = r.range(0, TAU), d = r.range(0, 14), b = r.range(0, TAU), l = r.range(6, 13), el = r.range(-0.6, 0.6), x0 = Math.cos(az) * d, z0 = Math.sin(az) * d, y0 = r.range(-34, -4);
            crackle3(q, zigzag3(r, [x0, y0, z0], [x0 + Math.cos(b) * Math.cos(el) * l, y0 + Math.sin(el) * l, z0 + Math.sin(b) * Math.cos(el) * l], 0.4, 0.3), 0.85 * k + 0.1, C, 0.35);
          }
        }
        if (u > 0 && u < 1) pool(q, 0, 0, front(t) * 0.8, C[3], 0.2 * (1 - u));
        ps.draw(q);
        hot.draw(q);
        lights.draw(q);
      },
    };
  },
};
