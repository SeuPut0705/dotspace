import { fit, sparkle, cycle, space, clamp, smooth, TAU, WHITE } from "../../core/index.js";
import { GOLD, oval, shapeOf, shell, nearer } from "./_lib.js";

export const meta = {
  name: "Divine shield",
  desc: "A bubble of gold light round the character: a bright rim and a thin gold film, meridians turning like a slow globe, a sheen sweeping across and sparkles winking on it.",
  tags: ["holy", "shield", "bubble", "barrier", "buff", "character", "loop"],
  size: [88, 84],
  origin: [44, 68],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: GOLD, radius: 29, seed: 8 },
};

const BRACE = { turn: 0.7, crouch: 3, lean: 1, fx: 5, fy: -33, bx: 10, by: -20, ffx: 4, fbx: -2 };
export const act = {
  onBody: true,
  poses: [
    [0, BRACE],
    [0.6, { ...BRACE, crouch: 4 }],
    [1.2, { ...BRACE, fy: -35, crouch: 3 }],
    [1.8, { ...BRACE, crouch: 4 }],
    [2.4, BRACE],
  ],
};

const CY = -22, TILT = 0.34, N = 4, FLOOR_SY = 0.26;

// a point of the sphere (lat, lon) seen from a little above: screen x, y and depth z (> 0 faces us)
function onSphere(r, lat, lon) {
  const X = r * Math.cos(lat) * Math.sin(lon), Y = r * Math.sin(lat), Z = r * Math.cos(lat) * Math.cos(lon);
  return [X, CY - (Y * Math.cos(TILT) - Z * Math.sin(TILT)), Y * Math.sin(TILT) + Z * Math.cos(TILT)];
}

// the sheen: a diagonal band crossing the bubble once a loop, then a rest
const sheen = (t, T) => -1.7 + 3.4 * clamp(((t / T) % 1) / 0.55);

function lattice(p, t, o, back) {
  const C = fit(o.palette, 8), r = o.radius, T = meta.duration, phi = (t / T) * (Math.PI / N), sw = sheen(t, T), seen = new Map();
  // gather the lines' pixels first, so each is drawn once
  const dot = (x, y, z) => {
    if (z < 0 !== back) return;
    const key = Math.floor(x) * 1000 + Math.floor(y), f = Math.abs(z) / r, q = (x - (y - CY)) / (r * 1.414), hot = Math.abs(q - sw) < 0.12 ? 1 : 0, v = seen.get(key);
    if (!v || f < v[2]) seen.set(key, [x, y, f, hot || (v ? v[3] : 0)]);
  };
  // meridians, turning
  for (let k = 0; k < 2 * N; k++) {
    const lon = phi + (k * Math.PI) / N;
    for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += 0.7 / r) dot(...onSphere(r, lat, lon));
  }
  // the equator
  for (let lon = 0; lon < TAU; lon += 0.7 / r) dot(...onSphere(r, 0, lon));
  // behind: faint and broken. In front: bright where the surface turns away, a translucent wash of gold
  // where it faces us, so the character still shows through
  for (const [x, y, f, hot] of seen.values()) {
    if (back) p.blend(x, y, C[4], 0.32);
    else if (hot) p.px(x, y, WHITE);
    else if (f < 0.4) p.px(x, y, C[6]);
    else p.blend(x, y, f < 0.7 ? C[6] : C[5], f < 0.7 ? 0.8 : 0.55);
  }
}

