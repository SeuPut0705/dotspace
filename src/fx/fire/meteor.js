// The impact's particle recipe (fire puffs that cool into smoke, sparks, embers, burning brands that land and
// keep burning, rocks, grit, dust, scorch) is adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, fit, band, flare, clamp, smooth, ease, noise, rand, TAU, WHITE, hex, mix, scale, rgb, space, lit } from "../../core/index.js";
import { hotFirst, flameBlade, simDraw, floorLight, LAYERS, floorGlow, simDraw3 } from "./_lib.js";

export const meta = {
  name: "Meteor",
  desc: "A burning rock streaks in from the upper left in a comet of fire and smashes into the floor: a white flash, a fireball, rocks and brands thrown, a glowing crater that cools.",
  tags: ["fire", "meteor", "impact", "explosion", "spell", "debris", "one-shot"],
  size: [272, 232],
  origin: [150, 208],
  duration: 5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    stone: "#4a3f69",
    rock: ["#120e16", "#2a2230", "#463a4a", "#6a5a66"],
    seed: 9,
  },
};

const HIT = 0.62, FROM = [-112, -142], SOOT = hex("#0d0a12"), SOOT2 = hex("#17121d"), OUTLINE = hex("#1a1422"), WARM = rgb(255, 176, 96);

function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3) };
}
function rock(p, b, st) {
  const r = 0.6 + b.s * 0.75, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
    out.a = fade;
  });
}

