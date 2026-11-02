import { cycle, fit, mix, luma, rand, Rng, clamp, smooth, sparkle, space, TAU, WHITE } from "../../core/index.js";
import { shape, colorAt, eyes, travel, onSprite, lift } from "./_lib.js";

export const meta = {
  name: "Frozen",
  desc: "Chilled to the bone: frost ferns creep over the body, icicles hang from chin and hands and drip, breath steams, snow settles, a shiver every second, frost spreads underfoot.",
  tags: ["status", "ice", "freeze", "frozen", "cold", "chill", "debuff", "loop"],
  size: [72, 64],
  origin: [36, 54],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], seed: 4 },
};

const STIFF = { turn: 0.9, crouch: 1, fx: -6, fy: -15, bx: 7, by: -15, ffx: -2, fbx: 3 };
export const act = {
  onBody: true,
  poses: [[0, { ...STIFF, crouch: 2 }], [0.22, STIFF], [1, STIFF], [1, { ...STIFF, crouch: 2 }, "snap"], [1.22, STIFF], [2, { ...STIFF, crouch: 2 }]],
};

const D = meta.duration, SHIVER = 1;
const since = (t) => (((t % SHIVER) + SHIVER) % SHIVER);
/** The effect draws the whole (chilled, shivering) body, so the stand-in is hidden throughout. */
export const actorAlpha = () => 0;
const shake = (t) => (since(t) < 0.22 ? (Math.floor(t * 50) % 2 ? 1 : -1) : 0);

// worked out once per character: fern paths creeping in from the outline, icicle roots, snow ledges, the mouth
const PLANS = new WeakMap();
function plan(a, seed) {
  let m = PLANS.get(a.mask);
  if (!m) PLANS.set(a.mask, (m = new Map()));
  if (m.has(seed)) return m.get(seed);
  const S = shape(a), H = S.h, W = S.w, R = new Rng(seed * 11 + 1);
  // ferns: a stem walking in from an edge with fronds branching off it at alternate sides, each pixel ordered by when it grows
  const ferns = [];
  const roots = S.side.filter(([, y]) => y > H * 0.2 && y < H * 0.85).sort(() => R.next() - 0.5).slice(0, 6);
  roots.forEach(([x0, y0, dir], i) => {
    let x = x0, y = y0, ang = dir < 0 ? -0.5 : Math.PI + 0.5;
    ang += R.range(-0.4, 0.4);
    for (let s = 0; s < 9; s++) {
      x += Math.cos(ang) * 1.1;
      y += Math.sin(ang) * 1.1;
      const px = Math.round(x), py = Math.round(y);
      if (!S.on(px, py)) break;
      ferns.push([px, py, s / 9, i]);
      if (s % 2 === 1)
        for (const side of [-1, 1]) {
          const ba = ang + side * 1.05, L = 1 + Math.round(R.range(0, 2) * (1 - s / 9));
          for (let k = 1; k <= L; k++) {
            const bx = Math.round(x + Math.cos(ba) * k), by = Math.round(y + Math.sin(ba) * k);
            if (S.on(bx, by)) ferns.push([bx, by, (s + k * 0.6) / 9, i]);
          }
        }
      ang += R.range(-0.25, 0.25);
    }
  });
  // icicles under the hair tips, the jaw and the hands: bottom edges with clear space under them
  const clear = (x, y) => {
    let n = 0;
    while (n < 7 && y + 1 + n < H && !S.on(x, y + 1 + n)) n++;
    return n;
  };
  const hangs = S.body.filter(([x, y]) => !S.on(x, y + 1) && S.on(x, y - 1) && y < H * 0.72 && y > 4).map(([x, y]) => [x, y, clear(x, y)]).filter(([, , c]) => c >= 4);
  const best = (f, key) => hangs.filter(f).sort(key)[0];
  const icicles = [
    best(([, y]) => y < H * 0.36, (p, q) => p[0] - q[0]),
    best(([, y]) => y < H * 0.36, (p, q) => q[0] - p[0]),
    best(([x, y]) => y >= H * 0.36 && y < H * 0.5 && x < W / 2, (p, q) => q[0] - p[0]),
    best(([x, y]) => y >= H * 0.36 && y < H * 0.5 && x >= W / 2, (p, q) => p[0] - q[0]),
    best(([x, y]) => y >= H * 0.5 && x < W / 2, (p, q) => p[0] - q[0]),
    best(([x, y]) => y >= H * 0.5 && x >= W / 2, (p, q) => q[0] - p[0]),
  ]
    .filter(Boolean)
    .map(([x, y, c], i) => ({ x, y: y + 1, len: Math.min(c - 1, R.range(3, 5.5)), phase: R.next(), period: i % 2 ? 1 : 2 }));
  // snow ledges: the upward edges of the head and the shoulders
  const snow = S.up.filter(([, y]) => y < H * 0.6).map(([x, y]) => [x, y, 1 + (rand(x, seed, 3) < 0.45 ? 1 : 0)]);
  const E = eyes(a), mouth = E.length === 2 ? [(E[0].x1 + E[1].x0 + 1) / 2, Math.max(E[0].y1, E[1].y1) + 2] : [W / 2, H * 0.38];
  const out = { ferns, icicles, snow, mouth };
  m.set(seed, out);
  return out;
}

