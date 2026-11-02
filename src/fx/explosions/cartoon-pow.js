import { Particles, P, Rng, fit, sparkle, clamp, smooth, ease, rand, TAU, WHITE, hex, space } from "../../core/index.js";
import { cull, pool3 } from "./_lib.js";

export const meta = {
  name: "Cartoon POW",
  desc: "A comic-book hit: a jagged two-tone burst star slams in with a shake and boiling edges, POW! drops in letter by letter, action lines fly, then it all snaps away.",
  tags: ["cartoon", "comic", "pow", "hit", "impact", "text", "one-shot"],
  size: [184, 144],
  origin: [92, 72],
  duration: 1.05,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1a0e14", "#6e1a12", "#c8361a", "#f47a24", "#ffc23c", "#fff07a", "#ffffff"], text: "POW!", seed: 5 },
};

const N = 14, IN = 0.05, GO = 0.66, END = 0.8;

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), INK = C[0];
  const ps = new Particles({ rng: R, sparks: [C[6], C[5], C[4], C[3]] });
  // the star's spikes: long and short in turn, each its own length, boiling a little every few frames
  const spikes = Array.from({ length: N * 2 }, (_, i) => ({ r: i % 2 ? R.range(0.5, 0.6) : R.range(0.85, 1.05), j: R.next() * 100 }));
  const lines = Array.from({ length: 16 }, (_, i) => ({ a: ((i + R.range(0.2, 0.8)) / 16) * TAU, r: R.range(0.92, 1.08), L: R.range(10, 17), t0: R.range(0, 0.06) }));
  let t = 0, popped = false, burst = false;
  return {
    update(dt) {
      t += dt;
      if (!burst && t >= IN) {
        burst = true;
        for (let i = 0; i < 22; i++) {
          const a = R.range(0, TAU), sp = R.range(180, 360);
          ps.spawn(P.SPARK, Math.cos(a) * 14, Math.sin(a) * 10, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.12, 0.3));
        }
      }
      // it snaps away into a scatter of little stars
      if (!popped && t >= GO) {
        popped = true;
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), sp = R.range(60, 150);
          ps.spawn(P.STAR, Math.cos(a) * 26, Math.sin(a) * 18, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.42), R.pick([C[6], C[5], C[4]]), R.range(1.2, 2.4));
        }
      }
      ps.update(dt);
      cull(ps, -meta.origin[0] + 3, -meta.origin[1] + 3, meta.size[0] - meta.origin[0] - 3, meta.size[1] - meta.origin[1] - 3);
    },
    draw(p) {
      const k = clamp(t / IN);
      // the slam: it punches in past full size, shudders and settles; then it squeezes and snaps away
      const s = t < IN ? 0.25 + 0.95 * ease.outCubic(k) : t < GO ? 1 + 0.18 * Math.exp(-(t - IN) * 18) * Math.cos((t - IN) * 40) : 1 - ease.inBack(clamp((t - GO) / (END - GO)), 2);
      const shake = t < 0.3 ? (1 - t / 0.3) * 2.2 : 0, sx = Math.round(Math.sin(t * 97) * shake), sy = Math.round(Math.cos(t * 83) * shake);
      if (s > 0.02) {
        // the burst star, in one pass: its edge at each angle runs straight from spike tip to notch. An inked edge, a
        // yellow body with halftone dots on its shaded side, an inked orange heart and a yellow core
        const boil = Math.floor(t * 12), outer = 50 * s, rot = -0.1 + (t > GO ? (t - GO) * 3 : 0), M = N * 2;
        const rad = spikes.map((q, i) => q.r * (1 + (rand(i, boil, 7) - 0.5) * 0.08));
        p.shade(sx - outer - 4, sy - outer - 4, sx + outer + 4, sy + outer + 4, (x, y) => {
          const dx = x - sx, dy = (y - sy) / 0.82, d = Math.hypot(dx, dy);
          let u = (((Math.atan2(dy, dx) - rot) / TAU) % 1 + 1) % 1 * M;
          const i = Math.floor(u) % M, f = u - Math.floor(u), r = rad[i] + (rad[(i + 1) % M] - rad[i]) * f, e = d / r;
          if (e > outer + 2.5) return;
          if (e > outer) return INK;
          if (e > outer * 0.66 + 2) return dx * 0.6 + dy * 0.8 > outer * 0.25 && (Math.floor(x) + Math.floor(y) * 2) % 4 === 0 && Math.floor(y) % 2 === 0 ? C[4] : C[5];
          if (e > outer * 0.66) return INK;
          return e > outer * 0.44 ? C[3] : C[4];
        });
        p.glow(sx, sy, outer * 1.3, C[5], 0.3 * Math.min(1, s));
      }
      // action lines flying out, and a ring of impact
      for (const q of lines) {
        const u = (t - IN - q.t0) / 0.32;
        if (u <= 0 || u >= 1) continue;
        const r0 = (46 + 22 * ease.outCubic(u)) * q.r, L = q.L * 0.7 * (1 - u), ca = Math.cos(q.a), sa = Math.sin(q.a) * 0.82;
        p.line(ca * r0, sa * r0, ca * (r0 + L), sa * (r0 + L), (v) => (v < 0.5 ? WHITE : C[5]));
      }
      const ru = (t - IN) / 0.24;
      if (ru > 0 && ru < 1) p.ring(0, 0, 30 + 34 * ease.outCubic(ru), Math.max(1, 2.5 * (1 - ru)), ru < 0.4 ? WHITE : C[5], 1.1 - ru);
      // the word: letters dropping in one after another, inked, with a deep red extrusion, then a squash as it goes
      const word = String(o.text ?? "POW!"), scale = 3, widths = [...word].map((ch) => p.measure(ch, { font: "big", scale })[0]);
      let x = -(widths.reduce((a, w) => a + w + scale, -scale)) / 2;
      [...word].forEach((ch, i) => {
        const u = (t - IN - 0.04 - i * 0.05) / 0.12, away = clamp((t - GO) / (END - GO - 0.04));
        if (u > 0 && away < 1) {
          const drop = (1 - ease.outBack(clamp(u), 2.4)) * -14, y = Math.round(-11 + drop - i * 1.5 + sy + away * 6);
          const lx = Math.round(x + sx), a = 1 - away;
          // a thick ink edge, a deep red extrusion, a white face going warm toward its foot
          for (let d = 4; d >= 1; d--) p.text(ch, lx + d, y + d, d >= 3 ? INK : C[1], { font: "big", scale, a, outline: d === 4 ? INK : undefined });
          for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) p.text(ch, lx + ox, y + oy, INK, { font: "big", scale, a });
          p.text(ch, lx, y, (gx, gy) => (gy < 4 ? C[6] : gy < 6 ? C[5] : C[4]), { font: "big", scale, a });
        }
        x += widths[i] + scale;
      });
      ps.draw(p);
      if (t > IN && t < IN + 0.12) sparkle(p, sx + 34, sy - 22, 6 * (1 - (t - IN) / 0.12), C[6], C[5], 0.6);
    },
  };
}

