// The rocks, grit, rolling floor dust and dust column are adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, clamp, smooth, ease, space, TAU, WHITE, mix } from "../../core/index.js";
import { stone, star, makeCracks, drawCracks, frontCrescent, rock, rockShape, SOOT, aimed, aimedUp, makeCracks3, drawCracks3, star3, hoop, rock3 } from "./_lib.js";

export const meta = {
  name: "Ground slam",
  desc: "Something lands hard: the floor flashes and cracks, two crescent shock waves race out along it, a dust wave and a tall dust cloud rise, rocks erupt, bounce and settle.",
  tags: ["impact", "ground", "slam", "shockwave", "quake", "rocks", "dust", "one-shot"],
  size: [288, 208],
  origin: [144, 164],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#2a1712", "#5e2c1c", "#a4502a", "#e8893a", "#ffc764", "#fff0b4", "#ffffff"], stone: "#4a3f69", reach: 104, seed: 5 },
};

const WAVE = 0.6; // seconds for the shock fronts to run out

// the dent: the floor's edge caves into a shallow dish, its bottom glowing while hot, lips thrown up either side
function crater(p, st, hot, C, k) {
  for (let x = -12; x <= 11; x++) {
    const q = Math.abs(x + 0.5) / 12, dep = Math.round(2.6 * (1 - q * q));
    if (q < 0.84) {
      for (let y = 0; y < dep; y++) p.dot(x, y, SOOT, k);
      p.dot(x, dep, hot > 0.5 ? C[5] : hot > 0.2 ? C[4] : st.lip, k);
    } else {
      p.dot(x, -1, q > 0.93 ? st.light : st.lip, k);
      if (q < 0.9) p.dot(x, -2, st.light, k * 0.8);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 7), st = stone(o.stone), REACH = o.reach, R = new Rng(o.seed), floor = () => 0, D = meta.duration;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] });
  const bits = new Bits({ ground: floor }), lights = new Lights(), HOT = [WHITE, C[5], C[4], C[3]];
  const dustLit = mix(st.dust, WHITE, 0.2), cracks = makeCracks(R, 10, { len: [22, 58], dive: 0.55, maxY: 22, forks: 0.7, x0: [2, 9] });
  const front = (t) => 7 + (REACH - 7) * ease.outCubic(clamp((t - 0.015) / WAVE));
  const heat = (t) => Math.pow(clamp(1 - t / 0.8), 1.4);
  const crest = (u) => [6 + 28 * Math.pow(1 - u, 0.75), 1.5 + 5 * Math.pow(1 - u, 0.9)]; // a front's height and thickness
  // the flash: a flat half-star hugging the floor, long rays along it, short ones up
  const burst = [
    { a: -0.07, len: R.range(34, 40), w: 1.9 }, { a: Math.PI + 0.07, len: R.range(34, 40), w: 1.9 },
    { a: -0.42 + R.range(-0.08, 0.08), len: R.range(15, 20), w: 1.5 }, { a: -Math.PI + 0.42 + R.range(-0.08, 0.08), len: R.range(15, 20), w: 1.5 },
    { a: -Math.PI / 2 + R.range(-0.15, 0.15), len: R.range(18, 24), w: 1.7 },
    { a: -1.05 + R.range(-0.1, 0.1), len: R.range(10, 14), w: 1.2 }, { a: -Math.PI + 1.05 + R.range(-0.1, 0.1), len: R.range(10, 14), w: 1.2 },
  ];
  // embers caught in the cracks, flickering as they cool
  const embers = [];
  for (const c of cracks)
    for (const [x, y, d] of c.pts) if (d > 3 && d < 32 && R.chance(0.25)) embers.push({ x, y, d, life: R.range(0.8, 2.2), ph: R.range(0, TAU) });

  // contact: light floods out, sparks fly off the stone and skitter along the floor
  lights.add(0, -12, 96, C[4], 0.6, 0.6);
  lights.add(0, -4, 50, WHITE, 0.9, 0.14);
  for (let i = 0; i < 56; i++) {
    const low = i < 14, s = R.sign(), a = low ? (s > 0 ? -R.range(0.04, 0.6) : Math.PI + R.range(0.04, 0.6)) : -Math.PI / 2 + R.range(-1.15, 1.15);
    const sp = low ? R.range(150, 380) : R.range(200, 500);
    ps.spawn(P.SPARK, R.range(-4, 4), -1, Math.cos(a) * sp, Math.sin(a) * sp, low ? R.range(0.2, 0.5) : R.range(0.25, 0.65), WHITE, 1, low ? 0 : R.range(0, 0.05));
  }
  // rocks erupt from the dent: three heavy ones that barely clear it, the rest thrown high
  for (let i = 0; i < 20; i++) {
    const s = i < 3 ? 4 : R.int(1, 3), a = -Math.PI / 2 + R.range(-0.5, 0.5), sp = s > 3 ? R.range(110, 190) : R.range(170, 380) * (s > 2 ? 0.8 : 1);
    bits.add({ kind: B.CHUNK, x: R.range(-7, 7), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.4, bounce: 0.38, life: R.range(1.9, 2.7), a: R.range(0, TAU), va: R.range(-14, 14), s, pts: rockShape(R), pvy: 0 });
  }
  // grit: a fan of floor bits that bounce once and settle
  for (let i = 0; i < 110; i++) {
    const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.65, sp = R.range(110, 380) * (1 - 0.35 * Math.abs(u));
    ps.spawn(P.GRIT, u * 6, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 2.2), R.pick([st.light, st.body, st.body, st.shade, st.shade, st.lip]), R.chance(0.35) ? 2 : 1);
  }
  // the dust cloud: a column that shoots up and spreads at the top, lit on top, and a heavy bank at its foot
  for (let i = 0; i < 28; i++) {
    const core = i < 14, s = R.sign();
    ps.spawn(P.SMOKE, core ? R.range(-5, 5) : s * R.range(4, 12), -R.range(2, 10), core ? R.range(-12, 12) : s * R.range(14, 38), -R.range(50, 130) * (core ? 1 : R.range(0.3, 0.6)), R.range(1.9, 2.7), R.chance(0.35) ? dustLit : st.dust, core ? R.range(4.5, 9) : R.range(4, 7.5), R.range(0.02, 0.22), PF.BIG);
  }
  for (let i = 0; i < 10; i++) {
    const s = R.sign();
    ps.spawn(P.SMOKE, s * R.range(2, 14), -R.range(2, 6), s * R.range(20, 70), -R.range(4, 20), R.range(1.4, 2.3), st.dust, R.range(6, 9), R.range(0, 0.08), PF.BIG);
  }
  // fine dust settling out of the cloud while it hangs
  for (let i = 0; i < 26; i++)
    ps.spawn(P.FLAKE, R.range(-22, 22), -R.range(14, 80), R.range(-12, 12), R.range(-10, 4), R.range(1.2, 2), R.chance(0.5) ? st.lip : dustLit, R.range(0.5, 1.2), R.range(0.25, 1));

  let t = 0;
  const acc = [R.next(), R.next()];
  const ring = (p, back) => {
    const u = clamp((t - 0.015) / (WAVE + 0.1));
    if (t < 0.015 || u >= 0.9) return;
    band(p, 0, 0.5, front(t) + 1, 0.16, Math.max(1, 4 * Math.pow(1 - u, 0.8)), u < 0.55 ? 1.1 : (0.9 - u) / 0.35,
      u < 0.35 ? [C[3], C[4], C[5], C[6]] : [st.body, st.light, C[4], C[5]], (g) => Math.sin(g) < 0 === back, t < 0.09);
  };
  const fronts = (p) => {
    const u = clamp((t - 0.03) / (WAVE + 0.16));
    if (t < 0.03 || u >= 1) return;
    const fr = front(t), [h, w] = crest(u), k = u < 0.7 ? 1 : (1 - u) / 0.3;
    const cols = u < 0.14 ? [WHITE, C[6], C[5]] : u < 0.34 ? [C[6], C[5], C[4]] : u < 0.55 ? [C[5], C[4], st.lip] : [st.lip, st.light, st.dust];
    for (const s of [-1, 1]) {
      frontCrescent(p, s * fr, s, h, w, cols, k);
      p.glow(s * fr, -h * 0.3, 8 + h * 0.7, C[4], 0.5 * (1 - u) * k);
    }
  };

  return {
    update(dt) {
      t += dt;
      // dust kicked up behind the racing fronts, and spray off their crests
      const u = clamp((t - 0.015) / WAVE);
      if (u > 0 && u < 1) {
        const fr = front(t), [h] = crest(u);
        for (let k = 0; k < 2; k++) {
          const s = k ? 1 : -1;
          for (acc[k] += dt * 120 * (1 - u * 0.7); acc[k] > 1; acc[k]--) {
            ps.spawn(P.SMOKE, s * (fr - R.range(1, 7)), -R.range(0.5, 3), s * R.range(15, 70) * (1 - u), -R.range(2, 12), R.range(1, 2.1), R.chance(0.3) ? dustLit : st.dust, R.range(2.5, 6.5) * (1 - 0.4 * u), 0, PF.BIG);
            if (R.chance(0.5)) ps.spawn(P.DUST, s * (fr - R.range(0, 3)), -R.range(0.3, 0.9) * h, s * R.range(-15, 25), -R.range(8, 35), R.range(0.3, 0.6), R.chance(0.5) ? dustLit : st.dust, R.range(1.2, 2.4));
            if (R.chance(0.4)) ps.spawn(P.GRIT, s * fr, -1, s * R.range(10, 60), -R.range(40, 140) * (1 - u), R.range(0.5, 1), R.pick([st.light, st.body, st.lip]), 1);
            if (u < 0.45 && R.chance(0.2)) ps.spawn(P.SPARK, s * fr, -1, s * R.range(60, 200), -R.range(30, 160), R.range(0.12, 0.3));
          }
        }
      }
      for (const b of bits.list) b.pvy = b.vy;
      bits.update(dt);
      // rocks that land hard kick up dust
      for (const b of bits.list)
        if (b.pvy > 70 && b.vy <= 0) {
          const n = b.pvy > 200 ? 3 : 2;
          for (let i = 0; i < n; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 16), R.range(0.3, 0.65), st.dust, R.range(1.3, 2.4) * (0.7 + b.s * 0.25));
          b.pvy = 0;
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const fade = 1 - smooth(D - 0.9, D - 0.15, t), H = heat(t);
      if (t > 0.02) crater(p, st, H, C, fade);
      drawCracks(p, cracks, (c) => c.len * ease.outCubic(clamp((t - c.t0) / 0.1)), (d) => H * clamp(1.2 - d / 40), HOT, SOOT, st.light, fade);
      for (const e of embers) {
        const k = 1 - (t - 0.1) / e.life;
        if (t < 0.1 || k <= 0) continue;
        const f = 0.6 + 0.4 * Math.sin(t * 23 + e.ph);
        p.px(e.x, e.y, k * f > 0.55 ? C[5] : k * f > 0.25 ? C[4] : C[3]);
        p.glow(e.x, e.y, 4, C[4], 0.35 * k * f);
      }
      ring(p, true);
      ps.draw(p, "back");
    },
    draw(p) {
      ring(p, false);
      fronts(p);
      for (const b of bits.list) rock(p, b, st);
      ps.draw(p, "front");
      if (t < 0.035) {
        p.ellipse(0, 0, 30, 4.5, (d) => (d > 0.8 ? C[4] : d > 0.5 ? C[6] : WHITE));
        star(p, 0, -1, burst, 1, 1, [C[4], C[6], WHITE, WHITE]);
      } else if (t < 0.07) star(p, 0, -1, burst, 1.25, 0.5, [C[3], C[5], C[6], WHITE]);
      // the floor flashes along its length, then the dent glows while the cracks are hot
      if (t < 0.14) p.glowLine(-80, 0, 80, 0, 10, C[5], 0.55 * (1 - t / 0.14));
      const H = heat(t);
      if (H > 0) p.glow(0, 1, 46, C[4], 0.35 * H);
      lights.draw(p);
    },
  };
}

