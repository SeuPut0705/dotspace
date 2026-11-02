// The shaded, outlined icons and the twinkles are
// adapted from Sprite Fusion's open-source heal (https://www.spritefusion.com/pixel-art-vfx/heal),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { cycle, fit, hex, mix, sparkle, flare, rand, space, clamp, TAU } from "../../core/index.js";
import { icon, bitmap, shaped, starShape, lift } from "./_lib.js";

export const meta = {
  name: "Stunned",
  desc: "Seeing stars: three spinning stars and two little birds circle the head on a tilted ring, ducking behind it and sweeping round in front, trailing glitter.",
  tags: ["status", "stun", "dizzy", "daze", "stars", "birds", "debuff", "loop"],
  size: [60, 64],
  origin: [30, 56],
  duration: 2,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#3a1e0c", "#8a4a12", "#d88a1c", "#f5c030", "#ffe36e", "#fff6c8", "#ffffff"],
    birds: ["#1a1422", "#6a7fae", "#b8c8e8", "#f4f8ff"],
    beak: "#ffae35",
    seed: 2,
  },
};

const DAZE = { turn: 1, fx: -7, fy: -15, bx: 8, by: -15, ffx: -3, fbx: 4 };
export const act = {
  onBody: true,
  poses: [
    [0, { ...DAZE, x: -1, lean: -3, hx: -1 }],
    [0.5, { ...DAZE, x: 0, lean: 0, crouch: 2, hy: 1, ffx: -2 }],
    [1, { ...DAZE, x: 1, lean: 3, hx: 1 }],
    [1.5, { ...DAZE, x: 0, lean: 0, crouch: 2, hy: 1, fbx: 3 }],
    [2, { ...DAZE, x: -1, lean: -3, hx: -1 }],
  ],
};

const D = meta.duration, TURNS = 2, N = 5;
const STAR7 = ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", ".#...#."];
// a little bird facing right: body, head, eye, beak, tail, a wing that beats
const BIRD = [true, false].map((up) => (dx, dy) => {
  const x = dx + 0.5, y = dy + 0.5;
  if (dx === 3 && dy === -2) return "e";
  if ((dx === 5 || dx === 4) && dy === -1) return dx === 5 ? "b" : "#";
  const wing = up ? [[-1, -1], [-1, -2], [-2, -2], [-2, -3], [-3, -3], [-3, -4]] : [[-1, 1], [-1, 2], [-2, 2], [-2, 3], [0, 1]];
  if (wing.some(([a, b]) => a === dx && b === dy)) return "w";
  if ((x / 3.3) ** 2 + ((y - 0.6) / 1.9) ** 2 <= 1 || (x - 2.8) ** 2 + (y + 1.2) ** 2 <= 1.7 ** 2) return "#";
  if ((dx === -4 && (dy === -1 || dy === 0)) || (dx === -5 && dy === -1)) return "#";
  return "";
});
const STAR = shaped.bind(null, starShape(0.44));

// the ring round the head: stars at 0, 2, 4, birds between
function ring(t, a) {
  const cy = a.y + 2, rx = a.w * 0.62, ry = 4.5;
  return Array.from({ length: N }, (_, i) => {
    const th = TAU * ((TURNS * t) / D + i / N), s = Math.sin(th);
    return { i, th, x: Math.cos(th) * rx, y: cy + s * ry, near: s >= 0, depth: 0.5 + 0.5 * s, bird: i % 2 === 1, rx, ry, cy };
  });
}

