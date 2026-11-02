import { Particles, Bits, Lights, P, PF, B, Rng, fit, sparkle, band, bolt, space, clamp, smooth, seg, lerp, ease, TAU, WHITE, hex, mix, scale } from "../../core/index.js";
import { GOLD, oval, shell } from "./_lib.js";

export const meta = {
  name: "Smite",
  desc: "A glint marks the spot, then a bolt of light drops like a hammer: a white flash, a shockwave over the floor, stone chips flying and cracks that glow and cool.",
  tags: ["holy", "smite", "strike", "impact", "light", "ground", "one-shot"],
  size: [224, 176],
  origin: [112, 148],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: GOLD, stone: "#5a5066", seed: 9 },
};

const TOP = -148, SY = 0.38, MARK = 0.42, HIT = 0.54, LEN = 44;
const OUTLINE = hex("#1a1422");

// a chip of stone: lit side, shaded side, outline
function chip(p, b, st) {
  const r = 0.6 + b.s * 0.7, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.2, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.3 ? st[3] : lit > 0.5 ? st[1] : st[2];
    out.a = fade;
  });
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), s0 = hex(o.stone);
  const st = [scale(s0, 0.5), scale(s0, 0.75), s0, mix(scale(s0, 1.4), WHITE, 0.1)], dust = mix(s0, hex("#8a8094"), 0.4);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]] });
  const chips = new Bits({ ground: () => 0 }), lights = new Lights();
  // cracks across the floor, mostly out to the sides and towards us, each its own length
  const cracks = Array.from({ length: 7 }, (_, i) => {
    const a = 0.12 + (i / 6) * (Math.PI - 0.24) + R.range(-0.12, 0.12), L = R.range(30, 54) * (Math.abs(Math.sin(a)) > 0.7 ? 0.6 : 1);
    const pts = bolt(R, 0, 0, Math.cos(a) * L, Math.sin(a) * L, { jag: 0.28, depth: 4 }).map(([x, z]) => [x, z * SY]);
    const fork = pts.length > 6 ? bolt(R, ...pts[Math.floor(pts.length * 0.5)], pts[Math.floor(pts.length * 0.5)][0] + Math.cos(a + R.sign() * 0.7) * L * 0.35, pts[Math.floor(pts.length * 0.5)][1] + Math.sin(a + R.sign() * 0.7) * L * 0.35 * SY, { jag: 0.3, depth: 3 }) : null;
    return { pts, fork, L, cool: R.range(1.6, 2.1) };
  });
  let t = 0, hit = false;

  // the hammer of light: a heavy blunt bolt that falls faster and faster
  const tipY = (tt) => lerp(TOP - 6, 0, ease.inCubic(seg(tt, MARK, HIT)));

  function hammer(p) {
    if (t < MARK || t >= HIT + 0.06) return;
    const y1 = t >= HIT ? 0 : tipY(t), y0 = Math.max(TOP + 5, y1 - LEN * (t >= HIT ? 1 - (t - HIT) / 0.06 : 1)), white = t >= HIT;
    if (y1 < TOP + 12) return;
    // speed lines above it
    for (const [dx, k] of [[-5, 0.6], [-2, 0.9], [2, 0.8], [5, 0.5]]) if (y0 > TOP + 2) p.line(dx, Math.max(TOP, y0 - 70), dx, y0, (u) => (u > 0.7 ? C[6] : C[4]), (u) => u * k);
    if (y1 - 3 > y0) p.beam(0, y0, 0, y1 - 3, 9, (u, v) => (white || v < 0.35 ? WHITE : v < 0.7 ? C[6] : C[5]));
    // the head: wider, white hot
    p.beam(0, y1 - 6, 0, y1 - 1, 13, (u, v) => (v < 0.6 || white ? WHITE : C[6]));
    p.glowLine(0, y0 + 10, 0, y1, 16, C[5], 0.6);
    p.glow(0, y1 - 4, Math.min(22, y1 - TOP - 6), WHITE, 0.5);
  }

  function crack(p) {
    if (t < HIT) return;
    const grow = ease.outCubic(seg(t, HIT, HIT + 0.1));
    for (const c of cracks) {
      for (const path of c.fork ? [c.pts, c.fork] : [c.pts]) {
        const n = Math.max(1, Math.round((path.length - 1) * grow));
        for (let i = 0; i < n; i++) {
          const [x0, y0] = path[i], [x1, y1] = path[i + 1], d = Math.hypot(x0, y0 / SY) / c.L, heat = clamp(1 - (t - HIT) / c.cool - d * 0.5);
          if (heat <= 0) continue;
          const col = heat > 0.85 ? WHITE : heat > 0.65 ? C[6] : heat > 0.45 ? C[5] : heat > 0.3 ? C[4] : heat > 0.18 ? C[3] : C[2];
          p.line(x0, y0, x1, y1, col, heat < 0.12 ? heat / 0.12 : 1);
          // wide and deep near the heart, a hairline at the tips
          if (d < 0.45 && path === c.pts) p.line(x0, y0 + 1, x1, y1 + 1, heat > 0.5 ? C[4] : C[2], heat < 0.12 ? heat / 0.12 : 1);
          if (i % 2 === 0) p.glow(x0, y0, 10, C[4], 0.45 * heat);
        }
      }
    }
    // the crater glows at the heart and cools
    const h = clamp(1 - (t - HIT) / 1.6);
    if (h > 0) {
      oval(p, 0, 0, 5, 1.6, h > 0.6 ? WHITE : h > 0.3 ? C[5] : C[3], Math.min(1, h * 3));
      p.glow(0, 0, 18, C[4], 0.45 * h);
    }
  }

  return {
    update(dt) {
      t += dt;
      if (t < MARK && R.chance(0.25)) ps.spawn(P.STAR, R.range(-10, 10), -R.range(0, 18), 0, -R.range(4, 12), R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
      // sparks shed off the sides of the falling hammer
      if (t > MARK && t < HIT && tipY(t) > TOP + 50 && R.chance(0.6)) ps.spawn(P.MOTE, R.sign() * R.range(4, 7), tipY(t) - R.range(4, 30), R.range(-20, 20), -R.range(10, 40), R.range(0.15, 0.3), C[6], 0.7);
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(0, -24, 92, C[5], 1, 0.6);
        lights.add(0, -8, 40, WHITE, 0.9, 0.12);
        for (let i = 0; i < 60; i++) {
          const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(110, 280);
          ps.spawn(P.SPARK, R.range(-3, 3), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.75));
        }
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + R.range(-1, 1), sp = R.range(60, 160);
          ps.spawn(P.STAR, R.range(-4, 4), -4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.4, 0.9), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2.4));
        }
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(90, 230);
          chips.add({ kind: B.CHUNK, x: R.range(-5, 5), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.4, bounce: 0.35, life: R.range(1.2, 1.8), a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 3) });
        }
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1, 1), sp = R.range(60, 220);
          ps.spawn(P.GRIT, R.range(-4, 4), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.9, 1.5), R.pick(st.slice(1)), R.chance(0.4) ? 2 : 1);
        }
        // dust rolls out along the floor, a little smoke lifts off the crater
        for (let i = 0; i < 9; i++) {
          const s = R.sign();
          ps.spawn(P.SMOKE, s * R.range(2, 10), -R.range(1, 4), s * R.range(50, 130), -R.range(2, 12), R.range(0.7, 1.2), mix(dust, C[4], 0.18), R.range(3.5, 6), R.range(0, 0.06), PF.BIG);
        }
        for (let i = 0; i < 4; i++) ps.spawn(P.SMOKE, R.range(-4, 4), -R.range(2, 8), R.range(-8, 8), -R.range(20, 45), R.range(1.2, 1.8), mix(dust, C[5], 0.25), R.range(4, 6), R.range(0.05, 0.3));
      }
      // the cracks spit embers while they're hot
      if (t > HIT && t < HIT + 1.3 && R.chance(0.5)) {
        const c = R.pick(cracks), q = R.pick(c.pts);
        if (R.chance(0.75)) ps.spawn(P.EMBER, q[0], q[1] - 1, R.range(-8, 8), -R.range(15, 35), R.range(0.5, 0.9), C[5]);
        else ps.spawn(P.STAR, q[0], q[1] - 2, 0, -R.range(4, 12), R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.8));
      }
      chips.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      crack(p);
      ps.draw(p, "back");
      const k = seg(t, HIT, HIT + 0.42);
      if (t >= HIT && k < 1) band(p, 0, 0, 6 + 84 * ease.outCubic(k), SY * 0.8, Math.max(1, 5 * (1 - k)), 1.15 - k, C.slice(3), (g) => Math.sin(g) < 0, k < 0.12);
    },
    draw(p) {
      // the mark: a glint on the floor and a ring closing on it
      if (t < HIT) {
        const u = seg(t, 0, MARK), k = smooth(0, 0.08, t), spin = t * 3, rr = lerp(26, 8, ease.inOutCubic(u));
        oval(p, 0, 0, rr, rr * SY, (g) => (Math.sin(g * 4 + spin) > 0 ? WHITE : C[5]), k * (0.65 + 0.35 * Math.sin(t * 40)));
        oval(p, 0, 1, rr, rr * SY, C[3], k * 0.6, (g) => Math.sin(g) > 0);
        const L = (3 + 8 * ease.outBack(clamp(t / 0.2), 2)) * (t > MARK ? 1 + 0.6 * seg(t, MARK, HIT) : 1);
        for (let i = 0; i < 4; i++) {
          const a = spin * 0.3 + (i * Math.PI) / 2, len = i % 2 ? L * 0.6 : L;
          p.line(0, -2, Math.cos(a) * len, -2 + Math.sin(a) * len, (v) => (v < 0.4 ? WHITE : C[5]), (v) => 1.2 - v);
        }
        p.px(0, -2, WHITE);
        p.glow(0, -2, 14 + 10 * u, C[5], 0.5 * k);
        p.glowLine(0, TOP + 6, 0, -2, 5, C[4], 0.12 * u);
      }
      hammer(p);
      // the bolt's afterimage: a thread of light from the sky to the mark, thinning out
      const ai = seg(t, HIT + 0.04, HIT + 0.55);
      if (t > HIT + 0.04 && ai < 1) {
        const w = 1 + 4 * Math.pow(1 - ai, 2);
        p.beam(0, TOP + 4, 0, -4, w, (u, v) => (v < 0.5 ? WHITE : C[5]), (u) => (0.3 + 0.7 * u) * (1 - ai * 0.5));
        p.glowLine(0, TOP + 16, 0, -6, 10, C[5], 0.4 * (1 - ai));
      }
      const k = seg(t, HIT, HIT + 0.42);
      if (t >= HIT && k < 1) band(p, 0, 0, 6 + 84 * ease.outCubic(k), SY * 0.8, Math.max(1, 5 * (1 - k)), 1.15 - k, C.slice(3), (g) => Math.sin(g) >= 0, k < 0.12);
      // the air shock: a dome of light thrown up over the hit
      const d = seg(t, HIT, HIT + 0.28);
      if (t >= HIT && d < 1) {
        const r = 8 + 40 * ease.outCubic(d);
        p.arc(0, 0, r, Math.max(1, 3 * (1 - d)), Math.PI, TAU, (u, v) => (d < 0.2 || v > 0.6 ? WHITE : C[5]), 1.1 - d);
        for (let g = Math.PI * 1.1; g < TAU - 0.2; g += 0.5) p.glow(Math.cos(g) * r, Math.sin(g) * r, 8, C[5], 0.3 * (1 - d));
      }
      // the white hero frame
      if (t >= HIT && t < HIT + 0.07) {
        p.circle(0, -6, 16, WHITE);
        p.circle(0, -6, 19, C[6], 0.6);
      }
      for (const b of chips.list) chip(p, b, st);
      ps.draw(p, "front");
      if (t >= HIT && t < HIT + 0.25) sparkle(p, 0, -8, 16 * (1 - (t - HIT) / 0.25), WHITE, C[5], 0.7);
      lights.draw(p);
    },
  };
}

