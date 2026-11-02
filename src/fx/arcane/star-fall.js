// The slanted streaks landing with a ring and a kick of bits follow Sprite Fusion's open-source rain
// (https://www.spritefusion.com/pixel-art-vfx/rain), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, PAL, fit, band, flare, sparkle, clamp, ease, TAU, WHITE, space } from "../../core/index.js";

const N = 11, SPREAD = 46, H = 124, SLANT = 0.38, TRAIL = 0.17;

export const meta = {
  name: "Star fall",
  desc: "Stars streak down on long trails across an area, each landing with a white flash, a ring across the floor and a kick of sparks.",
  tags: ["arcane", "star", "meteor", "rain", "aoe", "magic", "ground", "one-shot"],
  size: [232, 172],
  origin: [124, 150],
  duration: 2.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: PAL.arcane, seed: 13 },
};

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // where they land: spread over the area in a shuffled order, a little in front of or behind the line
  const xs = Array.from({ length: N }, (_, i) => -SPREAD + ((i + R.range(0.2, 0.8)) * 2 * SPREAD) / N);
  for (let i = N - 1; i > 0; i--) {
    const j = R.int(0, i);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  const stars = xs.map((x, i) => {
    const y = R.range(-3, 2), h = H * R.range(0.85, 1);
    return { x, y, sx: x - h * SLANT, sy: y - h, t0: 0.04 + i * 0.105 + R.range(0, 0.05), T: R.range(0.3, 0.4), landed: false, big: R.chance(0.35), ph: R.range(0, TAU) };
  });
  const hits = [];
  let t = 0;
  const at = (s, tt) => {
    const q = clamp((tt - s.t0) / s.T), e = q * (0.35 + 0.65 * q);
    return [s.sx + (s.x - s.sx) * e, s.sy + (s.y - s.sy) * e, q];
  };

  function star(p, s) {
    const [x, y, q] = at(s, t);
    // the trail: a long tapered streak back up its path, white at the head, thinning into violet
    const n = 20;
    for (let k = n; k >= 1; k--) {
      const [ax, ay] = at(s, t - (k * TRAIL) / n), [bx, by] = at(s, t - ((k - 1) * TRAIL) / n), u = k / n;
      if (t - (k * TRAIL) / n < s.t0) continue;
      const c = u < 0.15 ? WHITE : u < 0.4 ? C[6] : u < 0.7 ? C[5] : C[4];
      // a second line beside the first near the head gives it body; the tail thins to a dithered thread
      if (u < (s.big ? 0.55 : 0.35)) p.line(ax + 1, ay, bx + 1, by, u < 0.2 ? C[6] : C[5], 1.1 - u * 1.4);
      p.line(ax, ay, bx, by, c, 1.3 - u);
      if (k % 3 === 0) p.glow(ax, ay, 7 * (1 - u) + 2, C[5], 0.3 * (1 - u));
    }
    // the head: a twinkling four-point star
    if (s.big) flare(p, x, y, 7 + 1.5 * Math.sin(t * 40 + s.ph), 0.8, C);
    else sparkle(p, x, y, 3.5 + Math.sin(t * 40 + s.ph), C[6], C[5], 0.6);
    p.circle(x, y, s.big ? 1.6 : 1.1, WHITE);
    p.glow(x, y, s.big ? 18 : 13, C[5], 0.6);
    p.glow(x, y, 5, WHITE, 0.35);
    return q;
  }

  function hit(p, h, far) {
    const k = (t - h.t) / 0.45;
    if (k < 0 || k >= 1) return;
    band(p, h.x, h.y, 3 + (h.big ? 22 : 16) * ease.outCubic(k), 0.26, Math.max(1, 2.5 * (1 - k)), 1.15 - k, [C[3], C[5], C[6], WHITE], (g) => Math.sin(g) < 0 === far, k < 0.2);
  }

  return {
    update(dt) {
      t += dt;
      for (const s of stars) {
        if (t < s.t0 || s.landed) continue;
        const [x, y, q] = at(s, t);
        if (R.chance(0.55)) ps.spawn(P.STAR, x + R.range(-1.5, 1.5), y + R.range(-1.5, 1.5), R.range(-12, 12), R.range(-8, 4), R.range(0.35, 0.7), R.pick([WHITE, C[6], C[5]]), R.chance(0.7) ? R.range(0.4, 0.9) : R.range(1.2, 1.8));
        if (q >= 1) {
          s.landed = true;
          hits.push({ x: s.x, y: s.y, t, big: s.big });
          lights.add(s.x, s.y - 12, s.big ? 46 : 38, C[5], 0.9, 0.32);
          lights.add(s.x, s.y - 3, 16, WHITE, 0.8, 0.08);
          for (let i = 0; i < (s.big ? 14 : 9); i++) {
            const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(50, 150);
            ps.spawn(P.SPARK, s.x, Math.min(-1, s.y - 1), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.5));
          }
          for (let i = 0; i < 4; i++) ps.spawn(P.STAR, s.x + R.range(-4, 4), s.y - R.range(2, 8), R.range(-15, 15), -R.range(10, 35), R.range(0.4, 0.8), R.pick([WHITE, C[6]]), R.range(0.8, 2));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the area lit beneath while they fall
      const k = clamp(t / 0.3) * (1 - clamp((t - 1.7) / 0.7));
      if (k > 0) for (const x of [-36, 0, 36]) p.glow(x, -1, 40, C[4], 0.14 * k);
      for (const h of hits) hit(p, h, true);
      // a glowing mark where each landed, cooling away
      for (const h of hits) {
        const k2 = 1 - (t - h.t) / 0.7;
        if (k2 <= 0) continue;
        p.dot(h.x, h.y, k2 > 0.6 ? WHITE : C[6], k2 * 1.5);
        for (const dx of [-1, 1]) p.dot(h.x + dx, h.y, C[5], k2 * 1.2);
        p.glow(h.x, h.y - 1, 10, C[5], 0.35 * k2);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      for (const s of stars) if (t >= s.t0 && !s.landed) star(p, s);
      for (const h of hits) {
        hit(p, h, false);
        const k = (t - h.t) / 0.22;
        if (k < 0 || k >= 1) continue;
        if (k < 0.35) p.circle(h.x, h.y - 2, 5 * (1 - k / 0.35) + 1, WHITE);
        flare(p, h.x, h.y - 2, (h.big ? 16 : 12) * Math.pow(1 - k, 1.5) + 2, 1 - k, C);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: stars fall on slanted paths through a volume over a disc of ground, trailing long beams of light; each lands with
// a true ring across the floor, a flash ball and column, a kick of sparks in a full circle and a glow on the floor.
export const three = {
  meta: { size: [232, 206], origin: [124, 170], camera: { pitch: 0.4 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
    // where they land: spread over a disc in a shuffled order
    const pts = Array.from({ length: N }, (_, i) => {
      const a = i * 2.39996 + R.range(-0.35, 0.35), r = SPREAD * Math.sqrt((i + R.range(0.2, 0.8)) / N);
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    for (let i = N - 1; i > 0; i--) {
      const j = R.int(0, i);
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    const stars = pts.map(([x, z], i) => {
      const h = H * R.range(0.85, 1), j = R.range(-0.55, 0.55), sx = x - h * SLANT * Math.cos(j), sz = z - h * SLANT * Math.sin(j);
      return { x, z, sx, sy: -h, sz, t0: 0.04 + i * 0.105 + R.range(0, 0.05), T: R.range(0.3, 0.4), landed: false, big: R.chance(0.35), ph: R.range(0, TAU) };
    });
    const hits = [];
    let t = 0;
    const at = (s, tt) => {
      const q = clamp((tt - s.t0) / s.T), e = q * (0.35 + 0.65 * q);
      return [s.sx + (s.x - s.sx) * e, s.sy * (1 - e), s.sz + (s.z - s.sz) * e, q];
    };

    function star(q, s) {
      const [x, y, z] = at(s, t), n = 20;
      // the trail: a long tapered beam back up its path, white at the head, thinning into violet
      for (let k = n; k >= 1; k--) {
        if (t - (k * TRAIL) / n < s.t0) continue;
        const [ax, ay, az] = at(s, t - (k * TRAIL) / n), [bx, by, bz] = at(s, t - ((k - 1) * TRAIL) / n), u = k / n;
        const c = u < 0.15 ? WHITE : u < 0.4 ? C[6] : u < 0.7 ? C[5] : C[4];
        // near the head it has body: a beam with a lit core; the tail thins to a dithered thread
        if (u < (s.big ? 0.55 : 0.35)) q.beam(ax, ay, az, bx, by, bz, 2.4 * (1 - u * 0.9), (uu, v) => (v < 0.45 ? c : u < 0.2 ? C[6] : C[5]), 1.1 - u * 1.4);
        else q.line(ax, ay, az, bx, by, bz, c, 1.3 - u);
      }
      // the head: a twinkling four-point star, a white ball in it
      q.ball(x, y, z, s.big ? 1.6 : 1.1, WHITE);
      if (s.big) q.at(x, y, z, (pp) => flare(pp, 0, 0, 7 + 1.5 * Math.sin(t * 40 + s.ph), 0.8, C));
      else q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 3.5 + Math.sin(t * 40 + s.ph), C[6], C[5], 0.6));
    }
    // light along the trail and on the head, after the solid parts
    function starLight(q, s) {
      const [x, y, z] = at(s, t);
      for (let k = n3; k >= 3; k -= 3) {
        if (t - (k * TRAIL) / n3 < s.t0) continue;
        const [ax, ay, az] = at(s, t - (k * TRAIL) / n3), u = k / n3;
        q.glow(ax, ay, az, 7 * (1 - u) + 2, C[5], 0.3 * (1 - u));
      }
      q.glow(x, y, z, s.big ? 18 : 13, C[5], 0.6);
      q.glow(x, y, z, 5, WHITE, 0.35);
    }
    const n3 = 20, ringOf = (q, h) => {
      const k = (t - h.t) / 0.45;
      if (k < 0 || k >= 1) return;
      q.ring(h.x, 0, h.z, 3 + (h.big ? 22 : 16) * ease.outCubic(k), Math.max(2, 3 * (1 - k)),
        (v) => { const u = 1 - v; return u < 0.15 ? WHITE : u < 0.4 ? C[6] : u < 0.7 ? C[5] : C[3]; },
        (v) => { const u = 1 - v; return (1.15 - k) * (u < 0.4 ? 1.2 : 1.15 - u); });
    };

    return {
      update(dt) {
        t += dt;
        for (const s of stars) {
          if (t < s.t0 || s.landed) continue;
          const [x, y, z, q] = at(s, t);
          if (R.chance(0.55)) ps.spawn3(P.STAR, x + R.range(-1.5, 1.5), y + R.range(-1.5, 1.5), z + R.range(-1.5, 1.5), R.range(-12, 12), R.range(-8, 4), R.range(-12, 12), R.range(0.35, 0.7), R.pick([WHITE, C[6], C[5]]), R.chance(0.7) ? R.range(0.4, 0.9) : R.range(1.2, 1.8));
          if (q >= 1) {
            s.landed = true;
            hits.push({ x: s.x, z: s.z, t, big: s.big });
            lights.add(s.x, -12, s.big ? 46 : 38, C[5], 0.9, 0.32, s.z);
            lights.add(s.x, -3, 16, WHITE, 0.8, 0.08, s.z);
            for (let i = 0; i < (s.big ? 14 : 9); i++) {
              const th = R.range(0, 1.35), ph = R.range(0, TAU), sp = R.range(50, 150);
              ps.spawn3(P.SPARK, s.x, -1, s.z, Math.sin(th) * Math.cos(ph) * sp, -Math.cos(th) * sp, Math.sin(th) * Math.sin(ph) * sp, R.range(0.2, 0.5));
            }
            for (let i = 0; i < 4; i++) {
              const a = R.range(0, TAU), d = R.range(0, 4);
              ps.spawn3(P.STAR, s.x + Math.cos(a) * d, -R.range(2, 8), s.z + Math.sin(a) * d, R.range(-15, 15), -R.range(10, 35), R.range(-15, 15), R.range(0.4, 0.8), R.pick([WHITE, C[6]]), R.range(0.8, 2));
            }
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // solid: the rings, the stars on their trails, the flash balls and columns
        for (const h of hits) ringOf(q, h);
        for (const s of stars) if (t >= s.t0 && !s.landed) star(q, s);
        for (const h of hits) {
          const k = (t - h.t) / 0.22;
          if (k < 0 || k >= 1) continue;
          if (k < 0.35) q.ball(h.x, -2, h.z, 5 * (1 - k / 0.35) + 1, WHITE);
          q.beam(h.x, 0, h.z, h.x, -4 - 16 * (1 - k), h.z, 2.2 * (1 - k) + 0.6, (u) => (u < 0.4 ? WHITE : C[5]), (u) => (1 - k) * (1.2 - u));
          q.at(h.x, -2, h.z, (pp) => flare(pp, 0, 0, (h.big ? 16 : 12) * Math.pow(1 - k, 1.5) + 2, 1 - k, C));
        }
        ps.draw(q);
        // light: the area lit beneath while they fall, a glowing mark where each landed, along the trails
        const lk = clamp(t / 0.3) * (1 - clamp((t - 1.7) / 0.7));
        if (lk > 0)
          q.plane(0, 0, 0, null, SPREAD + 16, (u, v, out) => {
            const f = 1 - Math.hypot(u, v) / (SPREAD + 16);
            if (f <= 0) return;
            out.l = C[4];
            out.k = f * 0.3 * lk;
          });
        for (const h of hits) {
          const k2 = 1 - (t - h.t) / 0.7;
          if (k2 <= 0) continue;
          q.plane(h.x, 0, h.z, null, 4, (u, v, out) => {
            const d = Math.hypot(u, v);
            if (d < 1.2) (out.c = k2 > 0.6 ? WHITE : C[6]), (out.a = Math.min(1, k2 * 1.5));
            else if (d < 3.4) (out.c = C[5]), (out.a = Math.min(1, k2 * 1.2));
          });
          q.glow(h.x, -1, h.z, 10, C[5], 0.35 * k2);
        }
        for (const s of stars) if (t >= s.t0 && !s.landed) starLight(q, s);
        lights.draw(q);
      },
    };
  },
};
