// The speed lines are adapted from Sprite Fusion's open-source dash and the ray star from his sparkle
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, space, sparkle, clamp, smooth, ease, TAU, WHITE, READY } from "../../core/index.js";
import { spray } from "./_lib.js";

export const meta = {
  name: "Thrust",
  desc: "A piercing stab: a bundle of streaks shoots out from the hand to a point, a long four-point star flares at the tip with a pierce ring, sparks and speed lines.",
  tags: ["melee", "thrust", "stab", "spear", "rapier", "pierce", "combat", "directional", "one-shot"],
  size: [196, 76],
  origin: [34, 62],
  duration: 0.75,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a1608", "#6b3c10", "#b8701a", "#f0b42e", "#ffe27a", "#fff6cf", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    reach: 66,
    seed: 4,
  },
};

const STANCE = { ...READY, weapon: "sword", x: -14, fx: 12, fy: -21, sa: -0.3 };
// the hand comes back to the hip with the point forward, then the whole arm goes out along the blade
const BACK = { ...STANCE, crouch: 5, lean: -3, fx: -3, fy: -19, sa: -0.05, bx: 8, by: -30, armsFront: true, ffx: 10, fbx: -8 };
const LUNGE = { ...STANCE, crouch: 6, lean: 6, fx: 23, fy: -20, sa: 0, bx: -8, by: -24, ffx: 15, fbx: -11, toeB: true };
export const act = {
  target: { x: 80 },
  poses: [
    [-0.46, STANCE],
    [-0.24, BACK],
    [-0.05, { ...BACK, crouch: 6, fx: -5 }],
    [0, { ...LUNGE, ghost: 1 }, "snap"],
    [0.07, LUNGE, "snap"],
    [0.3, { ...LUNGE, crouch: 5, lean: 5 }],
    [0.7, STANCE],
  ],
  hits: [{ t: 0.07, stop: 0.12, shake: 0.14, amp: 2, push: 2.8, straw: 16, y: -26 }],
  dust: [{ t: 0, x: -24, n: 6, dir: -1 }, { t: 0.07, x: 1, n: 6, dir: 1 }],
};

const OUT = 0.07; // the point arrives
const HOLD = 0.06, PULL = 0.2;

// a long four-point star: the forward and back arms long, up and down shorter, thick at the heart
function longStar(p, x, y, L, k, C) {
  if (L < 1) return;
  const arms = [[1, 0, L], [-1, 0, L * 0.7], [0, -1, L * 0.42], [0, 1, L * 0.42]];
  for (const [dx, dy, len] of arms)
    for (let d = 1; d <= len; d += 0.5) {
      const u = d / len, c = u < 0.3 ? WHITE : u < 0.65 ? C[5] : C[4];
      p.dot(x + dx * d, y + dy * d, c, u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35);
      if (u < 0.25 && len > 6) (p.dot(x + dx * d - dy, y + dy * d + dx, C[5]), p.dot(x + dx * d + dy, y + dy * d - dx, C[5]));
    }
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let d = 1; d <= Math.min(3, L * 0.14); d++) p.px(x + dx * d, y + dy * d, d < 2 ? C[5] : C[4]);
  p.px(x, y, WHITE);
  p.glow(x, y, 6 + L * 1.3, C[4], 0.35 * k);
  p.glow(x, y, 3 + L * 0.4, WHITE, 0.3 * k);
}

