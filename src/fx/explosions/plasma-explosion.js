// The release (flash, rings, flare, light) and the arcs are adapted from Sprite Fusion's open-source energy
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, rng, fit, band, bolt, forks, flare, sparkle, clamp, smooth, ease, noise, space, TAU, WHITE } from "../../core/index.js";
import { cull } from "./_lib.js";

export const meta = {
  name: "Plasma explosion",
  desc: "A blue-violet energy blast with no smoke: a white flash, a ball of plasma swelling into a thinning shell, shock rings in and out of depth, lightning arcs crackling off it.",
  tags: ["explosion", "plasma", "energy", "electric", "magic", "sci-fi", "one-shot"],
  size: [224, 200],
  origin: [112, 100],
  duration: 1.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0a0828", "#1a1c6e", "#2c3cc0", "#4a7cf0", "#7cc0ff", "#c8ecff", "#ffffff"],
    accent: ["#1c0a30", "#4a1a8c", "#8a3ce0", "#c48cff", "#f0d8ff"],
    seed: 7,
  },
};

const BALL = 0.55;

export function create(o) {
  const C = fit(o.palette, 7), V = fit(o.accent, 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [C[6], C[5], C[4], V[3]] }), lights = new Lights();
  lights.add(0, 0, 96, C[4], 1, 0.6);
  lights.add(0, 0, 40, WHITE, 0.9, 0.1);
  lights.add(0, 0, 70, V[2], 0.5, 1.1);
  for (let i = 0; i < 46; i++) {
    const a = R.range(0, TAU), sp = R.range(140, 360);
    ps.spawn(P.MOTE, Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.42), R.pick([C[6], C[5], C[4], V[3]]), R.range(0.7, 1.1));
  }
  for (let i = 0; i < 26; i++) {
    const a = R.range(0, TAU), sp = R.range(40, 140);
    ps.spawn(P.FLAKE, Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.5), R.pick([C[5], V[3], V[4]]), R.range(0.6, 1.6));
  }
  let t = 0;
  return {
    update(dt) {
      t += dt;
      // the shell sheds sparkles and motes as it thins
      if (t > 0.12 && t < 0.9 && R.chance(30 * dt)) {
        const a = R.range(0, TAU), r = shell(t);
        ps.spawn(P.STAR, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * R.range(10, 40), Math.sin(a) * R.range(10, 40), R.range(0.3, 0.6), R.chance(0.5) ? C[5] : V[4], R.range(0.5, 1.8));
      }
      ps.update(dt);
      cull(ps, -meta.origin[0] + 3, -meta.origin[1] + 3, meta.size[0] - meta.origin[0] - 3, meta.size[1] - meta.origin[1] - 3);
      lights.update(dt);
    },
    drawBack(p) {
      // the tilted ring's far half, behind the ball
      tilted(p, t, C, V, true);
    },
    draw(p) {
      // the ball: a white heart, cyan and blue bands, a violet rim boiling at the edge; it swells, then hollows out
      if (t < BALL) {
        const u = t / BALL, r = shell(t), hollow = smooth(0.35, 1, u), boil = Math.floor(t * 20);
        p.shade(-r - 3, -r - 3, r + 3, r + 3, (x, y, out) => {
          const d = Math.hypot(x, y), a = Math.atan2(y, x), edge = r * (1 + 0.1 * noise(a * 3 + boil * 0.7, 3));
          if (d > edge) return;
          const v = d / edge;
          if (v < hollow * 0.92) return;
          // turbulent bands swirling round the heart, and bright filaments twisting through them
          const n = noise(a * 4 + d * 0.25 + boil * 0.5, 5), w = v + n * 0.14, fil = Math.abs(Math.sin(a * 5 + d * 0.32 - t * 14 + n * 2.5)) < 0.1;
          out.k = 0.25 * (1 - u);
          if (v > 0.9) return V[2];
          if (fil && v > 0.3) return u < 0.5 ? WHITE : C[5];
          return w < 0.32 - u * 0.25 ? WHITE : w < 0.52 ? C[5] : w < 0.72 ? C[4] : w < 0.86 ? (u < 0.5 ? C[3] : V[3]) : V[2];
        });
        p.glow(0, 0, r * 1.6 + 6, C[4], 0.6 * (1 - u));
      }
      if (t < 0.07) p.circle(0, 0, 9 - t * 60, WHITE);
      if (t < 0.25) flare(p, 0, 0, 52 * Math.pow(1 - t / 0.25, 1.3), 1 - t / 0.25, C);
      // shock rings: a fast bright one, a slower violet one
      const u1 = t / 0.42;
      if (u1 < 1) {
        p.ring(0, 0, 8 + 84 * ease.outCubic(u1), Math.max(1, 3 * (1 - u1)), u1 < 0.25 ? WHITE : C[5], 1.15 - u1);
        p.glowRing(0, 0, 8 + 84 * ease.outCubic(u1), 5, C[4], 0.35 * (1 - u1));
      }
      const u2 = (t - 0.06) / 0.6;
      if (u2 > 0 && u2 < 1) p.ring(0, 0, 6 + 60 * ease.outCubic(u2), Math.max(1, 2 * (1 - u2)), V[3], 1.1 - u2);
      // arcs: lightning crackling out of the heart, re-struck every few frames, shorter as the charge runs out
      const left = 1 - smooth(0.15, 0.85, t), strike = Math.floor(t * 18);
      if (left > 0) {
        const r = rng(o.seed, strike, 17), n = 2 + Math.round(4 * left);
        for (let i = 0; i < n; i++) {
          const a = r.range(0, TAU), L = r.range(26, 58) * (0.45 + 0.55 * left), path = bolt(r, 0, 0, Math.cos(a) * L, Math.sin(a) * L, { jag: 0.28, depth: 4 });
          arc(p, path, C, V, 0.8 * left);
          if (r.chance(0.5)) for (const f of forks(r, path, { count: 1, len: 14, jag: 0.35 })) arc(p, f, C, V, 0.5 * left);
        }
        // and little arcs crawling over the shell
        const rs = shell(t);
        for (let i = 0; i < 3; i++) {
          const a = r.range(0, TAU), b = a + r.range(0.3, 0.6);
          arc(p, bolt(r, Math.cos(a) * rs, Math.sin(a) * rs, Math.cos(b) * rs, Math.sin(b) * rs, { jag: 0.4, depth: 3 }), C, V, 0.6 * left);
        }
      }
      tilted(p, t, C, V, false);
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// the ball's radius: punched out fast, then easing
function shell(t) {
  return 5 + 30 * ease.outCubic(clamp(t / BALL));
}

// a ring on a tilted plane racing out round the blast: far half behind, near half in front
function tilted(p, t, C, V, back) {
  const u = (t - 0.03) / 0.5;
  if (u <= 0 || u >= 1) return;
  band(p, 0, 4, 12 + 86 * ease.outCubic(u), 0.28, Math.max(1, 4 * (1 - u)), 1.15 - u, [V[1], V[2], C[4], C[5]], (g) => (Math.sin(g) < 0) === back, u < 0.15);
}

// one arc: a soft glow along it, a cyan halo line, a white core
function arc(p, path, C, V, k) {
  if (k <= 0.05) return;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    p.glowLine(ax, ay, bx, by, 5, V[2], 0.18 * k);
    p.line(ax + 1, ay, bx + 1, by, C[4], k * 0.8);
    p.line(ax, ay, bx, by, i < path.length * 0.6 ? WHITE : C[5], Math.min(1, k * 1.4));
  }
}

// ---- 3D: a ball of plasma whose swirls and filaments are painted on the sphere itself, thinning into a lace of shell;
// bolts and forks that branch out through x, y and z; two shock spheres (a rim facing us, and a great circle through
// each, so they turn) and a tilted ring racing out round the blast; sparks in every direction.
export const three = {
  meta: { size: [224, 208], origin: [112, 104], camera: { pitch: 0.25 } },
  create(o) {
    const C = fit(o.palette, 7), V = fit(o.accent, 5), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, sparks: [C[6], C[5], C[4], V[3]] }), lights = new Lights();
    lights.add(0, 0, 96, C[4], 1, 0.6, 0);
    lights.add(0, 0, 40, WHITE, 0.9, 0.1, 0);
    lights.add(0, 0, 70, V[2], 0.5, 1.1, 0);
    const sph = () => {
      const y = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - y * y);
      return [Math.cos(a) * s, y, Math.sin(a) * s];
    };
    for (let i = 0; i < 46; i++) {
      const d = sph(), sp = R.range(140, 360);
      ps.spawn3(P.MOTE, d[0] * 4, d[1] * 4, d[2] * 4, d[0] * sp, d[1] * sp, d[2] * sp, R.range(0.2, 0.42), R.pick([C[6], C[5], C[4], V[3]]), R.range(0.7, 1.1));
    }
    for (let i = 0; i < 26; i++) {
      const d = sph(), sp = R.range(40, 140);
      ps.spawn3(P.FLAKE, d[0] * 10, d[1] * 10, d[2] * 10, d[0] * sp, d[1] * sp, d[2] * sp, R.range(0.8, 1.5), R.pick([C[5], V[3], V[4]]), R.range(0.6, 1.6));
    }
    let t = 0;
    return {
      update(dt) {
        t += dt;
        // the shell sheds sparkles and motes as it thins
        if (t > 0.12 && t < 0.9 && R.chance(30 * dt)) {
          const d = sph(), r = shell(t), v = R.range(10, 40);
          ps.spawn3(P.STAR, d[0] * r, d[1] * r, d[2] * r, d[0] * v, d[1] * v, d[2] * v, R.range(0.3, 0.6), R.chance(0.5) ? C[5] : V[4], R.range(0.5, 1.8));
        }
        ps.update(dt);
        // nothing may leave the canvas, whichever side it is seen from
        const L = ps.list;
        for (let i = L.length - 1; i >= 0; i--) if (Math.hypot(L[i].x, L[i].y, L[i].z) > 96) L.splice(i, 1);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), glows = [];
        // the ball, painted on a sphere
        if (t < BALL) {
          const u = t / BALL, r = shell(t);
          plasmaBall(q, t, u, r, C, V);
          glows.push(() => q.glow(0, 0, 0, r * 1.6 + 6, C[4], 0.6 * (1 - u)));
        }
        if (t < 0.07) q.ball(0, 0, 0, 9 - t * 60, WHITE);
        // arcs: lightning crackling out of the heart, re-struck every few frames, shorter as the charge runs out
        const left = 1 - smooth(0.15, 0.85, t), strike = Math.floor(t * 18);
        if (left > 0) {
          const r = rng(o.seed, strike, 17), n = 2 + Math.round(4 * left), right = [q.cy, 0, -q.sy];
          const unit = () => {
            const y = r.range(-1, 1), a = r.range(0, TAU), s = Math.sqrt(1 - y * y);
            return [Math.cos(a) * s, y, Math.sin(a) * s];
          };
          for (let i = 0; i < n; i++) {
            const d = unit(), L = r.range(26, 58) * (0.45 + 0.55 * left), path = bolt3(r, [0, 0, 0], [d[0] * L, d[1] * L, d[2] * L], 0.28, 4);
            arc3(q, path, C, V, 0.8 * left, right, glows);
            if (r.chance(0.5)) for (const f of forks3(r, path, { count: 1, len: 14, jag: 0.35 })) arc3(q, f, C, V, 0.5 * left, right, glows);
          }
          // and little arcs crawling over the shell
          const rs = shell(t) * 1.05 + 0.5;
          for (let i = 0; i < 3; i++) {
            const a = unit(), s = unit(), w = r.range(0.3, 0.6);
            // b: a on the sphere nudged sideways by about w radians
            let bx = a[0] + s[0] * w, by = a[1] + s[1] * w, bz = a[2] + s[2] * w;
            const bl = Math.hypot(bx, by, bz) || 1;
            arc3(q, bolt3(r, [a[0] * rs, a[1] * rs, a[2] * rs], [(bx / bl) * rs, (by / bl) * rs, (bz / bl) * rs], 0.4, 3), C, V, 0.6 * left, right, glows);
          }
        }
        // shock spheres: a fast bright one, a slower violet one: a rim facing us and a great circle through each
        const u1 = t / 0.42;
        if (u1 < 1) {
          const R1 = 8 + 84 * ease.outCubic(u1), w1 = Math.max(1, 3 * (1 - u1)), a1 = 1.15 - u1, c1 = u1 < 0.25 ? WHITE : C[5];
          q.at(0, 0, 0, (pp, k) => pp.ring(0, 0, R1 * k, w1, c1, a1));
          circle3(q, R1, 0.9, 1.15, 0, c1, a1 * 0.8);
          glows.push(() => q.at(0, 0, 0, (pp, k) => { pp.z -= 14; pp.glowRing(0, 0, R1 * k, 5, C[4], 0.35 * (1 - u1)); }));
        }
        const u2 = (t - 0.06) / 0.6;
        if (u2 > 0 && u2 < 1) {
          const R2 = 6 + 60 * ease.outCubic(u2), a2 = 1.1 - u2;
          q.at(0, 0, 0, (pp, k) => pp.ring(0, 0, R2 * k, Math.max(1, 2 * (1 - u2)), V[3], a2));
          circle3(q, R2, 1.9, 0.5, 0.4, V[3], a2 * 0.8);
        }
        tilted3(q, t, C, V);
        ps.draw(q);
        for (const g of glows) g();
        if (t < 0.25) flare3(q, 52 * Math.pow(1 - t / 0.25, 1.3), 1 - t / 0.25, C);
        lights.draw(q);
      },
    };
  },
};

