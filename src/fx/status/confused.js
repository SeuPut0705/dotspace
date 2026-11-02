// The shaded, outlined question marks are
// adapted from Sprite Fusion's open-source heal (https://www.spritefusion.com/pixel-art-vfx/heal),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { cycle, fit, mix, sparkle, space, ease, clamp, TAU } from "../../core/index.js";
import { icon, bitmap, eyes, lift } from "./_lib.js";

export const meta = {
  name: "Confused",
  desc: "Head in a spin: a glowing spiral whirls over the head, question marks pop up round it and bob, the eyes dart left and right.",
  tags: ["status", "confused", "confusion", "dizzy", "debuff", "loop"],
  size: [60, 78],
  origin: [30, 70],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#1e0f2e", "#4b2070", "#8a3ab0", "#c66ae0", "#f0a8ff", "#ffffff"],
    marks: ["#2a1608", "#b0701a", "#ffd84a", "#fff4b8"],
    seed: 6,
  },
};

const SHRUG = { turn: 1, fx: -13, fy: -26, bx: 14, by: -26, ffx: -3, fbx: 4 };
export const act = {
  onBody: true,
  poses: [
    [0, { ...SHRUG, x: 0, lean: -2 }],
    [0.6, { ...SHRUG, x: 1, lean: 1, crouch: 1, fy: -23, by: -29, fbx: 5, fby: -6 }],
    [1.2, { ...SHRUG, x: 2, lean: 2 }],
    [1.8, { ...SHRUG, x: 1, lean: -1, crouch: 1, fy: -29, by: -23, ffx: -4, ffy: -6 }],
    [2.4, { ...SHRUG, x: 0, lean: -2 }],
  ],
};

const D = meta.duration;
const QS = [
  [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  [".####.", "##..##", "....##", "...##.", "..##..", "..##..", "......", "..##..", "..##.."],
  [".#####.", "##...##", "##...##", ".....##", "....##.", "...##..", "...##..", ".......", "...##..", "...##.."],
].map((rows) => bitmap(rows));
// three marks round the spiral: where they sit, when they pop, how big they get
const MARKS = [
  { x: -12, y: -5, t0: 0, big: 2 },
  { x: 12, y: -8, t0: 0.8, big: 1 },
  { x: 1, y: -17, t0: 1.6, big: 2 },
];

// the spiral, seen from the front: an arm winding out from its heart, spinning
function spiral(p, C, cx, cy, t) {
  const rot = (t / D) * TAU * 2, turns = 1.8, n = 72, breathe = 1 + 0.08 * Math.sin((t / D) * TAU * 4);
  const at = (u) => {
    const th = u * turns * TAU - rot, r = (0.8 + 6.6 * u) * breathe;
    return [cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.9];
  };
  // a dark underlay on the outer arm so it reads against anything, then the arm brightening as it winds out
  for (let i = 1; i <= n; i++) {
    const u = i / n, [x0, y0] = at((i - 1) / n), [x1, y1] = at(u);
    if (u > 0.45) p.line(x0 + 0.5, y0 + 0.7, x1 + 0.5, y1 + 0.7, C[1]);
  }
  for (let i = 1; i <= n; i++) {
    const u = i / n, [x0, y0] = at((i - 1) / n), [x1, y1] = at(u);
    p.line(x0, y0, x1, y1, u > 0.88 ? C[5] : u > 0.62 ? C[4] : u > 0.3 ? C[3] : C[2]);
    if (i % 6 === 0) p.light(x1, y1, C[3], 0.4 * u);
  }
  const [hx, hy] = at(1);
  sparkle(p, hx, hy, 2, C[4], C[3], 0.5);
  p.glow(cx, cy, 13, C[3], 0.28);
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 6), a = o.actor;
  p.glow(0, a.y - 7, 16, C[3], 0.22);
}

