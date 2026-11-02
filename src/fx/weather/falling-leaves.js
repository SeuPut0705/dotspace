// The falling leaf (a pendulum swing that speeds through the bottom of each arc, a tilt that follows it, a flip
// by squashing across, a rest on the ground, a litter of fallen leaves) is adapted from Sprite Fusion's
// open-source falling leaves (https://www.spritefusion.com/pixel-art-vfx/falling-leaves), MIT License,
// Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, rand, wrap, mix, fbm, space, TAU, hex } from "../../core/index.js";
import { clip, rows, trips, bakeFloor3, layFloor3, orient3, tumble3 } from "./_lib.js";

export const meta = {
  name: "Falling leaves",
  desc: "Autumn leaves swing down through the air, tilting and flipping to show their pale backs, ride a gust, land flat in the litter and fade.",
  tags: ["weather", "leaves", "autumn", "fall", "wind", "nature", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 10,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#4a1d0c", "#8a3a14", "#c8621e", "#f0982e", "#ffcf72", "#fff0c4"],
    reds: ["#40101a", "#7c1c22", "#b8302a", "#e85a3c", "#ff9a72", "#ffd8c4"],
    golds: ["#3e300c", "#7a5c14", "#b8901e", "#e8c23a", "#fff09a", "#fffbe0"],
    seed: 8,
  },
};

const D = 10, FLOOR = 1;
const gust = (t) => 16 * Math.sin((TAU * t) / D - 1.2) + 5 * Math.sin((TAU * 3 * t) / D);
// ∫|cos| from the start of a swing: speeds up through the bottom of each arc, so the drop does too
const Hc = (th) => {
  const k = Math.floor((th + Math.PI / 2) / Math.PI);
  return 2 * k + 1 + Math.sin(th - k * Math.PI);
};

// a leaf's outline in its own frame: u along it (-1 stem .. 1 tip), v across; 0 inside, > 1 outside
const SHAPES = [
  (u, v) => (Math.abs(u) >= 1 ? 9 : (v * v) / (0.36 * (1 - u * u) * (1.15 - 0.3 * u))), // a beech: a long oval, pointed tip
  (u, v) => {
    const r = Math.hypot(u, v * 1.1), a = Math.atan2(v, u);
    return r / (0.62 + 0.38 * Math.abs(Math.cos(2.5 * a)) ** 1.5); // a maple: five lobes
  },
  (u, v) => (Math.abs(u) >= 1 ? 9 : (v * v) / (0.16 * (1 - u * u))), // a willow: long and thin
];

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed, R3 = ramps(o), C = R3[0];
  // a faint dusk haze, warmer low down, that keeps the sky's stars out of the leaves' way
  const top = hex("#0e0a12"), low = mix(hex("#140c14"), C[0], 0.3);
  rows(p, meta, -170, 9, (y, R) => {
    const k = (y + 170) / 180, c = mix(top, low, k * k);
    R.c.fill(c);
    R.a.fill(0.32 + 0.1 * k);
    R.b.fill(1);
  });
  litter(q, S, R3);
  leaves(q, t, S, R3, false);
}

export function draw(p, t, o) {
  leaves(clip(p, meta), t, o.seed, ramps(o), true);
}

const ramps = (o) => [fit(o.palette, 6), fit(o.reds, 6), fit(o.golds, 6)];