// the ball painted on its own sphere: bands swirling round a white heart, bright filaments twisting through them, a violet
// rim boiling at the edge. The patterns follow the sphere (world normal), not the screen; as it ages the shell dissolves into lace.
function plasmaBall(q, t, u, r, C, V) {
  const hollow = smooth(0.35, 1, u), boil = Math.floor(t * 20), cp = q.cp, sp = q.sp, cy = q.cy, sy = q.sy;
  q.ball(0, 0, 0, r, (nx, ny, nz) => {
    // the normal in world space
    const wy = ny * cp - nz * sp, vz = ny * sp + nz * cp, wx = nx * cy + vz * sy, wz = vz * cy - nx * sy;
    const n = (noise(wx * 2.6 + boil * 0.5, 5) + noise(wy * 2.6 + boil * 0.37, 6) + noise(wz * 2.6 - boil * 0.45, 7)) * 0.55;
    const v = Math.sqrt(1 - nz * nz), w = v + n * 0.14, fil = Math.abs(Math.sin(wx * 5.5 + wy * 4.7 + wz * 3.1 - t * 14 + n * 2.5)) < 0.1;
    // the shell thins into lace: holes open in it, only its rim stays whole
    if (n < hollow * 2 - 0.85 && v < 0.84) return 0;
    if (v > 0.9) return V[2];
    if (fil && v > 0.3) return u < 0.5 ? WHITE : C[5];
    return w < 0.32 - u * 0.25 ? WHITE : w < 0.52 ? C[5] : w < 0.72 ? C[4] : w < 0.86 ? (u < 0.5 ? C[3] : V[3]) : V[2];
  });
}

