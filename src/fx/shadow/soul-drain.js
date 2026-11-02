import { cycle, fit, smooth, ease, rand, space, TAU, WHITE } from "../../core/index.js";
import { VOID, ringFast, halo } from "./_lib.js";

export const meta = {
  name: "Soul drain",
  desc: "Pale souls are torn loose on the right and dragged down a funnel of streaks into a black crystal vessel, which flares violet as each one lands.",
  tags: ["shadow", "soul", "drain", "necromancy", "funnel", "directional", "magic", "loop"],
  size: [208, 120],
  origin: [40, 110],
  duration: 3.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, soul: ["#2c3f66", "#7d9fd0", "#cfe6ff", "#ffffff"], seed: 8 },
};

// the vessel's centre; the loop; the funnel's streamlines (start points out on the right); four souls a loop
const VY = -50, D = 3.2, LINES = 11, SOULS = 4, TRAVEL = 1.45;
const wrap = (x) => ((x % D) + D) % D;
const line = (i) => {
  const sx = 96 + rand(i, 1) * 64, sy = -88 + rand(i, 2) * 72, bend = (rand(i, 3) - 0.5) * 50;
  return { sx, sy, c1x: sx * 0.55, c1y: sy + bend, c2x: 22 + rand(i, 4) * 14, c2y: VY + (sy - VY) * 0.25 };
};
const LN = Array.from({ length: LINES }, (_, i) => line(i));
// a point along streamline i at u (0 at its start, 1 at the vessel), cubic bezier
function along(L, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * L.sx + b * L.c1x + c * L.c2x, a * L.sy + b * L.c1y + c * L.c2y + d * (VY - L.sy) + d * L.sy];
}
const soul = (j) => ({ born: (j + 0.15 + rand(j, 7) * 0.5) * (D / SOULS), line: Math.floor(rand(j, 8) * LINES) });
const landings = (t) => {
  let f = 0;
  for (let j = 0; j < SOULS; j++) {
    const since = wrap(t - soul(j).born - TRAVEL);
    f += Math.exp(-since / 0.14) * (since < 1 ? 1 : 0);
  }
  return Math.min(1.4, f);
};