export function create(o) {
  const F = fit(o.palette, 9), H = hotFirst(F), RK = fit(o.rock, 4), st = stone(o.stone), R = new Rng(o.seed), floor = () => 0, S = o.seed * 11;
  let blazes;
  const ps = new Particles({ rng: R, ground: floor, sparks: [H[1], H[2], H[4], H[5]], onLand: (x, y) => blazes.add(x, y - 0.25, R.range(0.9, 1.6), R.range(0.5, 0.85)) });
  blazes = new Blazes(ps);
  const bits = new Bits({ ground: floor }), lights = new Lights(), GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25);
  const len = Math.hypot(FROM[0], FROM[1]), ux = -FROM[0] / len, uy = -FROM[1] / len;
  // the flight: speeding up a touch as it falls
  const pos = (tt) => {
    const k = ease.inQuad(clamp(tt / HIT)) * 0.35 + clamp(tt / HIT) * 0.65;
    return [FROM[0] * (1 - k), FROM[1] * (1 - k)];
  };
  let t = 0, hit = false, last = pos(0);

  // the meteor: a lumpy rock, white-hot on its leading face, cracks glowing over the dark back, an outline
  const meteor = (p, x, y, R0, cool, alpha = 1) => {
    p.shade(x - R0 - 2, y - R0 - 2, x + R0 + 2, y + R0 + 2, (px, py, out) => {
      out.a = alpha;
      const dx = px - x, dy = py - y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), rr = R0 * (1 + 0.18 * noise(a * 2.2 + 3, S) + 0.1 * noise(a * 5, S + 1));
      if (d > rr + 1) return;
      if (d > rr) return OUTLINE;
      const face = (dx * ux + dy * uy) / Math.max(1, d), heat = (1 - cool) * (face * 0.6 + 0.5 - (d / rr) * 0.25);
      if (heat > 0.62) return heat > 0.85 ? H[0] : heat > 0.74 ? H[1] : H[2];
      if (heat > 0.42) return H[4];
      const h = rand(Math.floor(px - x), Math.floor(py - y), S + 3);
      if (h < 0.22 * (1 - cool * 0.7)) return (1 - cool) > 0.5 ? H[4] : H[6];
      return dx * -0.6 + dy * -0.8 > 0 ? RK[2] : d / rr > 0.6 ? RK[0] : RK[1];
    });
  };
  // the crater: hot rock pooled in the dent cooling to soot, a lip of broken floor
  const crater = (p) => {
    if (t < HIT) return;
    const a = t - HIT, end = 1 - smooth(meta.duration - 1, meta.duration - 0.15, t), rx = 36 * Math.min(1, a / 0.08), ry = 6;
    for (let y = -1; y <= 3; y++)
      for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
        const dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        const k = rand(x * 31 + y, S + 5), T = Math.pow(clamp(1 - a / 2.6), 1.3) * (1.25 - d) - k * 0.35;
        if (T > 0.06) {
          const ramp = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7], H[8]], c = ramp[Math.min(8, Math.floor((1 - Math.min(1, T)) * 8))];
          p.dot(x, y, c, end);
          if ((x & 3) === 0) p.glow(x + 0.5, y, 7, c, 0.2 * T * end);
        } else p.dot(x, y, d < 0.55 ? SOOT : SOOT2, (d < 0.95 - k * 0.3 ? 1 : 1 - d) * end);
      }
    // the lip: broken floor heaped round the edge, lit by the glow inside
    for (let x = -40; x <= 40; x++) {
      const e = Math.abs(x) / 40, hh = e < 0.7 ? 0 : Math.round(2.4 * Math.sin(((e - 0.7) / 0.3) * Math.PI) * (0.6 + 0.4 * rand(x, S + 7)));
      for (let j = 0; j < hh; j++) p.dot(x, -1 - j, j === hh - 1 ? mix(st.light, H[4], 0.5 * clamp(1 - a / 2)) : st.shade, end);
      if (hh) p.dot(x, 0, OUTLINE, end);
    }
  };

  return {
    update(dt) {
      t += dt;
      if (t < HIT) {
        // the flight: a comet of fire shed behind, smoke, sparks, embers
        const [x, y] = pos(t), vx = (x - last[0]) / dt, vy = (y - last[1]) / dt;
        last = [x, y];
        for (let i = 0; i < 3; i++) {
          if (!R.chance(0.8 * dt * 60)) continue;
          ps.spawn(P.FIRE, x - ux * R.range(2, 8) + R.range(-3, 3), y - uy * R.range(2, 8) + R.range(-3, 3), vx * 0.15 + R.range(-20, 20), vy * 0.15 + R.range(-30, 10), R.range(0.3, 0.6), 0, R.range(3, 6), 0, R.chance(0.65) ? PF.SMOKES | PF.BIG : 0);
        }
        if (R.chance(0.6 * dt * 60)) ps.spawn(P.SPARK, x, y, vx * 0.35 + R.range(-80, 80), vy * 0.35 + R.range(-80, 40), R.range(0.2, 0.5));
        if (R.chance(0.3 * dt * 60)) ps.spawn(P.EMBER, x, y, vx * 0.1 + R.range(-30, 30), vy * 0.1 + R.range(-40, 0), R.range(0.8, 1.6), H[3], R.chance(0.2) ? 2 : 1);
      } else if (!hit) {
        hit = true;
        // the impact: flash, fireball thrown up and forward with the rock's momentum, a column, smoke, sparks
        lights.add(0, -40, 100, WARM, 0.95, 0.9);
        lights.add(0, -20, 46, WHITE, 0.9, 0.12);
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3) + 0.25, sp = R.range(50, 210);
          ps.spawn(P.FIRE, R.range(-6, 6), -R.range(2, 10), Math.cos(a) * sp, Math.sin(a) * sp * 0.75 - 30, R.range(0.5, 1.1), 0, R.range(5, 9), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
        }
        for (let i = 0; i < 9; i++) ps.spawn(P.FIRE, R.range(-6, 6), -6, R.range(-14, 14), -R.range(130, 220), R.range(0.8, 1.2), 0, R.range(6, 8.5), R.range(0, 0.12), PF.SMOKES | PF.BIG);
        for (let i = 0; i < 20; i++) {
          const a = R.range(-Math.PI, 0), d = R.range(4, 18);
          ps.spawn(P.SMOKE, Math.cos(a) * d, -R.range(6, 24), Math.cos(a) * R.range(10, 40), -R.range(30, 110), R.range(1.8, 2.8), 0, R.range(8, 12), R.range(0.15, 0.5), PF.BIG);
        }
        for (let i = 0; i < 16; i++) {
          const s = R.sign();
          ps.spawn(P.SMOKE, s * R.range(4, 18), -R.range(1, 5), s * R.range(60, 130) + 10, -R.range(2, 12), R.range(1.2, 2.0), st.dust, R.range(5, 8), R.range(0, 0.06), PF.BIG);
        }
        for (let i = 0; i < 90; i++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3) + 0.15, sp = R.range(100, 300);
          ps.spawn(P.SPARK, 0, -4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.7));
        }
        for (let i = 0; i < 36; i++) {
          const a = R.range(0, TAU), sp = R.range(40, 150);
          ps.spawn(P.EMBER, Math.cos(a) * 8, -8 + Math.sin(a) * 6, Math.cos(a) * sp, Math.sin(a) * sp - 70, R.range(1.2, 2.6), H[3]);
        }
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + R.range(-1, 1.05), sp = R.range(130, 240);
          ps.spawn(P.BRAND, 0, -6, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.7, 1.3));
        }
        for (let i = 0; i < 28; i++)
          bits.add({ kind: B.CHUNK, x: R.range(-8, 8), y: -3, vx: R.range(-80, 110), vy: -R.range(140, 340), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.8, 2.8), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3), ramp: [OUTLINE, st.shade, st.body, st.light, mix(st.light, WHITE, 0.3)] });
        for (let i = 0; i < 80; i++) {
          const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.7 + 0.15, sp = R.range(90, 270) * (1 - 0.4 * Math.abs(u));
          ps.spawn(P.GRIT, u * 6, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.2, 2.2), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
        }
      }
      bits.update(dt);
      for (const b of bits.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 3; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 18), R.range(0.3, 0.6), st.dust, R.range(1.3, 2.6));
        }
      blazes.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      crater(p);
      simDraw(p, ps, H, "back");
      blazes.drawBack(p);
      const k = (t - HIT) / 0.5;
      if (k > 0 && k < 1) band(p, 0, 0.5, 110 * ease.outCubic(k), 0.16, Math.max(1, 5 * (1 - k)), 1.15 - k, [st.body, st.light, H[4], H[1]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      const k = (t - HIT) / 0.5;
      if (k > 0 && k < 1) band(p, 0, 0.5, 110 * ease.outCubic(k), 0.16, Math.max(1, 5 * (1 - k)), 1.15 - k, [st.body, st.light, H[4], H[1]], (g) => Math.sin(g) >= 0, k < 0.12);
      for (const b of bits.list) rock(p, b, st);
      if (t < HIT) {
        // the comet: tongues of flame streaming back off the rock, the rock, its light; the floor lights up below
        const [x, y] = pos(t), NZ = (rate, seed = 0, off = 0) => noise(t * rate + off, seed);
        floorLight(p, 0, 0.5, 30 + 40 * (t / HIT), 7, GLOW, 0.5 * (t / HIT) ** 2);
        [[36, 7, 0], [26, 7.5, -2.5], [26, 7.5, 2.5], [16, 8, 0]].forEach(([L, w, off], i) => {
          const n = (S + i) * 13;
          flameBlade(p, x - uy * off, y + ux * off, -ux, -uy, L * (0.85 + 0.25 * NZ(5, n)), w, NZ(3, n + 3) * 3, NZ, n, H, LAYERS, 0.5, 1.6);
        });
        meteor(p, x, y, 6.5, 0);
        p.glow(x, y, 46, GLOW, 0.55);
        p.glow(x, y, 12, H[1], 0.4);
      } else {
        // the core of the meteor sits half-buried in the crater, cooling
        const a = t - HIT, cool = clamp(a / 2.8), end = 1 - smooth(meta.duration - 1.1, meta.duration - 0.2, t);
        if (end > 0) {
          meteor(p, 0, 0, 5.5, cool, end);
          p.glow(0, -2, 22, GLOW, 0.4 * (1 - cool) * end);
        }
      }
      simDraw(p, ps, H, "front");
      // the hero frame: a white-hot flash and a flare of rays
      const f = (t - HIT) / 0.08;
      if (f > 0 && f < 1) {
        p.circle(0, -6, 11 * (1 - f * 0.3) + 1.5, H[3]);
        p.circle(0, -6, 11 * (1 - f * 0.3), f < 0.5 ? H[1] : H[2]);
        p.circle(0, -6, 7 * (1 - f * 0.3), f < 0.5 ? WHITE : H[1]);
      }
      const fr = (t - HIT) / 0.24;
      if (fr > 0 && fr < 1) flare(p, 0, -6, 44 * Math.pow(1 - fr, 1.4), 1 - fr, [H[6], H[4], H[2], H[1]]);
      lights.draw(p);
    },
  };
}