// a great circle of radius R: the plane's axes are two perpendicular directions, built from a tilt and a turn
function circle3(q, R, tilt, turn, phase, c, a) {
  const e1 = [Math.cos(turn), 0, Math.sin(turn)], nx = Math.sin(tilt) * Math.cos(turn + Math.PI / 2), nz = Math.sin(tilt) * Math.sin(turn + Math.PI / 2), ny = -Math.cos(tilt);
  const e2 = [ny * e1[2], nz * e1[0] - nx * e1[2], -ny * e1[0]], pts = [];
  for (let i = 0; i <= 72; i++) {
    const g = (i / 72) * TAU + phase, cg = Math.cos(g) * R, sg = Math.sin(g) * R;
    pts.push([e1[0] * cg + e2[0] * sg, e1[1] * cg + e2[1] * sg, e1[2] * cg + e2[2] * sg]);
  }
  q.polyline(pts, c, a);
}

// a ring on a tilted plane racing out round the blast: the far half goes behind the ball, the near half in front
function tilted3(q, t, C, V) {
  const u = (t - 0.03) / 0.5;
  if (u <= 0 || u >= 1) return;
  const r = 12 + 86 * ease.outCubic(u), th = Math.max(1, 4 * (1 - u)), k = 1.15 - u, tilt = 0.35, n = [Math.sin(tilt), -Math.cos(tilt), 0];
  q.ring(0, 0, 0, r, th, (v) => (v > 0.85 ? (u < 0.15 ? WHITE : C[5]) : v > 0.6 ? C[4] : v > 0.3 ? V[2] : V[1]), (v) => k * (v > 0.6 ? 1.2 : 1.15 - (1 - v)), n);
}