// the vessel: a black crystal, two facets lit violet from inside, a hard ridge, a heart of stolen light
function vessel(p, C, t, f) {
  const y0 = VY + Math.sin((TAU * t) / D) * 1.5, W = 9, UP = 14, DN = 12;
  p.shade(-W - 1, y0 - UP - 1, W + 1, y0 + DN + 1, (x, y) => {
    const dy = y - y0, half = dy < 0 ? W * (1 + dy / UP) : W * (1 - dy / DN);
    if (half <= 0 || Math.abs(x) > half + 0.6) return;
    if (Math.abs(x) > half - 0.4) return f > 0.5 ? C[6] : C[1];
    const ridge = Math.abs(x + dy * 0.12) < 0.6, heart = Math.abs(x) + Math.abs(dy - 1) < 2.6 + f * 1.5;
    if (heart) return f > 0.4 ? WHITE : C[6];
    if (ridge) return f > 0.3 ? C[7] : C[5];
    if (x < 0) return dy < 0 ? (f > 0.2 ? C[5] : C[4]) : C[3];
    return dy < 0 ? C[2] : C[1];
  });
  p.glow(0, y0, 30 + 14 * f, C[5], 0.5 + 0.5 * f);
  p.glow(0, y0 + 1, 8, WHITE, 0.25 + 0.6 * f);
  return y0;
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  // the funnel: streamlines bunching into the vessel, dashes running down them, brighter as they close in
  for (let i = 0; i < LINES; i++) {
    const L = LN[i], ph = wrap(t + i * 0.37) / D;
    let px = null, py = null;
    for (let u = 0; u <= 1.0001; u += 0.01) {
      const [x, y] = along(L, u), dash = (((u * 5 - ph * 10 + i * 0.3) % 1) + 1) % 1;
      // a faint line the whole way, bright dashes riding it inward, all brighter as it narrows
      if (px !== null) p.line(px, py, x, y, u > 0.6 ? C[3] : C[2], 0.4 + 0.6 * u);
      if (dash < 0.18) p.px(x, y, u > 0.7 ? C[7] : u > 0.35 ? C[6] : C[5]);
      (px = x), (py = y);
    }
  }
  p.glow(10, VY, 40, C[4], 0.22);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), S = fit(o.soul, 4), f = landings(t);
  // where the souls are torn from: a faint pale haze out on the right
  cycle(t, D, 10, o.seed, (r) => r.range(0.8, 1.3), (age, Lf, r) => {
    const x = r.range(100, 150), y = r.range(-80, -20) - age * 18, u = age / Lf;
    p.dot(x, y, S[2], (1 - u) * 0.8);
    p.glow(x, y, 4, S[1], 0.2 * (1 - u));
  });
  // streaks racing down the funnel, faster as they close on the vessel, white at the head
  cycle(t, D, 22, o.seed + 1, (r) => r.range(0.4, 0.7), (age, Lf, r) => {
    const L = LN[Math.floor(r.next() * LINES)], u0 = r.range(0.15, 0.5), q = u0 + (1 - u0) * Math.pow(age / Lf, 2.2), q2 = u0 + (1 - u0) * Math.pow(Math.max(0, age - 0.06) / Lf, 2.2);
    const [x, y] = along(L, q), [tx, ty] = along(L, q2);
    p.line(tx, ty, x, y, (v) => (v > 0.7 ? WHITE : v > 0.35 ? C[6] : C[4]));
    p.glow(x, y, 4, C[6], 0.35);
  });
  const y0 = vessel(p, C, t, f);
  // motes circling the vessel, in front and behind it
  for (let k = 0; k < 6; k++) {
    const a = (TAU * (2 * t)) / D + (k * TAU) / 6, ex = Math.cos(a) * 15, ey = Math.sin(a) * 5 - 2, z = Math.sin(a);
    p.px(ex, y0 + ey, z > 0 ? C[7] : C[4]);
    if (z > 0) p.glow(ex, y0 + ey, 4, C[6], 0.35);
  }
  // the souls: a pale head with hollow eyes and an open mouth, a wavering tail, dragged faster as they go
  for (let j = 0; j < SOULS; j++) {
    const s = soul(j), age = wrap(t - s.born);
    if (age > TRAVEL) continue;
    const L = LN[s.line], u = Math.pow(age / TRAVEL, 1.8), [x, y] = along(L, u);
    if (age < 0.18) {
      const k = 1 - age / 0.18;
      ringFast(p, L.sx, L.sy, 3 + 9 * (1 - k), 1, k > 0.5 ? S[2] : S[1]);
      p.glow(L.sx, L.sy, 12, S[1], 0.5 * k);
    }
    // the tail: a wavering wisp, pale near the head, thinning to violet
    for (let k = 14; k >= 1; k--) {
      const uu = Math.pow(Math.max(0, age - k * 0.03) / TRAVEL, 1.8), [tx, ty] = along(L, uu), w = Math.sin(t * 12 + k * 0.8 + j) * k * 0.16;
      const r = Math.max(0.5, 2.6 - k * 0.17);
      p.disc(tx, ty + w, r, k < 4 ? S[2] : k < 9 ? S[1] : C[5], 0.75 * (1 - k / 15));
    }
    // the head: a pale round face, hollow eyes and an open mouth, a lit rim, stretched as it nears the vessel
    const near = smooth(0.82, 1, u), hr = 3.4 - near * 1.6;
    p.circle(x, y, hr + 0.8, S[1]);
    p.circle(x, y, hr, S[2]);
    p.px(x - 1, y - 2, S[3]);
    p.px(x - 2, y - 1, S[3]);
    if (near < 0.5) {
      p.px(x - 1.5, y, S[0]);
      p.px(x + 1.5, y, S[0]);
      p.px(x, y + 1.6, S[0]);
      p.px(x, y + 2.4, S[0]);
    }
    p.glow(x, y, 10, S[1], 0.5);
  }
  // each landing: a flash in the heart, a ring off the crystal, a glint
  for (let j = 0; j < SOULS; j++) {
    const since = wrap(t - soul(j).born - TRAVEL);
    if (since < 0.3) {
      const k = since / 0.3;
      ringFast(p, 0, y0, 6 + 18 * ease.outCubic(k), Math.max(1, 2 * (1 - k)), k < 0.4 ? C[7] : k < 0.7 ? C[5] : C[3]);
    }
  }
  halo(p, 0, y0, 4, 22, C[6], 0.25 * f);
}