// the eyes dart from side to side (painted on the body)
function darting(p, a, t) {
  const look = Math.floor((t / D) * 6) % 2 ? 1 : -1;
  for (const e of eyes(a)) {
    for (const [x, y] of e.px) p.px(a.x + x, a.y + y, 0xff17121f);
    p.px(a.x + (look < 0 ? e.x0 : e.x1), a.y + e.y0, 0xffffffff);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 6), M = fit(o.marks, 4), a = o.actor;
  darting(p, a, t);
  spiral(p, C, 0, a.y - 7, t);
  // the question marks pop up, bob, and shrink away
  for (const m of MARKS) {
    const age = (((t - m.t0) % D) + D) % D, life = 1.9;
    if (age > life) continue;
    const u = age / life, pop = ease.outBack(clamp(age / 0.16), 3), out = clamp((u - 0.82) / 0.18);
    const size = Math.max(0, Math.round(m.big * pop * (1 - out) + (pop > 1.1 ? 1 : 0)));
    const bob = Math.sin(age * 5 + m.t0 * 3) * 1.6, tilt = Math.sin(age * 3.3 + m.t0) * 0.8;
    if (pop < 0.3 || (out > 0 && size === 0 && out > 0.6)) continue;
    const x = m.x + tilt, y = a.y + m.y + bob - age * 2;
    // it pops in with a burst of short rays and a flash
    if (age < 0.2) {
      const k = age / 0.2;
      for (let j = 0; j < 8; j++) {
        const an = (j / 8) * TAU + 0.2, d0 = 4 + 7 * k, d1 = d0 + 3 * (1 - k);
        p.line(x + Math.cos(an) * d0, y + Math.sin(an) * d0, x + Math.cos(an) * d1, y + Math.sin(an) * d1, j % 2 ? M[2] : M[3], 1 - k);
      }
      p.glow(x, y, 16, M[2], 0.45 * (1 - k));
    }
    icon(p, x, y, 7, QS[Math.min(2, size)], [M[0], M[1], M[2], M[3]]);
    p.glow(x, y, 10 + size * 2, M[2], 0.28 * (1 - out));
  }
  // glitter flicking off the spiral
  cycle(t, D, 10, o.seed + 2, (r) => r.range(0.35, 0.6), (age, life, r) => {
    const th = r.range(0, TAU), u = age / life, d = 6 + age * r.range(12, 22);
    const x = Math.cos(th) * d, y = a.y - 7 + Math.sin(th) * d * 0.8;
    if (Math.sin(Math.PI * u) > 0.6 && r.next() < 0.5) sparkle(p, x, y, 1, C[4], C[3], 0.3);
    else p.dot(x, y, u < 0.5 ? C[5] : C[4], 1.2 - u);
  });
}

