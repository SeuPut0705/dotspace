// The crescent and trace recipe is adapted from Sprite Fusion's open-source slash, and the vapour from his
// ice and poison (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, space, sparkle, clamp, smooth, ease, rand, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, travel, smear, glowAlong, lay, smear3, glowAlong3, onSwing3, travel3 } from "./_lib.js";

export const meta = {
  name: "Scythe reap",
  desc: "A slow, huge dark crescent reaps round the front with a pale ghostly edge; it hangs, then tears away from the tail into curling wisps and cold vapour.",
  tags: ["melee", "scythe", "reap", "dark", "ghost", "death", "slash", "combat", "one-shot"],
  size: [184, 116],
  origin: [84, 98],
  duration: 2.1,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#07040c", "#140a22", "#24113a", "#3b1d58", "#5a3a82", "#7fd6c0", "#d8fff2", "#ffffff"],
    seed: 13,
  },
};

// the butt rests on the floor in one hand; both hands take it out to the right, and he turns with it round the front
const REST_ = { ...READY, weapon: "scythe", x: 2, sa: -1.5, fx: 11, fy: -22, bx: 7, by: -16 };
const OUT_ = { ...REST_, two: true, crouch: 4, lean: 4, fx: 17, fy: -27, sa: -0.45, ffx: 11, fbx: -8 };
const END = { ...REST_, two: true, x: 0, yaw: 3.14, crouch: 6, lean: 4, fx: 15, fy: -24, sa: 0.3, ffx: 11, fbx: -10, toeB: true };
export const act = {
  target: { x: 66 },
  poses: [
    [-0.56, REST_],
    [-0.26, OUT_],
    [0.08, { ...OUT_, crouch: 5 }],
    [0.2, { ...OUT_, yaw: 0.8, crouch: 5, lean: 3, fx: 16, fy: -23, sa: 0.1, ghost: 1 }],
    [0.3, { ...OUT_, x: 1, yaw: 1.9, crouch: 6, lean: 3, fx: 15, fy: -23, sa: 0.2, ghost: 1 }],
    [0.42, END],
    [0.92, { ...END, crouch: 5 }],
    [1.3, { ...REST_, x: 1, yaw: 1.4, crouch: 4 }],
    [1.7, REST_],
  ],
  hits: [{ t: 0.14, stop: 0.12, shake: 0.16, amp: 2, push: 2.4, straw: 20, skin: "shadow" }],
  dust: [{ t: 0.3, x: 2, n: 6 }],
};

const WIND = 0.08, SWEEP = 0.34, HANG = 0.14, TEAR = 0.55;
const T0 = WIND, T1 = WIND + SWEEP, T2 = T1 + HANG, T3 = T2 + TEAR;
const head = (t) => ease.inOutSine(clamp((t - T0) / SWEEP));