function leaves(q, t, S, R3, front) {
  trips(t, D, 62, S * 19, 2, 3, (u, k, m, i) => {
    const j = wrap(k, m), R = (n) => rand(S * 19, i, j, n), near = R(1) < 0.35;
    if (near !== front) return;
    const dur = D / m, air = 0.72, tf = dur * air, a = Math.min(u * dur, tf), rest = u * dur - tf;
    const w = 1.7 + R(2) * 1.2, ph0 = R(3) * TAU, amp = (near ? 14 : 8) + R(4) * 10, x0 = -180 + R(5) * 340, y0 = -186;
    // the drop speed that lands it on the floor just as its time in the air runs out
    const path = (aa) => 0.45 * aa + (0.9 * (Hc(w * aa + ph0) - Hc(ph0))) / w, vy = (FLOOR - y0) / path(tf);
    const born = t - u * dur, xAt = (aa) => x0 + 7 * aa + Math.sin(w * aa + ph0) * amp + (gust(born + aa) - gust(born)) * (near ? 1 : 0.7);
    const size = (near ? 5.8 : 4.2) + R(6) * 1.6, shape = Math.floor(R(7) * 3), col = R3[Math.floor(R(8) * 3)];
    if (rest > 0) {
      // lying flat in the litter, fading
      const fade = 1 - rest / (dur - tf);
      leaf(q, xAt(tf), FLOOR - 1, size, (R(9) - 0.5) * 0.5, 0.42, shape, col, fade);
      return;
    }
    const x = xAt(a), y = y0 + vy * path(a), tilt = Math.cos(w * a + ph0) * 0.75 + (near ? 0 : 0.3);
    const flip = Math.cos(R(10) * TAU + a * (R(11) < 0.3 ? 5 : 1.2));
    leaf(q, x, y, size, tilt, flip, shape, col, 1);
    // a leaf turned full face to the light catches it for a moment
    if (flip > 0.86) {
      const k = (flip - 0.86) / 0.14, hx = x - Math.cos(tilt) * size * 0.3, hy = y - Math.sin(tilt) * size * 0.3 - 1;
      q.px(hx, hy, col[5]);
      q.glow(hx, hy, 5 + size * 0.5, col[4], 0.22 * k);
    }
  });
}

// draw a leaf: squash it across by `flip` (the sign says which face shows), tilt it, outline it, a midrib down
// the middle, the face lit on one side; the back face is paler and duller
function leaf(q, x, y, size, ang, flip, shape, col, a) {
  // like a card turning: never thinner than a third, and the back shows only past edge-on
  const back = flip < -0.25, fs = 0.35 + 0.65 * Math.abs(flip), c = Math.cos(ang), s = Math.sin(ang);
  const L = size, Wd = size * 0.9, ext = L + 1.5, shapeFn = SHAPES[shape];
  const face = back ? [mix(col[1], hex("#9c8a78"), 0.2), mix(col[2], hex("#c8b49c"), 0.22), mix(col[3], hex("#e0d0b8"), 0.22)] : [col[2], col[3], col[4]];
  const rim = col[0], vein = back ? mix(col[2], hex("#e8dcc8"), 0.5) : col[1];
  q.shade(x - ext, y - ext, x + ext, y + ext, (px, py, out) => {
    const dx = px - x, dy = py - y, lu = (dx * c + dy * s) / L, lv = (-dx * s + dy * c) / (Wd * fs);
    const d = shapeFn(lu, lv);
    if (lu < -1.25 || lu > 1.1) return;
    // the stem pokes out past the base
    if (lu < -0.92 && Math.abs(lv * Wd * fs) < 0.5) return void ((out.c = rim), (out.a = a));
    if (d > 1.32) return;
    out.a = a;
    if (d > 1) out.c = rim;
    else if (Math.abs(lv * Wd * fs) < 0.45 && lu > -0.9 && lu < 0.75) out.c = vein;
    else out.c = lv < -0.15 ? face[2] : lv < 0.35 ? face[1] : face[0];
  });
}

// fallen leaves lying in a band along the floor, overlapping. They never move, so they're shaded once per seed
// and palette and the pixels replayed
const LITTER = new Map();
function litter(q, S, R3) {
  const key = S + R3.flat().join();
  let px = LITTER.get(key);
  if (!px) {
    px = [];
    const rec = {
      shade(x0, y0, x1, y1, fn) {
        const o = { c: 0, a: 1 };
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
          for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
            o.c = 0;
            o.a = 1;
            const c = fn(x + 0.5, y + 0.5, o) || o.c;
            if (c) px.push(x + 0.5, y + 0.5, c, o.a);
          }
      },
    };
    for (let i = 0; i < 64; i++) {
      const x = -164 + rand(S, i, 91) * 328, y = FLOOR - 2 + Math.floor(rand(S, i, 92) * 4) * 2, col = R3[Math.floor(rand(S, i, 93) * 3)];
      leaf(rec, x, y, 3.6 + rand(S, i, 94) * 1.8, (rand(S, i, 95) - 0.5) * 0.7, 0.45 + rand(S, i, 96) * 0.25, Math.floor(rand(S, i, 97) * 3), col.map((c) => mix(c, col[0], 0.12)), 1);
    }
    LITTER.set(key, px);
  }
  for (let i = 0; i < px.length; i += 4) q.dot(px[i], px[i + 1], px[i + 2], px[i + 3]);
}

