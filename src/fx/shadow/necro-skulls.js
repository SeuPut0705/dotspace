import { cycle, fit, clamp, smooth, tileNoise, space, TAU, WHITE, mix } from "../../core/index.js";
import { halo } from "./_lib.js";

export const meta = {
  name: "Necro skulls",
  desc: "Spectral skulls circle a cold green flame on a tilted orbit, passing behind and before it, eyes lit, trailing curls of ghost smoke.",
  tags: ["shadow", "necromancy", "skull", "orbit", "ghost", "spectral", "magic", "loop"],
  size: [136, 116],
  origin: [68, 108],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#040e10", "#0a2228", "#0f3d44", "#16615f", "#23907f", "#45c4a0", "#9af0c8", "#e8fff4"],
    bone: ["#0c1a1c", "#2c4a4a", "#5c847c", "#a6cdb8", "#e4fff0"],
    seed: 6,
  },
};

// the flame's base and height; the orbit (centre, radii, tilt); six skulls, one turn a loop
const CY = -52, FB = -32, FH = 34, RX = 42, RY = 11, TILT = -0.12, D = 3, N = 5;
const SKULL = [
  "...kkkkk...",
  ".kkhhhllkk.",
  "khhhhlllmmk",
  "khhllllllmk",
  "kleeeleeemk",
  "kleeeleeedk",
  "kmleelleedk",
  ".kmllnllmk.",
  ".kmmlnlmdk.",
  "..kmmmmmk..",
  "..ktgtgtk..",
  "...kkkkk...",
];

// a skull's place at t: round the tilted orbit, bobbing; z > 0 is in front of the flame
function skullAt(i, t) {
  const a = (TAU * t) / D + (i * TAU) / N, ex = Math.cos(a) * RX, ey = Math.sin(a) * RY;
  const bob = Math.sin((TAU * 2 * t) / D + i * 1.7) * 2;
  return { x: ex * Math.cos(TILT) - ey * Math.sin(TILT), y: CY + ex * Math.sin(TILT) + ey * Math.cos(TILT) + bob, z: Math.sin(a), a };
}

// ghost smoke curling off behind each skull along its orbit: puffs that swell, rise and thin with age
function tail(p, C, i, t) {
  for (let k = 8; k >= 1; k--) {
    const tt = t - k * 0.05, s = skullAt(i, tt), age = k / 8;
    const r = 2 + age * 3.6, a = (1 - age) * 0.5 * (0.6 + 0.4 * (s.z + 1) / 2);
    p.disc(s.x, s.y - age * 7 + 2, r, age < 0.4 ? C[5] : age < 0.7 ? C[4] : C[3], a);
  }
}

function drawSkull(p, C, K, s, t, i) {
  const front = s.z >= 0, depth = 0.55 + 0.45 * (s.z + 1) / 2;
  const PAL = front
    ? { k: K[0], d: K[1], m: K[2], l: K[3], h: K[4], e: C[0], n: C[0], t: K[3], g: K[0] }
    : { k: K[0], d: K[0], m: K[1], l: K[2], h: K[3], e: C[0], n: C[0], t: K[2], g: K[0] };
  const x0 = Math.round(s.x) - 5, y0 = Math.round(s.y) - 6;
  p.sprite(SKULL, PAL, x0, y0);
  // eyes: cold points of light in the dark, flaring as the skull swings toward us
  const k = (0.5 + 0.5 * Math.sin((TAU * 3 * t) / D + i * 2.1)) * 0.5 + 0.5;
  for (const ex of [3, 7]) {
    p.px(x0 + ex + 0.5, y0 + 5.5, front ? (k > 0.75 ? WHITE : C[7]) : C[6]);
    if (front) p.px(x0 + ex + 0.5, y0 + 4.5, C[5]);
    p.glow(x0 + ex + 1, y0 + 6, 6, C[5], 0.45 * depth * k);
  }
  p.glow(s.x, s.y, 11, C[4], 0.18 * depth);
}

