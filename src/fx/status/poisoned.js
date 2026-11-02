import { cycle, fit, hex, mix, luma, rand, Rng, clamp, smooth, band, space, lit, TAU, WHITE } from "../../core/index.js";
import { shape, colorAt, eyes, onSprite, lift } from "./_lib.js";

export const meta = {
  name: "Poisoned",
  desc: "Sick to the bone: green rolls up the body in waves, dark veins creep from a wound, toxic sweat drips and hisses; every 0.8 s it wobbles, blisters pop and a ring pulses out.",
  tags: ["status", "poison", "toxic", "dot", "debuff", "sick", "loop"],
  size: [72, 64],
  origin: [36, 54],
  duration: 1.6,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#0e1d14", "#173320", "#23552e", "#318232", "#55b92f", "#8eea3f", "#cfff63", "#f6ffc2"], veins: "#2c1a3a", seed: 5 },
};

const SICK = { turn: 0.8, crouch: 4, lean: 4, hy: 1, fx: 2, fy: -20, bx: 8, by: -14, ffx: 3, fbx: -3 };
export const act = {
  onBody: true,
  poses: [[0, { ...SICK, x: -1, crouch: 5, lean: 5 }], [0.2, { ...SICK, x: 0 }], [0.5, { ...SICK, x: 1 }], [0.8, { ...SICK, x: 1, crouch: 5, lean: 5 }], [1, { ...SICK, x: 0 }], [1.3, { ...SICK, x: -1 }], [1.6, { ...SICK, x: -1, crouch: 5, lean: 5 }]],
};

const D = meta.duration, TICK = 0.8, G = 760;
const since = (t) => (((t % TICK) + TICK) % TICK);
/** The effect draws the whole (sick, swaying) body, so the stand-in is hidden throughout. */
export const actorAlpha = () => 0;

// worked out once per character: the veins (walks out from a wound on the forearm), blister spots, sweat spots
const BODIES = new WeakMap();
function body(a, seed) {
  let m = BODIES.get(a.mask);
  if (!m) BODIES.set(a.mask, (m = new Map()));
  if (m.has(seed)) return m.get(seed);
  const S = shape(a), H = S.h, W = S.w, R = new Rng(seed * 7 + 3);
  const [l, r] = S.rows[Math.round(H * 0.6)], wx = r - 1, wy = Math.round(H * 0.6);
  const veins = [];
  const walk = (x, y, ang, len, depth) => {
    const pts = [];
    for (let s = 0; s < len; s++) {
      ang += R.range(-0.5, 0.5);
      x += Math.cos(ang);
      y += Math.sin(ang);
      if (!S.on(Math.round(x), Math.round(y))) break;
      pts.push([Math.round(x), Math.round(y), s / len]);
      if (depth < 2 && s > 2 && R.chance(0.16)) walk(x, y, ang + R.sign() * R.range(0.6, 1.1), len * 0.55, depth + 1);
    }
    veins.push(pts);
  };
  for (let i = 0; i < 4; i++) walk(wx, wy, Math.PI + (i / 4 - 0.45) * 2.2, 11, 0);
  const lum = (x, y) => luma(colorAt(a, x, y));
  const skin = S.body.filter(([x, y]) => lum(x, y) > 0.55 && S.on(x - 1, y) && S.on(x + 1, y));
  const pick = (list) => list[Math.floor(R.next() * list.length)];
  const blisters = [0, 1].map(() => [0, 1, 2].map(() => {
    const [x, y] = pick(S.body.filter(([x, y]) => y > 4 && S.on(x - 1, y) && S.on(x + 1, y) && S.on(x, y - 1)));
    return { x, y, r: R.range(1.1, 1.8) };
  }));
  const E = eyes(a), sweat = [];
  for (const e of E) sweat.push([e.x0 < W / 2 ? e.x0 - 1 : e.x1 + 1, e.y0 - 1]);
  for (const side of [-1, 1]) {
    const hand = S.body.filter(([x, y]) => y > H * 0.5 && y < H * 0.7 && (side < 0 ? x <= l + 1 : x >= r - 1) && !S.on(x, y + 1));
    if (hand.length) sweat.push(hand[0]);
  }
  if (!sweat.length) sweat.push(pick(skin.length ? skin : S.body));
  const out = { veins, wound: [wx, wy], blisters, sweat };
  m.set(seed, out);
  return out;
}