// ---- 3D: the burst is a real spiked ball (a toon-shaded core and ~40 inked cones in a full sphere, long and short in
// turn, boiling, turning slowly about the vertical), the action lines are 3D beams flying out every way, an impact ring
// lies on the floor and another circles the burst. The word is a billboard in front of it, so it reads from any side.

// a cone of base width w from (x0, y0, z0) to its tip (x1, y1, z1): a toon-shaded, inked solid with a depth per pixel;
// col(f, s, lit, sx, sy) gets f along it, s across (-1..1), lit towards the light and the pixel
function cone(q, x0, y0, z0, x1, y1, z1, w, col) {
  if (!q.project(x0, y0, z0)) return;
  const ax = q.x, ay = q.y, ad = q.d, ra = (w / 2) * q.k;
  if (!q.project(x1, y1, z1)) return;
  const bx = q.x, by = q.y, bd = q.d, p = q.p, zp = p.z, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, L = Math.sqrt(L2);
  const nx = -dy / L, ny = dx / L, side = -0.6 * nx - 0.8 * ny;
  p.each(Math.min(ax, bx) - ra, Math.min(ay, by) - ra, Math.max(ax, bx) + ra, Math.max(ay, by) + ra, (lx, ly, sx, sy) => {
    const f = clamp(((lx - ax) * dx + (ly - ay) * dy) / L2), rr = Math.max(ra * (1 - f), 0.6), c = (lx - ax - dx * f) * nx + (ly - ay - dy * f) * ny, s = c / rr;
    if (Math.abs(s) > 1) return;
    p.z = ad + (bd - ad) * f - Math.sqrt(1 - s * s) * (w / 2) * (1 - f);
    p.put(sx, sy, col(f, s, s * side, rr, sx, sy), 1);
  });
  p.z = zp;
}