function draw1(p, t, o, layer) {
  const C = fit(o.palette, 7), Bd = fit(o.birds, 4), a = o.actor, far = layer === "back";
  const dim = (c) => (far ? mix(c, Bd[0], 0.3) : c);
  for (const it of ring(t, a)) {
    if (it.near === far) continue;
    // glitter left along the ring behind each star
    if (!it.bird)
      for (let k = 1; k <= 12; k++) {
        const th = it.th - k * 0.085, x = Math.cos(th) * it.rx, y = it.cy - 1 + Math.sin(th) * it.ry;
        if (Math.sin(th) >= 0 === far || rand(it.i, k, Math.floor(((t / D) * TURNS + k * 0.37) * 9)) < 0.25) continue;
        p.dot(x, y, dim(k < 4 ? C[6] : k < 8 ? C[5] : C[4]), 1.1 - k / 13);
        if (k < 6) p.light(x, y, C[4], 0.3 * (1 - k / 6));
      }
    if (it.bird) {
      const up = Math.floor(t * 8 + it.i * 0.5) % 2 === 0, bob = Math.sin((t / D) * TAU * 4 + it.i) * 0.7, flip = it.near;
      const f = BIRD[up ? 0 : 1], ins = flip ? (dx, dy) => f(-dx, dy) : f;
      icon(p, it.x, it.y - 3 + bob, 7, ins, [Bd[0], dim(Bd[1]), dim(Bd[2]), dim(Bd[3])], 1, { e: Bd[0], b: dim(hex(o.beak)), w: dim(Bd[1]) });
    } else {
      const spin = (t / D) * TAU * 3 + it.i, R = [C[0], dim(C[3]), dim(C[4]), dim(C[5])];
      if (it.depth > 0.55) icon(p, it.x, it.y - 1, 7, STAR(4 + 0.8 * it.depth, spin), R);
      else icon(p, it.x, it.y - 1, 5, bitmap(STAR7), R);
      p.px(it.x, it.y - 1, far ? C[5] : C[6]);
      p.glow(it.x, it.y - 1, 11, C[4], 0.24 + 0.3 * it.depth);
      p.glow(it.x, it.y - 1, 4, C[6], 0.3 * it.depth);
      // a flare as it sweeps past the front, nearest the eye
      const fr = Math.exp(-((Math.atan2(Math.sin(it.th - Math.PI / 2), Math.cos(it.th - Math.PI / 2)) / 0.32) ** 2));
      if (!far && fr > 0.08) flare(p, it.x, it.y - 1, 9 * fr, fr, [C[3], C[4], C[5], C[6]]);
    }
  }
}

export function drawBack(p, t, o) {
  draw1(p, t, o, "back");
}

export function draw(p, t, o) {
  const C = fit(o.palette, 7), a = o.actor;
  draw1(p, t, o, "front");
  // little twinkles popping round the ring
  cycle(t, D, 14, o.seed + 3, (r) => r.range(0.25, 0.5), (age, life, r) => {
    const th = r.range(0, TAU), u = age / life, x = Math.cos(th) * a.w * r.range(0.45, 0.95), y = a.y + 1 + Math.sin(th) * 7 - r.range(0, 9);
    const arm = Math.round(r.range(1, 2.6) * Math.sin(Math.PI * u));
    if (arm < 1) p.dot(x, y, C[6], Math.sin(Math.PI * u) * 1.4);
    sparkle(p, x, y, arm, C[5], C[4], 0.35 * Math.sin(Math.PI * u));
  });
  p.glow(0, a.y + 1, 26, C[4], 0.13);
}

