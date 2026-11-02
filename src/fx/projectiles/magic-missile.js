// The gathering motes, star particles and burst flare follow Sprite Fusion's open-source energy bolt
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, flare, sparkle, clamp, smooth, ease, space, TAU, WHITE } from "../../core/index.js";
import { frame3, spike3 } from "./_lib.js";

export const meta = {
  name: "Magic missile",
  desc: "Motes gather into an arcane orb at a hand `height` px above the floor (the origin); it weaves to its target trailing a twisting ribbon and bursts into a star of light.",
  tags: ["projectile", "magic", "arcane", "missile", "spell", "directional", "one-shot"],
  size: [208, 112],
  origin: [24, 104],
  duration: 1.9,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"], height: 26, reach: 112, seed: 6 },
};

const CHARGE = 0.2, FLY = 0.62;

export function create(o) {
  const C = fit(o.palette, 8), H = o.height, X1 = o.reach, R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // the path: out of the hand, weaving up and down twice, homing in on the target at the same height
  const pos = (u) => [X1 * ease.inOutSine(u) + Math.sin(u * Math.PI) * 6, -H + Math.sin(u * TAU * 1.5) * 9 * Math.sin(u * Math.PI)];
  let t = 0, burst = false;
  const trail = [];
  return {
    update(dt) {
      t += dt;
      if (t < CHARGE) {
        // motes spiral in to the hand
        if (R.chance(0.8)) {
          const a = R.range(0, TAU), d = R.range(12, 26), sp = d / 0.14;
          ps.spawn(P.MOTE, Math.cos(a) * d, -H + Math.sin(a) * d, -Math.cos(a) * sp - Math.sin(a) * sp * 0.5, -Math.sin(a) * sp + Math.cos(a) * sp * 0.5, 0.14, R.pick([C[5], C[6], WHITE]), 0.8);
        }
      } else if (t < CHARGE + FLY) {
        const u = (t - CHARGE) / FLY, [x, y] = pos(u);
        trail.push({ x, y, t });
        if (R.chance(0.6)) ps.spawn(P.MOTE, x, y, R.range(-50, 50), R.range(-50, 50), R.range(0.2, 0.4), R.pick([C[4], C[5], C[6]]), 0.7);
        if (R.chance(0.25)) ps.spawn(P.STAR, x + R.range(-3, 3), y + R.range(-3, 3), R.range(-10, 10), R.range(-10, 10), R.range(0.25, 0.5), C[6], R.range(0.6, 1.6));
      } else if (!burst) {
        burst = true;
        const y = -H;
        lights.add(X1, y, 52, C[4], 0.95, 0.55);
        lights.add(X1, y, 22, WHITE, 0.8, 0.12);
        for (let i = 0; i < 26; i++) {
          const a = R.range(0, TAU), sp = R.range(60, 150) * (1 - 0.65 * Math.max(0, Math.sin(a)));
          ps.spawn(i % 3 ? P.MOTE : P.STAR, X1, y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.45), R.pick([C[5], C[6], WHITE]), R.range(0.8, 1.8));
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(110, 240) * (1 - 0.5 * Math.max(0, Math.sin(a)));
          ps.spawn(P.SPARK, X1, y, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.12, 0.3));
        }
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), d = R.range(4, 22);
          ps.spawn(P.STAR, X1 + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0, -R.range(2, 8), R.range(0.5, 1.1), R.pick([C[6], WHITE, C[5]]), R.range(0.8, 2.6), R.range(0.05, 0.45));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      // the ribbon: a strip that twists as it trails the orb, its bright face and its dark back taking turns,
      // fading from the tail
      const now = t, keep = trail.filter((q) => now - q.t < 0.32);
      for (let i = 1; i < keep.length; i++) {
        const a = keep[i - 1], b = keep[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        for (let f = 0; f < 1; f += 0.5 / l) {
          const tt = a.t + (b.t - a.t) * f, k = 1 - (now - tt) / 0.32, tw = Math.sin(tt * 26), w = 3.2 * k * Math.abs(tw) + 0.4, face = tw > 0;
          const x = a.x + dx * f, y = a.y + dy * f;
          for (let s = -w; s <= w; s += 0.5) {
            const edge = Math.abs(s) > w - 0.8, c = face ? (edge ? C[6] : k > 0.6 ? C[5] : C[4]) : edge ? C[4] : C[2];
            p.dot(x + nx * s, y + ny * s, c, k > 0.35 ? 1 : k / 0.35);
          }
        }
        if (i % 3 === 0) p.glow(b.x, b.y, 6, C[4], 0.25 * (1 - (now - b.t) / 0.32));
      }
      ps.draw(p);
      // the orb: gathering at the hand, then flying, its heart white, a ring of light turning round it
      if (t < CHARGE + FLY) {
        const k = t < CHARGE ? t / CHARGE : 1, [x, y] = t < CHARGE ? [0, -H] : pos((t - CHARGE) / FLY), r = 1 + 3 * ease.outBack(k);
        p.circle(x, y, r + 1.4, C[3]);
        p.circle(x, y, r + 0.4, C[5]);
        p.circle(x - 0.4, y - 0.4, r * 0.55, WHITE);
        for (let i = 0; i < 3; i++) {
          const a = t * 14 + (i * TAU) / 3;
          p.px(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3) * 0.6, i ? C[6] : WHITE);
        }
        p.glow(x, y, 20, C[4], 0.65 * k);
        p.glow(x, y, 7, C[6], 0.5 * k);
      }
      // the burst: a star flare and a ring that open out and fade
      const q = t - CHARGE - FLY;
      if (q >= 0 && q < 0.5) {
        const e = q / 0.5;
        if (e < 0.5) flare(p, X1, -H, 26 * Math.pow(1 - e * 2, 1.2) + 2, 1 - e * 2, C);
        if (e < 0.12) p.circle(X1, -H, 6 * (1 - e / 0.12) + 1, WHITE);
        p.ring(X1, -H, 4 + 20 * ease.outCubic(e), Math.max(1, 2.5 * (1 - e)), e < 0.3 ? C[6] : C[5], Math.min(1, (1 - e) * 1.5));
        if (e < 0.4) sparkle(p, X1, -H, 7 * (1 - e / 0.4), C[6], C[4], 0.6 * (1 - e / 0.4));
      }
      lights.draw(p);
      void clamp, smooth;
    },
  };
}

