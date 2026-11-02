// The release (a white disc, a cross, two rings, a big light and a spray of motes and stars) is adapted from
// Sprite Fusion's open-source energy charge (https://www.spritefusion.com/pixel-art-vfx/energy),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, PAL, fit, flare, sparkle, space, clamp, ease, TAU, WHITE } from "../../core/index.js";
import { sigil } from "./_lib.js";

const CY = -28, GATHER = 0.22, N = 9;

export const meta = {
  name: "Mana burst",
  desc: "Energy rushes into a point and blows out in a white flash and rings, flinging glowing runes that flare and pop into sparks one after another.",
  tags: ["arcane", "burst", "mana", "rune", "nova", "magic", "ground", "one-shot"],
  size: [208, 150],
  origin: [104, 124],
  duration: 1.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 9 },
};

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // the runes: flung out round the burst, slowing hard, bobbing while they burn, each popping in its turn
  const runes = Array.from({ length: N }, (_, i) => {
    const a = (i / N) * TAU + R.range(-0.25, 0.25) - Math.PI / 2, sp = R.range(150, 210);
    // thrown less far downward, so the low ones stay clear of the floor
    return { g: i, x: 0, y: CY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (Math.sin(a) > 0 ? 0.42 : 0.85), pop: GATHER + 0.42 + i * 0.065 + R.range(0, 0.05), popped: false, ph: R.range(0, TAU) };
  });
  const pops = [];
  let t = 0, released = false;

  return {
    update(dt) {
      t += dt;
      if (t < GATHER - 0.03) {
        // the gather: streaks rush in from all round
        for (let i = 0; i < 2; i++) {
          const a = R.range(0, TAU), D = R.range(24, 52), T = R.range(0.12, 0.18), v = (D * 3) / (Math.exp(3 * T) - 1);
          const x = Math.cos(a) * D, y = Math.min(-2, CY + Math.sin(a) * D * 0.85), l = Math.hypot(x, y - CY) || 1;
          ps.spawn(P.STREAK, x, y, (-x / l) * v, ((CY - y) / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
        }
      }
      if (t >= GATHER && !released) {
        released = true;
        lights.add(0, CY - 12, 96, C[5], 1, 0.5);
        lights.add(0, CY, 40, WHITE, 0.9, 0.1);
        // a spray of motes and stars, thrown less hard at the floor
        for (let i = 0; i < 96; i++) {
          const a = R.range(0, TAU), sp = R.range(100, 250), dn = Math.sin(a) > 0 ? 0.45 : 1;
          ps.spawn(R.chance(0.65) ? P.MOTE : P.STAR, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp * dn, R.range(0.25, 0.55), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.8));
        }
        for (let i = 0; i < 20; i++) {
          const a = R.range(0, TAU), sp = R.range(130, 280);
          ps.spawn(P.SPARK, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.45));
        }
      }
      if (released)
        for (const r of runes) {
          if (r.popped) continue;
          r.vx -= r.vx * 4.2 * dt;
          r.vy -= r.vy * 4.2 * dt + 8 * dt;
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          if (R.chance(0.35)) ps.spawn(P.MOTE, r.x + R.range(-1.5, 1.5), r.y, r.vx * 0.2 + R.range(-10, 10), r.vy * 0.2 - R.range(5, 25), R.range(0.2, 0.4), C[5], 0.5);
          if (t >= r.pop) {
            r.popped = true;
            pops.push({ t, x: r.x, y: r.y });
            lights.add(r.x, r.y, 34, C[5], 0.9, 0.22);
            lights.add(r.x, r.y, 12, WHITE, 0.8, 0.06);
            for (let i = 0; i < 9; i++) {
              const a = R.range(0, TAU), sp = R.range(70, 200);
              ps.spawn(P.SPARK, r.x, r.y, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.15, 0.4));
            }
            for (let i = 0; i < 5; i++) {
              const a = R.range(0, TAU), sp = R.range(20, 80);
              ps.spawn(i % 2 ? P.STAR : P.MOTE, r.x, r.y, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.3, 0.6), R.pick([WHITE, C[6]]), R.range(0.8, 1.6));
            }
          }
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the floor beneath catches the burst
      const k = t < GATHER ? 0.4 * (t / GATHER) : Math.max(0, 1 - (t - GATHER) / 1.1);
      if (k > 0) p.glow(0, -1, 50, C[4], 0.3 * k);
    },
    draw(p) {
      if (t < GATHER) {
        // the point it gathers into: a swelling ball with a white heart
        const k = t / GATHER, r = 1 + 3.5 * k * k;
        p.circle(0, CY, r + 1.2, C[4]);
        p.circle(0, CY, r, C[6]);
        p.circle(0, CY, r * 0.5, WHITE);
        p.glow(0, CY, 10 + 20 * k, C[5], 0.4 + 0.4 * k);
        const q = clamp((t - GATHER * 0.35) / (GATHER * 0.65));
        if (q > 0 && q < 1) p.ring(0, CY, r + 2 + 16 * (1 - ease.outCubic(q)), 1, q > 0.6 ? WHITE : C[6], 1 - q * 0.5);
      } else {
        const q = (t - GATHER) / 0.6;
        if (q < 1) {
          const e = ease.outCubic(q);
          if (q < 0.12) {
            p.circle(0, CY, 12 * (1 - q / 0.12) + 2, C[5]);
            p.circle(0, CY, 12 * (1 - q / 0.12), WHITE);
          }
          if (q < 0.32) flare(p, 0, CY, 30 * (1 - q / 0.32) + 4, 1 - q / 0.32, C);
          // the rings, cut off where they meet the floor
          p.ring(0, CY, 4 + 62 * e, Math.max(1, 5 * (1 - q)), q < 0.2 ? WHITE : C[6], (v, ang) => (CY + Math.sin(ang) * (4 + 62 * e) > 0 ? 0 : 1.2 - q));
          p.ring(0, CY, 2 + 38 * ease.outCubic(Math.min(1, q * 1.4)), Math.max(1, 2 * (1 - q)), C[5], (v, ang) => (CY + Math.sin(ang) * 40 > 0 ? 0 : 1 - q));
          p.glow(0, CY, 60 * (0.4 + 0.6 * e), C[5], 0.9 * (1 - q));
        }
      }
      // the runes: white as they fly, settling to lilac, flaring white just before they pop
      for (const r of runes) {
        if (!released || r.popped) continue;
        const left = r.pop - t, hot = t - GATHER < 0.08 || left < 0.06, bob = Math.sin(t * 9 + r.ph) * 0.6;
        sigil(p, r.g, r.x, r.y + bob, hot ? WHITE : C[6], 1, hot ? C[4] : C[3]);
        p.glow(r.x, r.y + bob, 10, C[5], hot ? 0.7 : 0.35);
        if (left < 0.06) sparkle(p, r.x, r.y + bob, 3 + 4 * (1 - left / 0.06), C[6], C[5], 0.5);
      }
      // each pop: a small flare and a ring
      for (const q of pops) {
        const k = (t - q.t) / 0.32;
        if (k >= 1) continue;
        if (k < 0.35) flare(p, q.x, q.y, 11 * (1 - k / 0.35) + 2, 1 - k / 0.35, C);
        p.ring(q.x, q.y, 2 + 11 * ease.outCubic(k), Math.max(1, 2 * (1 - k)), k < 0.3 ? WHITE : C[6], 1.15 - k);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// ---- 3D: the gather is a sphere of streaks rushing into a lit ball; the release throws a shell of motes, stars
// and sparks every way, three true rings (flat, standing, tilted) and a thin translucent shell; the runes are
// flung out on a full circle at different heights and each pops in its own place.
const unit = (n) => {
  const l = Math.hypot(...n) || 1;
  return n.map((v) => v / l);
};
const cr3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// a plane's axes, the same as the Space's own (to know where on the plane the floor cuts a ring)
function axes(n) {
  const N = unit(n), e1 = Math.abs(N[1]) > 0.9 ? unit(cr3(cr3(N, [1, 0, 0]), N)) : unit(cr3(N, [0, -1, 0]));
  return [e1, cr3(N, e1)];
}
const FLOOR = [0, -1, 0];
// a ring from r - w to r on the plane of normal n, fading out where it would dip into the floor
function band3(q, cx, cy, cz, n, r, w, c, a) {
  if (r < 1 || a <= 0) return;
  const [e1, e2] = axes(n), w2 = Math.max(1.5, w);
  q.plane(cx, cy, cz, n, r + 0.5, (u, v, out) => {
    const d = Math.hypot(u, v);
    if (d < r - w2 || d > r) return;
    const y = cy + e1[1] * u + e2[1] * v, k = y > -1 ? 0 : Math.min(1, (-1 - y) / 6);
    if (k <= 0) return;
    out.c = c;
    out.a = Math.min(1, a * 1.35) * k;
    out.l = c;
    out.k = 0.3 * k;
  });
}
// a direction out in every way; what points down is shortened, so nothing is thrown into the floor
function every(R, dn) {
  const y = R.range(-1, 1), a = R.range(0, TAU), h = Math.sqrt(1 - y * y);
  return [Math.cos(a) * h, y > 0 ? y * dn : y, Math.sin(a) * h];
}

export const three = {
  meta: { size: [208, 164], origin: [104, 138], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
    const runes = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * TAU + R.range(-0.25, 0.25), el = ((i * 0.618) % 1) * 1.1 - 0.3 + R.range(-0.1, 0.1), sp = R.range(150, 210), h = Math.cos(el);
      return { g: i, x: 0, y: CY, z: 0, vx: Math.cos(a) * h * sp, vy: -Math.sin(el) * sp * (el < 0 ? 0.5 : 0.85), vz: Math.sin(a) * h * sp, pop: GATHER + 0.42 + i * 0.065 + R.range(0, 0.05), popped: false, ph: R.range(0, TAU) };
    });
    const pops = [];
    let t = 0, released = false;

    return {
      update(dt) {
        t += dt;
        if (t < GATHER - 0.03) {
          // the gather: streaks rush in from every side
          for (let i = 0; i < 3; i++) {
            const [dx, dy, dz] = every(R, 0.85), D = R.range(24, 52), T = R.range(0.12, 0.18), v = (D * 3) / (Math.exp(3 * T) - 1);
            const x = dx * D, y = Math.min(-2, CY + dy * D), z = dz * D, l = Math.hypot(x, y - CY, z) || 1;
            ps.spawn3(P.STREAK, x, y, z, (-x / l) * v, ((CY - y) / l) * v, (-z / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
          }
        }
        if (t >= GATHER && !released) {
          released = true;
          lights.add(0, CY - 12, 96, C[5], 1, 0.5);
          lights.add(0, CY, 40, WHITE, 0.9, 0.1);
          // a sphere of motes and stars, thrown less hard at the floor
          for (let i = 0; i < 110; i++) {
            const [dx, dy, dz] = every(R, 0.4), sp = R.range(100, 250);
            ps.spawn3(R.chance(0.65) ? P.MOTE : P.STAR, 0, CY, 0, dx * sp, dy * sp, dz * sp, R.range(0.25, 0.55), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.8));
          }
          for (let i = 0; i < 24; i++) {
            const [dx, dy, dz] = every(R, 0.6), sp = R.range(130, 280);
            ps.spawn3(P.SPARK, 0, CY, 0, dx * sp, dy * sp, dz * sp, R.range(0.2, 0.45));
          }
        }
        if (released)
          for (const r of runes) {
            if (r.popped) continue;
            r.vx -= r.vx * 4.2 * dt;
            r.vy -= r.vy * 4.2 * dt + 8 * dt;
            r.vz -= r.vz * 4.2 * dt;
            r.x += r.vx * dt;
            r.y += r.vy * dt;
            r.z += r.vz * dt;
            if (R.chance(0.35)) ps.spawn3(P.MOTE, r.x + R.range(-1.5, 1.5), r.y, r.z + R.range(-1.5, 1.5), r.vx * 0.2 + R.range(-10, 10), r.vy * 0.2 - R.range(5, 25), r.vz * 0.2 + R.range(-10, 10), R.range(0.2, 0.4), C[5], 0.5);
            if (t >= r.pop) {
              r.popped = true;
              pops.push({ t, x: r.x, y: r.y, z: r.z, n: unit([R.range(-1, 1), R.range(-1, 1), R.range(-1, 1)]) });
              lights.add(r.x, r.y, 34, C[5], 0.9, 0.22, r.z);
              lights.add(r.x, r.y, 12, WHITE, 0.8, 0.06, r.z);
              for (let i = 0; i < 9; i++) {
                const [dx, dy, dz] = every(R, 0.6), sp = R.range(70, 200);
                ps.spawn3(P.SPARK, r.x, r.y, r.z, dx * sp, dy * sp - 40, dz * sp, R.range(0.15, 0.4));
              }
              for (let i = 0; i < 5; i++) {
                const [dx, dy, dz] = every(R, 0.6), sp = R.range(20, 80);
                ps.spawn3(i % 2 ? P.STAR : P.MOTE, r.x, r.y, r.z, dx * sp, dy * sp - 20, dz * sp, R.range(0.3, 0.6), R.pick([WHITE, C[6]]), R.range(0.8, 1.6));
              }
            }
          }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), glowK = t < GATHER ? 0.4 * (t / GATHER) : Math.max(0, 1 - (t - GATHER) / 1.1);
        // the floor beneath catches the burst
        if (glowK > 0)
          q.plane(0, 0, 0, null, 46, (u, v, out) => {
            const d = Math.hypot(u, v) / 44;
            if (d >= 1) return;
            out.l = d < 0.35 ? C[6] : C[5];
            out.k = (1 - d) * (1 - d) * 0.9 * glowK;
          });
        let shell = null, flash = null;
        if (t < GATHER) {
          // the point it gathers into: a swelling ball with a white heart, and two rings closing in on it
          const k = t / GATHER, r = 1 + 3.5 * k * k;
          q.ball(0, CY, 0, r + 1.2, C[4]);
          q.ball(0, CY, 0, r, (nx, ny, nz) => (nz > 0.6 ? WHITE : C[6]));
          const g = clamp((t - GATHER * 0.35) / (GATHER * 0.65));
          if (g > 0 && g < 1) {
            const rr = r + 2 + 16 * (1 - ease.outCubic(g)), col = g > 0.6 ? WHITE : C[6];
            band3(q, 0, CY, 0, FLOOR, rr, 1.5, col, 1 - g * 0.5);
            band3(q, 0, CY, 0, [0, 0, 1], rr, 1.5, col, 1 - g * 0.5);
          }
          q.glow(0, CY, 0, 10 + 20 * k, C[5], 0.4 + 0.4 * k);
        } else {
          const g = (t - GATHER) / 0.6;
          if (g < 1) {
            const e = ease.outCubic(g);
            if (g < 0.12) {
              q.ball(0, CY, 0, 12 * (1 - g / 0.12) + 2, C[5]);
              q.ball(0, CY, 0, 12 * (1 - g / 0.12), WHITE);
            }
            // three rings round the burst: one lying flat, one standing, one on a slant
            band3(q, 0, CY, 0, FLOOR, 4 + 62 * e, 5 * (1 - g), g < 0.2 ? WHITE : C[6], 1.2 - g);
            band3(q, 0, CY, 0, [1, 0, 0], 2 + 38 * ease.outCubic(Math.min(1, g * 1.4)), 2 * (1 - g), C[5], 1 - g);
            band3(q, 0, CY, 0, unit([0.55, -0.6, 0.6]), 3 + 50 * ease.outCubic(Math.min(1, g * 1.15)), 3 * (1 - g), g < 0.3 ? WHITE : C[6], 1.1 - g);
            shell = { r: 4 + 36 * e, g };
            flash = g;
          }
        }
        // the runes, nearest first
        const live = runes.filter((r) => released && !r.popped);
        for (const r of q.sort(live, (r) => [r.x, r.y, r.z]).reverse()) {
          const left = r.pop - t, hot = t - GATHER < 0.08 || left < 0.06, bob = Math.sin(t * 9 + r.ph) * 0.6;
          q.at(r.x, r.y + bob, r.z, (pp) => {
            sigil(pp, r.g, 0, 0, hot ? WHITE : C[6], 1, hot ? C[4] : C[3]);
            if (left < 0.06) sparkle(pp, 0, 0, 3 + 4 * (1 - left / 0.06), C[6], C[5], 0.5);
          });
        }
        // each pop: a small flare and a ring in some slant
        for (const e of pops) {
          const k = (t - e.t) / 0.32;
          if (k >= 1) continue;
          if (k < 0.35) q.at(e.x, e.y, e.z, (pp) => flare(pp, 0, 0, 11 * (1 - k / 0.35) + 2, 1 - k / 0.35, C));
          band3(q, e.x, e.y, e.z, e.n, 2 + 11 * ease.outCubic(k), 2 * (1 - k), k < 0.3 ? WHITE : C[5], 1.15 - k);
        }
        ps.draw(q);
        // the white cross and the shell: a thin translucent sphere, brightest at its rim
        if (flash !== null && flash < 0.32) q.at(0, CY, 0, (pp) => flare(pp, 0, 0, 30 * (1 - flash / 0.32) + 4, 1 - flash / 0.32, C));
        if (shell) q.disc(0, CY, 0, shell.r, (d) => (d > 0.92 ? C[6] : C[5]), (d) => Math.pow(d, 5) * 0.55 * (1 - shell.g));
        if (shell) q.glow(0, CY, 0, 60 * (0.4 + 0.6 * ease.outCubic(shell.g)), C[5], 0.9 * (1 - shell.g));
        lights.draw(q);
        for (const r of live) {
          const left = r.pop - t, hot = t - GATHER < 0.08 || left < 0.06, bob = Math.sin(t * 9 + r.ph) * 0.6;
          q.glow(r.x, r.y + bob, r.z, 10, C[5], hot ? 0.7 : 0.35);
        }
      },
    };
  },
};