// frost on the floor round the feet: a white crust, a pale bloom under it, its edge creeping out and back
function frost(p, C, t, reach) {
  for (let x = -Math.ceil(reach) - 1; x <= reach + 1; x++) {
    const q = Math.abs(x + 0.5) / reach, h = rand(x, 17), k = 1 - q * q;
    if (q > 1 + h * 0.15) continue;
    const tw = Math.sin((t / D) * TAU * 2 + rand(x, 3) * TAU) > 0.94;
    p.px(x, 0, tw || h < 0.3 ? C[7] : q > 0.85 ? C[5] : C[6]);
    if (h < 0.3 * k) p.px(x, -1, C[6]);
    for (let j = 1; j <= 1 + Math.round(2 * k); j++) p.dot(x, j, j === 1 ? C[5] : C[4], (1.05 - j / 4) * 0.85);
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), reach = 13 + 3.5 * Math.sin((t / D) * TAU);
  p.shade(-28, -3, 28, 6, (x, y, out) => {
    const d = Math.hypot(x / 24, (y - 0.5) / 4);
    if (d < 1) (out.l = C[4]), (out.k = 0.24 * (1 - d) * (1 - d));
  });
  frost(p, C, t, reach);
}

// the chilled body itself: its colours pulled toward ice, the rim frosted and lit, frost ferns creeping in from the
// outline (each shiver cracks most of it off and it creeps back), snow settled on the head and shoulders
function chill(p, C, a, P, t) {
  const S = shape(a), H = S.h, dx = shake(t), ph = since(t);
  const X = (mx) => a.x + mx + dx, Y = (my) => a.y + my;
  for (const [mx, my] of S.body) {
    const c = colorAt(a, mx, my), ice = C[clamp(1 + Math.round(luma(c) * 5.6), 1, 7)];
    const rim = !S.on(mx - 1, my) || !S.on(mx, my - 1) || !S.on(mx + 1, my);
    p.px(X(mx), Y(my), rim && luma(c) < 0.3 ? (my < H * 0.5 || !S.on(mx - 1, my) ? C[5] : C[3]) : mix(c, ice, 0.38));
  }
  const grow = 0.2 + 0.65 * smooth(0.05, 0.95, ph);
  for (const [x, y, u] of P.ferns) if (u < grow) p.px(X(x), Y(y), u > grow - 0.1 ? WHITE : rand(x, y, 5) < 0.5 ? C[6] : C[5]);
  for (const [x, y, d] of P.snow) {
    p.px(X(x), Y(y) - 1, C[7]);
    if (d > 1) p.px(X(x), Y(y) - 2, rand(x, y, 9) < 0.5 ? C[7] : C[6]);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), a = o.actor, S = shape(a), H = S.h, P = plan(a, o.seed), dx = shake(t), ph = since(t);
  const X = (mx) => a.x + mx + dx, Y = (my) => a.y + my;
  chill(p, C, a, P, t);
  // icicles hanging under the chin, hands and hair: they grow, a drop gathers and falls, they shrink back
  for (const ic of P.icicles) {
    const per = ic.period, u = ((t / per + ic.phase) % 1 + 1) % 1, L = ic.len * (0.55 + 0.45 * smooth(0, 0.7, u)), x = X(ic.x), y0 = Y(ic.y);
    for (let j = 0; j < L; j++) {
      const v = j / L;
      p.px(x, y0 + j, v > 0.75 ? WHITE : v < 0.3 ? C[7] : C[6]);
      if (v < 0.5) p.px(x + 1, y0 + j, C[4]);
    }
    // the drop: it swells at the tip, lets go and falls to the floor
    if (u > 0.7 && u < 0.86) p.px(x, y0 + L, C[6]);
    else if (u >= 0.86) {
      const f = (u - 0.86) * per, y = y0 + L + 0.5 * 760 * f * f;
      if (y < -1) (p.px(x, y, C[6]), p.px(x, y - 1, C[5]));
    }
    p.glow(x, y0 + L * 0.6, 4, C[5], 0.18);
  }
  // breath steaming from the mouth between shivers
  const [mx0, my0] = P.mouth;
  for (let i = 0; i < 4; i++) {
    const age = ph - 0.35 - i * 0.05;
    if (age < 0 || age > 0.65) continue;
    const u = age / 0.65, x = X(mx0) + 1 + travel(16, 0, 2.2, age) + i, y = Y(my0) - travel(6, 3, 1, age) - i * 0.5, rad = 0.8 + 2.4 * Math.sqrt(u);
    p.disc(x, y, rad, C[7], 0.5 * (1 - u) * Math.min(1, u * 8));
    p.disc(x - rad * 0.2, y - rad * 0.3, rad * 0.5, WHITE, 0.4 * (1 - u));
  }
  // snow falling and settling; flakes flung off by the shiver
  cycle(t, D, 9, o.seed + 2, (r) => r.range(1.2, 1.8), (age, life, r) => {
    const x = r.range(-14, 14) + Math.sin(age * 3 + r.next() * TAU) * 1.5, y = a.y - 16 + age * 14;
    if (y > a.y + 2) return;
    p.dot(x, y, r.next() < 0.5 ? WHITE : C[6], Math.min(1, age * 4));
  });
  if (ph < 0.5)
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1, vx = side * (20 + 30 * rand(i, 4)), vy = -(20 + 30 * rand(i, 5)), x = side * (6 + 6 * rand(i, 6)) + vx * ph, y = a.y + 3 * rand(i, 7) + vy * ph + 0.5 * 300 * ph * ph;
      p.dot(x, y, i % 3 ? C[6] : WHITE, 1.2 - ph * 2);
    }
  if (ph < 0.25) sparkle(p, X(Math.round(S.w * 0.3)), Y(4), Math.round(3 * (1 - ph / 0.25)), C[6], C[5], 0.4);
  // cold light: off the body, lifting with each shiver
  p.glow(0, a.y + H * 0.45, 30, C[4], 0.2 + 0.12 * Math.exp(-ph / 0.2));
  p.glow(0, a.y + 2, 16, C[5], 0.1);
}