// one arc: a soft glow along it, a cyan halo line, a white core
function arc3(q, path, C, V, k, right, glows) {
  if (k <= 0.05) return;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay, az] = path[i - 1], [bx, by, bz] = path[i];
    glows.push(() => q.glowLine(ax, ay, az, bx, by, bz, 5, V[2], 0.18 * k));
    q.line(ax + right[0], ay, az + right[2], bx + right[0], by, bz + right[2], C[4], k * 0.8);
    q.line(ax, ay, az, bx, by, bz, i < path.length * 0.6 ? WHITE : C[5], Math.min(1, k * 1.4));
  }
}

// a jagged lightning path from a to b by midpoint displacement, sideways in any direction
function bolt3(r, a, b, jag, depth) {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], B = pts[i], dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], L = Math.hypot(dx, dy, dz) || 1;
      let rx = r.next() * 2 - 1, ry = r.next() * 2 - 1, rz = r.next() * 2 - 1;
      const k = (rx * dx + ry * dy + rz * dz) / (L * L);
      (rx -= dx * k), (ry -= dy * k), (rz -= dz * k);
      const off = ((r.next() * 2 - 1) * jag * L) / (Math.hypot(rx, ry, rz) || 1);
      next.push([(A[0] + B[0]) / 2 + rx * off, (A[1] + B[1]) / 2 + ry * off, (A[2] + B[2]) / 2 + rz * off], B);
    }
    pts = next;
  }
  return pts;
}

