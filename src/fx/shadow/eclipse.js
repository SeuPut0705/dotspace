import { cycle, fit, clamp, smooth, rand, space, TAU, WHITE, mix } from "../../core/index.js";
import { VOID, halo, unlight } from "./_lib.js";

export const meta = {
  name: "Eclipse",
  desc: "A black moon over the sun: a breathing pearl corona with long streamers, a thin white rim, and one diamond bead blazing on its edge.",
  tags: ["shadow", "eclipse", "moon", "sun", "corona", "sky", "magic", "loop"],
  size: [160, 144],
  origin: [80, 72],
  duration: 4,
  loop: true,
  fps: 30,
  bg: "sky",
  options: { palette: VOID, pearl: ["#5a4f8a", "#a99be0", "#e6defa", "#fffaf2"], seed: 3 },
};

// the moon's radius, the loop, where the bead blazes on the rim (radians, 0 = right, up is negative)
const R = 19, D = 4, BEAD = -0.72;
const breathe = (t, k, ph) => Math.sin((TAU * k * t) / D + ph);
// streamers: crowded toward the equator (left and right), longer there, each curving off as it goes out
const STREAMS = Array.from({ length: 30 }, (_, i) => {
  const side = i % 2 ? 0 : Math.PI, spread = (rand(i, 1) - 0.5) * (rand(i, 2) < 0.7 ? 1.3 : 3.1);
  const a = side + spread, eq = Math.abs(Math.cos(a));
  return { a, len: (10 + rand(i, 3) * 28) * (0.45 + 0.75 * eq), curl: (rand(i, 4) - 0.5) * 0.00018, k: 1 + (i % 3), ph: rand(i, 5) * TAU, w: rand(i, 6) };
});

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), Q = fit(o.pearl, 4), S = o.seed;
  // stars twinkling in the dark sky round it
  cycle(t, D, 26, S, (r) => r.range(1.2, 2.6), (age, L, r) => {
    const x = r.range(-78, 78), y = r.range(-70, 70);
    if (Math.hypot(x, y) < R + 22) return;
    const k = Math.sin((Math.PI * age) / L);
    p.dot(x, y, k > 0.7 ? WHITE : Q[1], k * 1.2);
    if (k > 0.85 && r.next() < 0.4) (p.dot(x - 1, y, Q[0], 0.8), p.dot(x + 1, y, Q[0], 0.8));
  });
  // the outer corona's light: a wide pearly bloom, breathing
  const b = 1 + 0.08 * breathe(t, 1, 0);
  p.glow(0, 0, 72 * b, C[4], 0.38);
  p.glow(0, 0, 46 * b, Q[1], 0.34);
  // streamers: fine rays of pearl, white at the root, thinning to violet, curling as they go out
  for (const s of STREAMS) {
    const L = s.len * (1 + 0.18 * breathe(t, s.k, s.ph));
    for (let d = 4; d <= L; d += 0.5) {
      const u = d / L, a = s.a + s.curl * d * d, r = R + 1 + d, x = Math.cos(a) * r, y = Math.sin(a) * r;
      p.dot(x, y, u < 0.3 ? Q[2] : u < 0.65 ? Q[1] : C[5], u < 0.75 ? 1 : (1 - u) * 4);
    }
    p.glowLine(Math.cos(s.a) * (R + 4), Math.sin(s.a) * (R + 4), Math.cos(s.a) * (R + L * 0.6), Math.sin(s.a) * (R + L * 0.6), 3, Q[1], 0.12);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), Q = fit(o.pearl, 4), b = 1 + 0.08 * breathe(t, 1, 0);
  // the inner corona: a bright collar hugging the moon, finely streaked, fading out through pearl to violet
  const W = R + 10;
  p.shade(-W, -W, W, W, (x, y, out) => {
    const r = Math.sqrt(x * x + y * y);
    if (r < R - 0.5 || r > R + 9 * b) return;
    const a = Math.atan2(y, x), e = (r - R) / (9 * b);
    const streak = 0.55 + 0.3 * Math.cos(a * 23 + Math.sin(a * 5) * 2) + 0.15 * Math.cos(a * 41 - (TAU * t) / D);
    const I = (1 - e) ** 2.2 * streak * (0.75 + 0.4 * Math.abs(Math.cos(a)));
    if (r < R + 0.9) return Q[3];
    if (I < 0.1) return;
    if (I > 0.45 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.2 * I;
    return I > 0.72 ? Q[2] : I > 0.42 ? Q[1] : I > 0.22 ? C[5] : C[4];
  });
  // the moon: black, a whisper of earthshine on its left limb
  p.shade(-R, -R, R, R, (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    if (r >= R - 0.5) return;
    return r > R - 2.2 && x < -R * 0.45 ? C[1] : C[0];
  });
  // the diamond bead: a blazing point on the rim, rays flaring out and breathing
  const bx = Math.cos(BEAD) * (R + 0.4), by = Math.sin(BEAD) * (R + 0.4), k = 0.75 + 0.25 * breathe(t, 2, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.12, len = (i % 2 ? 7 : 22) * k * (i === 1 || i === 5 ? 1.6 : 1);
    for (let d = 1; d <= len; d += 0.5) {
      const u = d / len, x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d;
      if (x * x + y * y < (R - 0.5) ** 2) break;
      p.dot(x, y, u < 0.35 ? WHITE : u < 0.7 ? Q[2] : Q[1], u < 0.5 ? 1 : (1 - u) * 2.2);
    }
  }
  p.circle(bx, by, 3 * k, Q[2]);
  p.circle(bx, by, 2.2 * k, Q[3]);
  p.circle(bx, by, 1.4, WHITE);
  p.glow(bx, by, 46 * k, Q[2], 0.8 * k);
  p.glow(bx, by, 14, WHITE, 0.8);
  halo(p, 0, 0, R - 0.5, R + 16, Q[2], 0.35 * b);
  unlight(p, -R, -R, R, R, (x, y) => x * x + y * y < (R - 0.6) ** 2);
}