// ---- 3D: a real funnel. The streamlines are beziers in x, y and z that start on a disc out on +x and spiral in to the
// vessel; the souls run down them with soft tails; the vessel is a black hexagonal crystal rendered facet by facet
// (ray against its planes, so it has real depth and turns); motes circle it on a tilted ring and the landings are true rings.
const NS = 100, FROM = 80, SPAN = 46, DISC = 38, TWIST = 1.6;
const LN3 = Array.from({ length: LINES }, (_, i) => {
  const phi = i * 2.4 + rand(i, 2) * 0.8, rad = 12 + DISC * Math.sqrt(rand(i, 6)), bend = (rand(i, 3) - 0.5) * 40, ry = Math.cos(phi) * rad, rz = Math.sin(phi) * rad;
  return { sx: FROM + rand(i, 1) * SPAN, ry, rz, c1y: ry * 0.55 + bend, c1z: rz * 0.55 + (rand(i, 7) - 0.5) * 40, c2x: 22 + rand(i, 4) * 14, c2y: ry * 0.25, c2z: rz * 0.25 };
});
// a point along streamline L at u (0 at the start on the disc, 1 at the vessel): a cubic bezier whose offset from the funnel's
// axis turns as it closes in
function along3(L, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u;
  const ry = a * L.ry + b * L.c1y + c * L.c2y, rz = a * L.rz + b * L.c1z + c * L.c2z, g = TWIST * u, cg = Math.cos(g), sg = Math.sin(g);
  return [a * L.sx + b * L.sx * 0.55 + c * L.c2x, VY + ry * cg - rz * sg, ry * sg + rz * cg];
}
const PT = LN3.map((L) => Array.from({ length: NS + 1 }, (_, k) => along3(L, k / NS)));

// the vessel: a black hexagonal bipyramid. Each pixel's ray is cut against the 12 facet planes (the camera's axes read off
// the Space), so the crystal has a depth per pixel, lit facets, bright ridges and a rim, and turns with `ang`.
function crystal(q, C, y0, ang, f) {
  const W = 11, UPH = 18, DNH = 14, N = 6, p = q.p, top = [0, -UPH, 0], bot = [0, DNH, 0], faces = [];
  if (!q.project(0, y0, 0)) return [];
  const cx = q.x, cy = q.y, d0 = q.d, k = q.k;
  const ring = Array.from({ length: N }, (_, i) => [Math.cos(ang + (i * TAU) / N) * W, 0, Math.sin(ang + (i * TAU) / N) * W]);
  const Rw = [q.view(1, 0, 0)[0], q.view(0, 1, 0)[0], q.view(0, 0, 1)[0]], Dw = [q.view(1, 0, 0)[1], q.view(0, 1, 0)[1], q.view(0, 0, 1)[1]], Tw = [q.view(1, 0, 0)[2], q.view(0, 1, 0)[2], q.view(0, 0, 1)[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const add = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n);
    n = n.map((x) => x / l);
    let d = dot(n, a);
    if (d < 0) (n = n.map((x) => -x)), (d = -d);
    faces.push({ n, d, v: q.view(...n), nd: -dot(n, Tw), nR: dot(n, Rw), nD: dot(n, Dw) });
  };
  for (let i = 0; i < N; i++) {
    add(top, ring[i], ring[(i + 1) % N]);
    add(bot, ring[i], ring[(i + 1) % N]);
  }
  const cells = [], seen = new Set(), z0 = p.z, key = (sx, sy) => sy * 8192 + sx;
  p.each(cx - (W + 2) * k, cy - (UPH + 2) * k, cx + (W + 2) * k, cy + (DNH + 2) * k, (lx, ly, sx, sy) => {
    const a = (lx - cx) / k, b = (ly - cy) / k;
    let tin = -Infinity, tout = Infinity, t2 = -Infinity, fi = -1;
    for (let j = 0; j < faces.length; j++) {
      const F = faces[j], no = F.d - a * F.nR - b * F.nD;
      if (F.nd < -1e-6) {
        const tt = no / F.nd;
        if (tt > tin) (t2 = tin), (tin = tt), (fi = j);
        else if (tt > t2) t2 = tt;
      } else if (F.nd > 1e-6) tout = Math.min(tout, no / F.nd);
      else if (no < 0) return;
    }
    if (fi < 0 || tin >= tout) return;
    seen.add(key(sx, sy));
    cells.push([sx, sy, tin, fi, tin - t2]);
  });
  for (const [sx, sy, tin, fi, gap] of cells) {
    const [nx, ny, nz] = faces[fi].v, dl = nx * -0.5 + ny * -0.6 + nz * 0.62;
    const rim = !(seen.has(key(sx - 1, sy)) && seen.has(key(sx + 1, sy)) && seen.has(key(sx, sy - 1)) && seen.has(key(sx, sy + 1)));
    let c;
    if (rim) c = f > 0.5 ? C[6] : C[1];
    else if (gap < 0.8) c = f > 0.3 ? C[7] : C[5];
    else c = C[(dl > 0.5 ? 3 : dl > 0.1 ? 2 : dl > -0.3 ? 1 : 0) + (f > 0.2 ? 1 : 0) + (f > 0.7 ? 1 : 0)];
    p.z = d0 + tin;
    p.put(sx, sy, c, 1);
  }
  p.z = z0;
  return cells;
}