// 3D: the spiral is a real funnel of light whirling over the head about the vertical axis (its far side dimmer,
// behind the head; its shadow whirling on the floor), the question marks pop up on a circle round it and orbit
// as billboards, glitter flicks off in every direction, the eyes dart on the body.
export const three = {
  meta: { size: [88, 100], origin: [44, 84], bg: "ground", camera: { pitch: 0.38 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 6), M = fit(o.marks, 4), a = o.actor, cy = lift(q, a.y - 7);
    darting(p, a, t);
    // the funnel: an arm winding out from its heart while it climbs, spinning
    const rot = (t / D) * TAU * 2, turns = 1.8, n = 72, breathe = 1 + 0.08 * Math.sin((t / D) * TAU * 4);
    const pt = (u, dy = 0) => {
      const g = u * turns * TAU - rot, r = (1 + 10.5 * u) * breathe;
      return [Math.cos(g) * r, cy + 4 - 15 * u + dy, Math.sin(g) * r];
    };
    const shade = (c, x, y, z) => (q.depth(x, y, z) > 0 ? mix(c, C[0], 0.4) : c);
    // its shadow whirls across the floor
    q.decal(0, 0, 0, null, 16, (pp) => {
      for (let i = 1; i <= n; i++) {
        const u = i / n, g0 = ((i - 1) / n) * turns * TAU - rot, g1 = u * turns * TAU - rot, r0 = (1 + 10.5 * (i - 1) / n) * breathe * 1.1, r1 = (1 + 10.5 * u) * breathe * 1.1;
        pp.line(Math.cos(g0) * r0, Math.sin(g0) * r0, Math.cos(g1) * r1, Math.sin(g1) * r1, C[3], 0.8 * u);
      }
    });
    // a dark underlay on the outer arm so it reads against anything, then the arm brightening as it winds out
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      if (u > 0.45) q.line(...pt((i - 1) / n, 0.8), ...pt(u, 0.8), C[1]);
    }
    for (let i = 1; i <= n; i++) {
      const u = i / n, p0 = pt((i - 1) / n), p1 = pt(u), c = u > 0.88 ? C[5] : u > 0.62 ? C[4] : u > 0.3 ? C[3] : C[2];
      q.beam(...p0, ...p1, 1.1 + 0.6 * u, shade(c, ...p1));
    }
    const [hx, hy, hz] = pt(1);
    // the question marks
    const marks = [], bursts = [];
    MARKS.forEach((m, i) => {
      const age = (((t - m.t0) % D) + D) % D, life = 1.9;
      if (age > life) return;
      const u = age / life, pop = ease.outBack(clamp(age / 0.16), 3), out = clamp((u - 0.82) / 0.18);
      const size = Math.max(0, Math.round(m.big * pop * (1 - out) + (pop > 1.1 ? 1 : 0)));
      const bob = Math.sin(age * 5 + m.t0 * 3) * 1.6;
      if (pop < 0.3 || (out > 0 && size === 0 && out > 0.6)) return;
      const an = 0.9 + (i * TAU) / 3 + age * 0.9, rho = 16 + Math.sin(age * 3.3 + m.t0) * 1.2, y = lift(q, a.y + m.y - 8 + bob - age * 2);
      marks.push({ x: Math.cos(an) * rho, y, z: Math.sin(an) * rho, size, out, age });
    });
    for (const m of marks) q.at(m.x, m.y, m.z, (pp) => icon(pp, 0, 0, 7, QS[Math.min(2, m.size)], [M[0], M[1], M[2], M[3]]));
    // light, after the solids
    q.glow(0, cy, 0, 16, C[3], 0.22);
    q.glow(0, cy, 0, 13, C[3], 0.28);
    q.glow(0, -2, 0, 24, C[2], 0.1);
    for (let i = 6; i <= n; i += 6) {
      const u = i / n, [x, y, z] = pt(u);
      q.glow(x, y, z, 3, C[3], 0.4 * u);
    }
    for (const m of marks) q.glow(m.x, m.y, m.z, 10 + m.size * 2, M[2], 0.28 * (1 - m.out));
    q.at(hx, hy, hz, (pp) => sparkle(pp, 0, 0, 2, C[4], C[3], 0.5));
    // each mark pops in with a burst of short rays (all the way round) and a flash
    for (const m of marks) {
      if (m.age >= 0.2) continue;
      const k = m.age / 0.2;
      for (let j = 0; j < 8; j++) {
        const an = (j / 8) * TAU + 0.2, el = j % 2 ? 0.6 : -0.6, d0 = 4 + 7 * k, d1 = d0 + 3 * (1 - k);
        const dx = Math.cos(an) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(an) * Math.cos(el);
        q.line(m.x + dx * d0, m.y + dy * d0, m.z + dz * d0, m.x + dx * d1, m.y + dy * d1, m.z + dz * d1, j % 2 ? M[2] : M[3], 1 - k);
      }
      q.glow(m.x, m.y, m.z, 16, M[2], 0.45 * (1 - k));
    }
    // glitter flicking off the spiral, in every direction
    cycle(t, D, 10, o.seed + 2, (r) => r.range(0.35, 0.6), (age, life, r) => {
      const th = r.range(0, TAU), el = r.range(-1, 1), u = age / life, d = 6 + age * r.range(12, 22);
      const x = Math.cos(th) * d * Math.cos(el), z = Math.sin(th) * d * Math.cos(el), y = cy + Math.sin(el) * d * 0.8;
      if (Math.sin(Math.PI * u) > 0.6 && r.next() < 0.5) q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 1, C[4], C[3], 0.3));
      else q.dot(x, y, z, u < 0.5 ? C[5] : C[4], 1.2 - u);
    });
  },
};