// ---- 3D: a true black sphere in a sky of its own. The streamers are real rays spreading out of it in every
// direction, crowded to an equatorial band that is a tilted plane (a faint streaked disc lies in it); the stars hang
// in a shell round it; the bead is fixed to a point of the sphere, so it swings behind the moon as the camera turns.
const norm3 = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const POLE = norm3([-0.22, -1, 0.18]); // the moon's axis (up): the equatorial plane is perpendicular to it
const E1 = norm3([1 - POLE[0] * POLE[0], -POLE[0] * POLE[1], -POLE[0] * POLE[2]]);
const E2 = [POLE[1] * E1[2] - POLE[2] * E1[1], POLE[2] * E1[0] - POLE[0] * E1[2], POLE[0] * E1[1] - POLE[1] * E1[0]];
// a direction by longitude (round the axis, from E1 towards E2) and latitude (towards the pole)
const dir3 = (lon, lat) => {
  const c = Math.cos(lat), a = c * Math.cos(lon), b = c * Math.sin(lon), s = Math.sin(lat);
  return [E1[0] * a + E2[0] * b + POLE[0] * s, E1[1] * a + E2[1] * b + POLE[1] * s, E1[2] * a + E2[2] * b + POLE[2] * s];
};
const SPOKES = Array.from({ length: 64 }, (_, i) => {
  const lon = rand(i, 11) * TAU, lat = (rand(i, 12) - 0.5) * (rand(i, 13) < 0.72 ? 0.8 : 3.0), eq = Math.cos(lat);
  return {
    lon, lat, len: (10 + rand(i, 14) * 30) * (0.4 + 0.8 * eq * eq) * (0.8 + 0.4 * Math.abs(Math.cos(lon))),
    curl: (rand(i, 15) - 0.5) * 0.0003, k: 1 + (i % 3), ph: rand(i, 16) * TAU,
  };
});
const BEAD3 = norm3([0.74, -0.62, 0.3]).map((c) => c * (R + 0.4));