// 3D: the orb corkscrews to its target, and the ribbon it trails is a real strip of light twisting about the path, its
// bright face and dark back turning to and away from the camera. Motes gather out of a sphere, a bead circles the orb
// in a true circle, and the burst is a ball of rays with a ring of light opening out across the line of flight and
// another along the floor.
export const three = {
  meta: { size: [264, 124], origin: [132, 90], bg: "ground", camera: { pitch: 0.3 }, options: { reach: 84 } },
  create(o) {
    const C = fit(o.palette, 8), H = o.height, X1 = o.reach, R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
    // the path: out of the hand, a corkscrew round the line to the target at the same height
    const pos = (u) => {
      const s = Math.sin(u * Math.PI), a = u * TAU * 1.5;
      return [X1 * ease.inOutSine(u) + s * 6, -H + Math.sin(a) * 10 * s, Math.cos(a) * 10 * s];
    };
    const dir = () => {
      const a = R.range(0, TAU), b = R.range(-1, 1), s = Math.sqrt(1 - b * b);
      return [Math.cos(a) * s, b, Math.sin(a) * s];
    };
    let t = 0, burst = false;
    const trail = [];
    return {
      update(dt) {
        t += dt;
        if (t < CHARGE) {
          // motes spiral in to the hand from every side
          if (R.chance(0.8)) {
            const [dx, dy, dz] = dir(), [tx, ty, tz] = dir(), d = R.range(12, 26), sp = d / 0.14;
            ps.spawn3(P.MOTE, dx * d, -H + dy * d, dz * d, -dx * sp + tx * sp * 0.5, -dy * sp + ty * sp * 0.5, -dz * sp + tz * sp * 0.5, 0.14, R.pick([C[5], C[6], WHITE]), 0.8);
          }
        } else if (t < CHARGE + FLY) {
          const u = (t - CHARGE) / FLY, [x, y, z] = pos(u);
          trail.push({ x, y, z, t });
          if (R.chance(0.6)) ps.spawn3(P.MOTE, x, y, z, R.range(-50, 50), R.range(-50, 50), R.range(-50, 50), R.range(0.2, 0.4), R.pick([C[4], C[5], C[6]]), 0.7);
          if (R.chance(0.25)) ps.spawn3(P.STAR, x + R.range(-3, 3), y + R.range(-3, 3), z + R.range(-3, 3), R.range(-10, 10), R.range(-10, 10), R.range(-10, 10), R.range(0.25, 0.5), C[6], R.range(0.6, 1.6));
        } else if (!burst) {
          burst = true;
          const [x, y, z] = pos(1);
          lights.add(x, y, 52, C[4], 0.95, 0.55, z);
          lights.add(x, y, 22, WHITE, 0.8, 0.12, z);
          for (let i = 0; i < 26; i++) {
            const [dx, dy, dz] = dir(), sp = R.range(60, 150) * (1 - 0.35 * Math.max(0, -dy));
            ps.spawn3(i % 3 ? P.MOTE : P.STAR, x, y, z, dx * sp, dy * sp, dz * sp, R.range(0.25, 0.45), R.pick([C[5], C[6], WHITE]), R.range(0.8, 1.8));
          }
          for (let i = 0; i < 18; i++) {
            const [dx, dy, dz] = dir(), sp = R.range(110, 240) * (1 - 0.3 * Math.max(0, -dy));
            ps.spawn3(P.SPARK, x, y, z, dx * sp, dy * sp - 30, dz * sp, R.range(0.12, 0.3));
          }
          for (let i = 0; i < 14; i++) {
            const [dx, dy, dz] = dir(), d = R.range(4, 22);
            ps.spawn3(P.STAR, x + dx * d, y + dy * d * 0.8, z + dz * d, 0, -R.range(2, 8), 0, R.range(0.4, 0.7), R.pick([C[6], WHITE, C[5]]), R.range(0.8, 2.6), R.range(0.05, 0.3));
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), now = t, keep = trail.filter((s) => now - s.t < 0.32);
        // the ribbon: a strip that twists about the path as it trails the orb, its bright face and its dark back taking
        // turns as they turn to the camera, fading from the tail
        for (let i = 1; i < keep.length; i++) {
          const a = keep[i - 1], b = keep[i], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.hypot(dx, dy, dz) || 1;
          const [e1, e2] = frame3(dx / l, dy / l, dz / l);
          for (let f = 0; f < 1; f += 0.5 / l) {
            const tt = a.t + (b.t - a.t) * f, k = 1 - (now - tt) / 0.32, th = tt * 13, w = 3.2 * k + 0.4;
            const nx = e1[0] * Math.cos(th) + e2[0] * Math.sin(th), ny = e1[1] * Math.cos(th) + e2[1] * Math.sin(th), nz = e1[2] * Math.cos(th) + e2[2] * Math.sin(th);
            // the strip's own normal is the path direction crossed with its width; which way it faces the camera tells face from back
            const cx = (dy / l) * nz - (dz / l) * ny, cy = (dz / l) * nx - (dx / l) * nz, cz = (dx / l) * ny - (dy / l) * nx;
            const face = q.view(cx, cy, cz)[2] > 0, x = a.x + dx * f, y = a.y + dy * f, z = a.z + dz * f;
            q.line(x - nx * w, y - ny * w, z - nz * w, x + nx * w, y + ny * w, z + nz * w, (u) => {
              const edge = u < 0.14 || u > 0.86;
              return face ? (edge ? C[6] : k > 0.6 ? C[5] : C[4]) : edge ? C[4] : C[2];
            }, k > 0.35 ? 1 : k / 0.35);
          }
          if (i % 3 === 0) q.glow(b.x, b.y, b.z, 6, C[4], 0.25 * (1 - (now - b.t) / 0.32));
        }
        // the orb: gathering at the hand, then flying, its heart white, a bright bead circling it
        if (t < CHARGE + FLY) {
          const k = t < CHARGE ? t / CHARGE : 1, [x, y, z] = t < CHARGE ? [0, -H, 0] : pos((t - CHARGE) / FLY), r = 1 + 3 * ease.outBack(k), rr = r + 1.4;
          q.ball(x, y, z, rr, (nx, ny, nz) => (Math.hypot(nx, ny) > (r + 0.4) / rr ? C[3] : nx + ny < -0.45 ? WHITE : Math.hypot(nx, ny) > 0.5 ? C[5] : C[6]));
          const e1 = [0.8, -0.5, 0.33], e2 = [-0.1, 0.45, 0.88], n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          q.ring(x, y, z, r + 3.6, 0.8, C[4], 0.4 * k, n);
          for (let i = 0; i < 3; i++) {
            const a = t * 14 + (i * TAU) / 3, c = Math.cos(a) * (r + 3.6), s = Math.sin(a) * (r + 3.6);
            q.ball(x + e1[0] * c + e2[0] * s, y + e1[1] * c + e2[1] * s, z + e1[2] * c + e2[2] * s, 0.9, i ? C[6] : WHITE);
          }
          q.glow(x, y, z, 20, C[4], 0.65 * k);
          q.glow(x, y, z, 7, C[6], 0.5 * k);
        }
        ps.draw(q);
        // the burst: a ball of rays, a star flare and rings that open out and fade
        const w = t - CHARGE - FLY;
        if (w >= 0 && w < 0.5) {
          const e = w / 0.5, [x, y, z] = pos(1);
          if (e < 0.5) {
            const len = 26 * Math.pow(1 - e * 2, 1.2) + 2;
            for (let i = 0; i < 16; i++) {
              const h = 1 - (2 * i + 1) / 16, a = i * 2.39996, s = Math.sqrt(1 - h * h), L = len * (i % 3 === 0 ? 1 : 0.62);
              spike3(q, x, y, z, Math.cos(a) * s, h, Math.sin(a) * s, L, 1.3 * (1 - e * 2), (uu, v) => (v < 0.4 && uu < 0.5 ? WHITE : e < 0.3 ? C[6] : C[5]));
            }
          }
          if (e < 0.12) q.ball(x, y, z, 6 * (1 - e / 0.12) + 1, WHITE);
          const rr = 4 + 20 * ease.outCubic(e), ww = Math.max(1, 2.5 * (1 - e)), c = e < 0.3 ? C[6] : C[5], al = Math.min(1, (1 - e) * 1.5);
          q.ring(x, y, z, rr, ww, c, al, [1, 0, 0]);
          q.ring(x, y, z, rr, ww, c, al * 0.8);
          if (e < 0.4) q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 7 * (1 - e / 0.4), C[6], C[4], 0.6 * (1 - e / 0.4)));
        }
        lights.draw(q);
      },
    };
  },
};