// forks off a 3D bolt: each leaves a point of the path turned sideways by a random angle round the path
function forks3(r, path, { count = 3, len = 20, jag = 0.3, spread = 0.9 } = {}) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const i = 1 + Math.floor(r.next() * (path.length - 2)), P2 = path[i], Q = path[i - 1];
    let dx = P2[0] - Q[0], dy = P2[1] - Q[1], dz = P2[2] - Q[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    (dx /= L), (dy /= L), (dz /= L);
    let rx = r.next() * 2 - 1, ry = r.next() * 2 - 1, rz = r.next() * 2 - 1;
    const d = rx * dx + ry * dy + rz * dz;
    (rx -= dx * d), (ry -= dy * d), (rz -= dz * d);
    const rl = Math.hypot(rx, ry, rz) || 1, ang = spread * (0.4 + 0.6 * r.next()), l = len * (0.4 + 0.6 * r.next());
    const fx = dx * Math.cos(ang) + (rx / rl) * Math.sin(ang), fy = dy * Math.cos(ang) + (ry / rl) * Math.sin(ang), fz = dz * Math.cos(ang) + (rz / rl) * Math.sin(ang);
    out.push(bolt3(r, P2, [P2[0] + fx * l, P2[1] + fy * l, P2[2] + fz * l], jag, 3));
  }
  return out;
}

// the 8-ray flare in space: long rays out along the horizontal axes, shorter up and down, short ones out of the corners
function flare3(q, L, k, C) {
  if (L < 1) return;
  const dirs = [];
  for (let i = 0; i < 4; i++) dirs.push([Math.cos((i * TAU) / 4), 0, Math.sin((i * TAU) / 4), L]);
  dirs.push([0, -1, 0, L * 0.6], [0, 1, 0, L * 0.6]);
  for (let i = 0; i < 8; i++) dirs.push([(i & 1 ? 1 : -1) * 0.58, (i & 2 ? 1 : -1) * 0.58, (i & 4 ? 1 : -1) * 0.58, L * 0.3]);
  for (const [dx, dy, dz, len] of dirs) {
    for (let d = 0; d <= len; d += 0.5) {
      const w = d / len;
      q.dot(dx * d, dy * d, dz * d, w < 0.35 ? WHITE : w < 0.7 ? C[5] : C[4], w < 0.6 ? 1 : k * 1.5 * (1 - w) + 0.2);
    }
  }
}