// 3D: frost on the floor as a true circle with a jagged creeping edge, icicles of beams hanging from the body that let
// go real drops to the floor, breath fanning out in the air, snow falling through a volume and flakes thrown off the
// shoulders in a full circle, a cold pool of light. The chilled body and the ferns and snow on it stay painted on it.
function frostDisc(p, C, t, reach) {
  const R = Math.ceil(reach * 1.2) + 1;
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const r = Math.hypot(x + 0.5, y + 0.5), ang = Math.atan2(y + 0.5, x + 0.5), j = Math.floor(((ang + Math.PI) / TAU) * 36);
      const e = reach * (1 + 0.16 * (rand(j, 17) - 0.5) * 2) * (0.96 + 0.08 * rand(Math.floor(ang * 9), 21));
      if (r > e) continue;
      const q = r / e, h = rand(x, y, 17), tw = Math.sin((t / D) * TAU * 2 + rand(x, y, 3) * TAU) > 0.993;
      // a crust on the rim, a pale bloom under the rest, a few crystals in it
      if (tw) p.px(x, y, C[7]);
      else if (e - r < 2 && h < 0.8) p.px(x, y, h < 0.2 ? C[7] : e - r < 1 ? C[5] : C[6]);
      else p.blend(x, y, q > 0.78 ? C[5] : C[4], q > 0.78 ? 0.6 : 0.52 - q * 0.2);
    }
  // frost ferns fanning out from the feet, longest and then drawn back with the edge
  for (let i = 0; i < 7; i++) {
    const g = (i / 7) * TAU + rand(i, 41) * 0.6, len = reach * (0.6 + 0.35 * rand(i, 43)), c = Math.cos(g), s = Math.sin(g);
    p.line(c * 7, s * 7, c * len, s * len, C[6]);
    for (const b of [0.5, 0.75]) {
      const side = b > 0.6 ? 1 : -1, bl = (1 - b) * len * 0.5 + 1.5;
      p.line(c * len * b, s * len * b, c * len * b + Math.cos(g + side * 0.8) * bl, s * len * b + Math.sin(g + side * 0.8) * bl, C[5]);
    }
  }
}