// the word, as in 2D: letters dropping in one after another, inked, a deep red extrusion, a white face going warm
function drawWord(p, o, C, t, sx, sy) {
  const INK = C[0], word = String(o.text ?? "POW!"), scale = 3, widths = [...word].map((ch) => p.measure(ch, { font: "big", scale })[0]);
  let x = -(widths.reduce((a, w) => a + w + scale, -scale)) / 2;
  [...word].forEach((ch, i) => {
    const u = (t - IN - 0.04 - i * 0.05) / 0.12, away = clamp((t - GO) / (END - GO - 0.04));
    if (u > 0 && away < 1) {
      const drop = (1 - ease.outBack(clamp(u), 2.4)) * -14, y = Math.round(-11 + drop - i * 1.5 + sy + away * 6);
      const lx = Math.round(x + sx), a = 1 - away;
      for (let d = 4; d >= 1; d--) p.text(ch, lx + d, y + d, d >= 3 ? INK : C[1], { font: "big", scale, a, outline: d === 4 ? INK : undefined });
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) p.text(ch, lx + ox, y + oy, INK, { font: "big", scale, a });
      p.text(ch, lx, y, (gx, gy) => (gy < 4 ? C[6] : gy < 6 ? C[5] : C[4]), { font: "big", scale, a });
    }
    x += widths[i] + scale;
  });
}