// the sway: the body leans from the feet, the head moving most; on the tick, every row wobbles a pixel
function offsets(t, H) {
  const lean = 1.3 * Math.sin((t / D) * TAU), ph = since(t), wob = ph < 0.12;
  const w = wob ? Math.sin((ph / 0.12) * Math.PI) : 0;
  return (my) => Math.round(lean * (1 - my / H) + w * Math.sin(my * 0.42 + ph * 40));
}

export function drawBack(p, t, o) {
  const P = fit(o.palette, 8), ph = since(t);
  // a green ring pulses out across the floor on the tick (far half), the floor glows sick
  const k = ph / 0.55;
  if (k < 1) band(p, 0, 0, 5 + 22 * Math.sqrt(k), 0.18, Math.max(1, 2.5 * (1 - k)), 1 - k, [P[3], P[4], P[5], P[6]], (g) => Math.sin(g) < 0);
  p.shade(-28, -3, 28, 6, (x, y, out) => {
    const d = Math.hypot(x / 24, (y - 0.5) / 4);
    if (d < 1) (out.l = P[4]), (out.k = (0.14 + 0.2 * Math.exp(-ph / 0.2)) * (1 - d) * (1 - d));
  });
}

// the sick body itself: its own colours sickened by green that rolls up it in waves, veins creeping out from the wound
// and drawing back, the wound
function sicken(p, P, a, S, B, off, vein, t) {
  const H = S.h;
  for (const [mx, my] of S.body) {
    const c = colorAt(a, mx, my), l = luma(c), wave = 0.5 + 0.5 * Math.sin(TAU * ((my / H) * 1.6 + (t / D) * 2));
    const sick = P[clamp(1 + Math.round(l * 6.2), 1, 7)], k = 0.22 + 0.4 * wave * wave;
    p.px(a.x + mx + off(my), a.y + my, mix(c, wave > 0.85 && l > 0.4 ? mix(sick, P[6], 0.3) : sick, k));
  }
  const grow = smooth(0, D * 0.55, t) * (1 - smooth(D * 0.62, D, t)) * 1.15;
  for (const pts of B.veins)
    for (const [x, y, u] of pts) if (u < grow) p.px(a.x + x + off(y), a.y + y, u > grow - 0.12 ? P[2] : vein);
  const [wx, wy] = B.wound;
  p.px(a.x + wx + off(wy), a.y + wy, P[6]);
  p.px(a.x + wx + off(wy) - 1, a.y + wy, P[3]);
  p.glow(a.x + wx, a.y + wy, 6, P[5], 0.3);
}

export function draw(p, t, o) {
  const P = fit(o.palette, 8), a = o.actor, S = shape(a), H = S.h, B = body(a, o.seed), off = offsets(t, H), ph = since(t), tick = Math.floor(t / TICK) % 2;
  const vein = hex(o.veins);
  sicken(p, P, a, S, B, off, vein, t);
  // blisters: on the tick they swell up out of the skin, shine, and pop
  for (const bl of B.blisters[tick]) {
    const x = a.x + bl.x + off(bl.y), y = a.y + bl.y, grow2 = clamp(ph / 0.16), pop = ph > 0.38;
    if (!pop) {
      const r = bl.r * grow2;
      p.circle(x, y, r + 0.6, P[3]);
      p.circle(x - 0.2, y - 0.2, r, P[5]);
      if (r > 0.8) p.px(x - 0.5, y - 0.8, WHITE);
      p.glow(x, y, 4, P[5], 0.3 * grow2);
    } else if (ph < 0.56) {
      const k = (ph - 0.38) / 0.18;
      for (let j = 0; j < 6; j++) {
        const an = (j / 6) * TAU + bl.x, d = bl.r + 0.5 + k * 3.5;
        p.dot(x + Math.cos(an) * d, y + Math.sin(an) * d - k * 2, j % 2 ? P[6] : P[5], 1.2 - k);
      }
      p.glow(x, y, 6, P[6], 0.4 * (1 - k));
    }
  }
  // toxic sweat: beads gather, run, fall and hiss on the floor
  B.sweat.forEach(([sx, sy], i) => {
    const per = D / 2, age = (((t - i * 0.37) % per) + per) % per, gather = 0.35;
    const x = a.x + sx + 0.5 + off(sy), y0 = a.y + sy;
    if (age < gather) {
      const k = age / gather, run = Math.round(k * 2);
      p.px(x, y0 + run, k > 0.5 ? P[6] : P[5]);
      if (k > 0.5) p.px(x, y0 + run - 1, P[4]);
      return;
    }
    const f = age - gather, fallH = -1 - (y0 + 2), tf = Math.sqrt((2 * Math.max(1, fallH)) / G);
    if (f < tf) {
      const y = y0 + 2 + 0.5 * G * f * f;
      p.line(x, y - Math.min(3, G * f * 0.012), x, y, P[4]);
      p.px(x, y, P[6]);
      return;
    }
    const h = f - tf;
    if (h > 0.4) return;
    // the hiss: a green fleck spreads, a wisp of vapour curls up, sizzle sparks
    const k = h / 0.4;
    p.line(x - 1 - k * 2, -1, x + 1 + k * 2, -1, P[k < 0.4 ? 6 : 4], 1.2 - k);
    for (let j = 0; j < 3; j++) p.dot(x + (j - 1) * (2 + 3 * k), -2 - j % 2 - 5 * k * (1 - k), P[6], 1 - k);
    p.disc(x + Math.sin(k * 6) * 1.5, -3 - k * 6, 1 + 1.5 * k, P[5], 0.35 * (1 - k));
    p.glow(x, -1.5, 5, P[5], 0.35 * (1 - k));
  });
  // the near half of the floor ring
  const k = ph / 0.55;
  if (k < 1) band(p, 0, 0, 5 + 22 * Math.sqrt(k), 0.18, Math.max(1, 2.5 * (1 - k)), 1 - k, [P[3], P[4], P[5], P[6]], (g) => Math.sin(g) >= 0);
  // a sick light on the body, surging with the tick
  p.glow(0, a.y + H * 0.45, 26, P[4], 0.14 + 0.2 * Math.exp(-ph / 0.18));
}