// 3D: the hammer falls on a floor that cracks in every direction, a shock ring runs out across it as a true circle
// and a dome of light is thrown up over the hit; stone, grit and dust fly all round
export const three = {
  meta: { size: [224, 184], origin: [112, 154], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), s0 = hex(o.stone);
    const st = [scale(s0, 0.5), scale(s0, 0.75), s0, mix(scale(s0, 1.4), WHITE, 0.1)], dust = mix(s0, hex("#8a8094"), 0.4);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]] });
    const chips = new Bits({ ground: () => 0 }), lights = new Lights();
    // cracks across the floor, in every direction, each its own length
    const cracks = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * TAU + R.range(-0.15, 0.15), L = R.range(30, 54);
      const pts = bolt(R, 0, 0, Math.cos(a) * L, Math.sin(a) * L, { jag: 0.28, depth: 4 });
      const m = pts[Math.floor(pts.length * 0.5)], fork = pts.length > 6 ? bolt(R, ...m, m[0] + Math.cos(a + R.sign() * 0.7) * L * 0.35, m[1] + Math.sin(a + R.sign() * 0.7) * L * 0.35, { jag: 0.3, depth: 3 }) : null;
      return { pts, fork, L, cool: R.range(1.6, 2.1) };
    });
    // a direction thrown up from the hit: off the vertical by up to lim, any way round
    const fling = (lim, sp) => {
      const p = R.range(0, lim), g = R.range(0, TAU);
      return [Math.sin(p) * Math.cos(g) * sp, -Math.cos(p) * sp, Math.sin(p) * Math.sin(g) * sp];
    };
    let t = 0, hit = false;

    // the hammer of light: a heavy blunt bolt that falls faster and faster
    const tipY = (tt) => lerp(TOP - 6, 0, ease.inCubic(seg(tt, MARK, HIT)));

    function hammer(q) {
      if (t < MARK || t >= HIT + 0.06) return;
      const y1 = t >= HIT ? 0 : tipY(t), y0 = Math.max(TOP + 5, y1 - LEN * (t >= HIT ? 1 - (t - HIT) / 0.06 : 1)), white = t >= HIT;
      if (y1 < TOP + 12) return;
      // the head: wider, white hot
      q.beam(0, y1 - 6, 0, 0, y1 - 1, 0, 13, (u, v) => (v < 0.6 || white ? WHITE : C[6]));
      if (y1 - 3 > y0) q.beam(0, y0, 0, 0, y1 - 3, 0, 9, (u, v) => (white || v < 0.35 ? WHITE : v < 0.7 ? C[6] : C[5]));
      // speed lines above it, round it
      for (const [dx, dz, k] of [[-5, 0, 0.6], [-2, 3, 0.9], [2, -3, 0.8], [5, 0, 0.5]]) if (y0 > TOP + 2) q.line(dx, Math.max(TOP, y0 - 70), dz, dx, y0, dz, (u) => (u > 0.7 ? C[6] : C[4]), (u) => u * k);
      q.glowLine(0, y0 + 10, 0, 0, y1, 0, 16, C[5], 0.6);
      q.glow(0, y1 - 4, 0, Math.min(22, y1 - TOP - 6), WHITE, 0.5);
    }

    function crack(q) {
      if (t < HIT) return;
      const grow = ease.outCubic(seg(t, HIT, HIT + 0.1));
      for (const c of cracks) {
        for (const path of c.fork ? [c.pts, c.fork] : [c.pts]) {
          const n = Math.max(1, Math.round((path.length - 1) * grow));
          for (let i = 0; i < n; i++) {
            const [x0, z0] = path[i], [x1, z1] = path[i + 1], d = Math.hypot(x0, z0) / c.L, heat = clamp(1 - (t - HIT) / c.cool - d * 0.5);
            if (heat <= 0) continue;
            const col = heat > 0.85 ? WHITE : heat > 0.65 ? C[6] : heat > 0.45 ? C[5] : heat > 0.3 ? C[4] : heat > 0.18 ? C[3] : C[2], a = heat < 0.12 ? heat / 0.12 : 1;
            q.line(x0, 0, z0, x1, 0, z1, col, a);
            // wide and deep near the heart, a hairline at the tips
            if (d < 0.45 && path === c.pts) q.line(x0 + 0.8, 0, z0 + 0.8, x1 + 0.8, 0, z1 + 0.8, heat > 0.5 ? C[4] : C[2], a);
            if (i % 2 === 0) q.glow(x0, 0, z0, 10, C[4], 0.45 * heat);
          }
        }
      }
      // the crater glows at the heart and cools
      const h = clamp(1 - (t - HIT) / 1.6);
      if (h > 0) {
        q.plane(0, 0, 0, null, 5, (u, v, out) => {
          if (Math.hypot(u, v) > 4.5) return;
          out.c = h > 0.6 ? WHITE : h > 0.3 ? C[5] : C[3];
          out.a = Math.min(1, h * 3);
        });
        q.glow(0, 0, 0, 18, C[4], 0.45 * h);
      }
    }

    return {
      update(dt) {
        t += dt;
        if (t < MARK && R.chance(0.25)) ps.spawn3(P.STAR, R.range(-10, 10), -R.range(0, 18), R.range(-10, 10), 0, -R.range(4, 12), 0, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
        // sparks shed off the sides of the falling hammer
        if (t > MARK && t < HIT && tipY(t) > TOP + 50 && R.chance(0.6)) {
          const g = R.range(0, TAU), r = R.range(4, 7);
          ps.spawn3(P.MOTE, Math.cos(g) * r, tipY(t) - R.range(4, 30), Math.sin(g) * r, R.range(-20, 20), -R.range(10, 40), R.range(-20, 20), R.range(0.15, 0.3), C[6], 0.7);
        }
        if (!hit && t >= HIT) {
          hit = true;
          lights.add(0, -24, 92, C[5], 1, 0.6);
          lights.add(0, -8, 40, WHITE, 0.9, 0.12);
          for (let i = 0; i < 60; i++) {
            const [vx, vy, vz] = fling(1.25, R.range(110, 280));
            ps.spawn3(P.SPARK, R.range(-3, 3), -2, R.range(-3, 3), vx, vy, vz, R.range(0.25, 0.75));
          }
          for (let i = 0; i < 16; i++) {
            const [vx, vy, vz] = fling(1, R.range(60, 160));
            ps.spawn3(P.STAR, R.range(-4, 4), -4, R.range(-4, 4), vx, vy, vz, R.range(0.4, 0.9), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 2.4));
          }
          for (let i = 0; i < 14; i++) {
            const [vx, vy, vz] = fling(1.2, R.range(90, 230));
            chips.add({ kind: B.CHUNK, x: R.range(-5, 5), y: -2, z: R.range(-5, 5), vx, vy, vz, g: 1, drag: 0.4, bounce: 0.35, life: R.range(1.2, 1.8), a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 3), ramp: [OUTLINE, ...st] });
          }
          for (let i = 0; i < 34; i++) {
            const [vx, vy, vz] = fling(1, R.range(60, 220));
            ps.spawn3(P.GRIT, R.range(-4, 4), -1, R.range(-4, 4), vx, vy, vz, R.range(0.9, 1.5), R.pick(st.slice(1)), R.chance(0.4) ? 2 : 1);
          }
          // dust rolls out along the floor in a ring, a little smoke lifts off the crater
          for (let i = 0; i < 14; i++) {
            const g = (i / 14) * TAU + R.range(-0.2, 0.2), sp = R.range(50, 130), d = R.range(2, 10);
            ps.spawn3(P.SMOKE, Math.cos(g) * d, -R.range(1, 4), Math.sin(g) * d, Math.cos(g) * sp, -R.range(2, 12), Math.sin(g) * sp, R.range(0.7, 1.2), mix(dust, C[4], 0.18), R.range(3.5, 6), R.range(0, 0.06), PF.BIG);
          }
          for (let i = 0; i < 4; i++) ps.spawn3(P.SMOKE, R.range(-4, 4), -R.range(2, 8), R.range(-4, 4), R.range(-8, 8), -R.range(20, 45), R.range(-8, 8), R.range(1.2, 1.8), mix(dust, C[5], 0.25), R.range(4, 6), R.range(0.05, 0.3));
        }
        // the cracks spit embers while they're hot
        if (t > HIT && t < HIT + 1.3 && R.chance(0.5)) {
          const c = R.pick(cracks), q = R.pick(c.pts);
          if (R.chance(0.75)) ps.spawn3(P.EMBER, q[0], -1, q[1], R.range(-8, 8), -R.range(15, 35), R.range(-8, 8), R.range(0.5, 0.9), C[5]);
          else ps.spawn3(P.STAR, q[0], -2, q[1], 0, -R.range(4, 12), 0, R.range(0.3, 0.6), R.chance(0.5) ? WHITE : C[6], R.range(0.8, 1.8));
        }
        chips.update(dt);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        crack(q);
        // the mark: a glint on the floor and a ring closing on it
        if (t < HIT) {
          const u = seg(t, 0, MARK), k = smooth(0, 0.08, t), spin = t * 3, rr = lerp(26, 8, ease.inOutCubic(u)), flick = 0.65 + 0.35 * Math.sin(t * 40);
          for (let j = 0, n = Math.ceil(rr * TAU * 1.4); j < n; j++) {
            const g = (j / n) * TAU;
            q.dot(Math.cos(g) * rr, 0, Math.sin(g) * rr, Math.sin(g * 4 + spin) > 0 ? WHITE : C[5], k * flick);
            q.dot(Math.cos(g) * (rr - 1.5), 0, Math.sin(g) * (rr - 1.5), C[3], k * 0.6);
          }
          const L = (3 + 8 * ease.outBack(clamp(t / 0.2), 2)) * (t > MARK ? 1 + 0.6 * seg(t, MARK, HIT) : 1);
          for (let i = 0; i < 4; i++) {
            const a = spin * 0.3 + (i * Math.PI) / 2, len = (i % 2 ? L * 0.6 : L) * 1.6;
            q.line(0, 0, 0, Math.cos(a) * len, 0, Math.sin(a) * len, (v) => (v < 0.4 ? WHITE : C[5]), (v) => 1.2 - v);
          }
          q.at(0, -2, 0, (pp) => sparkle(pp, 0, 0, L * 0.7, WHITE, C[5], 0.5));
          q.glow(0, -2, 0, 14 + 10 * u, C[5], 0.5 * k);
          q.glowLine(0, TOP + 6, 0, 0, -2, 0, 5, C[4], 0.12 * u);
        }
        hammer(q);
        // the bolt's afterimage: a thread of light from the sky to the mark, thinning out
        const ai = seg(t, HIT + 0.04, HIT + 0.55);
        if (t > HIT + 0.04 && ai < 1) {
          const w = 1 + 4 * Math.pow(1 - ai, 2);
          q.beam(0, TOP + 4, 0, 0, -4, 0, w, (u, v) => (v < 0.5 ? WHITE : C[5]), (u) => (0.3 + 0.7 * u) * (1 - ai * 0.5));
          q.glowLine(0, TOP + 16, 0, 0, -6, 0, 10, C[5], 0.4 * (1 - ai));
        }
        // the shock: a ring of light running out over the floor, and a dome of light thrown up over the hit
        const k = seg(t, HIT, HIT + 0.42);
        if (t >= HIT && k < 1) {
          const r = 6 + 84 * ease.outCubic(k), th = Math.max(3, 9 * (1 - k)), hot = k < 0.12, B5 = C.slice(3), n = B5.length;
          q.ring(0, 0, 0, r, th, (v) => {
            const w = 1 - v;
            return w < 0.15 ? (hot ? WHITE : B5[n - 1]) : w < 0.4 ? B5[n - 2] : w < 0.7 ? B5[n - 3] : B5[n - 4];
          }, (v) => {
            const w = 1 - v;
            return (1.15 - k) * (w < 0.4 ? 1.2 : 1.15 - w);
          });
        }
        const d = seg(t, HIT, HIT + 0.28);
        if (t >= HIT && d < 1) {
          const r = 8 + 40 * ease.outCubic(d), th = Math.max(1, 3 * (1 - d));
          shell(q, 0, 0, 0, r, (nx, ny, nz, out) => {
            const e = Math.sqrt(1 - nz * nz);
            if (e < 1 - th / r) {
              out.c = C[6];
              out.a = 0.1 * (1 - d);
            } else {
              out.c = d < 0.2 || e > 1 - (th * 0.4) / r ? WHITE : C[5];
              out.a = 1.1 - d;
            }
          }, 0);
          for (let i = 0; i < 8; i++) q.glow(Math.cos((i / 8) * TAU) * r, -2, Math.sin((i / 8) * TAU) * r, 8, C[5], 0.3 * (1 - d));
        }
        // the white hero frame
        if (t >= HIT && t < HIT + 0.07) {
          q.ball(0, -6, 0, 19, C[6], 0.6);
          q.ball(0, -6, 0, 16, WHITE);
        }
        chips.draw(q);
        ps.draw(q);
        if (t >= HIT && t < HIT + 0.25) q.at(0, -8, 0, (pp) => sparkle(pp, 0, 0, 16 * (1 - (t - HIT) / 0.25), WHITE, C[5], 0.7));
        lights.draw(q);
      },
    };
  },
};