// ---- 3D: leaves swinging down through a cylinder of air on a pendulum, each one a real flat leaf in space. It
// swings in its own vertical plane at its own heading, tilts with the swing, flips about its long axis and shows
// its pale back when turned away; one turned square to the light flashes. They land flat in a litter on the floor.
const VR = 96, VH = 112, LIGHT = [-0.45, -0.6, 0.66];
const edgeFade = (x, z) => 1 - smooth(VR * 0.92, VR * 1.1, Math.hypot(x, z));

// the paler, duller back of a leaf: [face tones, midrib], made once per ramp
const BACKS = new WeakMap();
function backOf(col) {
  let b = BACKS.get(col);
  if (!b) BACKS.set(col, (b = { face: [mix(col[1], hex("#9c8a78"), 0.2), mix(col[2], hex("#c8b49c"), 0.22), mix(col[3], hex("#e0d0b8"), 0.22)], vein: mix(col[2], hex("#e8dcc8"), 0.5) }));
  return b;
}

// the colour of a leaf at (lu, lv) in its own axes (world px): rim, midrib, face in three tones by how square it
// faces the light (lam, 0..1) and a bit of relief across it; the back is paler and duller. 0 outside the leaf.
function leafCol(shape, lu, lv, L, Wd, col, back, lam) {
  const u = lu / L, v = lv / Wd;
  if (u < -1.25 || u > 1.1) return 0;
  const rim = col[0], av = Math.abs(lv);
  // the stem pokes out past the base
  if (u < -0.92 && av < 0.5) return rim;
  const d = SHAPES[shape](u, v);
  if (d > 1.32) return 0;
  if (d > 1) return rim;
  const B = back ? backOf(col) : null;
  if (av < 0.55 && u > -0.9 && u < 0.75) return back ? B.vein : col[1];
  const face = back ? B.face : col;
  return face[clamp(Math.round(1 + (lam - 0.62) * 3 + (v < -0.15 ? 0.6 : v < 0.35 ? 0 : -0.6)), 0, 2) + (back ? 0 : 2)];
}

// fallen leaves lying on the floor, overlapping in drifts; they never move, so they're baked once
function litterFloor(S, R3) {
  return bakeFloor3("leaves3" + S + R3.flat().join(), VR, (set) => {
    let n = 0;
    for (let i = 0; n < 190 && i < 2400; i++) {
      const r = VR * 0.98 * Math.sqrt(rand(S, i, 91)), g = rand(S, i, 92) * TAU, x = Math.cos(g) * r, z = Math.sin(g) * r;
      // in drifts: more where the noise is high
      if (rand(S, i, 93) > 0.18 + 1.1 * Math.max(0, 0.5 + fbm(x / 34, z / 34, S + 11, 2)) ** 2) continue;
      n++;
      const col = R3[Math.floor(rand(S, i, 94) * 3)].map((c) => mix(c, R3[0][0], 0.3)), shape = Math.floor(rand(S, i, 95) * 3), size = 4.4 + rand(S, i, 96) * 2.6;
      const hd = rand(S, i, 97) * TAU, c = Math.cos(hd), s = Math.sin(hd), back = rand(S, i, 98) < 0.2, lam = 0.4 + rand(S, i, 99) * 0.4, ext = Math.ceil(size * 1.3) + 1;
      for (let dz = -ext; dz <= ext; dz++)
        for (let dx = -ext; dx <= ext; dx++) {
          const lu = dx * c + dz * s, lv = -dx * s + dz * c, k = leafCol(shape, lu, lv, size, size * 0.9, col, back, lam);
          if (k) set(x + dx, z + dz, k);
        }
    }
  });
}