export function create(o) {
  const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
  const HX = 9, HY = -20, TX = HX + o.reach, TY = HY;
  // the bundle: streaks fanned at the hand, meeting at the point; the middle one hottest
  const streaks = [-7, -4, -2, 0, 2, 4, 7].map((off) => ({ off, x0: HX + 1 + Rg.range(0, 5) + Math.abs(off) * 0.6, t0: Rg.range(0, 0.02) + Math.abs(off) * 0.003, w: off === 0 ? 2 : 1, hot: off === 0, len: Rg.range(0.75, 1) }));
  const lines = [];
  let t = 0, struck = false;
  return {
    update(dt) {
      t += dt;
      // speed lines race forward beside the bundle while it shoots out and just after
      if (t < OUT + 0.08 && Rg.chance(0.5)) {
        const s = Rg.sign();
        lines.push({ x: HX + Rg.range(0, o.reach * 0.6), y: HY + s * Rg.range(7, 17), l: Rg.range(18, 42), v: Rg.range(200, 340), t });
      }
      for (let i = lines.length - 1; i >= 0; i--) if (t - lines[i].t > 0.24) lines.splice(i, 1);
      for (const l of lines) l.x += l.v * dt;
      if (!struck && t >= OUT) {
        struck = true;
        lights.add(TX, TY, 44, C[4], 0.45, 0.3);
        lights.add(TX, TY, 14, WHITE, 0.6, 0.06);
        for (let i = 0; i < 12; i++) {
          const a = Rg.range(-0.55, 0.45), sp = Rg.range(150, 330);
          ps.spawn(P.SPARK, TX, TY, Math.cos(a) * sp, Math.sin(a) * sp - 30, Rg.range(0.12, 0.35));
        }
        for (let i = 0; i < 10; i++) {
          const a = Rg.range(-0.9, 0.9) + (Rg.chance(0.3) ? Math.PI : 0), sp = Rg.range(40, 120);
          ps.spawn(P.MOTE, TX + Rg.range(-6, 2), TY + Rg.range(-2, 2), Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : C[4], 0.6);
        }
        for (let i = 0; i < 4; i++) ps.spawn(P.STAR, TX + Rg.range(-10, 8), TY + Rg.range(-9, 9), 0, -3, Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2), Rg.range(0.06, 0.2));
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the point catches the light before it goes
      if (t < 0.05) sparkle(p, HX + 2, HY, 5 * (1 - t / 0.05) + 1, C[5], C[3], 0.4);
      // speed lines: dotted, white at the head, dimming back along their length
      for (const l of lines) {
        const k = (t - l.t) / 0.24;
        for (let d = 0; d < l.l * (1 - k * 0.6); d++) p.dot(l.x - d, l.y, d < 3 ? WHITE : d < l.l * 0.4 ? C[5] : C[3], (1 - d / l.l) * (1 - k));
      }
      // the bundle: each streak shoots from the hand to the point, holds, then is drawn in to the point
      const pull = smooth(OUT + HOLD, OUT + HOLD + PULL, t);
      for (const s of streaks) {
        const u = clamp((t - s.t0) / OUT), head = ease.outExpo(u);
        if (u <= 0 || pull >= 1) continue;
        // the outer streaks stop short of the point and trail a little behind, so each reads on its own
        const y0 = HY + s.off, end = s.x0 + (TX - s.x0) * s.len, x1 = s.x0 + (end - s.x0) * head, xa = s.x0 + (end - s.x0) * Math.max(pull, head * 0.35 * (1 - s.len) * 3);
        const yAt = (x) => y0 + (TY - y0) * clamp((x - s.x0) / (TX - s.x0)) * 0.85;
        for (let x = xa; x <= x1; x += 0.5) {
          const v = (x - xa) / Math.max(1, x1 - xa), c = v > 0.88 ? WHITE : s.hot ? (v > 0.35 ? C[6] : C[5]) : v > 0.55 ? C[5] : v > 0.25 ? C[4] : C[3];
          p.dot(x, yAt(x), c, v < 0.12 ? v / 0.12 : 1);
          if (s.w > 1 && v > 0.1) p.dot(x, yAt(x) + 1, v > 0.6 ? C[5] : C[3], v < 0.2 ? v / 0.2 : 1);
        }
      }
      if (t < OUT + HOLD + PULL) p.glowLine(HX + (TX - HX) * pull, HY, HX + (TX - HX) * ease.outExpo(clamp(t / OUT)), TY, 6, C[4], 0.22 * (1 - pull));
      // the long star at the point, and a pierce ring shed from it
      const q = t - OUT;
      if (q >= 0 && q < 0.4) {
        const g = ease.outBack(clamp(q / 0.04), 2.4) * (1 - smooth(0.08, 0.4, q)) * (1 + 0.12 * Math.sin(q * 70));
        longStar(p, TX, TY, 24 * g, 1 - q / 0.4, C);
      }
      if (q >= 0 && q < 0.2) {
        const k = q / 0.2, rx = 2 + 7 * ease.outCubic(k), ry = 4 + 12 * ease.outCubic(k);
        for (let a = 0; a < TAU; a += 0.05) p.dot(TX + 4 + 10 * k + Math.cos(a) * rx, TY + Math.sin(a) * ry, k < 0.3 ? WHITE : C[5], 1.15 - k);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// 3D: the thrust goes down +x. The streaks are real lines fanned round the axis, from a ring of hand-side points to
// the one point, so from the front they stack like the 2D bundle and from behind or ahead they close in like the
// spokes of a wheel. The speed lines race round it at every angle. The pierce ring is a true ring standing across the
// axis (a few of them follow each other out from the tip, a cone of rings), the star at the tip is six arms (long
// ahead and behind, short up, down and across), and the sparks leave in a cone round +x, a few tumbling back.
const ARMS = [[1, 0, 0, 1], [-1, 0, 0, 0.7], [0, -1, 0, 0.42], [0, 1, 0, 0.42], [0, 0, 1, 0.42], [0, 0, -1, 0.42]];
function longStar3(q, x, y, z, L, k, C) {
  if (L < 1) return;
  for (const [dx, dy, dz, f] of ARMS) {
    const len = L * f;
    q.line(x + dx, y + dy, z + dz, x + dx * len, y + dy * len, z + dz * len, (u) => (u < 0.3 ? WHITE : u < 0.65 ? C[5] : C[4]), (u) => (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35));
    if (len > 6) q.beam(x + dx, y + dy, z + dz, x + dx * len * 0.25, y + dy * len * 0.25, z + dz * len * 0.25, 1.6, (u, v) => (v < 0.4 ? WHITE : C[5]), 1);
  }
  q.at(x, y, z, (pp) => {
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let d = 1; d <= Math.min(3, L * 0.14); d++) pp.px(dx * d, dy * d, d < 2 ? C[5] : C[4]);
    pp.px(0, 0, WHITE);
  });
  q.glow(x, y, z, 6 + L * 1.3, C[4], 0.35 * k);
  q.glow(x, y, z, 3 + L * 0.4, WHITE, 0.3 * k);
}

export const three = {
  meta: { size: [256, 124], origin: [128, 72], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, sparks: o.sparks }), lights = new Lights();
    const HX = 9, HY = -20, TX = HX + o.reach, TY = HY;
    // the bundle: a hot one down the axis and six round it, fanned out at the hand and meeting at the point
    const streaks = [{ rad: 0, ph: 0 }, ...[6.5, 4, 6.5, 4, 6.5, 4].map((rad, i) => ({ rad, ph: (i * TAU) / 6 + 0.3 }))].map((s) => ({ ...s, x0: HX + 1 + Rg.range(0, 5) + s.rad * 0.6, t0: Rg.range(0, 0.02) + s.rad * 0.003, hot: s.rad === 0, len: Rg.range(0.75, 1) }));
    const lines = [];
    let t = 0, struck = false;
    return {
      update(dt) {
        t += dt;
        // speed lines race forward round the bundle while it shoots out and just after
        if (t < OUT + 0.08 && Rg.chance(0.7)) {
          const ph = Rg.range(0, TAU), rho = Rg.range(7, 17);
          lines.push({ x: HX + Rg.range(0, o.reach * 0.6), y: HY + Math.sin(ph) * rho, z: Math.cos(ph) * rho, l: Rg.range(18, 42), v: Rg.range(200, 340), t });
        }
        for (let i = lines.length - 1; i >= 0; i--) if (t - lines[i].t > 0.24) lines.splice(i, 1);
        for (const l of lines) l.x += l.v * dt;
        if (!struck && t >= OUT) {
          struck = true;
          lights.add(TX, TY, 44, C[4], 0.45, 0.3, 0);
          lights.add(TX, TY, 14, WHITE, 0.6, 0.06, 0);
          for (let i = 0; i < 14; i++) {
            const [vx, vy, vz] = spray(Rg, [1, 0, 0], 0.55, Rg.range(110, 260));
            ps.spawn3(P.SPARK, TX, TY, 0, vx, vy - 30, vz, Rg.range(0.12, 0.35));
          }
          for (let i = 0; i < 10; i++) {
            const [vx, vy, vz] = spray(Rg, [Rg.chance(0.3) ? -1 : 1, 0, 0], 0.9, Rg.range(40, 120));
            ps.spawn3(P.MOTE, TX + Rg.range(-6, 2), TY + Rg.range(-2, 2), Rg.range(-2, 2), vx, vy, vz, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[5] : C[4], 0.6);
          }
          for (let i = 0; i < 4; i++) ps.spawn3(P.STAR, TX + Rg.range(-10, 8), TY + Rg.range(-9, 9), Rg.range(-9, 9), 0, -3, 0, Rg.range(0.2, 0.4), Rg.chance(0.5) ? C[5] : WHITE, Rg.range(1, 2), Rg.range(0.06, 0.2));
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the point catches the light before it goes
        if (t < 0.05) q.at(HX + 2, HY, 0, (pp) => sparkle(pp, 0, 0, 5 * (1 - t / 0.05) + 1, C[5], C[3], 0.4));
        // speed lines: dotted, white at the head, dimming back along their length
        for (const l of lines) {
          const k = (t - l.t) / 0.24, len = l.l * (1 - k * 0.6);
          q.line(l.x - len, l.y, l.z, l.x, l.y, l.z, (u) => (u > 1 - 3 / len ? WHITE : u > 0.6 ? C[5] : C[3]), (u) => u * (1 - k));
        }
        // the bundle: each streak shoots from the hand to the point, holds, then is drawn in to the point
        const pull = smooth(OUT + HOLD, OUT + HOLD + PULL, t);
        for (const s of streaks) {
          const u = clamp((t - s.t0) / OUT), head = ease.outExpo(u);
          if (u <= 0 || pull >= 1) continue;
          const end = s.x0 + (TX - s.x0) * s.len, x1 = s.x0 + (end - s.x0) * head, xa = s.x0 + (end - s.x0) * Math.max(pull, head * 0.35 * (1 - s.len) * 3);
          if (x1 - xa < 0.5) continue;
          const at = (x) => { const f = clamp((x - s.x0) / (TX - s.x0)) * 0.85, r = s.rad * (1 - f); return [x, HY + Math.sin(s.ph) * r, Math.cos(s.ph) * r]; };
          const col = (v) => (v > 0.88 ? WHITE : s.hot ? (v > 0.35 ? C[6] : C[5]) : v > 0.55 ? C[5] : v > 0.25 ? C[4] : C[3]);
          if (s.hot) q.beam(...at(xa), ...at(x1), 1.7, (uu, vv) => (uu > 0.88 || vv < 0.3 ? WHITE : col(uu)), (uu) => (uu < 0.12 ? uu / 0.12 : 1));
          else {
            const n = Math.max(1, Math.ceil((x1 - xa) / 5));
            for (let i = 0; i < n; i++) {
              const xs = xa + ((x1 - xa) * i) / n, xe = xa + ((x1 - xa) * (i + 1)) / n, v0 = (xs - xa) / (x1 - xa), v1 = (xe - xa) / (x1 - xa);
              q.line(...at(xs), ...at(xe), (uu) => col(v0 + (v1 - v0) * uu), (uu) => { const v = v0 + (v1 - v0) * uu; return v < 0.12 ? v / 0.12 : 1; });
            }
          }
        }
        if (t < OUT + HOLD + PULL) q.glowLine(HX + (TX - HX) * pull, HY, 0, HX + (TX - HX) * ease.outExpo(clamp(t / OUT)), TY, 0, 6, C[4], 0.22 * (1 - pull));
        // the long star at the point, and pierce rings shed from it, a cone of rings opening out along the axis
        const w = t - OUT;
        if (w >= 0 && w < 0.4) {
          const g = ease.outBack(clamp(w / 0.04), 2.4) * (1 - smooth(0.08, 0.4, w)) * (1 + 0.12 * Math.sin(w * 70));
          longStar3(q, TX, TY, 0, 24 * g, 1 - w / 0.4, C);
        }
        for (let j = 0; j < 3; j++) {
          const wj = w - j * 0.03;
          if (wj < 0 || wj >= 0.2) continue;
          const k = wj / 0.2, r = 4 + 11 * ease.outCubic(k) + j * 2.5, x = TX + 4 + 10 * k + j * 5;
          q.ring(x, TY, 0, r, 1.2, k < 0.3 ? WHITE : C[5], (1.1 - k) * (1 - j * 0.3), [1, 0, 0]);
          // the lead ring's rim is a line too, so it still reads when seen edge on
          if (j === 0) {
            const rim = [];
            for (let i = 0; i <= 28; i++) rim.push([x, TY + Math.sin((i / 28) * TAU) * r, Math.cos((i / 28) * TAU) * r]);
            q.polyline(rim, k < 0.3 ? WHITE : C[5], 1.1 - k);
          }
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