export const three = {
  meta: { size: [84, 84], origin: [42, 68], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), a = o.actor, S = shape(a), H = S.h, P = plan(a, o.seed), dx = shake(t), ph = since(t), q = space(p, o);
    const X = (mx) => a.x + mx + dx, Y = (my) => a.y + my, G = 760;
    chill(p, C, a, P, t);
    // frost spreading underfoot, creeping out and back
    q.decal(0, 0, 0, null, 28, (pp) => frostDisc(pp, C, t, 17 + 4 * Math.sin((t / D) * TAU)));
    // icicles: three beams narrowing to a point under a chin, hand or hair tip; a drop swells, lets go and falls the
    // whole way to the floor, where it splashes frost
    const splash = [];
    P.icicles.forEach((ic, i) => {
      const per = ic.period, u = (((t / per + ic.phase) % 1) + 1) % 1, full = ic.len * 1.9, Lw = full * (0.55 + 0.45 * smooth(0, 0.7, u));
      const [rx, ry, rz] = onSprite(q, X(ic.x) + 0.5, Y(ic.y), 0.6 + (i % 3) * 0.4);
      // each hangs with a shorter one beside it, a little nearer the eye, so the cluster has some depth
      for (const [ox, k, dz] of [[0, 1, 0], [i % 2 ? -2.4 : 2.4, 0.55, 1.6]]) {
        const [bx, by, bz] = onSprite(q, X(ic.x) + 0.5 + ox, Y(ic.y), 0.6 + (i % 3) * 0.4 + dz), L = Lw * k;
        for (let j = 0; j < 3; j++)
          q.beam(bx, by + (L * j) / 3, bz, bx, by + (L * (j + 1)) / 3 + 0.5, bz, [3.2, 2.2, 1.3][j] * (k < 1 ? 0.75 : 1), (_, v) => (j === 2 && v < 0.45 ? WHITE : v < 0.35 ? C[7] : v < 0.7 ? C[5] : C[2]));
      }
      if (u > 0.7 && u < 0.86) q.ball(rx, ry + Lw + 0.6, rz, 0.9, C[6]);
      // the drop, from the moment it lets go (it keeps falling after the icicle has begun to grow back)
      const f = (u >= 0.86 ? u - 0.86 : u + 0.14) * per;
      if (u >= 0.86 || u < 0.7) {
        const [dxw, , dzw] = onSprite(q, a.x + ic.x + 0.5, 0, 0.6 + (i % 3) * 0.4), y0 = ry + full + 0.6, tf = Math.sqrt((2 * -y0) / G);
        if (f < tf) {
          const y = y0 + 0.5 * G * f * f;
          q.line(dxw, y - Math.min(4, G * f * 0.012), dzw, dxw, y, dzw, C[5]);
          q.ball(dxw, y, dzw, 0.9, C[6]);
          q.glow(dxw, y, dzw, 4, C[5], 0.16);
        } else if (f < tf + 0.34) splash.push([dxw, dzw, (f - tf) / 0.34, i]);
      }
      q.glow(rx, ry + Lw * 0.6, rz, 4, C[5], 0.18);
    });
    for (const [x, z, k, i] of splash) {
      q.ring(x, 0, z, 1 + 4.5 * k, 1, k < 0.35 ? C[7] : C[6], (1 - k) * 0.85);
      for (let j = 0; j < 4; j++) {
        const g = (j / 4) * TAU + i * 1.7;
        q.px(x + Math.cos(g) * k * 5, -k * (1 - k) * 12, z + Math.sin(g) * k * 5, j % 2 ? C[6] : WHITE);
      }
    }
    // flakes cracked off the head and shoulders by the shiver, thrown out in a full circle
    if (ph < 0.5)
      for (let i = 0; i < 14; i++) {
        const g = (i / 14) * TAU + rand(i, 8) * 0.9, v = 18 + 32 * rand(i, 4), r0 = 6 + 6 * rand(i, 6), vy = -(20 + 30 * rand(i, 5));
        q.dot(Math.cos(g) * (r0 + v * ph), lift(q, a.y + 4 + 4 * rand(i, 7)) + vy * ph + 150 * ph * ph, Math.sin(g) * (r0 + v * ph), i % 3 ? C[6] : WHITE, 1.2 - ph * 2);
      }
    // the sparkle on the shoulder
    if (ph < 0.25) {
      const k = 1 - ph / 0.25;
      q.at(...onSprite(q, X(Math.round(S.w * 0.3)), Y(4), 2), (pp) => sparkle(pp, 0, 0, Math.round(3 * k), C[6], C[5], 0.4));
    }
    // cold light: off the body, lifting with each shiver, and a pool on the floor
    const surge = 0.2 + 0.12 * Math.exp(-ph / 0.2);
    q.glow(0, lift(q, a.y + H * 0.45), 0, 30, C[4], surge);
    q.glow(0, lift(q, a.y + 2), 0, 16, C[5], 0.1);
    q.plane(0, 0, 0, null, 44, (u, v, out) => {
      const f = 1 - Math.hypot(u, v) / 44;
      if (f <= 0) return;
      out.l = C[4];
      out.k = f * f * (surge + 0.1);
    });
    // breath steaming from the mouth between shivers, fanning out in the air
    const mouth = onSprite(q, X(P.mouth[0]) + 1, Y(P.mouth[1])), puffs = [];
    for (let i = 0; i < 6; i++) {
      const age = ph - 0.3 - i * 0.045;
      if (age < 0 || age > 0.65) continue;
      const g = (i - 2.5) * 0.3 + Math.sin(i * 2.1) * 0.15, d = travel(16, 0, 2.2, age) + i, u = age / 0.65;
      puffs.push({ x: mouth[0] + Math.cos(g) * d, y: mouth[1] - travel(6, 3, 1, age) - i * 0.5, z: mouth[2] + Math.sin(g) * d, u, r: 1 + 3 * Math.sqrt(u) });
    }
    // snow falling through the air round him; the far flakes he hides, the near ones are drawn over him
    cycle(t, D, 30, o.seed + 2, (r) => r.range(1.3, 2), (age, life, r) => {
      const g = r.range(0, TAU), rad = 6 + 22 * Math.sqrt(r.next()), sw = Math.sin(age * 3 + r.next() * TAU) * 1.5, y0 = r.range(-62, -8);
      const x = Math.cos(g) * rad + sw, z = Math.sin(g) * rad + Math.cos(age * 2.4 + g) * 1.5, y = Math.min(-0.5, y0 + age * r.range(13, 20));
      q.dot(x, y, z, r.next() < 0.5 ? WHITE : C[6], Math.min(1, age * 4, (life - age) * 4));
    });
    for (const s of q.sort(puffs, (e) => [e.x, e.y, e.z])) {
      q.disc(s.x, s.y, s.z, s.r, C[6], 0.45 * (1 - s.u) * Math.min(1, s.u * 8));
      q.disc(s.x, s.y - s.r * 0.3, s.z, s.r * 0.5, C[7], 0.4 * (1 - s.u));
    }
  },
};