function leaves3(q, t, S, R3) {
  trips(t, D, 66, S * 19, 2, 3, (u, k, m, i) => {
    const j = wrap(k, m), R = (n) => rand(S * 19, i, j, n), near = R(1) < 0.35;
    const dur = D / m, tf = dur * 0.72, a = Math.min(u * dur, tf), rest = u * dur - tf, born = t - u * dur;
    const w = 1.7 + R(2) * 1.2, ph0 = R(3) * TAU, amp = (near ? 14 : 8) + R(4) * 10, y0 = -VH, gk = near ? 1 : 0.7;
    const psi = R(13) * TAU, r0 = VR * 0.96 * Math.sqrt(R(5)), g0 = R(14) * TAU, x0 = Math.cos(g0) * r0, z0 = Math.sin(g0) * r0;
    // the drop speed that lands it on the floor just as its time in the air runs out
    const path = (aa) => 0.45 * aa + (0.9 * (Hc(w * aa + ph0) - Hc(ph0))) / w, vy = (-0.8 - y0) / path(tf);
    const at = (aa) => {
      const th = w * aa + ph0, sw = Math.sin(th) * amp, sd = 0.35 * amp * Math.cos(th);
      return [
        x0 + 7 * (aa - tf / 2) + (gust(born + aa) - gust(born + tf / 2)) * gk + sw * Math.cos(psi) - sd * Math.sin(psi),
        z0 + 0.4 * (gust(born + aa + D / 4) - gust(born + tf / 2 + D / 4)) * gk + sw * Math.sin(psi) + sd * Math.cos(psi),
      ];
    };
    const size = ((near ? 5.8 : 4.2) + R(6) * 1.6) * 1.3, shape = Math.floor(R(7) * 3), col = R3[Math.floor(R(8) * 3)], head = (aa) => R(9) * TAU + aa * (R(12) - 0.5) * 1.6;
    const [x, z] = at(a), y = y0 + vy * path(a), edge = edgeFade(x, z), top = smooth(0, 0.06, a / tf);
    let al = edge * top, o;
    const flipSpin = R(11) < 0.3 ? 5 : 1.2;
    if (rest > 0) {
      // lying flat in the litter, fading
      al = edgeFade(x, z) * (1 - rest / (dur - tf));
      o = orient3(head(tf), 0, (R(15) - 0.5) * 0.3, psi);
    } else {
      o = orient3(head(a), R(10) * TAU + a * flipSpin, Math.cos(w * a + ph0) * 0.75, psi);
      // settling flat as it lands
      const land = smooth(0.86, 1, a / tf);
      if (land > 0) {
        const f = orient3(head(a), 0, (R(15) - 0.5) * 0.3, psi);
        o = { N: o.N.map((v, n) => v + (f.N[n] - v) * land), U: o.U.map((v, n) => v + (f.U[n] - v) * land) };
      }
    }
    if (al < 0.06) return;
    const yy = rest > 0 ? -0.8 : y, Nl = Math.hypot(...o.N), Nv = q.view(o.N[0] / Nl, o.N[1] / Nl, o.N[2] / Nl);
    const sgn = Nv[2] > 0 ? 1 : -1, lam = clamp((Nv[0] * LIGHT[0] + Nv[1] * LIGHT[1] + Nv[2] * LIGHT[2]) * sgn);
    const L = size, Wd = size * 0.9, back = Nv[2] < 0;
    const face = tumble3(q, x, yy, z, o.N, o.U, L * 1.35, (lu, lv, out) => {
      const c = leafCol(shape, lu, lv, L, Wd, col, back, lam);
      if (!c) return;
      out.c = c;
      out.a = al;
    }, { len: size * 0.95, c: back ? col[1] : col[2], a: al });
    // a leaf turned full face to the light catches it for a moment
    if (rest <= 0 && face > 0 && lam > 0.88) {
      const kk = (lam - 0.88) / 0.12;
      q.px(x, y - 1, z, col[5]);
      q.glow(x, y - 1, z, 5 + size * 0.5, col[4], 0.22 * kk * al);
    }
  });
}

export const three = {
  meta: { size: [248, 194], origin: [124, 150], bg: "ground", camera: { pitch: 0.42 } },
  draw(p, t, o) {
    const q = space(p, o), S = o.seed, R3 = ramps(o);
    layFloor3(q, litterFloor(S, R3), -0.2, 0.72);
    leaves3(q, t, S, R3);
  },
};