// the cold flame: a body that swells off its base and tapers into licking tongues, white only low in its heart,
// cooling outward and upward through the ghost greens, scrolling up (the noise wraps once a loop)
// fb: where its base sits, sc: a smaller or bigger copy, ph: shifts the noise so copies differ, glow: false leaves the
// light to the caller (the 3D variant lights the world, not a billboard)
function flame(p, C, t, fb = FB, sc = 1, ph = 0, glow = true) {
  const W = 10 * sc, FHs = FH * sc, scroll = t / D;
  p.shade(-W - 4, fb - FHs - 4, W + 4, fb + 2, (x, y, out) => {
    const u = (fb - y) / FHs;
    if (u < -0.04 || u >= 1) return;
    const n1 = tileNoise(x * 0.3 + ph, y * 0.2 + scroll * 8 + ph, 0, 8, 3), n2 = tileNoise(x * 0.6 + ph, y * 0.45 + scroll * 16 + ph, 0, 16, 5);
    const prof = u < 0.22 ? 0.35 + 0.65 * Math.sqrt(Math.max(0, u) / 0.22) : Math.pow(1 - (u - 0.22) / 0.78, 0.85);
    const w = W * prof * (1 + 0.3 * n1) + n2 * 2.2 * u, sway = n1 * 3 * u * u, d = Math.abs(x - sway) / Math.max(0.6, w);
    if (d > 1) return;
    const heat = Math.pow(1 - d, 0.7) * Math.pow(Math.max(0, 1 - u), 0.55) + n2 * 0.12;
    if (((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.16 * heat;
    return heat > 0.82 ? WHITE : heat > 0.66 ? C[7] : heat > 0.46 ? C[6] : heat > 0.27 ? C[5] : heat > 0.12 ? C[4] : C[3];
  });
  if (!glow) return;
  p.glow(0, fb - FHs * 0.35, 40, C[5], 0.45);
  p.glow(0, fb - 5, 12, C[7], 0.25);
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), K = fit(o.bone, 5);
  p.glow(0, -1, 40, C[4], 0.2);
  // the far half of the orbit: tails and skulls behind the flame, back to front
  const order = Array.from({ length: N }, (_, i) => [i, skullAt(i, t)]).filter(([, s]) => s.z < 0).sort((a, b) => a[1].z - b[1].z);
  for (const [i] of order) tail(p, C, i, t);
  for (const [i, s] of order) drawSkull(p, C, K, s, t, i);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), K = fit(o.bone, 5), S = o.seed;
  // motes and cold sparks rising off the flame
  cycle(t, D, 18, S, (r) => r.range(0.8, 1.4), (age, L, r) => {
    const x0 = r.range(-6, 6), u = age / L, x = x0 + Math.sin(u * 5 + r.range(0, 6)) * 3 * u, y = FB - 6 - u * r.range(36, 56);
    p.dot(x, y, u < 0.5 ? C[7] : C[6], u < 0.7 ? 1 : (1 - u) * 3.3);
    p.glow(x, y, 3, C[6], 0.3 * (1 - u));
  });
  flame(p, C, t);
  // the near half of the orbit, back to front
  const order = Array.from({ length: N }, (_, i) => [i, skullAt(i, t)]).filter(([, s]) => s.z >= 0).sort((a, b) => a[1].z - b[1].z);
  for (const [i] of order) tail(p, C, i, t);
  for (const [i, s] of order) drawSkull(p, C, K, s, t, i);
  halo(p, 0, CY, 0, 46, C[4], 0.12);
}

// ---- 3D: the orbit is a real circle round the flame, tilted and rolled; the skulls are upright billboards on it,
// the flame a core with three tongues leaning round it so it has a body when the camera turns, the ghost smoke a
// trail of translucent puffs along the circle, sorted far to near. Which skulls sit in front of the flame is a
// matter of the camera, so passing behind the flame happens through depth.
const R3 = 40, T3 = 0.05, ROLL = -0.2;
// a point of the orbit at angle a (the circle's plane tilts towards the viewer by T3 and rolls by ROLL), bobbing
const at3 = (a, bob = 0) => {
  const ex = Math.cos(a) * R3, ey = Math.sin(a) * R3 * Math.sin(T3), ez = Math.sin(a) * R3 * Math.cos(T3);
  return [ex * Math.cos(ROLL) - ey * Math.sin(ROLL), CY + ex * Math.sin(ROLL) + ey * Math.cos(ROLL) + bob, ez];
};
const lead3 = (i, t) => (TAU * t) / D + (i * TAU) / N;
const skull3 = (i, t) => at3(lead3(i, t), Math.sin((TAU * 2 * t) / D + i * 1.7) * 2);

export const three = {
  meta: { size: [144, 124], origin: [72, 108], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), K = fit(o.bone, 5), S = o.seed, q = space(p, o), zc = q.depth(0, CY, 0);
    // how far towards the camera from the flame each skull is: bright face in front of it, dark behind it
    const face = (pos) => clamp((zc - q.depth(...pos)) / R3, -1, 1);
    // the flame: a core and three tongues leaning round it, each its own noise
    for (let j = 0; j < 3; j++) {
      const a = 0.6 + (j * TAU) / 3;
      q.at(Math.cos(a) * 5, FB, Math.sin(a) * 5, (pp) => flame(pp, C, t, 0, 0.68, 5 + j * 7, false));
    }
    q.at(0, FB, 0, (pp) => flame(pp, C, t, 0, 1, 0, false));
    // the skulls, at their places on the circle
    const skulls = Array.from({ length: N }, (_, i) => ({ i, pos: skull3(i, t) }));
    for (const s of skulls) {
      const f = face(s.pos);
      s.f = f;
      q.at(...s.pos, (pp) => drawSkull(pp, C, K, { x: 0, y: 0, z: f }, t, s.i));
    }
    // motes and cold sparks rising off the flame, drifting out every way
    cycle(t, D, 26, S, (r) => r.range(0.8, 1.4), (age, L, r) => {
      const g = r.range(0, TAU), rad = r.range(0, 6) + (age / L) * r.range(2, 8), u = age / L, w = Math.sin(u * 5 + r.range(0, 6)) * 3 * u;
      const x = Math.cos(g) * rad + w, z = Math.sin(g) * rad, y = FB - 6 - u * r.range(36, 56);
      q.dot(x, y, z, u < 0.5 ? C[7] : C[6], u < 0.7 ? 1 : (1 - u) * 3.3);
      q.glow(x, y, z, 3, C[6], 0.3 * (1 - u));
    });
    // the orbit itself: a thin line round the circle, brighter where a skull has just been
    const behind = (g) => {
      let near = 1;
      for (let i = 0; i < N; i++) near = Math.min(near, ((((lead3(i, t) - g) % TAU) + TAU) % TAU) / TAU);
      return near;
    };
    for (let j = 0; j < 96; j++) {
      const g0 = (j / 96) * TAU, g1 = ((j + 1) / 96) * TAU, b = behind(g0);
      q.line(...at3(g0), ...at3(g1), b < 0.2 ? C[5] : C[3], b < 0.35 ? 0.7 - b : 0.2);
    }
    // light: the flame's, a pool of it on the floor, a wash over the whole orbit
    q.glow(0, -1, 0, 40, C[4], 0.2);
    q.glow(0, FB - FH * 0.35, 0, 40, C[5], 0.45);
    q.glow(0, FB - 5, 0, 12, C[7], 0.25);
    q.glow(0, CY, 0, 46, C[4], 0.12);
    q.plane(0, 0, 0, null, 56, (u, v, out) => {
      const f = 1 - Math.hypot(u, v) / 56;
      if (f <= 0) return;
      out.l = C[4];
      out.k = f * f * 0.22;
    });
    // ghost smoke curling off behind each skull along its orbit, far to near
    const puffs = [];
    for (const s of skulls)
      for (let k = 8; k >= 1; k--) {
        const tt = t - k * 0.05, age = k / 8, [x, y, z] = skull3(s.i, tt);
        puffs.push({ x, y: y - age * 7 + 2, z, r: 2 + age * 3.6, age, a: (1 - age) * 0.5 * (0.6 + 0.4 * (face([x, y, z]) + 1) / 2) });
      }
    for (const f of q.sort(puffs, (e) => [e.x, e.y, e.z])) q.disc(f.x, f.y, f.z, f.r, f.age < 0.4 ? C[5] : f.age < 0.7 ? C[4] : C[3], f.a);
  },
};