export const three = {
  meta: { size: [176, 176], origin: [88, 88], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const C = fit(o.palette, 8), Q = fit(o.pearl, 4), S = o.seed, q = space(p, o), b = 1 + 0.08 * breathe(t, 1, 0);
    // earthshine: a whisper on the limb of the moon that faces a fixed light in the world, whichever way we look
    const [lx, ly, lz] = norm3(q.view(-0.8, -0.35, 0.5));
    q.ball(0, 0, 0, R, (nx, ny, nz) => {
      const d = nx * lx + ny * ly + nz * lz;
      return nz < 0.5 && d > 0.55 ? (d > 0.8 && nz < 0.34 ? C[2] : C[1]) : C[0];
    });
    // stars twinkling in a shell all round
    cycle(t, D, 44, S, (r) => r.range(1.2, 2.6), (age, L, r) => {
      const z = r.range(-1, 1), g = r.range(0, TAU), rr = r.range(46, 78), s = Math.sqrt(1 - z * z);
      const k = Math.sin((Math.PI * age) / L), x = Math.cos(g) * s * rr, y = z * rr, w = Math.sin(g) * s * rr;
      q.at(x, y, w, (pp) => {
        pp.dot(0, 0, k > 0.7 ? WHITE : Q[1], k * 1.2);
        if (k > 0.85 && r.next() < 0.4) (pp.dot(-1, 0, Q[0], 0.8), pp.dot(1, 0, Q[0], 0.8));
      });
    });
    // streamers: fine rays of pearl, white at the root, thinning to violet, curling as they go out
    for (const s of SPOKES) {
      const L = s.len * (1 + 0.18 * breathe(t, s.k, s.ph)), at = (d) => dir3(s.lon + s.curl * d * d, s.lat).map((c) => c * (R + 1 + d));
      for (let d = 4; d < L; d += 3.5) {
        const d1 = Math.min(L, d + 3.5), u0 = d / L, u1 = d1 / L, f = (u) => u0 + (u1 - u0) * u;
        // a ray coming at us over the moon's face would scribble on it: it only shows past the limb
        const a0 = at(d), a1 = at(d1);
        q.project(...a1);
        if (Math.hypot(q.x, q.y) < R * q.k + 1.5 && q.d < 0) continue;
        q.line(...a0, ...a1, (u) => (f(u) < 0.3 ? Q[2] : f(u) < 0.65 ? Q[1] : C[5]), (u) => (f(u) < 0.75 ? 1 : (1 - f(u)) * 4));
      }
    }
    // the diamond bead on the rim: a point of the sphere with rays flaring out of it, breathing
    const [bx, by, bz] = BEAD3, kb = 0.75 + 0.25 * breathe(t, 2, 1), face = norm3(q.view(bx, by, bz))[2];
    q.project(bx, by, bz);
    const sx = q.x, sy = q.y, sk = q.k;
    q.at(bx, by, bz, (pp, k) => {
      pp.z -= 5;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + 0.12, len = (i % 2 ? 7 : 22) * kb * (i === 1 || i === 5 ? 1.6 : 1) * k;
        for (let d = 1; d <= len; d += 0.5) {
          const u = d / len, dx = Math.cos(a) * d, dy = Math.sin(a) * d;
          if (face > 0 && Math.hypot(sx + dx, sy + dy) < R * sk - 0.5) continue; // not across the moon's face
          pp.dot(dx, dy, u < 0.35 ? WHITE : u < 0.7 ? Q[2] : Q[1], u < 0.5 ? 1 : (1 - u) * 2.2);
        }
      }
      // turned to us it sits on the face of the moon, a small sparkle there
      if (face > 0.15)
        for (let d = 2; d <= 7; d++) for (const [sx2, sy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.dot(sx2 * d * k, sy2 * d * k, d < 4 ? WHITE : Q[2], (8 - d) / 7);
      pp.circle(0, 0, 3 * kb * k, Q[2]);
      pp.circle(0, 0, 2.2 * kb * k, Q[3]);
      pp.circle(0, 0, 1.4, WHITE);
    });
    // light: the outer corona's bloom, the streamers' glow, the bead
    q.glow(0, 0, 0, 72 * b, C[4], 0.38);
    q.glow(0, 0, 0, 46 * b, Q[1], 0.34);
    for (let i = 0; i < SPOKES.length; i += 2) {
      const s = SPOKES[i], L = s.len, a = dir3(s.lon, s.lat);
      q.glowLine(a[0] * (R + 4), a[1] * (R + 4), a[2] * (R + 4), a[0] * (R + L * 0.6), a[1] * (R + L * 0.6), a[2] * (R + L * 0.6), 3, Q[1], 0.12);
    }
    const vis = 0.3 + 0.7 * smooth(-0.55, 0.15, face);
    q.glow(bx, by, bz, 46 * kb, Q[2], 0.8 * kb * vis);
    q.glow(bx, by, bz, 14, WHITE, 0.8 * vis);
    // the inner corona: a pearly collar hugging the moon, finely streaked, the same from every side
    q.at(0, 0, 0, (pp, k) => {
      const Rk = R * k, W = Rk + 10 * k;
      pp.shade(-W, -W, W, W, (x, y, out) => {
        const r = Math.sqrt(x * x + y * y);
        if (r < Rk - 0.5 || r > Rk + 9 * b * k) return;
        const a = Math.atan2(y, x), e = (r - Rk) / (9 * b * k);
        const streak = 0.55 + 0.3 * Math.cos(a * 23 + Math.sin(a * 5) * 2) + 0.15 * Math.cos(a * 41 - (TAU * t) / D);
        const I = (1 - e) ** 2.2 * streak * (0.8 + 0.3 * Math.abs(Math.cos(a)));
        if (r < Rk + 0.9) return Q[3];
        if (I < 0.1) return;
        if (I > 0.45 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.2 * I;
        return I > 0.72 ? Q[2] : I > 0.42 ? Q[1] : I > 0.22 ? C[5] : C[4];
      });
      halo(pp, 0, 0, Rk - 0.5, Rk + 16 * k, Q[2], 0.35 * b);
    });
    // the band of the streamers: a faint streaked disc in the equatorial plane, thinning outward
    const V1 = q.view(...E1), V2 = q.view(...E2);
    q.plane(0, 0, 0, POLE, R + 56, (u, v, out) => {
      const d = Math.hypot(u, v), e = (d - R - 1) / 54;
      if (e < 0 || e > 1) return;
      // where the plane passes in front of the moon it would grey its face: it shows only past the limb
      const sx = u * V1[0] + v * V2[0], sy = u * V1[1] + v * V2[1];
      if (u * V1[2] + v * V2[2] > 0 && sx * sx + sy * sy < (R + 1) * (R + 1)) return;
      const g = Math.atan2(v, u), streak = 0.5 + 0.5 * Math.cos(g * 31 + Math.sin(g * 7) * 2);
      out.c = e < 0.3 ? Q[2] : Q[1];
      out.a = (1 - e) ** 2 * 0.6 * (0.4 + 0.6 * streak) * (0.9 + 0.1 * b);
      out.blend = true;
    });
    // the moon stays black under every light
    q.at(0, 0, 0, (pp, k) => unlight(pp, -R * k - 1, -R * k - 1, R * k + 1, R * k + 1, (x, y) => x * x + y * y < (R * k - 0.6) ** 2));
  },
};