function film(p, t, o, back) {
  const C = fit(o.palette, 8), r = o.radius, sw = sheen(t, meta.duration);
  p.each(-r - 1, CY - r - 1, r + 1, CY + r + 1, (x, y, sx, sy) => {
    const d = Math.hypot(x, y - CY) / r;
    if (d >= 1) return;
    const q = (x - (y - CY)) / (r * 1.414), hot = Math.max(0, 1 - Math.abs(q - sw) / 0.22);
    const a = (back ? 0.07 : 0.03) + 0.26 * Math.pow(d, 6) + 0.2 * hot * (back ? 0.3 : 1);
    p.blendPx(sx, sy, hot > 0.5 && !back ? C[6] : C[5], a);
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), r = o.radius, rf = Math.sqrt(r * r - CY * CY);
  film(p, t, o, true);
  lattice(p, t, o, true);
  // where it meets the floor: the far half of a bright seal
  oval(p, 0, 0, rf, rf * FLOOR_SY, C[5], 0.8, (g) => Math.sin(g) < 0);
  p.glow(0, CY, r * 1.1, C[4], 0.14);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), r = o.radius, T = meta.duration, rf = Math.sqrt(r * r - CY * CY), A = o.actor;
  // the bubble lights the character from all round
  if (A) for (const [x, y] of shapeOf(A).out) p.light(x, y, C[5], 0.3);
  film(p, t, o, false);
  lattice(p, t, o, false);
  // the rim: bright where the light sits (top left) and where the sheen crosses it
  const sw = sheen(t, T);
  for (let j = 0, n = Math.ceil(r * TAU * 1.4); j < n; j++) {
    const g = (j / n) * TAU, x = Math.cos(g) * r, y = CY + Math.sin(g) * r, q = (x - (y - CY)) / (r * 1.414);
    const lit = Math.cos(g + 2.36), hot = Math.abs(q - sw) < 0.15;
    p.dot(x, y, hot || lit > 0.75 ? WHITE : lit > -0.2 ? C[6] : C[5], 1);
    p.dot(Math.cos(g) * (r - 1), CY + Math.sin(g) * (r - 1), C[4], 0.35 + 0.3 * lit);
  }
  p.glowRing(0, CY, r, 6, C[4], 0.32);
  // where the meridians cross the equator, and at the pole they all turn round, the lattice catches the light
  const phi = (t / T) * (Math.PI / N);
  for (let k = 0; k < 2 * N; k++) {
    const [x, y, z] = onSphere(r, 0, phi + (k * Math.PI) / N);
    if (z < r * 0.15) continue;
    p.px(x, y, WHITE);
    if (z > r * 0.45) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.blend(x + dx, y + dy, C[6], 0.7);
    p.glow(x, y, 4, C[5], 0.3);
  }
  const [px0, py0] = onSphere(r, Math.PI / 2, 0);
  sparkle(p, px0, py0, 2 + Math.round(1.5 + 1.5 * Math.sin((t / T) * TAU * 2)), WHITE, C[6], 0.45);
  // two glints chase each other round the rim
  for (const off of [0, Math.PI]) {
    const g = (t / T) * TAU + off + 0.8;
    sparkle(p, Math.cos(g) * r, CY + Math.sin(g) * r, 2, WHITE, C[6], 0.4);
  }
  // a bubble's shine: a bright curl up on the left, a dot under it, a faint one low on the right
  for (let g = 3.55; g < 4.2; g += 0.04) p.px(Math.cos(g) * r * 0.74, CY + Math.sin(g) * r * 0.74, g > 3.7 && g < 4.05 ? WHITE : C[6]);
  p.px(Math.cos(3.4) * r * 0.62, CY + Math.sin(3.4) * r * 0.62, WHITE);
  for (let g = 0.45; g < 0.8; g += 0.05) p.dot(Math.cos(g) * r * 0.8, CY + Math.sin(g) * r * 0.8, C[5], 0.6);
  // the near half of the floor seal and a pool of light
  oval(p, 0, 0, rf, rf * FLOOR_SY, (g) => (Math.sin(g) > 0.6 ? WHITE : C[6]), 1, (g) => Math.sin(g) >= 0);
  for (let i = -2; i <= 2; i++) p.glow(i * rf * 0.5, 0, 12, C[4], 0.18);
  // sparkles winking on its skin as it turns, motes rising inside
  cycle(t, T, 9, o.seed, (g) => g.range(0.35, 0.6), (age, life, R) => {
    const [x, y, z] = onSphere(r, R.range(-1.2, 1.3), R.range(0, TAU) + phi), k = Math.sin((age / life) * Math.PI);
    if (z < 0) return;
    sparkle(p, x, y, 1 + 2.5 * k * R.range(0.6, 1), WHITE, C[6], 0.45 * k);
  });
  cycle(t, T, 12, o.seed + 1, (g) => g.range(1.2, 2.2), (age, life, R) => {
    const x0 = R.range(-0.7, 0.7) * r, u = age / life, x = x0 + Math.sin(u * 6 + R.range(0, 6)) * 2, y = CY + r * 0.75 - u * r * 1.4;
    if (Math.hypot(x, y - CY) > r - 2) return;
    p.dot(x, y, u < 0.5 ? C[6] : C[5], Math.sin(u * Math.PI));
    p.light(x, y, C[5], 0.4 * Math.sin(u * Math.PI));
  });
}