export function create(o) {
  const C = fit(o.palette, 8), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, haze: C[5] }), lights = new Lights();
  // a wide reap from out on the right, round the front of the fighter, to the left
  const A = swing({ cx: 8, cy: -33, R: 52, sy: 0.6, k: 0.1, rot: 0.08, a0: -0.5, dir: 1, span: 3.5 });
  const W = 21;
  const wisps = [];
  let t = 0, lastTear = 0;
  // how far the tear has eaten in from the tail (0..1 of the span), ragged by a per-pixel threshold
  const tear = () => smooth(T2, T3, t);
  const addWisp = (x, y, far) => wisps.push({ x, y, vx: Rg.range(-12, 12), vy: -Rg.range(8, 26), life: Rg.range(0.5, 0.9), max: 0, seed: Rg.range(0, 100), pts: [], far });
  return {
    update(dt) {
      t += dt;
      // the cold gathers on the blade before it moves
      if (t < WIND && Rg.chance(0.5)) {
        const [x, y] = onSwing(A, A.R - 4, 0);
        ps.spawn(P.VAPOUR, x + Rg.range(-14, 14), y + Rg.range(-8, 8), Rg.range(-10, 10), Rg.range(-6, 6), Rg.range(0.3, 0.5), C[5], Rg.range(1.5, 2.5));
      }
      // the edge sheds a little vapour as it goes
      if (t > T0 && t < T1 && Rg.chance(0.5)) {
        const tr = travel(A, A.span * head(t) * Rg.range(0.75, 1));
        ps.spawn(P.VAPOUR, tr.x, tr.y, tr.dx * 20, -Rg.range(4, 14), Rg.range(0.5, 0.9), C[6], Rg.range(2, 3.5), 0, Math.sin(tr.a) < 0 ? PF.BACK : 0);
      }
      // tearing away: wisps peel off where the crescent is coming apart
      const k = tear();
      for (let u = lastTear; u < k * 1.15; u += 0.022) {
        const uu = Math.min(1, u) * A.span, tr = travel({ ...A, R: A.R - Rg.range(0, 8) }, uu), far = Math.sin(tr.a) < 0;
        addWisp(tr.x, tr.y, far);
        if (Rg.chance(0.5)) ps.spawn(P.VAPOUR, tr.x, tr.y, Rg.range(-10, 10), -Rg.range(6, 18), Rg.range(0.55, 0.85), Rg.chance(0.5) ? C[5] : C[4], Rg.range(2.5, 4.5), 0, far ? PF.BACK : 0);
        if (Rg.chance(0.2)) ps.spawn(P.STAR, tr.x + Rg.range(-3, 3), tr.y + Rg.range(-3, 3), 0, -6, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[6] : WHITE, Rg.range(0.6, 1.6), 0, far ? PF.BACK : 0);
      }
      lastTear = Math.max(lastTear, k * 1.15);
      // wisps rise, sway and curl, leaving a fading thread behind them
      for (let i = wisps.length - 1; i >= 0; i--) {
        const w = wisps[i];
        w.max += dt;
        if (w.max > w.life) {
          wisps.splice(i, 1);
          continue;
        }
        w.vy -= 30 * dt;
        w.vx += Math.sin(w.max * 9 + w.seed) * 120 * dt;
        w.vx -= w.vx * 2 * dt;
        w.vy -= w.vy * 1.2 * dt;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.pts.push([w.x, w.y]);
        if (w.pts.length > 14) w.pts.shift();
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      this.blade(p, -1);
      ps.draw(p, "back");
      this.threads(p, true);
    },
    draw(p) {
      this.blade(p, 1);
      // the blade's point glints cold as it sets off and where it stops
      if (t < WIND + 0.05) {
        const [x, y] = onSwing(A, A.R - 3, 0);
        sparkle(p, x, y, 6 * Math.min(1, t / 0.04) * (1 - smooth(WIND - 0.02, WIND + 0.05, t)), C[6], C[5], 0.45);
      }
      const g = t - T1 + 0.06;
      if (g > 0 && g < 0.3) {
        const [x, y] = onSwing(A, A.R - 3, A.span);
        sparkle(p, x, y, 9 * ease.outBack(Math.min(1, g / 0.06)) * (1 - g / 0.3), C[6], C[5], 0.55);
      }
      ps.draw(p, "front");
      this.threads(p, false);
      lights.draw(p);
    },
    blade(p, half) {
      const U = A.span * head(t), k = tear();
      if (U < 0.02 || k >= 1) return;
      const ramp = half < 0 ? [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]] : C;
      smear(p, A, 0, U, W, (u, r, out, a) => {
        const v = u / U, w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.7)), 0.55);
        if (w < 0.5) return;
        const q = (A.R - r) / w;
        if (q < 0 || q > 1) return;
        // torn away from the tail: a ragged front of per-pixel thresholds
        const n = rand(Math.floor(u * 40), Math.floor(r), 7);
        if (k > 0 && (u / A.span) < k * 1.2 - n * 0.2) return;
        // a pale ghostly rim, a dark body that deepens inward, a faint lit seam
        const ci = q < 0.08 ? 7 : q < 0.16 ? 6 : q < 0.25 ? 5 : q < 0.4 ? 4 : q < 0.62 ? 3 : 2;
        out.c = ramp[t > T1 && q < 0.2 ? ci - 1 : ci];
        out.a = Math.min(1, v / 0.25);
      }, half);
      glowAlong(p, A, A.R - 2, Math.max(0, k * 1.2 * A.span - 0.3), U, 14, C[5], (u) => 0.3 * (u / U), half, 0.25);
    },
    threads(p, back) {
      for (const w of wisps) {
        if (w.far !== back) continue;
        const life = 1 - w.max / w.life;
        for (let i = 1; i < w.pts.length; i++) {
          const f = i / w.pts.length;
          p.line(w.pts[i - 1][0], w.pts[i - 1][1], w.pts[i][0], w.pts[i][1], f > 0.75 ? C[6] : f > 0.4 ? C[5] : C[3], life * (0.3 + 0.7 * f));
        }
        if (life > 0.5) p.glow(w.x, w.y, 5, C[5], 0.25 * life);
      }
    },
  };
}

// 3D: the crescent is a true arc on the tilted plane the 2D one is the front view of, leaning a little further in
// depth so it reaps round the front of the fighter, low and wide, from the right (towards the dummy), across him and
// out to the left; from the side it is a sheet cutting through space. As it tears, the wisps curl up in helices
// (a threaded line with a pale soul-head) and cold vapour and motes drift out in every direction, with fog creeping
// along the floor under the arc, whose dotted shadow follows the blade on the floor.