// 3D: the green body, veins and wound stay painted on the sprite. The tick ring is a true circle racing out over the
// floor, blisters are little spheres swelling on the skin, toxic sweat falls all the way to the floor and hisses into
// vapour, bubbles and spores rise round him with real positions, and a sick light pools under his feet.
export const three = {
  meta: { size: [88, 90], origin: [44, 72], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const P = fit(o.palette, 8), a = o.actor, S = shape(a), H = S.h, B = body(a, o.seed), off = offsets(t, H), ph = since(t), tick = Math.floor(t / TICK) % 2;
    const q = space(p, o), vein = hex(o.veins), G = 760, ramp = [P[0], P[2], P[3], P[4], P[5]], vapour = [];
    sicken(p, P, a, S, B, off, vein, t);
    // the sick light on the floor, surging with the tick
    const surge = 0.14 + 0.2 * Math.exp(-ph / 0.2);
    q.plane(0, 0, 0, null, 36, (u, v, out) => {
      const f = 1 - Math.hypot(u, v) / 36;
      if (f <= 0) return;
      out.l = P[4];
      out.k = f * f * surge * 1.3;
    });
    // the ring pulsing out across the floor on the tick: far half behind him, near half in front, by depth
    const kr = ph / 0.55;
    if (kr < 1) {
      const r = 5 + 24 * Math.sqrt(kr), w = Math.max(1.5, 3.5 * (1 - kr));
      q.plane(0, 0, 0, null, r + 1, (u, v, out) => {
        const b = (r - Math.hypot(u, v)) / w;
        if (b < 0 || b > 1) return;
        out.c = b < 0.25 ? P[6] : b < 0.5 ? P[5] : b < 0.75 ? P[4] : P[3];
        out.a = (1 - kr) * 0.95;
        out.blend = true;
        out.l = P[5];
        out.k = 0.3 * (1 - kr) * (1 - b);
      });
    }
    // blisters: on the tick they swell out of the skin as spheres, shine, and pop into a spray
    for (const bl of B.blisters[tick]) {
      const [bx, by, bz] = onSprite(q, a.x + bl.x + 0.5 + off(bl.y), a.y + bl.y, 1), grow = clamp(ph / 0.16);
      if (ph <= 0.38) {
        q.ball(bx, by, bz, bl.r * grow + 0.4, lit(ramp));
        q.glow(bx, by, bz, 4, P[5], 0.3 * grow);
      } else if (ph < 0.56) {
        const k = (ph - 0.38) / 0.18;
        for (let j = 0; j < 8; j++) {
          const g = (j / 8) * TAU + bl.x, el = rand(j, bl.x, 3) * 1.6 - 0.2, d = bl.r + 0.5 + k * 4;
          q.dot(bx + Math.cos(g) * Math.cos(el) * d, by + Math.sin(el) * d * 0.5 - k * 2, bz + Math.sin(g) * Math.cos(el) * d, j % 2 ? P[6] : P[5], 1.2 - k);
        }
        q.glow(bx, by, bz, 6, P[6], 0.4 * (1 - k));
      }
    }
    // toxic sweat: beads gather on the body, run, fall the whole way to the floor and hiss
    const per = D / 2, gather = 0.35;
    B.sweat.forEach(([sx, sy], i) => {
      const age = (((t - i * 0.37) % per) + per) % per, dz = 1 + (i % 3) * 0.6, [bx, by, bz] = onSprite(q, a.x + sx + 0.5 + off(sy), a.y + sy, dz);
      if (age < gather) {
        const k = age / gather, run = Math.round(k * 2);
        q.ball(bx, by + run, bz, 0.85, k > 0.5 ? P[6] : P[5]);
        return;
      }
      const [fx, , fz] = onSprite(q, a.x + sx + 0.5, 0, dz), y0 = (a.y + sy + 2) / q.cp, tf = Math.sqrt((2 * Math.max(1, -y0)) / G);
      // this cycle's drop, and the last one still hissing as the next gathers
      for (const f of [age - gather, age + per - gather]) {
        if (f < tf) {
          const y = y0 + 0.5 * G * f * f;
          q.line(fx, y - Math.min(3, G * f * 0.012), fz, fx, y, fz, P[4]);
          q.ball(fx, y, fz, 0.85, P[6]);
          continue;
        }
        const h = f - tf;
        if (h > 0.4) continue;
        const k = h / 0.4;
        q.ring(fx, 0, fz, 1.5 + 3 * k, 1.3, P[k < 0.4 ? 6 : 4], Math.min(1, 1.2 - k));
        for (let j = 0; j < 4; j++) {
          const g = (j / 4) * TAU + i * 1.3, d = 2 + 3 * k;
          q.dot(fx + Math.cos(g) * d, -1 - (j % 2) - 6 * k * (1 - k), fz + Math.sin(g) * d, P[6], 1 - k);
        }
        q.glow(fx, -1.5, fz, 5, P[5], 0.35 * (1 - k));
        vapour.push({ x: fx + Math.sin(k * 6 + i) * 1.5, y: -3 - k * 12, z: fz + Math.cos(k * 6 + i) * 1.5, r: 1.2 + 2 * k, a: 0.4 * (1 - k) });
      }
    });
    // toxic bubbles rising round him, and spores drifting off
    const bubbles = [];
    cycle(t, D, 9, o.seed + 7, (r) => r.range(1.1, 1.7), (age, life, r) => {
      const g = r.range(0, TAU), rad = r.range(9, 17), y0 = -r.range(4, 26), rr = r.range(0.8, 1.5), wob = Math.sin(age * 5 + r.next() * TAU) * 1.2;
      const x = Math.cos(g) * (rad + wob), z = Math.sin(g) * (rad + wob), y = y0 - age * r.range(10, 18);
      if (age < life - 0.1) bubbles.push([x, y, z, rr * (0.6 + 0.4 * Math.min(1, age * 3))]);
      else {
        const k = (age - (life - 0.1)) / 0.1;
        for (let j = 0; j < 6; j++) {
          const gg = (j / 6) * TAU, d = rr + 3 * k;
          q.dot(x + Math.cos(gg) * d, y + (j % 2 ? 1 : -1) * k, z + Math.sin(gg) * d, P[6], 1 - k);
        }
      }
    });
    for (const [x, y, z, rr] of q.sort(bubbles, (b) => b)) q.ball(x, y, z, rr, lit(ramp));
    cycle(t, D, 16, o.seed + 9, (r) => r.range(1.2, 2), (age, life, r) => {
      const g = r.range(0, TAU), d = r.range(6, 14) + age * r.range(4, 9), y = -r.range(6, 30) - age * r.range(5, 12);
      q.dot(Math.cos(g) * d + Math.sin(age * 3 + g) * 1.2, y, Math.sin(g) * d, r.next() < 0.5 ? P[6] : P[5], Math.min(1, age * 4, (life - age) * 3));
    });
    // a sick light on the body, surging with the tick, and on each bubble
    q.glow(0, lift(q, a.y + H * 0.45), 0, 26, P[4], surge);
    for (const [x, y, z, rr] of bubbles) q.glow(x, y, z, rr * 3, P[5], 0.2);
    for (const v of q.sort(vapour, (e) => [e.x, e.y, e.z])) q.disc(v.x, v.y, v.z, v.r, P[5], v.a);
  },
};