// 3D: the meteor falls in from the upper left and behind along a diagonal path, a true sphere of rock with a comet of
// flame streaming back along it. The impact is a full circle: a flash ball, fireball puffs flung every way, a shock
// ring running out over the floor, a flare of rays in space; the crater is a true circle that cools, ringed by a lip of
// broken floor, with rocks and burning brands thrown in every direction that land and keep burning.
export const three = {
  meta: { size: [304, 270], origin: [152, 226], camera: { pitch: 0.35 } },
  create(o) {
    const F = fit(o.palette, 9), H = hotFirst(F), RK = fit(o.rock, 4), st = stone(o.stone), R = new Rng(o.seed), floor = () => 0, S = o.seed * 11;
    let blazes;
    const ps = new Particles({ rng: R, ground: floor, sparks: [H[1], H[2], H[4], H[5]], onLand: (x, y, z) => blazes.add(x, y - 0.25, R.range(0.9, 1.6), R.range(0.5, 0.85), z) });
    blazes = new Blazes(ps);
    const bits = new Bits({ ground: floor }), lights = new Lights(), GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25);
    const FROM3 = [-92, -146, -54], len = Math.hypot(...FROM3), [ux, uy, uz] = FROM3.map((v) => -v / len);
    const hl = Math.hypot(ux, uz), fx = ux / hl, fz = uz / hl;
    // two axes across the flight path, for the tail's strands
    const e1 = [-uz / hl, 0, ux / hl], e2 = [uy * e1[2] - uz * e1[1], uz * e1[0] - ux * e1[2], ux * e1[1] - uy * e1[0]];
    const pos = (tt) => {
      const k = ease.inQuad(clamp(tt / HIT)) * 0.35 + clamp(tt / HIT) * 0.65;
      return [FROM3[0] * (1 - k), FROM3[1] * (1 - k), FROM3[2] * (1 - k)];
    };
    const polar = (th, ph, sp) => [Math.sin(th) * Math.cos(ph) * sp, -Math.cos(th) * sp, Math.sin(th) * Math.sin(ph) * sp];
    const CHUNK = lit([OUTLINE, st.shade, st.body, st.light, mix(st.light, WHITE, 0.3)]);
    let t = 0, hit = false, last = pos(0);
    // the lumps on the rock and the pieces of the lip are fixed
    const lumps = Array.from({ length: 4 }, (_, i) => {
      const a = rand(i, S, 31) * TAU, b = rand(i, S, 32) * 2 - 1, c = Math.sqrt(1 - b * b);
      return [Math.cos(a) * c * 0.78, b * 0.78, Math.sin(a) * c * 0.78, 0.42 + rand(i, S, 33) * 0.18];
    });
    const lip = Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * TAU + (rand(i, S, 34) - 0.5) * 0.14, d = 31 + rand(i, S, 35) * 8;
      return [Math.cos(a) * d, Math.sin(a) * d, 1.1 + rand(i, S, 36) * 1.5];
    });

    // the rock: a sphere white-hot on its leading face, dark rock with glowing cracks on the back. cut: the half
    // below the floor is hidden (the core lies half-buried).
    const meteor = (q, x, y, z, R0, cool, alpha = 1, cut = false) => {
      const [vx, vy, vz] = q.view(ux, uy, uz);
      const shade = (nx, ny, nz) => {
        if (nz < 0.2) return OUTLINE;
        const face = nx * vx + ny * vy + nz * vz, heat = (1 - cool) * (face * 0.7 + 0.32 - Math.hypot(nx, ny) * 0.25);
        if (heat > 0.62) return heat > 0.85 ? H[0] : heat > 0.74 ? H[1] : H[2];
        if (heat > 0.42) return H[4];
        if (rand(Math.floor(nx * 9), Math.floor(ny * 9), S + 3) < 0.28 * (1 - cool * 0.7)) return 1 - cool > 0.5 ? H[4] : H[6];
        return nx * -0.6 + ny * -0.8 > 0 ? RK[3] : Math.hypot(nx, ny) > 0.6 ? RK[1] : RK[2];
      };
      const part = (cx, cy, cz, r) => q.ball(cx, cy, cz, r, shade, (nx, ny, nz) => (cut && cy + r * (ny * q.cp - nz * q.sp) > 0.3 ? 0 : alpha));
      part(x, y, z, R0);
      for (const [a, b, c, r] of lumps) part(x + a * R0, y + b * R0, z + c * R0, r * R0);
    };

    // the crater: hot rock pooled in the dent cooling to soot, a true circle on the floor, and the lip of broken floor
    const crater = (q) => {
      if (t < HIT) return;
      const a = t - HIT, end = 1 - smooth(meta.duration - 1, meta.duration - 0.15, t), RX = 36 * Math.min(1, a / 0.08);
      if (RX < 1) return;
      const ramp = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7], H[8]];
      q.plane(0, 0, 0, null, RX, (u, v, out) => {
        const d = Math.hypot(u, v) / RX;
        if (d > 1) return;
        const k = rand(Math.floor(u / 1.5), Math.floor(v / 1.5), S + 5), T = Math.pow(clamp(1 - a / 2.6), 1.3) * (1.25 - d) - k * 0.35;
        if (T > 0.06) {
          const c = ramp[Math.min(8, Math.floor((1 - Math.min(1, T)) * 8))];
          out.c = c;
          out.a = end;
          out.l = c;
          out.k = 0.14 * T * end;
        } else {
          out.c = d < 0.55 ? SOOT : SOOT2;
          out.a = (d < 0.95 - k * 0.3 ? 1 : 1 - d) * end;
        }
      });
      const g = smooth(0, 0.14, a), LIP = lit([OUTLINE, st.shade, st.shade, mix(st.body, H[4], 0.55 * clamp(1 - a / 2))]);
      if (end > 0.02) for (const [x, z, s] of lip) q.ball(x, -s * g * 0.6, z, s * g, LIP, end);
    };

    return {
      update(dt) {
        t += dt;
        if (t < HIT) {
          // the flight: a comet of fire shed behind, smoke, sparks, embers
          const [x, y, z] = pos(t), vx = (x - last[0]) / dt, vy = (y - last[1]) / dt, vz = (z - last[2]) / dt;
          last = [x, y, z];
          for (let i = 0; i < 3; i++) {
            if (!R.chance(0.8 * dt * 60)) continue;
            const b = R.range(2, 8);
            ps.spawn3(P.FIRE, x - ux * b + R.range(-3, 3), y - uy * b + R.range(-3, 3), z - uz * b + R.range(-3, 3), vx * 0.15 + R.range(-20, 20), vy * 0.15 + R.range(-30, 10), vz * 0.15 + R.range(-20, 20), R.range(0.3, 0.6), 0, R.range(3, 6), 0, R.chance(0.65) ? PF.SMOKES | PF.BIG : 0);
          }
          if (R.chance(0.6 * dt * 60)) ps.spawn3(P.SPARK, x, y, z, vx * 0.35 + R.range(-80, 80), vy * 0.35 + R.range(-80, 40), vz * 0.35 + R.range(-80, 80), R.range(0.2, 0.5));
          if (R.chance(0.3 * dt * 60)) ps.spawn3(P.EMBER, x, y, z, vx * 0.1 + R.range(-30, 30), vy * 0.1 + R.range(-40, 0), vz * 0.1 + R.range(-30, 30), R.range(0.8, 1.6), H[3], R.chance(0.2) ? 2 : 1);
        } else if (!hit) {
          hit = true;
          // the impact: flash, fireball thrown up and every way with the rock's momentum, a column, smoke, sparks
          lights.add(0, -40, 100, WARM, 0.95, 0.9, 0);
          lights.add(0, -20, 46, WHITE, 0.9, 0.12, 0);
          for (let i = 0; i < 48; i++) {
            const v = polar(R.range(0, 1.35), R.range(0, TAU), R.range(50, 210)), a = R.range(0, TAU), d = R.range(0, 6);
            ps.spawn3(P.FIRE, Math.cos(a) * d, -R.range(2, 10), Math.sin(a) * d, v[0] + fx * 30, v[1] * 0.75 - 30, v[2] + fz * 30, R.range(0.5, 1.1), 0, R.range(5, 9), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
          }
          for (let i = 0; i < 9; i++) ps.spawn3(P.FIRE, R.range(-6, 6), -6, R.range(-6, 6), R.range(-14, 14), -R.range(130, 220), R.range(-14, 14), R.range(0.8, 1.2), 0, R.range(6, 8.5), R.range(0, 0.12), PF.SMOKES | PF.BIG);
          for (let i = 0; i < 22; i++) {
            const a = R.range(0, TAU), d = R.range(4, 18), s = R.range(10, 40);
            ps.spawn3(P.SMOKE, Math.cos(a) * d, -R.range(6, 24), Math.sin(a) * d, Math.cos(a) * s, -R.range(30, 110), Math.sin(a) * s, R.range(1.8, 2.8), 0, R.range(8, 12), R.range(0.15, 0.5), PF.BIG);
          }
          // a ring of dust rolling out over the floor
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * TAU + R.range(-0.12, 0.12), d = R.range(4, 18), s = R.range(60, 130);
            ps.spawn3(P.SMOKE, Math.cos(a) * d, -R.range(1, 5), Math.sin(a) * d, Math.cos(a) * s + fx * 10, -R.range(2, 12), Math.sin(a) * s + fz * 10, R.range(1.2, 2.0), st.dust, R.range(5, 8), R.range(0, 0.06), PF.BIG);
          }
          for (let i = 0; i < 110; i++) {
            const v = polar(R.range(0, 1.35), R.range(0, TAU), R.range(100, 300));
            ps.spawn3(P.SPARK, 0, -4, 0, v[0] + fx * 20, v[1], v[2] + fz * 20, R.range(0.2, 0.7));
          }
          for (let i = 0; i < 44; i++) {
            const a = R.range(0, TAU), sp = R.range(40, 150);
            ps.spawn3(P.EMBER, Math.cos(a) * 8, -8 + R.range(-6, 6), Math.sin(a) * 8, Math.cos(a) * sp, -R.range(10, 130), Math.sin(a) * sp, R.range(1.2, 2.6), H[3]);
          }
          for (let i = 0; i < 12; i++) {
            const v = polar(R.range(0, 1.05), R.range(0, TAU), R.range(130, 240));
            ps.spawn3(P.BRAND, 0, -6, 0, v[0] + fx * 20, v[1], v[2] + fz * 20, R.range(0.7, 1.3));
          }
          for (let i = 0; i < 32; i++) {
            const a = R.range(0, TAU), sp = R.range(0, 100), d = R.range(0, 8);
            bits.add({ kind: B.CHUNK, x: Math.cos(a) * d, y: -3, z: Math.sin(a) * d, vx: Math.cos(a) * sp + fx * 20, vy: -R.range(140, 340), vz: Math.sin(a) * sp + fz * 20, g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.8, 2.8), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
          }
          for (let i = 0; i < 90; i++) {
            const u = R.range(0, 1), v = polar(0.1 + u * 0.8, R.range(0, TAU), R.range(90, 270) * (1 - 0.4 * u));
            ps.spawn3(P.GRIT, R.range(-4, 4), -1, R.range(-4, 4), v[0] + fx * 15, v[1], v[2] + fz * 15, R.range(1.2, 2.2), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
          }
        }
        bits.update(dt);
        for (const b of bits.list)
          if (b.rest && !b.dusted) {
            b.dusted = true;
            for (let i = 0; i < 3; i++) {
              const a = R.range(0, TAU), sp = R.range(8, 35);
              ps.spawn3(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, b.z + R.range(-1.5, 1.5), Math.cos(a) * sp, -R.range(2, 18), Math.sin(a) * sp, R.range(0.3, 0.6), st.dust, R.range(1.3, 2.6));
            }
          }
        blazes.update(dt);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), k = (t - HIT) / 0.5;
        crater(q);
        if (k > 0 && k < 1) {
          const a0 = 1.15 - k, hot = k < 0.12;
          q.ring(0, -0.5, 0, 110 * ease.outCubic(k), 3 + 5 * (1 - k), (v) => (v > 0.85 ? (hot ? WHITE : H[1]) : v > 0.6 ? H[4] : v > 0.3 ? st.light : st.body), (v) => a0 * (v > 0.6 ? 1.2 : 1.15 - (1 - v)));
        }
        for (const b of bits.list) {
          const r = 1 + b.s * 0.8;
          q.ball(b.x, b.y - r * 0.8, b.z, r, CHUNK, Math.min(1, b.life / 0.5));
        }
        if (t < HIT) {
          // the comet: tongues of flame streaming back off the rock along the path, strands of heat in space, the rock, its light
          const [x, y, z] = pos(t), NZ = (rate, seed = 0, off = 0) => noise(t * rate + off, seed), f = t / HIT;
          const tv = q.view(-ux, -uy, -uz), ls = Math.hypot(tv[0], tv[1]), dx = ls > 0.02 ? tv[0] / ls : 0, dy = ls > 0.02 ? tv[1] / ls : -1, fo = Math.max(0.3, ls);
          [[36, 7, 0, 0], [26, 7.5, 2.8, 0], [26, 7.5, -2.8, 0], [16, 8, 0, 2.4], [20, 7, 0, -2.4]].forEach(([L, w, o1, o2], i) => {
            const n = (S + i) * 13;
            q.at(x + e1[0] * o1 + e2[0] * o2 - ux * 2, y + e1[1] * o1 + e2[1] * o2 - uy * 2, z + e1[2] * o1 + e2[2] * o2 - uz * 2, (pp) => flameBlade(pp, 0, 0, dx, dy, L * fo * (0.85 + 0.25 * NZ(5, n)), w, NZ(3, n + 3) * 3, NZ, n, H, LAYERS, 0.5, 1.6));
          });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + t * 4, L = 30 + 16 * rand(i, S, 41), s = 3 + 4 * rand(i, S, 42), c = Math.cos(a) * s, d = Math.sin(a) * s;
            q.line(x, y, z, x - ux * L + e1[0] * c + e2[0] * d, y - uy * L + e1[1] * c + e2[1] * d, z - uz * L + e1[2] * c + e2[2] * d, (u) => (u < 0.25 ? H[1] : u < 0.55 ? H[3] : H[5]), (u) => 1 - u * 0.85);
          }
          meteor(q, x, y, z, 7.5, 0);
          q.glowLine(x, y, z, x - ux * 40, y - uy * 40, z - uz * 40, 14, GLOW, 0.4);
          q.glow(x, y, z, 46, GLOW, 0.55);
          q.glow(x, y, z, 12, H[1], 0.4);
          floorGlow(q, x, z, 24, GLOW, 0.32 * f);
          floorGlow(q, 0, 0, 30 + 40 * f, GLOW, 0.5 * f * f);
        } else {
          // the core of the meteor sits half-buried in the crater, cooling
          const a = t - HIT, cool = clamp(a / 2.8), end = 1 - smooth(meta.duration - 1.1, meta.duration - 0.2, t);
          if (end > 0) {
            meteor(q, 0, -1, 0, 5.5, cool, end, true);
            q.glow(0, -2, 0, 22, GLOW, 0.4 * (1 - cool) * end);
          }
        }
        blazes.drawBack(q);
        // the hero frame: a white-hot flash and a flare of rays in every direction
        const f = (t - HIT) / 0.08;
        if (f > 0 && f < 1) q.ball(0, -6, 0, 11 * (1 - f * 0.3) + 1.5, (nx, ny, nz) => (nz < 0.3 ? H[3] : nz < 0.62 ? (f < 0.5 ? H[1] : H[2]) : f < 0.5 ? WHITE : H[1]));
        const fr = (t - HIT) / 0.24;
        if (fr > 0 && fr < 1) {
          const L = 50 * Math.pow(1 - fr, 1.4), rays = [[0, -1, 0, 1]];
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2, b = a + Math.PI / 4;
            rays.push([Math.cos(a), 0, Math.sin(a), 1], [Math.cos(b), 0, Math.sin(b), 0.6], [Math.cos(b) * 0.7, -0.7, Math.sin(b) * 0.7, 0.45]);
          }
          for (const [rx, ry, rz, m] of rays) q.line(0, -6, 0, rx * L * m, -6 + ry * L * m, rz * L * m, (u) => (u < 0.35 ? WHITE : u < 0.7 ? H[2] : H[4]), (u) => (u < 0.6 ? 1 : (1 - fr) * 1.5 * (1 - u) + 0.2));
        }
        simDraw3(q, ps, H);
        lights.draw(q);
      },
    };
  },
};