// 3D: the floor flashes and cracks all round (a true circle of cracks), the shock fronts are standing rings that
// race out across the floor (a stack of hoops leaning back, over a bright band on the floor), the dust wave kicks up
// all round, and the column, the rocks and the grit rise from the dent in every direction.
export const three = {
  meta: { size: [272, 196], origin: [136, 146], bg: "ground", camera: { pitch: 0.3 }, options: { reach: 84 } },
  create(o) {
    const C = fit(o.palette, 7), st = stone(o.stone), REACH = o.reach, R = new Rng(o.seed), floor = () => 0, D = meta.duration;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] });
    const bits = new Bits({ ground: () => -1.5 }), lights = new Lights(), HOT = [WHITE, C[5], C[4], C[3]];
    const dustLit = mix(st.dust, WHITE, 0.2), cracks = makeCracks3(R, 12, { len: [22, 58], forks: 0.7, x0: [2, 9] });
    const front = (t) => 7 + (REACH - 7) * ease.outCubic(clamp((t - 0.015) / WAVE));
    const heat = (t) => Math.pow(clamp(1 - t / 0.8), 1.4);
    const crest = (u) => [6 + 28 * Math.pow(1 - u, 0.75), 1.5 + 5 * Math.pow(1 - u, 0.9)];
    // the flash: a flat star hugging the floor in every direction, shorter rays rising from it, one straight up
    const ray = (el, az, len, w) => ({ d: [Math.cos(el) * Math.cos(az), -Math.sin(el), Math.cos(el) * Math.sin(az)], len, w });
    const az0 = R.range(0, TAU), burst = [];
    for (let i = 0; i < 8; i++) burst.push(ray(0.04, az0 + (i / 8) * TAU + R.range(-0.1, 0.1), i % 2 ? R.range(26, 32) : R.range(34, 40), 1.9));
    for (let i = 0; i < 6; i++) burst.push(ray(0.42 + R.range(-0.08, 0.08), az0 + ((i + 0.5) / 6) * TAU, R.range(15, 20), 1.5));
    burst.push(ray(Math.PI / 2, 0, R.range(18, 24), 1.7));
    for (let i = 0; i < 5; i++) burst.push(ray(1.05 + R.range(-0.1, 0.1), az0 + (i / 5) * TAU, R.range(10, 14), 1.2));
    // embers caught in the cracks, flickering as they cool
    const embers = [];
    for (const c of cracks)
      for (const [x, z, d] of c.pts) if (d > 3 && d < 32 && R.chance(0.25)) embers.push({ x, z, d, life: R.range(0.8, 2.2), ph: R.range(0, TAU) });

    // contact: light floods out, sparks fly off the stone and skitter along the floor
    lights.add(0, -12, 96, C[4], 0.6, 0.6);
    lights.add(0, -4, 50, WHITE, 0.9, 0.14);
    for (let i = 0; i < 56; i++) {
      const low = i < 14, d = low ? aimed(R, [Math.cos(az0 + i), -0.2, Math.sin(az0 + i)], 0.35) : aimedUp(R, 1.15), sp = low ? R.range(150, 380) : R.range(200, 500);
      ps.spawn3(P.SPARK, R.range(-4, 4), -1, R.range(-4, 4), d[0] * sp, d[1] * sp, d[2] * sp, low ? R.range(0.2, 0.5) : R.range(0.25, 0.65), WHITE, 1, low ? 0 : R.range(0, 0.05));
    }
    // rocks erupt from the dent: three heavy ones that barely clear it, the rest thrown high
    for (let i = 0; i < 20; i++) {
      const s = i < 3 ? 4 : R.int(1, 3), d = aimedUp(R, 0.5), sp = s > 3 ? R.range(110, 190) : R.range(170, 380) * (s > 2 ? 0.8 : 1);
      bits.add({ kind: B.CHUNK, x: d[0] * 7, y: -2, z: d[2] * 7, vx: d[0] * sp, vy: d[1] * sp, vz: d[2] * sp, g: 1, drag: 0.4, bounce: 0.38, life: R.range(1.9, 2.7), a: R.range(0, TAU), va: R.range(-14, 14), s, pts: rockShape(R), pvy: 0 });
    }
    // grit: a fan of floor bits that bounce once and settle
    for (let i = 0; i < 130; i++) {
      const d = aimedUp(R, 0.65), sp = R.range(110, 380) * (1 - 0.3 * R.next());
      ps.spawn3(P.GRIT, d[0] * 6, -1, d[2] * 6, d[0] * sp, d[1] * sp, d[2] * sp, R.range(1, 2.2), R.pick([st.light, st.body, st.body, st.shade, st.shade, st.lip]), R.chance(0.35) ? 2 : 1);
    }
    // the dust cloud: a column that shoots up and spreads at the top, lit on top, and a heavy bank at its foot
    for (let i = 0; i < 30; i++) {
      const core = i < 14, a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), rr = core ? R.range(0, 5) : R.range(4, 12), h = core ? R.range(0, 12) : R.range(14, 38);
      ps.spawn3(P.SMOKE, ca * rr, -R.range(2, 10), sa * rr, ca * h, -R.range(50, 130) * (core ? 1 : R.range(0.3, 0.6)), sa * h, R.range(1.9, 2.7), R.chance(0.35) ? dustLit : st.dust, core ? R.range(4.5, 9) : R.range(4, 7.5), R.range(0.02, 0.22), PF.BIG);
    }
    for (let i = 0; i < 12; i++) {
      const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), rr = R.range(2, 14), h = R.range(20, 70);
      ps.spawn3(P.SMOKE, ca * rr, -R.range(2, 6), sa * rr, ca * h, -R.range(4, 20), sa * h, R.range(1.4, 2.3), st.dust, R.range(6, 9), R.range(0, 0.08), PF.BIG);
    }
    // fine dust settling out of the cloud while it hangs
    for (let i = 0; i < 30; i++) {
      const a = R.range(0, TAU), rr = R.range(0, 22);
      ps.spawn3(P.FLAKE, Math.cos(a) * rr, -R.range(14, 80), Math.sin(a) * rr, R.range(-12, 12), R.range(-10, 4), R.range(1, 6) * R.sign(), R.range(1.2, 2), R.chance(0.5) ? st.lip : dustLit, R.range(0.5, 1.2), R.range(0.25, 1));
    }

    let t = 0, acc = 0;
    const ringBand = (q) => {
      const u = clamp((t - 0.015) / (WAVE + 0.1));
      if (t < 0.015 || u >= 0.9) return;
      const r = front(t) + 1, th = Math.max(1.5, 5 * Math.pow(1 - u, 0.8)), k = u < 0.55 ? 1.1 : (0.9 - u) / 0.35, hot = t < 0.09;
      const ramp = u < 0.35 ? [C[3], C[4], C[5], C[6]] : [st.body, st.light, C[4], C[5]];
      q.plane(0, 0, 0, null, r + 1, (pu, pv, out) => {
        const d = Math.hypot(pu, pv), w = (r - d) / th;
        if (w < 0 || w > 1) return;
        out.c = w < 0.15 ? (hot ? WHITE : ramp[3]) : w < 0.4 ? ramp[2] : w < 0.7 ? ramp[1] : ramp[0];
        out.a = k * (w < 0.4 ? 1.2 : 1.15 - w);
        out.l = C[4];
        out.k = 0.25 * k * (1 - w);
      });
    };
    // the standing front: a stack of hoops leaning back, thick at the foot and thin at the top
    const fronts = (q) => {
      const u = clamp((t - 0.03) / (WAVE + 0.16));
      if (t < 0.03 || u >= 1) return;
      const fr = front(t), [h, w] = crest(u), k = u < 0.7 ? 1 : (1 - u) / 0.3;
      const cols = u < 0.14 ? [WHITE, C[6], C[5]] : u < 0.34 ? [C[6], C[5], C[4]] : u < 0.55 ? [C[5], C[4], st.lip] : [st.lip, st.light, st.dust];
      const n = clamp(Math.round(h / 3.2), 4, 10), rx = Math.max(2, h * 0.55);
      // the outer face of the near wall is the bright leading edge; across the ring we see the dark back of the far wall
      const outer = (g) => Math.cos(g) * q.sy + Math.sin(g) * q.cy > 0;
      for (let j = 0; j < n; j++) {
        const s = 0.08 + (0.84 * j) / (n - 1), ey = (0.2 - s) / 0.8, e2 = 1 - ey * ey, edge = rx * Math.sqrt(e2) - rx, wt = Math.max(1.6, w * Math.pow(e2, 0.45)), tube = Math.max(wt, ((h * 0.84) / (n - 1)) * 1.05);
        hoop(q, 0, -h * s, 0, fr + edge - wt / 2, tube, (v, g) => (outer(g) ? (v > 0.82 ? cols[1] : cols[0]) : v > 0.82 ? cols[2] : cols[1]), k * (ey < -0.8 ? 0.75 : 1), 9);
      }
      for (let i = 0; i < 8; i++) {
        const g = (i / 8) * TAU + 0.4;
        q.glow(Math.cos(g) * fr, -h * 0.3, Math.sin(g) * fr, 8 + h * 0.7, C[4], 0.4 * (1 - u) * k);
      }
    };

    return {
      update(dt) {
        t += dt;
        // dust kicked up behind the racing front, and spray off its crest, all round
        const u = clamp((t - 0.015) / WAVE);
        if (u > 0 && u < 1) {
          const fr = front(t), [h] = crest(u);
          for (acc += dt * 240 * (1 - u * 0.7); acc > 1; acc--) {
            const a = R.range(0, TAU), ca = Math.cos(a), sa = Math.sin(a), rr = fr - R.range(1, 7), go = R.range(15, 70) * (1 - u);
            ps.spawn3(P.SMOKE, ca * rr, -R.range(0.5, 3), sa * rr, ca * go, -R.range(2, 12), sa * go, R.range(1, 2.1), R.chance(0.3) ? dustLit : st.dust, R.range(2.5, 6.5) * (1 - 0.4 * u), 0, PF.BIG);
            if (R.chance(0.5)) {
              const b = R.range(0, TAU), v = R.range(-15, 25), rd = fr - R.range(0, 3);
              ps.spawn3(P.DUST, Math.cos(b) * rd, -R.range(0.3, 0.9) * h, Math.sin(b) * rd, Math.cos(b) * v, -R.range(8, 35), Math.sin(b) * v, R.range(0.3, 0.6), R.chance(0.5) ? dustLit : st.dust, R.range(1.2, 2.4));
            }
            if (R.chance(0.4)) {
              const b = R.range(0, TAU), v = R.range(10, 60);
              ps.spawn3(P.GRIT, Math.cos(b) * fr, -1, Math.sin(b) * fr, Math.cos(b) * v, -R.range(40, 140) * (1 - u), Math.sin(b) * v, R.range(0.5, 1), R.pick([st.light, st.body, st.lip]), 1);
            }
            if (u < 0.45 && R.chance(0.2)) {
              const b = R.range(0, TAU), v = R.range(60, 200);
              ps.spawn3(P.SPARK, Math.cos(b) * fr, -1, Math.sin(b) * fr, Math.cos(b) * v, -R.range(30, 160), Math.sin(b) * v, R.range(0.12, 0.3));
            }
          }
        }
        for (const b of bits.list) b.pvy = b.vy;
        bits.update(dt);
        // rocks that land hard kick up dust
        for (const b of bits.list)
          if (b.pvy > 70 && b.vy <= 0) {
            const n = b.pvy > 200 ? 3 : 2;
            for (let i = 0; i < n; i++) {
              const a = R.range(0, TAU), v = R.range(8, 35);
              ps.spawn3(P.DUST, b.x, -0.5, b.z, Math.cos(a) * v, -R.range(2, 16), Math.sin(a) * v, R.range(0.3, 0.65), st.dust, R.range(1.3, 2.4) * (0.7 + b.s * 0.25));
            }
            b.pvy = 0;
          }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), fade = 1 - smooth(D - 0.9, D - 0.15, t), H = heat(t);
        // the dent: the floor caved into a dish, its edge glowing while hot, lips thrown up round it
        if (t > 0.02)
          q.plane(0, 0, 0, null, 20, (u, v, out) => {
            const d = Math.hypot(u, v);
            out.a = fade;
            if (d < 8) out.c = SOOT;
            else if (d < 10) out.c = H > 0.5 ? C[5] : H > 0.2 ? C[4] : st.lip;
            else if (d < 12) out.c = d > 11 ? st.light : st.lip;
            else if (d < 20) (out.c = SOOT), (out.blend = true), (out.a = fade * 0.45 * (1 - (d - 12) / 8));
          });
        drawCracks3(q, cracks, (c) => c.len * ease.outCubic(clamp((t - c.t0) / 0.1)), (d) => H * clamp(1.2 - d / 40), HOT, SOOT, fade, 0, st.light);
        for (const e of embers) {
          const k = 1 - (t - 0.1) / e.life;
          if (t < 0.1 || k <= 0) continue;
          const f = 0.6 + 0.4 * Math.sin(t * 23 + e.ph);
          q.px(e.x, -0.3, e.z, k * f > 0.55 ? C[5] : k * f > 0.25 ? C[4] : C[3]);
          q.glow(e.x, -1, e.z, 4, C[4], 0.35 * k * f);
        }
        ringBand(q);
        fronts(q);
        for (const b of bits.list) rock3(q, b, st);
        ps.draw(q);
        if (t < 0.035) {
          q.plane(0, -0.3, 0, null, 28, (u, v, out) => {
            const d = Math.hypot(u, v) / 28;
            if (d < 1) out.c = d > 0.8 ? C[4] : d > 0.5 ? C[6] : WHITE;
          });
          star3(q, 0, -1, 0, burst, 1, 1, [C[4], C[6], WHITE, WHITE]);
        } else if (t < 0.07) star3(q, 0, -1, 0, burst, 1.25, 0.5, [C[3], C[5], C[6], WHITE]);
        // the floor flashes all round, then the dent glows while the cracks are hot
        if (t < 0.14) q.glow(0, -2, 0, 70, C[5], 0.55 * (1 - t / 0.14));
        if (H > 0) q.glow(0, -1, 0, 46, C[4], 0.35 * H);
        lights.draw(q);
      },
    };
  },
};
