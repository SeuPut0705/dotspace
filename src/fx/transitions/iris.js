// The motes drifting in the light and the glints follow Sprite Fusion's open-source holy-light and sparkle
// (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, hex, clamp, smooth, ease, space, TAU, WHITE } from "../../core/index.js";
import { W, H, screenMeta, clipTo, glint, glint3, rect } from "./_lib.js";

export const meta = screenMeta({
  name: "Iris",
  desc: "A lit iris closes onto a warm spotlight where dust drifts, holds as its rim twinkles, snaps shut into a glint, then pops open from a flash with a white-hot rim throwing sparks.",
  tags: ["iris", "circle", "spotlight", "wipe"],
  duration: 2.2,
  options: { palette: ["#1c140c", "#3b2a18", "#6e5233", "#a8875a", "#d9bd8a", "#f3e2bd", "#fff7e8", "#ffffff"], focus: [160, 100], seed: 1 },
});

const D = meta.duration, CLOSE = 0.62, SNAP = 0.9, SHUT = 0.99, POP = 1.2, OPEN = 1.75, RS = 24, RW = 5, GLO = 16;

export function create(o) {
  const C = fit(o.palette, 8), ink = hex(o.color), R = new Rng(o.seed), [fx, fy] = o.focus;
  const R0 = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - fx, y - fy))) + RW + 2;
  const ps = new Particles({ rng: R, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // the hole's radius: closing, breathing on the spotlight, snapping shut; then popping open
  const radius = (t) =>
    t < CLOSE ? RS + (R0 - RS) * (1 - ease.inOutCubic(t / CLOSE))
      : t < SNAP ? RS + Math.sin((t - CLOSE) * 22) * 0.8 * (1 - (t - CLOSE) / (SNAP - CLOSE))
        : t < SHUT ? RS * (1 - ease.inCubic((t - SNAP) / (SHUT - SNAP)))
          : t < POP ? 0 : R0 * ease.outQuart(clamp((t - POP) / (OPEN - POP)));
  let t = 0, shut = false, popped = false, prevR = R0;
  const end = D - 0.05;
  return {
    update(dt) {
      t += dt;
      const r = radius(t);
      // dust drifts up through the spotlight while it holds
      if (t > CLOSE - 0.25 && t < SNAP && R.chance(0.25)) {
        const a = R.range(0, TAU), d = Math.sqrt(R.next()) * r * 0.9;
        ps.spawn(P.EMBER, fx + Math.cos(a) * d, fy + Math.sin(a) * d, R.range(-6, 6), -R.range(4, 14), R.range(0.4, 0.8), 0, 1);
      }
      // the rim twinkles as it holds
      if (t > CLOSE - 0.1 && t < SNAP && R.chance(0.3)) {
        const a = R.range(0, TAU);
        ps.spawn(P.STAR, fx + Math.cos(a) * (r + 1), fy + Math.sin(a) * (r + 1), 0, 0, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.4));
      }
      if (!shut && t >= SHUT) {
        shut = true;
        lights.add(fx, fy, 50, C[5], 0.7, 0.3);
      }
      if (!popped && t >= POP) {
        // pop: a white flash, sparks thrown out of the opening
        popped = true;
        lights.add(fx, fy, 140, C[5], 0.7, 0.45);
        lights.add(fx, fy, 50, WHITE, 0.9, 0.12);
        for (let i = 0; i < 40; i++) {
          const a = R.range(0, TAU), v = R.range(150, 420);
          ps.spawn(P.SPARK, fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, Math.cos(a) * v, Math.sin(a) * v, R.range(0.2, 0.5));
        }
      }
      // as the rim races out it sheds glinting motes that fly on and fade
      if (t > POP && t < OPEN - 0.1) {
        const vr = (r - prevR) / dt;
        for (let k = 0; k < 2; k++) {
          if (!R.chance(0.6)) continue;
          const a = R.range(0, TAU), x = fx + Math.cos(a) * r, y = fy + Math.sin(a) * r;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          ps.spawn(P.MOTE, x, y, Math.cos(a) * vr * 0.35, Math.sin(a) * vr * 0.35, Math.min(R.range(0.2, 0.45), end - t), R.chance(0.5) ? C[6] : C[5], 0.7);
        }
      }
      prevR = r;
      ps.update(dt);
      lights.update(dt);
    },
    draw(p0) {
      const p = clipTo(p0), r = radius(t);
      // the rim's heat: warm while it closes, white-hot as it pops, cooling as it opens
      const hot = t >= POP ? 1 - smooth(POP, OPEN, t) : t < SNAP ? 0.45 + 0.25 * smooth(CLOSE - 0.2, CLOSE, t) : 0.7;
      const rw = RW + (t >= POP ? 3 * hot : 0);
      if (t < OPEN + 0.05 && !(t >= SHUT && t < POP && r <= 0)) {
        for (let y = 0; y < H; y++) {
          const dy = y + 0.5 - fy, xo = Math.sqrt(Math.max(0, (r + rw) ** 2 - dy * dy)), xi = Math.abs(dy) < r ? Math.sqrt(r * r - dy * dy) : 0;
          if (xo <= 0) {
            rect(p0, 0, y, W, 1, ink);
            continue;
          }
          const a0 = clamp(Math.floor(fx - xo), 0, W), b1 = clamp(Math.ceil(fx + xo), 0, W);
          if (a0 > 0) rect(p0, 0, y, a0, 1, ink);
          if (b1 < W) rect(p0, b1, y, W - b1, 1, ink);
          // the rim band and the light just inside it
          const g = r > GLO ? Math.sqrt(Math.max(0, (r - GLO) ** 2 - dy * dy)) : 0;
          for (let x = a0; x < b1; x++) {
            const dx = x + 0.5 - fx;
            if (Math.abs(dx) < g) continue;
            const d = Math.hypot(dx, dy) - r;
            if (d >= 0) {
              // a bevel lit from the top left: bright there, a step darker round the far side
              const q = d / rw, lit = 0.5 - 0.5 * (dx * 0.7 + dy * 0.7) / (r + d + 0.01), h = hot * (0.55 + 0.6 * lit);
              p0.px(x, y, q >= 1 ? ink : q < 0.2 ? (h > 0.5 ? WHITE : h > 0.3 ? C[6] : C[5]) : q < 0.4 ? (h > 0.38 ? C[6] : C[5]) : q < 0.65 ? (h > 0.3 ? C[5] : C[4]) : q < 0.85 ? C[3] : C[2]);
              if (q < 0.5) p0.light(x, y, C[5], 0.45 * h * (1 - q * 2));
            } else if (d > -GLO) p0.light(x, y, C[5], (0.18 + 0.3 * hot) * (1 + d / GLO) ** 2);
          }
        }
      } else if (t >= SHUT && t < POP) rect(p0, 0, 0, W, H, ink);
      // the spotlight's pool of light, gathering as the iris closes, hottest at its heart
      if (r > 0 && r < 80 && t < SHUT) {
        const k = 1 - r / 80;
        p.glow(fx, fy, r * 1.15 + 6, C[5], 0.18 + 0.32 * k);
        p.glow(fx, fy, r * 0.6 + 3, C[6], 0.25 * k);
      }
      // light catches the iris as it turns: a glint runs once round the rim while it closes
      if (t > 0.08 && t < SNAP) {
        const a = -2.4 + ((t - 0.08) / (SNAP - 0.08)) * TAU, gx = fx + Math.cos(a) * (r + 1), gy = fy + Math.sin(a) * (r + 1);
        if (gx > 2 && gy > 2 && gx < W - 2 && gy < H - 2) glint(p, gx, gy, 7 + 3 * Math.sin(t * 9), t * 3, C[6], C[5], 0.9);
      }
      // snapping shut: the light collapses into a glint that lingers in the dark
      const s = t - SHUT;
      if (s > -0.06 && s < 0.22) glint(p, fx, fy, 14 * (1 - Math.abs(s + 0.01) / 0.23), s * 4, C[6], C[5]);
      // popping open: a flash at the heart
      const u = t - POP;
      if (u >= 0 && u < 0.18) glint(p, fx, fy, 20 * (1 - u / 0.18), 0.4 - u * 3, C[6], C[5]), p.glow(fx, fy, 60, WHITE, 0.6 * (1 - u / 0.18));
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// 3D: the iris as a lamp house standing in the room. A floor plate and a canopy plate, both ink, close their round
// holes together on a shaft of light where dust drifts; they snap shut on a glint (a ball of light between them),
// then pop open from a flash that throws sparks every way, rims white-hot.
export const three = {
  meta: { size: [176, 152], origin: [88, 118], bg: "ground", camera: { pitch: 0.34 } },
  create(o) {
    const C = fit(o.palette, 8), ink = hex(o.color), R = new Rng(o.seed);
    const R3 = 74, HI = 62, RS3 = 10, RW3 = 3.2, GLO3 = 8, RMAX = R3 + RW3 + 1, MID = -HI / 2;
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
    const radius = (t) =>
      t < CLOSE ? RS3 + (RMAX - RS3) * (1 - ease.inOutCubic(t / CLOSE))
        : t < SNAP ? RS3 + Math.sin((t - CLOSE) * 22) * 0.4 * (1 - (t - CLOSE) / (SNAP - CLOSE))
          : t < SHUT ? RS3 * (1 - ease.inCubic((t - SNAP) / (SHUT - SNAP)))
            : t < POP ? 0 : RMAX * ease.outQuart(clamp((t - POP) / (OPEN - POP)));
    let t = 0, shut = false, popped = false, prevR = RMAX;
    const end = D - 0.05;
    return {
      update(dt) {
        t += dt;
        const r = radius(t);
        // dust drifts up through the shaft while it holds
        if (t > CLOSE - 0.25 && t < SNAP && R.chance(0.3)) {
          const a = R.range(0, TAU), d = Math.sqrt(R.next()) * r * 0.9;
          ps.spawn3(P.EMBER, Math.cos(a) * d, -R.range(3, HI - 4), Math.sin(a) * d, R.range(-5, 5), -R.range(3, 10), R.range(-5, 5), R.range(0.4, 0.8), 0, 1);
        }
        // the rims twinkle as they hold
        if (t > CLOSE - 0.1 && t < SNAP && R.chance(0.35)) {
          const a = R.range(0, TAU);
          ps.spawn3(P.STAR, Math.cos(a) * (r + 1), R.chance(0.5) ? -0.5 : -HI + 0.5, Math.sin(a) * (r + 1), 0, 0, 0, R.range(0.2, 0.4), R.chance(0.5) ? WHITE : C[6], R.range(1, 2.2));
        }
        if (!shut && t >= SHUT) {
          shut = true;
          lights.add(0, MID, 40, C[5], 0.7, 0.3, 0);
        }
        if (!popped && t >= POP) {
          // pop: a white flash between the plates, sparks thrown out of the opening every way round
          popped = true;
          lights.add(0, MID, 90, C[5], 0.7, 0.45, 0);
          lights.add(0, MID, 36, WHITE, 0.9, 0.12, 0);
          for (let i = 0; i < 44; i++) {
            const a = R.range(0, TAU), el = Math.asin(R.range(-0.8, 0.8)), v = R.range(70, 190);
            ps.spawn3(P.SPARK, Math.cos(a) * 2, MID, Math.sin(a) * 2, Math.cos(a) * Math.cos(el) * v, Math.sin(el) * v * 0.8 - 20, Math.sin(a) * Math.cos(el) * v, R.range(0.2, 0.5));
          }
        }
        // as the rims race out they shed glinting motes that fly on and fade
        if (t > POP && t < OPEN - 0.1) {
          const vr = (r - prevR) / dt;
          for (let k = 0; k < 2; k++) {
            if (!R.chance(0.6)) continue;
            const a = R.range(0, TAU), y = R.chance(0.5) ? -1 : -HI + 1;
            if (r > R3) continue;
            ps.spawn3(P.MOTE, Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a) * vr * 0.35, 0, Math.sin(a) * vr * 0.35, Math.min(R.range(0.2, 0.45), end - t), R.chance(0.5) ? C[6] : C[5], 0.7);
          }
        }
        prevR = r;
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), r = radius(t);
        // the rim's heat: warm while it closes, white-hot as it pops, cooling as it opens
        const hot = t >= POP ? 1 - smooth(POP, OPEN, t) : t < SNAP ? 0.45 + 0.25 * smooth(CLOSE - 0.2, CLOSE, t) : 0.7;
        const rw = RW3 + (t >= POP ? 2 * hot : 0);
        if (t < OPEN + 0.05) {
          // the two plates: ink, a bevelled rim lit from the top left round the hole, a pale edge round the outside
          for (const y of [-3, -HI])
            q.plane(0, y, 0, null, R3 + RW3 + 2, (u, v, out) => {
              const d = Math.hypot(u, v), e = r > 0 ? d - r : rw + 1;
              if (e < 0) {
                if (y === -3 && e > -GLO3) (out.l = C[5]), (out.k = (0.18 + 0.3 * hot) * (1 + e / GLO3) ** 2);
                return;
              }
              if (e >= rw) {
                if (d > R3) return;
                return d > R3 - 1 ? C[2] : ink;
              }
              const k = e / rw, lit = 0.5 - (0.5 * (u * 0.7 + v * 0.7)) / (d + 0.01), h = hot * (0.55 + 0.6 * lit);
              if (k < 0.5) (out.l = C[5]), (out.k = 0.45 * h * (1 - k * 2));
              return k < 0.2 ? (h > 0.5 ? WHITE : h > 0.3 ? C[6] : C[5]) : k < 0.4 ? (h > 0.38 ? C[6] : C[5]) : k < 0.65 ? (h > 0.3 ? C[5] : C[4]) : k < 0.85 ? C[3] : C[2];
            });
        }
        // the plates' thickness: their outer wall, a step darker going down
        if (t < OPEN + 0.05 && r < R3)
          for (const y of [-3, -HI]) for (let j = 1; j <= 3; j++) q.ring(0, y + j, 0, R3, 1, j === 1 ? C[1] : C[0]);
        // the shaft between the plates: its edge, faint lines of light, a pool on the floor, hottest at its heart
        if (r > 0.5 && r < 60 && t < SHUT) {
          const k = 1 - r / 60;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + t * 0.6;
            q.line(Math.cos(a) * r * 0.94, 0, Math.sin(a) * r * 0.94, Math.cos(a) * r * 0.94, -HI, Math.sin(a) * r * 0.94, C[5], 0.25 + 0.3 * k);
          }
          q.glowLine(0, -1, 0, 0, -HI + 1, 0, r * 0.9 + 4, C[5], 0.1 + 0.18 * k);
          q.glow(0, -2, 0, r * 1.15 + 6, C[5], 0.18 + 0.32 * k);
          q.glow(0, -2, 0, r * 0.6 + 3, C[6], 0.25 * k);
        }
        // light catches the rims as the iris turns: a glint runs once round each, on opposite sides
        if (t > 0.08 && t < SNAP) {
          const a = -2.4 + ((t - 0.08) / (SNAP - 0.08)) * TAU;
          glint3(q, Math.cos(a) * (r + 1), -1, Math.sin(a) * (r + 1), 4 + 1.6 * Math.sin(t * 9), t * 3, C[6], C[5], 0.9);
          glint3(q, -Math.cos(a) * (r + 1), -HI + 1, -Math.sin(a) * (r + 1), 4 + 1.6 * Math.sin(t * 9 + 2), t * 3 + 1, C[6], C[5], 0.9);
        }
        // snapping shut: the light collapses into a glint that lingers between the plates
        const s = t - SHUT;
        if (s > -0.06 && s < 0.22) glint3(q, 0, MID, 0, 7 * (1 - Math.abs(s + 0.01) / 0.23), s * 4, C[6], C[5]);
        // popping open: a flash at the heart
        const u = t - POP;
        if (u >= 0 && u < 0.18) {
          q.ball(0, MID, 0, 5 * (1 - u / 0.18), WHITE);
          glint3(q, 0, MID, 0, 11 * (1 - u / 0.18), 0.4 - u * 3, C[6], C[5]);
          q.glow(0, MID, 0, 40, WHITE, 0.6 * (1 - u / 0.18));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