export const three = {
  meta: { size: [200, 200], origin: [100, 160], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), R = new Rng(o.seed), INK = C[0], CY = -62, floor = () => 0;
    const [W, H] = three.meta.size, [OX, OY] = three.meta.origin, RX = OX - 4, Y0 = -OY + 3, Y1 = H - OY - 3;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] });
    const dirOf = () => {
      const y = R.range(-1, 1), r = Math.sqrt(1 - y * y), a = R.range(0, TAU);
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    // the spikes: a spread of directions over a whole sphere, long and short in turn, each its own length
    const M = 26, spikes = Array.from({ length: M }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / M, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      return { d: [Math.cos(a) * r, y, Math.sin(a) * r], r: i % 2 ? R.range(0.72, 0.84) : R.range(1.0, 1.14), j: R.next() * 100 };
    });
    // the action lines, out in every direction; none that would end below the floor
    const lines = Array.from({ length: 30 }, () => ({ d: dirOf(), r: R.range(0.92, 1.08), L: R.range(10, 17), t0: R.range(0, 0.06) }));
    let t = 0, popped = false, burst = false;
    const keep = () => {
      const L = ps.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const q = L[i];
        if (q.y < Y0 || q.y > Y1 - 14 || Math.hypot(q.x, q.z) > RX) L.splice(i, 1);
      }
    };
    const shake = () => {
      const a = t < 0.3 ? (1 - t / 0.3) * 2.2 : 0;
      return [Math.round(Math.sin(t * 97) * a), Math.round(Math.cos(t * 83) * a), Math.round(Math.sin(t * 71) * a)];
    };
    return {
      update(dt) {
        t += dt;
        const [sx, sy, sz] = shake();
        if (!burst && t >= IN) {
          burst = true;
          for (let i = 0; i < 30; i++) {
            const [dx, dy, dz] = dirOf(), sp = R.range(180, 360);
            ps.spawn3(P.SPARK, dx * 14, CY + dy * 12, dz * 14, dx * sp, dy * sp, dz * sp, R.range(0.12, 0.3));
          }
        }
        if (!popped && t >= GO) {
          popped = true;
          for (let i = 0; i < 20; i++) {
            const [dx, dy, dz] = dirOf(), sp = R.range(60, 150);
            ps.spawn3(P.STAR, dx * 26 + sx, CY + dy * 22 + sy, dz * 26 + sz, dx * sp, dy * sp, dz * sp, R.range(0.25, 0.42), R.pick([C[6], C[5], C[4]]), R.range(1.2, 2.4));
          }
        }
        ps.update(dt);
        keep();
      },
      draw(p) {
        const q = space(p, o), k = clamp(t / IN);
        const s = t < IN ? 0.25 + 0.95 * ease.outCubic(k) : t < GO ? 1 + 0.18 * Math.exp(-(t - IN) * 18) * Math.cos((t - IN) * 40) : 1 - ease.inBack(clamp((t - GO) / (END - GO)), 2);
        const [sx, sy, sz] = shake(), cx = sx, cy = CY + sy, cz = sz;
        const outer = 44 * s;
        if (s > 0.02) {
          // the slam: a turn about the vertical, quicker as it goes
          const boil = Math.floor(t * 12), rot = -0.1 + 0.9 * t + (t > GO ? (t - GO) * 3 : 0), cr = Math.cos(rot), sr = Math.sin(rot), rc = outer * 0.5;
          // the core: a toon-shaded ball with an ink edge, an orange heart and a hot highlight
          q.ball(cx, cy, cz, rc, (nx, ny, nz) => {
            if (nz < 0.12) return INK;
            const l = -0.5 * nx - 0.6 * ny + 0.4 * nz;
            return l > 0.62 ? C[5] : l > 0.1 ? C[4] : C[3];
          });
          const base = rc * 0.7;
          for (let i = 0; i < M; i++) {
            const sp = spikes[i], len = outer * sp.r * (1 + (rand(i, boil, 7) - 0.5) * 0.08);
            const [dx0, dy, dz0] = sp.d, dx = dx0 * cr + dz0 * sr, dz = -dx0 * sr + dz0 * cr;
            const x0 = cx + dx * rc * 0.78, y0 = cy + dy * rc * 0.78, z0 = cz + dz * rc * 0.78, x1 = cx + dx * len, y1 = cy + dy * len, z1 = cz + dz * len;
            // spikes that point away sit a step deeper in colour
            const far = q.depth(x1, y1, z1) - q.depth(cx, cy, cz) > 8;
            cone(q, x0, y0, z0, x1, y1, z1, base * (0.8 + 0.4 * sp.r), (f, sv, lit, rr, px, py) => {
              if (rr > 1.7 && Math.abs(sv) * rr > rr - 1.2) return INK;
              if (lit < -0.5) return far ? C[3] : C[4];
              const dot = lit < -0.1 && (Math.floor(px) + Math.floor(py) * 2) % 4 === 0 && Math.floor(py) % 2 === 0;
              return far ? (dot ? C[3] : C[4]) : dot ? C[4] : C[5];
            });
          }
          q.glow(cx, cy, cz, outer * 1.35, C[5], 0.3 * Math.min(1, s));
        }
        // action lines: beams out through the burst, and a ring of impact on the floor and round it
        for (const l of lines) {
          const u = (t - IN - l.t0) / 0.32;
          if (u <= 0 || u >= 1) continue;
          const r0 = (52 + 18 * ease.outCubic(u)) * l.r, L = l.L * 0.7 * (1 - u), [dx, dy, dz] = l.d;
          let r1 = r0 + L;
          if (dy > 0.001) r1 = Math.min(r1, (-3 - cy) / dy);
          if (r1 <= r0 + 1) continue;
          q.beam(cx + dx * r0, cy + dy * r0, cz + dz * r0, cx + dx * r1, cy + dy * r1, cz + dz * r1, 1.6, (v) => (v < 0.5 ? WHITE : C[5]));
        }
        const ru = (t - IN) / 0.24;
        if (ru > 0 && ru < 1) {
          const e = ease.outCubic(ru), c = ru < 0.4 ? WHITE : C[5], w = Math.max(1, 2.5 * (1 - ru)), a = 1.1 - ru;
          q.ring(0, 0, 0, 30 + 44 * e, w * 1.2 + 1, c, a);
          q.at(cx, cy, cz, (pp, kk) => pp.ring(0, 0, (30 + 34 * e) * kk, w, c, a));
        }
        // the word in front of it all: letters as a billboard, so it reads from every side
        q.at(cx, cy, cz, (pp, kk) => {
          pp.z -= outer * 1.2 + 10;
          drawWord(pp, o, C, t, 0, 0);
          // the gleam of the slam, top right of the burst
          if (t > IN && t < IN + 0.12) sparkle(pp, 34 * kk, -22 * kk, 6 * (1 - (t - IN) / 0.12), C[6], C[5], 0.6);
        });
        if (s > 0.02) {
          // the burst's shadow on the floor, and the light it throws
          const Rs = 30 * Math.min(1, s);
          q.plane(cx, 0, cz, null, Rs, (u, v, out) => {
            const f = 1 - Math.hypot(u, v) / Rs;
            if (f <= 0) return;
            out.c = INK;
            out.a = Math.min(1, f * 2) * 0.45;
            out.blend = true;
          });
          pool3(q, 44, C[4], 0.25 * Math.min(1, s));
        }
        ps.draw(q);
      },
    };
  },
};