export const three = {
  meta: { size: [200, 132], origin: [98, 104], camera: { pitch: 0.4 } },
  create(o) {
    const C = fit(o.palette, 8), Rg = new Rng(o.seed), ps = new Particles({ rng: Rg, ground: () => 0, haze: C[5] }), lights = new Lights();
    const Y = -21;
    const base = swing({ cx: 8, cy: Y, R: 52, sy: 0.6, rot: 0.08, a0: -0.5, dir: 1, span: 3.5 });
    // the reap lies low and wide, on a plane tipped nearly flat; a thin pale echo of the edge rides a little above, a touch askew
    const A = lay(base, { yaw: 0.25, lean: 0.52 }), E = lay({ ...base, cy: Y - 8, R: 47 }, { yaw: -0.2, lean: 0.46 });
    const W = 32, WE = 9, DIM = [C[0], C[0], C[1], C[2], C[3], C[4], C[5], C[6]];
    const wisps = [];
    let t = 0, lastTear = 0;
    const tear = () => smooth(T2, T3, t);
    const addWisp = (x, y, z) => wisps.push({ x, y, z, vx: Rg.range(-12, 12), vy: -Rg.range(8, 26), vz: Rg.range(-12, 12), life: Rg.range(0.5, 0.9), max: 0, seed: Rg.range(0, 100), pts: [] });
    // outward from the plane's centre, flat: where cold drifts off the blade
    const out = (x, z) => { const l = Math.hypot(x - A.c[0], z - A.c[2]) || 1; return [(x - A.c[0]) / l, (z - A.c[2]) / l]; };
    const farAt = (q, S, r, a) => q.depth(S.c[0] + r * (S.U[0] * Math.cos(a) + S.V[0] * Math.sin(a)), Y, S.c[2] + r * (S.U[2] * Math.cos(a) + S.V[2] * Math.sin(a))) > q.depth(S.c[0], Y, S.c[2]);
    const crescent = (q, S, w0, lag) => {
      const U = S.span * head(t - lag), k = tear();
      if (U < 0.02 || k >= 1) return;
      smear3(q, S, 0, U, w0, (u, r, out, a) => {
        const v = u / U, w = w0 * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.7)), 0.55);
        if (w < 0.5) return;
        const f = (S.R - r) / w;
        if (f < 0 || f > 1) return;
        // torn away from the tail: a ragged front of per-pixel thresholds
        const nz = rand(Math.floor(u * 40), Math.floor(r), 7);
        if (k > 0 && u / S.span < k * 1.2 - nz * 0.2) return;
        // a pale ghostly rim, a dark body that deepens inward, a faint lit seam
        const ci = f < 0.08 ? 7 : f < 0.16 ? 6 : f < 0.25 ? 5 : f < 0.4 ? 4 : f < 0.62 ? 3 : 2, ramp = farAt(q, S, r, a) ? DIM : C;
        out.c = ramp[t > T1 && f < 0.2 ? ci - 1 : ci];
        out.a = Math.min(1, v / 0.25);
      });
      glowAlong3(q, S, S.R - 2, Math.max(0, k * 1.2 * S.span - 0.3), U, 14, C[5], (u) => (S === A ? 0.3 : 0.15) * (u / U), 0.25);
    };
    return {
      update(dt) {
        t += dt;
        // the cold gathers on the blade before it moves
        if (t < WIND && Rg.chance(0.5)) {
          const [x, y, z] = onSwing3(A, A.R - 4, 0);
          ps.spawn3(P.VAPOUR, x + Rg.range(-14, 14), y + Rg.range(-8, 8), z + Rg.range(-14, 14), Rg.range(-10, 10), Rg.range(-6, 6), Rg.range(-10, 10), Rg.range(0.3, 0.5), C[5], Rg.range(1.5, 2.5));
        }
        // the edge sheds a little vapour as it goes, and fog creeps along the floor under it
        if (t > T0 && t < T1) {
          if (Rg.chance(0.5)) {
            const tr = travel3(A, A.span * head(t) * Rg.range(0.75, 1));
            ps.spawn3(P.VAPOUR, tr.x, tr.y, tr.z, tr.dx * 20 + Rg.range(-6, 6), -Rg.range(4, 14), tr.dz * 20 + Rg.range(-6, 6), Rg.range(0.5, 0.9), C[6], Rg.range(2, 3.5));
          }
          if (Rg.chance(0.35)) {
            const tr = travel3(A, A.span * head(t) * Rg.range(0.5, 1));
            ps.spawn3(P.VAPOUR, tr.x, -2, tr.z, tr.dx * 10 + Rg.range(-5, 5), -Rg.range(1, 5), tr.dz * 10 + Rg.range(-5, 5), Rg.range(0.7, 1.2), C[3], Rg.range(2.5, 4));
          }
        }
        // tearing away: wisps peel off where the crescent is coming apart, spreading out of its plane
        const k = tear();
        for (let u = lastTear; u < k * 1.15; u += 0.022) {
          const uu = Math.min(1, u) * A.span, tr = travel3(A, uu, A.R - Rg.range(0, 8)), [ox, oz] = out(tr.x, tr.z), dn = Rg.range(-12, 12);
          addWisp(tr.x, tr.y, tr.z);
          if (Rg.chance(0.5)) ps.spawn3(P.VAPOUR, tr.x, tr.y, tr.z, Rg.range(-10, 10) + ox * 8 + A.n[0] * dn, -Rg.range(6, 18), Rg.range(-10, 10) + oz * 8 + A.n[2] * dn, Rg.range(0.55, 0.85), Rg.chance(0.5) ? C[5] : C[4], Rg.range(2.5, 4.5));
          if (Rg.chance(0.2)) ps.spawn3(P.STAR, tr.x + Rg.range(-3, 3), tr.y + Rg.range(-3, 3), tr.z + Rg.range(-3, 3), ox * 4, -6, oz * 4, Rg.range(0.25, 0.5), Rg.chance(0.5) ? C[6] : WHITE, Rg.range(0.6, 1.6));
          if (Rg.chance(0.35)) ps.spawn3(P.MOTE, tr.x, tr.y, tr.z, ox * Rg.range(8, 30) + A.n[0] * dn * 2, -Rg.range(4, 22) + A.n[1] * dn, oz * Rg.range(8, 30) + A.n[2] * dn * 2, Rg.range(0.4, 0.8), C[5 + Rg.int(0, 1)], 0.5);
        }
        lastTear = Math.max(lastTear, k * 1.15);
        // wisps rise, sway and curl round, leaving a fading thread behind them
        for (let i = wisps.length - 1; i >= 0; i--) {
          const w = wisps[i];
          w.max += dt;
          if (w.max > w.life) {
            wisps.splice(i, 1);
            continue;
          }
          w.vy -= 30 * dt;
          w.vx += Math.sin(w.max * 9 + w.seed) * 120 * dt;
          w.vz += Math.cos(w.max * 9 + w.seed) * 120 * dt;
          w.vx -= w.vx * 2 * dt;
          w.vz -= w.vz * 2 * dt;
          w.vy -= w.vy * 1.2 * dt;
          w.x += w.vx * dt;
          w.y += w.vy * dt;
          w.z += w.vz * dt;
          w.pts.push([w.x, w.y, w.z]);
          if (w.pts.length > 14) w.pts.shift();
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), U = A.span * head(t), k = tear();
        // the shadow of the blade runs along the floor under it, and goes with the tear
        if (t > T0 && k < 1) {
          let prev = null;
          for (let u = Math.min(1, k * 1.2) * A.span; u < U; u += 0.06) {
            const [x, , z] = onSwing3(A, A.R - 6, u);
            if (prev) q.line(prev[0], 0, prev[1], x, 0, z, C[3], 0.45 * Math.min(1, u / U / 0.25) * (1 - k));
            prev = [x, z];
          }
        }
        // the blade, and its thin echo a beat behind
        crescent(q, E, WE, 0.06);
        crescent(q, A, W, 0);
        // the blade's point glints cold as it sets off and where it stops
        if (t < WIND + 0.05) {
          const [x, y, z] = onSwing3(A, A.R - 3, 0);
          q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 6 * Math.min(1, t / 0.04) * (1 - smooth(WIND - 0.02, WIND + 0.05, t)), C[6], C[5], 0.45));
        }
        const g = t - T1 + 0.06;
        if (g > 0 && g < 0.3) {
          const [x, y, z] = onSwing3(A, A.R - 3, A.span);
          q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 9 * ease.outBack(Math.min(1, g / 0.06)) * (1 - g / 0.3), C[6], C[5], 0.55));
        }
        // threads with a soul at the head, far to near
        for (const w of q.sort(wisps, (w) => [w.x, w.y, w.z])) {
          const life = 1 - w.max / w.life;
          for (let i = 1; i < w.pts.length; i++) {
            const f = i / w.pts.length, a = w.pts[i - 1], b = w.pts[i];
            q.line(a[0], a[1], a[2], b[0], b[1], b[2], f > 0.75 ? C[6] : f > 0.4 ? C[5] : C[3], life * (0.3 + 0.7 * f));
          }
          if (life > 0.2) q.glow(w.x, w.y, w.z, 6, C[5], 0.3 * life);
          if (life > 0.4) q.at(w.x, w.y, w.z, (pp) => { pp.disc(0, 0, 1.6, C[5], 0.55 * life); pp.dot(0, 0, C[6], 1); });
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