// 3D: the same ring round the head, now a true circle in the air. Stars (the same from every side) and birds
// (turned to fly the way they go) are upright billboards on it; what is behind the head goes behind it, what is in
// front comes in front, whichever way the camera looks. Glitter hangs along the circle behind each star.
export const three = {
  meta: { size: [76, 70], origin: [38, 62], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 7), Bd = fit(o.birds, 4), a = o.actor, cy = lift(q, a.y + 2), R = a.w * 0.62;
    const at = (th, r = R, y = cy) => [Math.cos(th) * r, y, Math.sin(th) * r];
    const items = Array.from({ length: N }, (_, i) => ({ i, th: TAU * ((TURNS * t) / D + i / N), bird: i % 2 === 1 }));
    // the path itself, a hair of light so the circle reads from above
    q.ring(0, cy - 1, 0, R, 1, C[4], 0.16);
    // glitter along the circle behind each star
    for (const it of items) {
      if (it.bird) continue;
      for (let k = 1; k <= 12; k++) {
        const th = it.th - k * 0.085, [x, y, z] = at(th, R, cy - 1);
        if (rand(it.i, k, Math.floor(((t / D) * TURNS + k * 0.37) * 9)) < 0.25) continue;
        const far = q.depth(x, y, z) > 0, c = k < 4 ? C[6] : k < 8 ? C[5] : C[4];
        q.dot(x, y, z, far ? mix(c, Bd[0], 0.3) : c, 1.1 - k / 13);
      }
    }
    for (const it of items) {
      const [x, y, z] = at(it.th), far = q.depth(x, y, z) > 0, dim = (c) => (far ? mix(c, Bd[0], 0.3) : c);
      const front = clamp(-q.depth(x, y, z) / R);
      if (it.bird) {
        const up = Math.floor(t * 8 + it.i * 0.5) % 2 === 0, bob = Math.sin((t / D) * TAU * 4 + it.i) * 0.7;
        // it flies along the circle: turn it to face whichever way that runs across the screen
        const flip = q.view(-Math.sin(it.th), 0, Math.cos(it.th))[0] < 0, f = BIRD[up ? 0 : 1], ins = flip ? (dx, dy) => f(-dx, dy) : f;
        q.at(x, y, z, (pp) => icon(pp, 0, -3 + bob, 7, ins, [Bd[0], dim(Bd[1]), dim(Bd[2]), dim(Bd[3])], 1, { e: Bd[0], b: dim(hex(o.beak)), w: dim(Bd[1]) }));
      } else {
        const spin = (t / D) * TAU * 3 + it.i, Rm = [C[0], dim(C[3]), dim(C[4]), dim(C[5])], depth = 0.5 + 0.5 * front;
        q.at(x, y, z, (pp) => {
          if (depth > 0.55) icon(pp, 0, -1, 7, STAR(4 + 0.8 * depth, spin), Rm);
          else icon(pp, 0, -1, 5, bitmap(STAR7), Rm);
          pp.px(0, -1, far ? C[5] : C[6]);
        });
      }
    }
    // light after the solids, so a star behind the head doesn't light it
    for (const it of items) {
      if (it.bird) continue;
      const [x, y, z] = at(it.th), depth = 0.5 + 0.5 * clamp(-q.depth(x, y, z) / R);
      q.glow(x, y - 1, z, 11, C[4], 0.24 + 0.3 * depth);
      q.glow(x, y - 1, z, 4, C[6], 0.3 * depth);
      // a flare as it sweeps past the front, nearest the eye
      const fr = Math.exp(-((Math.acos(clamp(-q.depth(x, y, z) / R, -1, 1)) / 0.32) ** 2));
      if (fr > 0.08 && q.depth(x, y, z) < 0) q.at(x, y, z + 3, (pp) => flare(pp, 0, -1, 9 * fr, fr, [C[3], C[4], C[5], C[6]]));
    }
    // little twinkles popping round the circle
    cycle(t, D, 14, o.seed + 3, (r) => r.range(0.25, 0.5), (age, life, r) => {
      const th = r.range(0, TAU), u = age / life, d = a.w * r.range(0.45, 0.95), s = Math.sin(Math.PI * u), arm = Math.round(r.range(1, 2.6) * s);
      const [x, y, z] = at(th, d, lift(q, a.y + 1 - r.range(0, 9)));
      if (arm < 1) q.dot(x, y, z, C[6], s * 1.4);
      else q.at(x, y, z, (pp) => sparkle(pp, 0, 0, arm, C[5], C[4], 0.35 * s));
    });
    q.glow(0, cy, 0, 26, C[4], 0.13);
  },
};
