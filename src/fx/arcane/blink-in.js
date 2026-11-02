// The arrival (bits converging, a line of light that opens into the silhouette, a ring on the floor, a burst of
// stars) is adapted from Sprite Fusion's open-source blink (https://www.spritefusion.com/pixel-art-vfx/movement),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, PAL, fit, band, flare, sparkle, clamp, ease, rand, TAU, WHITE, READY, space } from "../../core/index.js";
import { shades, squeezed } from "./_lib.js";

const LINE = 0.26, GROW = 0.1, OPEN = 0.12, ARRIVE = LINE + GROW + OPEN;

export const meta = {
  name: "Blink in",
  desc: "Glittering bits spiral in to a point of light that opens into a line, then into a white silhouette that cools into the caster.",
  tags: ["arcane", "blink", "teleport", "appear", "movement", "magic", "one-shot"],
  size: [136, 96],
  origin: [68, 80],
  duration: 1.4,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: PAL.arcane, seed: 12 },
};

const LANDED = { crouch: 7, lean: 3, fx: 9, fy: -12, bx: 12, by: -12, ffx: 8, fbx: -6 };
export const act = {
  onBody: true,
  poses: [
    [0, LANDED],
    [0.48, LANDED],
    [0.56, { ...LANDED, crouch: 6 }, "snap"],
    [0.95, READY],
    [1.4, READY],
  ],
  hits: [{ t: 0.48, stop: 0.03, shake: 0.1, amp: 1 }],
  dust: [{ t: 0.48, x: 0, n: 7 }],
};