// 3D: a real sphere of light standing on the floor. The film is a skin with a far half and a near half (the
// character shows through the one and hides the other), the meridians and the equator are curves on the sphere
// itself and turn about its axis, and where it meets the floor is a true circle.

export const three = {
  meta: { size: [88, 88], origin: [44, 70], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), r = o.radius, T = meta.duration, rf = Math.sqrt(r * r - CY * CY), A = o.actor, q = space(p, o);
    const phi = (t / T) * (Math.PI / N), sw = sheen(t, T);
    q.project(0, CY, 0);
    const cx = q.x, cy = q.y, d0 = q.d;
    // the point of the sphere at (lat, lon): world position and how much it faces us (1 head on, 0 on the rim, -1 behind)
    const on = (lat, lon) => [r * Math.cos(lat) * Math.sin(lon), CY - r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon)];
    const face = (x, y, z) => (d0 - q.depth(x, y, z)) / r;
    // the bubble lights the character from all round
    if (A) for (const [x, y] of shapeOf(A).out) p.light(x, y, C[5], 0.3);
    // the film: a thin gold wash, thick where the skin turns away, with the sheen sweeping across it
    shell(q, 0, CY, 0, r, (nx, ny, nz, out) => {
      const back = nz < 0, d = Math.sqrt(1 - nz * nz), hot = Math.max(0, 1 - Math.abs((nx - ny) / 1.414 - sw) / 0.22);
      out.a = (back ? 0.07 : 0.03) + 0.26 * Math.pow(d, 6) + 0.2 * hot * (back ? 0.3 : 1);
      out.c = hot > 0.5 && !back ? C[6] : C[5];
    }, 0);
    // the lattice: gather every pixel of the curves once, the nearest of them
    const seen = new Map(), dot = (lat, lon) => {
      const [x, y, z] = on(lat, lon);
      if (y > 0 || !q.project(x, y, z)) return;
      const f = face(x, y, z), key = (Math.floor(q.x) * 1000 + Math.floor(q.y)) * 2 + (f < 0 ? 1 : 0), v = seen.get(key), a = Math.abs(f);
      const hot = Math.abs((q.x - cx - (q.y - cy)) / (r * 1.414) - sw) < 0.12 ? 1 : 0;
      if (!v || a < v[3]) seen.set(key, [x, y, z, a, f < 0, hot || (v ? v[5] : 0)]);
    };
    for (let k = 0; k < 2 * N; k++) for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += 0.7 / r) dot(lat, phi + (k * Math.PI) / N);
    for (const lat of [0]) for (let lon = 0; lon < TAU; lon += 0.7 / (r * Math.cos(lat))) dot(lat, lon);
    // behind: faint and broken. In front: bright where the surface turns away, a translucent wash of gold where it faces us
    for (const [x, y, z, f, back, hot] of seen.values()) {
      if (back) q.blend(x, y, z, C[4], 0.32);
      else if (hot) q.px(x, y, z, WHITE);
      else if (f < 0.4) q.px(x, y, z, C[6]);
      else q.blend(x, y, z, f < 0.7 ? C[6] : C[5], f < 0.7 ? 0.8 : 0.55);
    }
    // where it meets the floor: a bright seal, a true circle, the far half dim
    for (let j = 0, n = Math.ceil(rf * TAU * 1.4); j < n; j++) {
      const g = (j / n) * TAU, x = Math.cos(g) * rf, z = Math.sin(g) * rf, f = nearer(q, x, 0, z) / rf;
      if (f >= 0) q.px(x, 0, z, f > 0.6 ? WHITE : C[6]);
      else q.dot(x, 0, z, C[5], 0.8);
    }
    // the rim: bright where the light sits (top left) and where the sheen crosses it
    q.at(0, CY, 0, (pp, k) => {
      for (let j = 0, n = Math.ceil(r * TAU * 1.4); j < n; j++) {
        const g = (j / n) * TAU, x = Math.cos(g) * r, y = Math.sin(g) * r, qq = (x - y) / (r * 1.414);
        const lit = Math.cos(g + 2.36), hot = Math.abs(qq - sw) < 0.15;
        pp.dot(x * k, y * k, hot || lit > 0.75 ? WHITE : lit > -0.2 ? C[6] : C[5], 1);
        pp.dot(Math.cos(g) * (r - 1) * k, Math.sin(g) * (r - 1) * k, C[4], 0.35 + 0.3 * lit);
      }
      pp.glowRing(0, 0, r * k, 6, C[4], 0.32);
      // a bubble's shine: a bright curl up on the left, a dot under it, a faint one low on the right
      pp.z -= r * 0.65;
      for (let g = 3.55; g < 4.2; g += 0.04) pp.px(Math.cos(g) * r * 0.74 * k, Math.sin(g) * r * 0.74 * k, g > 3.7 && g < 4.05 ? WHITE : C[6]);
      pp.px(Math.cos(3.4) * r * 0.62 * k, Math.sin(3.4) * r * 0.62 * k, WHITE);
      for (let g = 0.45; g < 0.8; g += 0.05) pp.dot(Math.cos(g) * r * 0.8 * k, Math.sin(g) * r * 0.8 * k, C[5], 0.6);
    });
    // where the meridians cross the equator they catch the light; at the pole they all turn round
    for (let k = 0; k < 2 * N; k++) {
      const [x, y, z] = on(0, phi + (k * Math.PI) / N), f = face(x, y, z);
      if (f < 0.15) continue;
      q.px(x, y, z, WHITE);
      if (f > 0.45) q.at(x, y, z, (pp) => { pp.z -= 0.5; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.blend(dx, dy, C[6], 0.7); });
      q.glow(x, y, z, 4, C[5], 0.3);
    }
    const arm = 2 + Math.round(1.5 + 1.5 * Math.sin((t / T) * TAU * 2));
    q.at(0, CY - r, 0, (pp) => sparkle(pp, 0, 0, arm, WHITE, C[6], 0.45));
    // two glints chase each other round the bubble on a leaning orbit, in front and behind
    for (const off of [0, Math.PI]) {
      const g = (t / T) * TAU + off + 0.8, x = Math.cos(g) * r, y = CY - Math.sin(g) * r * 0.5, z = Math.sin(g) * r * 0.866;
      if (face(x, y, z) > 0) q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 2, WHITE, C[6], 0.4));
      else q.glow(x, y, z, 5, C[6], 0.25);
    }
    // sparkles winking on its skin as it turns, motes rising inside
    cycle(t, T, 9, o.seed, (g) => g.range(0.35, 0.6), (age, life, R) => {
      const [x, y, z] = on(R.range(-1.2, 1.3), R.range(0, TAU) + phi), k = Math.sin((age / life) * Math.PI), s = 1 + 2.5 * k * R.range(0.6, 1);
      if (face(x, y, z) < 0) return;
      q.at(x, y, z, (pp) => sparkle(pp, 0, 0, s, WHITE, C[6], 0.45 * k));
    });
    cycle(t, T, 12, o.seed + 1, (g) => g.range(1.2, 2.2), (age, life, R) => {
      const rr = R.range(0, 0.7) * r, a = R.range(0, TAU), u = age / life, sway = Math.sin(u * 6 + R.range(0, 6)) * 2, y = CY + r * 0.75 - u * r * 1.4;
      const x = Math.cos(a) * rr + sway, z = Math.sin(a) * rr;
      if (Math.hypot(x, y - CY, z) > r - 2) return;
      q.dot(x, y, z, u < 0.5 ? C[6] : C[5], Math.sin(u * Math.PI));
      q.light(x, y, z, C[5], 0.4 * Math.sin(u * Math.PI));
    });
    // a pool of light on the floor, and the whole bubble's glow
    for (let i = 0; i < 6; i++) q.glow(Math.cos((i / 6) * TAU) * rf * 0.6, 0, Math.sin((i / 6) * TAU) * rf * 0.6, 12, C[4], 0.18);
    q.glow(0, 0, 0, 14, C[4], 0.18);
    q.glow(0, CY, 0, r * 1.1, C[4], 0.14);
  },
};