export const three = {
  meta: { size: [284, 166], origin: [142, 130], camera: { pitch: 0.22 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), S = fit(o.soul, 4), f = landings(t);
    const y0 = VY + Math.sin((TAU * t) / D) * 1.5, glows = [], tails = [];
    // the funnel: streamlines bunching into the vessel, dashes running down them, brighter as they close in
    for (let i = 0; i < LINES; i++) {
      const ph = wrap(t + i * 0.37) / D, P = PT[i];
      for (let k = 1; k <= NS; k++) {
        const u = k / NS, dash = (((u * 5 - ph * 10 + i * 0.3) % 1) + 1) % 1;
        q.line(P[k - 1][0], P[k - 1][1], P[k - 1][2], P[k][0], P[k][1], P[k][2], u > 0.6 ? C[3] : C[2], 0.55 + 0.45 * u);
        if (dash < 0.18) q.px(P[k][0], P[k][1], P[k][2], u > 0.7 ? C[7] : u > 0.35 ? C[6] : C[5]);
      }
    }
    // the vessel, and the motes circling it on a tilted ring, in front of it and behind
    const cells = crystal(q, C, y0, (TAU * t) / D, f);
    const R = 17, st = Math.sin(0.45), ct = Math.cos(0.45), at = (a) => [Math.cos(a) * R, y0 + Math.sin(a) * R * st, Math.sin(a) * R * ct], dc = q.depth(0, y0, 0);
    q.ring(0, y0, 0, R + 0.5, 1, C[3], 0.3, [0, -ct, st]);
    for (let k = 0; k < 6; k++) {
      const a = (TAU * (2 * t)) / D + (k * TAU) / 6, [x, y, z] = at(a), front = q.depth(x, y, z) < dc;
      for (let j = 1; j <= 3; j++) q.line(...at(a - (j - 1) * 0.12), ...at(a - j * 0.12), front ? C[6] : C[3], 1.1 - j / 3);
      q.ball(x, y, z, 1.1, front ? C[7] : C[4]);
      if (front) glows.push([x, y, z, 4, C[6], 0.35]);
    }
    // streaks racing down the funnel, faster as they close on the vessel, white at the head
    cycle(t, D, 22, o.seed + 1, (r) => r.range(0.4, 0.7), (age, Lf, r) => {
      const L = LN3[Math.floor(r.next() * LINES)], u0 = r.range(0.15, 0.5), a = u0 + (1 - u0) * Math.pow(age / Lf, 2.2), a2 = u0 + (1 - u0) * Math.pow(Math.max(0, age - 0.06) / Lf, 2.2);
      const [x, y, z] = along3(L, a), [tx, ty, tz] = along3(L, a2);
      q.line(tx, ty, tz, x, y, z, (v) => (v > 0.7 ? WHITE : v > 0.35 ? C[6] : C[4]));
      glows.push([x, y, z, 4, C[6], 0.35]);
    });
    // the souls: a pale ball face with hollow eyes and an open mouth, a wavering tail, dragged faster as they go
    for (let j = 0; j < SOULS; j++) {
      const s = soul(j), age = wrap(t - s.born);
      if (age > TRAVEL) continue;
      const L = LN3[s.line], u = Math.pow(age / TRAVEL, 1.8), [x, y, z] = along3(L, u);
      if (age < 0.18) {
        const k = 1 - age / 0.18, [sx, sy, sz] = PT[s.line][0];
        q.ring(sx, sy, sz, 3 + 9 * (1 - k), 1, k > 0.5 ? S[2] : S[1], 1, [1, 0, 0]);
        glows.push([sx, sy, sz, 12, S[1], 0.5 * k]);
      }
      // the tail: a wavering wisp, pale near the head, thinning to violet
      for (let k = 14; k >= 1; k--) {
        const uu = Math.pow(Math.max(0, age - k * 0.03) / TRAVEL, 1.8), [tx, ty, tz] = along3(L, uu), ph = t * 12 + k * 0.8 + j, w = k * 0.16;
        tails.push({ x: tx, y: ty + Math.sin(ph) * w, z: tz + Math.cos(ph) * w, r: Math.max(0.5, 2.6 - k * 0.17), c: k < 4 ? S[2] : k < 9 ? S[1] : C[5], a: 0.75 * (1 - k / 15) });
      }
      // the head: a lit ball with a face on the side that looks at the camera, stretched thin as it nears the vessel
      const near = smooth(0.82, 1, u), hr = 3.4 - near * 1.6, rim = hr / (hr + 0.8);
      q.ball(x, y, z, hr + 0.8, (nx, ny) => (Math.hypot(nx, ny) > rim ? S[1] : nx + ny < -0.8 ? S[3] : S[2]));
      if (near < 0.5)
        q.at(x, y, z, (pp) => {
          pp.z -= hr + 0.9;
          pp.px(-1.5, 0, S[0]);
          pp.px(1.5, 0, S[0]);
          pp.px(0, 1.6, S[0]);
          pp.px(0, 2.4, S[0]);
        });
      glows.push([x, y, z, 10, S[1], 0.5]);
    }
    // each landing: a flash in the heart, rings off the crystal in the floor's plane and tilted, a glint
    for (let j = 0; j < SOULS; j++) {
      const since = wrap(t - soul(j).born - TRAVEL);
      if (since < 0.3) {
        const k = since / 0.3, r = 6 + 18 * ease.outCubic(k), w = Math.max(1, 2 * (1 - k)), col = k < 0.4 ? C[7] : k < 0.7 ? C[5] : C[3];
        q.ring(0, y0, 0, r, w, col);
        q.ring(0, y0, 0, r, w, col, 0.8, [0.45, -0.75, 0.5]);
      }
    }
    // where the souls are torn from: a faint pale haze out on +x, over the disc the funnel starts on
    cycle(t, D, 10, o.seed, (r) => r.range(0.8, 1.3), (age, Lf, r) => {
      const x = FROM + r.range(0, SPAN), rad = Math.sqrt(r.next()) * DISC, a = r.range(0, TAU), y = VY + Math.cos(a) * rad - age * 18, z = Math.sin(a) * rad, u = age / Lf;
      q.dot(x, y, z, S[2], (1 - u) * 0.8);
      glows.push([x, y, z, 4, S[1], 0.2 * (1 - u)]);
    });
    // translucent tails, far to near
    for (const e of q.sort(tails, (e) => [e.x, e.y, e.z])) q.disc(e.x, e.y, e.z, e.r, e.c, e.a);
    // light: the crystal's glow, a pool of it on the floor, and the glows of everything that burns
    q.glow(0, y0, 0, 30 + 14 * f, C[5], 0.5 + 0.5 * f);
    q.glow(0, y0 + 1, 0, 12, WHITE, 0.25 + 0.6 * f);
    q.glow(10, VY, 0, 40, C[4], 0.22);
    for (const g of glows) q.glow(...g);
    q.plane(0, 0, 0, null, 44, (u, v, out) => {
      const d = 1 - Math.hypot(u, v) / 44;
      if (d <= 0) return;
      out.l = C[4];
      out.k = d * d * (0.14 + 0.2 * f);
    });
    q.at(0, y0, 0, (pp) => halo(pp, 0, 0, 4, 22, C[6], 0.25 * f));
    // the crystal is black: its facets keep most of their own colour under all that light
    const L = p.L;
    for (const [sx, sy, , , gap] of cells) {
      if (sx < p.ox || sy < p.oy || sx >= p.ox + p.w || sy >= p.oy + p.h) continue;
      const i = (sy - p.oy) * p.w + (sx - p.ox), d = L[i];
      if (!d) continue;
      const keep = gap < 0.8 ? 0.7 : 0.3 + 0.2 * f;
      L[i] = (255 << 24) | ((((d >>> 16) & 255) * keep) << 16) | ((((d >>> 8) & 255) * keep) << 8) | ((d & 255) * keep);
    }
  },
};