/** The stand-in character appears once the silhouette has opened. */
export const actorAlpha = (t) => (t < ARRIVE ? 0 : 1);

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), A = o.actor, sh = shades(A);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  const mx = A.x + A.w / 2, my = A.y + A.h * 0.55, COLS = [WHITE, C[6], C[6], C[5], C[4]];
  const inside = (x, y) => x >= 0 && y >= 0 && x < A.w && y < A.h && A.mask.data[y * A.w + x];
  // the bits: each spirals in from its own spot to a point on the line, arriving as the line forms
  const bits = Array.from({ length: 230 }, () => {
    const a = R.range(0, TAU), d = R.range(16, 46), ty = A.y + R.range(3, A.h - 2);
    let oy = Math.sin(a) * d * 0.8 - 6;
    if (ty + oy > -2) oy = -Math.abs(oy) - 2; // none start under the floor
    return { tx: mx + R.range(-1, 1), ty, ox: Math.cos(a) * d, oy, t0: R.range(0, 0.1), t1: LINE + R.range(-0.02, GROW), spin: R.range(0.8, 1.8) * R.sign(), c: R.pick(COLS) };
  });
  let t = 0, arrived = false;
  const at = (b, tt) => {
    const k = clamp((tt - b.t0) / (b.t1 - b.t0)), e = ease.outCubic(k), r = 1 - e, sp = b.spin * r * 1.2;
    const ox = b.ox * Math.cos(sp) - b.oy * Math.sin(sp), oy = b.ox * Math.sin(sp) + b.oy * Math.cos(sp);
    return [b.tx + ox * r, Math.min(-1, b.ty + oy * r), k];
  };

  return {
    update(dt) {
      t += dt;
      if (t < LINE && R.chance(0.6)) {
        const a = R.range(0, TAU), D = R.range(22, 44), T = R.range(0.12, 0.18), v = (D * 3) / (Math.exp(3 * T) - 1);
        const x = mx + Math.cos(a) * D, y = Math.min(-2, my + Math.sin(a) * D), l = Math.hypot(x - mx, y - my) || 1;
        ps.spawn(P.STREAK, x, y, ((mx - x) / l) * v, ((my - y) / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
      }
      if (!arrived && t >= ARRIVE) {
        arrived = true;
        lights.add(mx, my - 6, 56, C[5], 0.9, 0.35);
        lights.add(mx, my, 24, WHITE, 0.8, 0.1);
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), sp = R.range(35, 110);
          ps.spawn(R.chance(0.6) ? P.STAR : P.MOTE, mx, my, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 30, R.range(0.4, 0.85), R.pick(COLS), R.range(0.6, 1.6));
        }
        for (let i = 0; i < 12; i++) {
          const s = R.sign();
          ps.spawn(P.SPARK, mx + s * R.range(2, 8), -1, s * R.range(60, 180), -R.range(20, 110), R.range(0.2, 0.45));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const k = (t - ARRIVE + 0.03) / 0.5;
      if (k >= 0 && k < 1) band(p, 0, 0, 4 + 30 * ease.outCubic(k), 0.2, Math.max(1, 3 * (1 - k)), 1.15 - k, [C[3], C[5], C[6], WHITE], (g) => Math.sin(g) < 0, k < 0.25);
      p.glow(0, -1, 26, C[5], 0.3 * (t < ARRIVE ? t / ARRIVE : 1 - clamp((t - ARRIVE) / 0.5)));
    },
    draw(p) {
      // the bits rushing in, streaking as they speed up, white as they land
      for (const b of bits) {
        if (t < b.t0 || t > b.t1 + 0.02) continue;
        const [x, y, k] = at(b, t);
        p.dot(x, y, k > 0.75 ? WHITE : b.c, Math.min(1, 0.35 + k * 2));
        // a short tail once they're rushing
        if (k > 0.55) {
          const [px, py] = at(b, t - 0.015);
          p.dot((x + px) / 2, (y + py) / 2, C[5], 0.8);
        }
        if (k > 0.8) p.glow(x, y, 3, C[6], 0.3);
      }
      if (t >= LINE - 0.04 && t < LINE) {
        // a point of light where it gathers
        const q = (t - LINE + 0.04) / 0.04;
        sparkle(p, mx, my, 2 + 3 * q, C[6], C[5], 0.6);
      } else if (t >= LINE && t < LINE + GROW) {
        // it opens into a line, top to bottom
        const q = ease.outCubic((t - LINE) / GROW), hh = (A.h / 2 + 3) * q;
        for (let y = -hh - 2; y <= hh + 2; y++) p.dot(mx, my + y, Math.abs(y) < hh ? WHITE : C[6], Math.abs(y) < hh ? 1 : 0.7);
        for (let y = -hh * 0.7; y <= hh * 0.7; y++) (p.dot(mx - 1, my + y, C[5], 0.6), p.dot(mx + 1, my + y, C[5], 0.6));
        p.glow(mx, my, 30, C[5], 0.9);
        p.glow(mx, my, 8, WHITE, 0.5);
      } else if (t >= LINE + GROW && t < ARRIVE) {
        // the line opens sideways into the silhouette, white hot
        const q = ease.outCubic((t - LINE - GROW) / OPEN);
        squeezed(p, A, sh, q, WHITE, C[6]);
        p.glow(mx, my, 36, C[5], 0.8);
      } else if (t >= ARRIVE && t < ARRIVE + 0.42) {
        // the caster cools out of the white: its body full of light, an outline crackling round it, both fading
        const k = 1 - (t - ARRIVE) / 0.42, f = Math.floor(t * 30);
        if (k > 0.86) squeezed(p, A, sh, 1, WHITE, C[6]);
        for (let y = 0; y < A.h; y++)
          for (let x = 0; x < A.w; x++)
            if (inside(x, y)) p.light(A.x + x, A.y + y, C[6], k * k * (sh[y * A.w + x] === 1 ? 0.3 : 0.8));
            else if ((inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) && rand(x, y, f) < 0.85 * k) p.px(A.x + x, A.y + y, k > 0.5 && rand(x, y, 7) < 0.5 ? WHITE : C[6]);
        p.glow(mx, my, 34, C[5], 0.6 * k);
      }
      if (t >= ARRIVE && t < ARRIVE + 0.2) {
        const q = (t - ARRIVE) / 0.2;
        flare(p, mx, my - 4, 18 * Math.pow(1 - q, 1.5) + 2, 1 - q, C);
      }
      const k = (t - ARRIVE + 0.03) / 0.5;
      if (k >= 0 && k < 1) band(p, 0, 0, 4 + 30 * ease.outCubic(k), 0.2, Math.max(1, 3 * (1 - k)), 1.15 - k, [C[3], C[5], C[6], WHITE], (g) => Math.sin(g) >= 0, k < 0.25);
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// 3D: the bits spiral in from a full sphere round the chest to a line of light standing on the spot, which opens into
// the silhouette (the body, its light and its crackling outline stay the 2D painter's, at depth 0). The ring is a
// true circle on the floor and the burst, the rays and the sparks leave in every direction.
const dir3 = (R) => {
  const y = R.range(-1, 1), a = R.range(0, TAU), r = Math.sqrt(1 - y * y);
  return [r * Math.cos(a), y, r * Math.sin(a)];
};
const ringBand = (q, C, r, th, k) =>
  q.ring(0, 0, 0, r, th, (v) => { const u = 1 - v; return u < 0.15 ? WHITE : u < 0.4 ? C[6] : u < 0.7 ? C[5] : C[3]; }, (v) => { const u = 1 - v; return k * (u < 0.4 ? 1.2 : 1.15 - u); });

export const three = {
  meta: { size: [148, 128], origin: [74, 110], camera: { pitch: 0.34 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), A = o.actor, sh = shades(A);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
    const mx = A.x + A.w / 2, my = A.y + A.h * 0.55, COLS = [WHITE, C[6], C[6], C[5], C[4]];
    const inside = (x, y) => x >= 0 && y >= 0 && x < A.w && y < A.h && A.mask.data[y * A.w + x];
    // the bits: each spirals in about the line from its own spot on a sphere, arriving as the line forms
    const bits = Array.from({ length: 230 }, () => {
      const [ux, uy, uz] = dir3(R), d = R.range(16, 46), ty = A.y + R.range(3, A.h - 2);
      let oy = uy * d * 0.8 - 6;
      if (ty + oy > -2) oy = -Math.abs(oy) - 2; // none start under the floor
      return { tx: mx + R.range(-1, 1), ty, ox: ux * d, oy, oz: uz * d, t0: R.range(0, 0.1), t1: LINE + R.range(-0.02, GROW), spin: R.range(0.8, 1.8) * R.sign(), c: R.pick(COLS) };
    });
    // the rays of the flare, spread over a sphere
    const rays = Array.from({ length: 14 }, () => dir3(R));
    let t = 0, arrived = false;
    const at = (b, tt) => {
      const k = clamp((tt - b.t0) / (b.t1 - b.t0)), e = ease.outCubic(k), r = 1 - e, sp = b.spin * r * 1.2, cs = Math.cos(sp), sn = Math.sin(sp);
      return [b.tx + (b.ox * cs - b.oz * sn) * r, Math.min(-1, b.ty + b.oy * r), (b.ox * sn + b.oz * cs) * r, k];
    };

    return {
      update(dt) {
        t += dt;
        if (t < LINE && R.chance(0.6)) {
          const [ux, uy, uz] = dir3(R), D = R.range(22, 44), T = R.range(0.12, 0.18);
          const x = mx + ux * D, y = Math.min(-2, my + uy * D), z = uz * D, l = Math.hypot(x - mx, y - my, z) || 1, v = (l * 3) / (Math.exp(3 * T) - 1);
          ps.spawn3(P.STREAK, x, y, z, ((mx - x) / l) * v, ((my - y) / l) * v, (-z / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
        if (!arrived && t >= ARRIVE) {
          arrived = true;
          lights.add(mx, my - 6, 56, C[5], 0.9, 0.35);
          lights.add(mx, my, 24, WHITE, 0.8, 0.1);
          for (let i = 0; i < 38; i++) {
            const [ux, uy, uz] = dir3(R), sp = R.range(35, 110);
            ps.spawn3(R.chance(0.6) ? P.STAR : P.MOTE, mx, my, 0, ux * sp, uy * sp * 0.7 - 30, uz * sp, R.range(0.4, 0.85), R.pick(COLS), R.range(0.6, 1.6));
          }
          for (let i = 0; i < 16; i++) {
            const a = R.range(0, TAU), r0 = R.range(2, 8), sp = R.range(60, 180);
            ps.spawn3(P.SPARK, mx + Math.cos(a) * r0, -1, Math.sin(a) * r0, Math.cos(a) * sp, -R.range(20, 110), Math.sin(a) * sp, R.range(0.2, 0.45));
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), kr = (t - ARRIVE + 0.03) / 0.5;
        // the body and its light: the 2D drawing, at depth 0
        if (t >= LINE + GROW && t < ARRIVE) {
          squeezed(p, A, sh, ease.outCubic((t - LINE - GROW) / OPEN), WHITE, C[6]);
        } else if (t >= ARRIVE && t < ARRIVE + 0.42) {
          const k = 1 - (t - ARRIVE) / 0.42, f = Math.floor(t * 30);
          if (k > 0.86) squeezed(p, A, sh, 1, WHITE, C[6]);
          for (let y = 0; y < A.h; y++)
            for (let x = 0; x < A.w; x++)
              if (inside(x, y)) p.light(A.x + x, A.y + y, C[6], k * k * (sh[y * A.w + x] === 1 ? 0.3 : 0.8));
              else if ((inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) && rand(x, y, f) < 0.85 * k) p.px(A.x + x, A.y + y, k > 0.5 && rand(x, y, 7) < 0.5 ? WHITE : C[6]);
        }
        // solid first: the ring, the bits rushing in (streaking as they speed up, white as they land), the line of light
        if (kr >= 0 && kr < 1) ringBand(q, C, 4 + 30 * ease.outCubic(kr), Math.max(2.4, 4.5 * (1 - kr)), 1.15 - kr);
        for (const b of bits) {
          if (t < b.t0 || t > b.t1 + 0.02) continue;
          const [x, y, z, k] = at(b, t);
          q.dot(x, y, z, k > 0.75 ? WHITE : b.c, Math.min(1, 0.35 + k * 2));
          if (k > 0.55) {
            const [px, py, pz] = at(b, t - 0.015);
            q.dot((x + px) / 2, (y + py) / 2, (z + pz) / 2, C[5], 0.8);
          }
        }
        if (t >= LINE && t < LINE + GROW) {
          // it opens into a line, top to bottom: a white core in a violet sleeve
          const g = ease.outCubic((t - LINE) / GROW), hh = (A.h / 2 + 3) * g, top = my - hh - 2, bot = Math.min(-0.5, my + hh + 2);
          q.beam(mx, top, 0, mx, bot, 0, 3.4, (u, v) => (v < 0.4 ? WHITE : C[5]), (u, v) => (v < 0.4 ? 1 : 0.6));
        }
        for (const [ux, uy, uz] of t >= ARRIVE && t < ARRIVE + 0.2 ? rays : []) {
          const g = (t - ARRIVE) / 0.2, L = (18 * Math.pow(1 - g, 1.5) + 2) * 1.5;
          q.line(mx + ux * 2, my - 4 + uy * 2, uz * 2, mx + ux * L, my - 4 + uy * L, uz * L, (u) => (u < 0.35 ? WHITE : u < 0.7 ? C[6] : C[5]), (u) => (u < 0.6 ? 1 : (1 - g) * 1.5 * (1 - u) + 0.2));
        }
        // billboards: the point of light and the flare
        if (t >= LINE - 0.04 && t < LINE) {
          const g = (t - LINE + 0.04) / 0.04;
          q.at(mx, my, 0, (pp) => sparkle(pp, 0, 0, 2 + 3 * g, C[6], C[5], 0.6));
        }
        if (t >= ARRIVE && t < ARRIVE + 0.2) {
          const g = (t - ARRIVE) / 0.2;
          q.at(mx, my - 4, 0, (pp) => flare(pp, 0, 0, 12 * Math.pow(1 - g, 1.5) + 2, 1 - g, C));
        }
        ps.draw(q);
        // light: round the line, the silhouette and the body, and a pool on the floor
        if (t >= LINE && t < LINE + GROW) {
          q.glow(mx, my, 0, 30, C[5], 0.9);
          q.glow(mx, my, 0, 8, WHITE, 0.5);
        } else if (t >= LINE + GROW && t < ARRIVE) q.glow(mx, my, 0, 36, C[5], 0.8);
        else if (t >= ARRIVE && t < ARRIVE + 0.42) q.glow(mx, my, 0, 34, C[5], 0.6 * (1 - (t - ARRIVE) / 0.42));
        const pool = 0.3 * (t < ARRIVE ? t / ARRIVE : 1 - clamp((t - ARRIVE) / 0.5));
        if (pool > 0)
          q.plane(0, 0, 0, null, 28, (u, v, out) => {
            const f = 1 - Math.hypot(u, v) / 28;
            if (f <= 0) return;
            out.l = C[5];
            out.k = f * f * pool * 1.6;
          });
        lights.draw(q);
      },
    };
  },
};
