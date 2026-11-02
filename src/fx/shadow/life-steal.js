import { Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, space, GRAVITY, TAU, WHITE, mix, luma, READY } from "../../core/index.js";
import { ringFast, Drops } from "./_lib.js";

export const meta = {
  name: "Life steal",
  desc: "A target on the right is struck and bleeds red orbs; they hang a moment, then whip home as comet streaks and flood the caster crimson.",
  tags: ["shadow", "life-steal", "drain", "blood", "heal", "directional", "magic", "one-shot"],
  size: [184, 100],
  origin: [36, 92],
  duration: 2.2,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a", "#ffe6de"], dark: "#2a1040", seed: 11 },
};

const GRASP = { ...READY, crouch: 3, lean: 3, fx: 17, fy: -28, bx: -6, by: -21, ffx: 10, fbx: -9 };
const FED = { turn: 1.15, crouch: 0, lean: -3, hy: -1, fx: -13, fy: -37, bx: 14, by: -37, ffx: -3, fbx: 4 };
export const act = {
  onBody: true,
  follow: 0,
  target: { x: 104 },
  poses: [
    [-0.46, READY],
    [-0.2, { ...READY, crouch: 4, lean: -2, fx: 3, fy: -27, bx: 8, by: -20 }],
    [0, GRASP, "snap"],
    [0.4, GRASP],
    [0.7, { ...GRASP, fx: 13, fy: -26, lean: 1 }],
    [0.8, { ...FED, crouch: 2 }, "snap"],
    [1.22, FED],
    [1.7, { turn: 1, crouch: 2, fx: -11, fy: -26, bx: 12, by: -26, ffx: -3, fbx: 4 }],
    [2.2, READY],
  ],
  hits: [
    { t: 0.01, stop: 0.07, shake: 0.12, amp: 1, push: 1.6, straw: 12, skin: "red", y: -24 },
    { t: 1.6, push: 0, straw: 0, flash: 0, skin: null },
  ],
};

// the target point on the right, the caster's heart; when the orbs turn for home
const TX = 104, TY = -24, HX = 1, HY = -20, N = 7;

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), A = o.actor, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[5]] });
  const drops = new Drops({ onLand: (x) => stains.push({ x, t0: t }) }), stains = [], lights = [];
  const orbs = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (i - (N - 1) / 2) * 0.4 + R.range(-0.12, 0.12), sp = R.range(100, 170);
    orbs.push({ x: TX, y: TY, vx: Math.cos(a) * sp + 10, vy: Math.sin(a) * sp, home: 0.36 + i * 0.05 + R.range(0, 0.04), trail: [], done: false, at: 0, size: R.range(1.6, 2.4) });
  }
  let t = 0, hit = false, flush = 0;
  const light = (x, y, r, c, k, life) => lights.push({ x, y, r, c, k, life, max: life });

  return {
    update(dt) {
      t += dt;
      if (!hit) {
        hit = true;
        light(TX, TY, 54, C[5], 1, 0.35);
        light(TX, TY, 18, WHITE, 1, 0.08);
        for (let i = 0; i < 14; i++) drops.add(TX + R.range(-3, 3), TY + R.range(-3, 3), R.range(-40, 90), R.range(-140, -20), R.chance(0.4) ? 2 : 1);
        for (let i = 0; i < 12; i++) {
          const a = R.range(0, TAU), sp = R.range(80, 170);
          ps.spawn(P.SPARK, TX, TY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.35));
        }
      }
      for (const b of orbs) {
        if (b.done) continue;
        if (t < b.home) {
          // burst out, slowing to a hover
          b.vx -= b.vx * 5 * dt;
          b.vy -= b.vy * 5 * dt;
        } else {
          // whip home: steer hard at the caster's heart, faster and faster
          const dx = HX - b.x, dy = HY - b.y, d = Math.hypot(dx, dy) || 1, pull = 2600 * Math.min(1, (t - b.home) * 3);
          b.vx += (dx / d) * pull * dt;
          b.vy += (dy / d) * pull * dt;
          b.vx -= b.vx * 2.2 * dt;
          b.vy -= b.vy * 2.2 * dt;
          if (d < 6) {
            b.done = true;
            b.at = t;
            flush = Math.min(1.5, flush + 0.45);
            light(HX, HY, 30, C[5], 0.8, 0.25);
            for (let i = 0; i < 6; i++) {
              const a = R.range(0, TAU), sp = R.range(40, 100);
              ps.spawn(P.SPARK, HX, HY, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.12, 0.3));
            }
            for (let i = 0; i < 3; i++) ps.spawn(P.EMBER, HX + R.range(-8, 8), HY + R.range(-6, 14), R.range(-10, 10), -R.range(15, 35), R.range(0.6, 1.1), C[6]);
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.trail.unshift([b.x, b.y]);
        if (b.trail.length > 26) b.trail.pop();
      }
      flush -= flush * 2.6 * dt;
      for (let i = lights.length - 1; i >= 0; i--) if ((lights[i].life -= dt) <= 0) lights.splice(i, 1);
      for (let i = stains.length - 1; i >= 0; i--) if (t - stains[i].t0 > 0.8) stains.splice(i, 1);
      drops.update(dt);
      ps.update(dt);
    },
    drawBack(p) {
      // the wound: a dark red bloom where the target was struck, thinning away
      const k = 1 - smooth(0.1, 0.9, t);
      if (k > 0) {
        p.disc(TX, TY, 6 + t * 10, C[2], 0.5 * k);
        p.glow(TX, TY, 30, C[4], 0.35 * k);
      }
      for (const s of stains) p.dot(s.x, -0.5, C[3], 1 - (t - s.t0) / 0.8);
    },
    draw(p) {
      // the caster flushes crimson as the orbs land: its own colours pushed toward blood-red, a hot outline
      const fk = Math.min(1, flush) * (1 - smooth(1.5, 2.05, t));
      if (A && fk > 0.03) {
        for (let my = 0; my < A.h; my++)
          for (let mx = 0; mx < A.w; mx++) {
            const c0 = A.pixels[my * A.w + mx];
            if (!c0) continue;
            const l = luma(c0);
            p.blend(A.x + mx, A.y + my, l > 0.6 ? C[6] : l > 0.4 ? C[5] : l > 0.2 ? C[4] : C[3], 0.45 * fk);
          }
        if (fk > 0.12) p.outline(A.mask, A.x, A.y, fk > 0.6 ? C[6] : fk > 0.3 ? C[5] : C[3]);
        p.glow(HX, HY, 28, C[5], 0.45 * fk);
      }
      // the hit on the target
      if (t < 0.12) sparkle(p, TX, TY, 10 * (1 - t / 0.12), C[7], C[5], 0.6);
      const ru = t / 0.28;
      if (ru < 1) ringFast(p, TX, TY, 4 + 16 * ease.outCubic(ru), Math.max(1, 2 * (1 - ru)), ru < 0.4 ? C[7] : C[5]);
      drops.draw(p, C[3], C[6]);
      // the orbs: comet tails tapering from a hot head through blood-red to a dark wine thread
      for (const b of orbs) {
        if (b.done && t - b.at > 0.2) continue;
        // the tail is swallowed after the head: it shortens rather than fades
        const n = b.done ? Math.floor(b.trail.length * (1 - (t - b.at) / 0.2)) : b.trail.length;
        for (let i = n - 1; i >= 1; i--) {
          const u = i / 25, [x0, y0] = b.trail[i - 1], [x1, y1] = b.trail[i];
          p.line(x1, y1, x0, y0, u < 0.15 ? C[7] : u < 0.35 ? C[6] : u < 0.6 ? C[5] : u < 0.8 ? C[4] : C[2]);
          if (i < 7) p.disc(x1, y1, (b.size + 0.4) * (1 - i / 7), u < 0.12 ? C[6] : C[5], 0.8);
          if (i % 6 === 3) p.glow(x1, y1, 6, C[5], 0.2 * (1 - u));
        }
        if (b.done) continue;
        const pulse = t < b.home ? 0.8 + 0.2 * Math.sin(t * 30 + b.size * 9) : 1;
        p.circle(b.x, b.y, b.size + 0.9, C[4]);
        p.circle(b.x, b.y, b.size * pulse, C[6]);
        p.px(b.x - 0.5, b.y - 0.5, WHITE);
        p.glow(b.x, b.y, 9, C[5], 0.5);
      }
      ps.draw(p);
      for (const l of lights) {
        const q = l.life / l.max;
        p.glow(l.x, l.y, l.r * (0.6 + 0.4 * q), l.c, l.k * q * q);
      }
    },
  };
}

// ---- 3D: the target stands on +x. It bleeds orbs in every direction (a sphere, a little more above than below) that
// hang, then whip home along real arcs that bow out of the x-y plane; the hit rings are true rings, drops fall in z.
export const three = {
  meta: { size: [296, 142], origin: [148, 100], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), A = o.actor, floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[5]] });
    const lights = new Lights(), drops = [], stains = [], orbs = [];
    // directions on a sphere round the wound: golden-angle azimuths, elevations from a little below the level to straight up
    for (let i = 0; i < N; i++) {
      const e = -0.35 + (1.35 * (((i * 3) % N) + 0.5)) / N, az = i * 2.4 + R.range(-0.2, 0.2), h = Math.sqrt(1 - e * e), sp = R.range(100, 170);
      orbs.push({
        x: TX, y: TY, z: 0, vx: Math.cos(az) * h * sp + 10, vy: -e * sp, vz: Math.sin(az) * h * sp,
        home: 0.36 + i * 0.05 + R.range(0, 0.04), trail: [], done: false, at: 0, size: R.range(1.6, 2.4), d0: 0,
        // the arc home bows out of the plane, to the near side or the far side in turn
        bz: (i % 2 ? 1 : -1) * R.range(26, 46), by: R.range(-12, 12),
      });
    }
    let t = 0, hit = false, flush = 0;

    return {
      update(dt) {
        t += dt;
        if (!hit) {
          hit = true;
          lights.add(TX, TY, 54, C[5], 1, 0.35, 0);
          lights.add(TX, TY, 18, WHITE, 1, 0.08, 0);
          for (let i = 0; i < 16; i++) {
            const a = R.range(0, TAU), sp = R.range(10, 80);
            drops.push({ x: TX + R.range(-3, 3), y: TY + R.range(-3, 3), z: R.range(-3, 3), vx: Math.cos(a) * sp, vy: R.range(-140, -20), vz: Math.sin(a) * sp, size: R.chance(0.4) ? 2 : 1 });
          }
          for (let i = 0; i < 14; i++) {
            const u = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - u * u), sp = R.range(80, 170);
            ps.spawn3(P.SPARK, TX, TY, 0, Math.cos(a) * s * sp, u * sp, Math.sin(a) * s * sp, R.range(0.15, 0.35));
          }
        }
        for (const b of orbs) {
          if (b.done) continue;
          if (t < b.home) {
            // burst out, slowing to a hover
            b.vx -= b.vx * 5 * dt;
            b.vy -= b.vy * 5 * dt;
            b.vz -= b.vz * 5 * dt;
          } else {
            // whip home: steer hard at the caster's heart, faster and faster; the aim point starts off to the side
            // and slides in, so the path bows
            const dx = HX - b.x, dy = HY - b.y, dz = -b.z, d = Math.hypot(dx, dy, dz) || 1;
            if (!b.d0) b.d0 = d;
            const k = clamp((d - 10) / b.d0) ** 2, ax = dx, ay = dy + b.by * k, az = dz + b.bz * k, al = Math.hypot(ax, ay, az) || 1;
            const pull = 2600 * Math.min(1, (t - b.home) * 3);
            b.vx += (ax / al) * pull * dt;
            b.vy += (ay / al) * pull * dt;
            b.vz += (az / al) * pull * dt;
            // near the heart it slows, so a fast orb lands rather than shooting through
            const drag = 2.2 + 16 * clamp(1 - d / 45);
            b.vx -= b.vx * drag * dt;
            b.vy -= b.vy * drag * dt;
            b.vz -= b.vz * drag * dt;
            if (d < 8) {
              b.done = true;
              b.at = t;
              flush = Math.min(1.5, flush + 0.45);
              lights.add(HX, HY, 30, C[5], 0.8, 0.25, 0);
              for (let i = 0; i < 7; i++) {
                const u = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - u * u), sp = R.range(40, 100);
                ps.spawn3(P.SPARK, HX, HY, 0, Math.cos(a) * s * sp, u * sp - 20, Math.sin(a) * s * sp, R.range(0.12, 0.3));
              }
              for (let i = 0; i < 3; i++) ps.spawn3(P.EMBER, HX + R.range(-8, 8), HY + R.range(-6, 14), R.range(-8, 8), R.range(-10, 10), -R.range(15, 35), R.range(-10, 10), R.range(0.35, 0.7), C[6]);
            }
          }
        }
        for (const b of orbs) {
          if (b.done) continue;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          b.trail.unshift([b.x, b.y, b.z]);
          if (b.trail.length > 26) b.trail.pop();
        }
        flush -= flush * 2.6 * dt;
        lights.update(dt);
        for (let i = stains.length - 1; i >= 0; i--) if (t - stains[i].t0 > 0.8) stains.splice(i, 1);
        // blood drops fall to the floor in 3D and leave a stain where they land
        for (let i = drops.length - 1; i >= 0; i--) {
          const d = drops[i];
          d.vy += GRAVITY * 0.8 * dt;
          d.vx -= d.vx * 0.4 * dt;
          d.vz -= d.vz * 0.4 * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.z += d.vz * dt;
          if (d.vy > 0 && d.y >= 0) {
            stains.push({ x: d.x, z: d.z, t0: t });
            drops.splice(i, 1);
          }
        }
        ps.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the caster flushes crimson as the orbs land: its own colours pushed toward blood-red, a hot outline (it stands at depth 0)
        const fk = Math.min(1, flush) * (1 - smooth(1.5, 2.05, t));
        if (A && fk > 0.03) {
          for (let my = 0; my < A.h; my++)
            for (let mx = 0; mx < A.w; mx++) {
              const c0 = A.pixels[my * A.w + mx];
              if (!c0) continue;
              const l = luma(c0);
              p.blend(A.x + mx, A.y + my, l > 0.6 ? C[6] : l > 0.4 ? C[5] : l > 0.2 ? C[4] : C[3], 0.45 * fk);
            }
          if (fk > 0.12) p.outline(A.mask, A.x, A.y, fk > 0.6 ? C[6] : fk > 0.3 ? C[5] : C[3]);
        }
        // stains on the floor where the drops landed
        for (const s of stains)
          q.plane(s.x, -0.4, s.z, null, 2, (u, v, out) => {
            if (u * u + v * v > 2.2) return;
            out.c = C[3];
            out.a = 1 - (t - s.t0) / 0.8;
          });
        // the drops: a dark body with a lit top
        for (const d of drops) {
          const up = d.vy < 0;
          q.px(d.x, d.y, d.z, C[3]);
          if (d.size > 1.4) q.px(d.x, d.y + (up ? 1 : -1), d.z, C[3]);
          q.px(d.x, d.y - (d.size > 1.4 && !up ? 1 : 0), d.z, C[6]);
        }
        // the orbs: comet tails tapering from a hot head through blood-red to a dark wine thread, in 3D points
        const tails = [];
        for (const b of orbs) {
          if (b.done && t - b.at > 0.2) continue;
          // the tail is swallowed after the head: it shortens rather than fades
          const n = b.done ? Math.floor(b.trail.length * (1 - (t - b.at) / 0.2)) : b.trail.length;
          for (let i = n - 1; i >= 1; i--) {
            const u = i / 25, [x0, y0, z0] = b.trail[i - 1], [x1, y1, z1] = b.trail[i];
            q.line(x1, y1, z1, x0, y0, z0, u < 0.15 ? C[7] : u < 0.35 ? C[6] : u < 0.6 ? C[5] : u < 0.8 ? C[4] : C[2]);
            if (i < 7) tails.push({ x: x1, y: y1, z: z1, r: (b.size + 0.4) * (1 - i / 7), c: u < 0.12 ? C[6] : C[5] });
          }
          if (b.done) continue;
          const pulse = t < b.home ? 0.8 + 0.2 * Math.sin(t * 30 + b.size * 9) : 1, rad = b.size + 0.9, core = (b.size * pulse) / rad;
          q.ball(b.x, b.y, b.z, rad, (nx, ny) => (Math.hypot(nx, ny) > core ? C[4] : nx + ny < -0.6 ? WHITE : C[6]));
        }
        // the hit on the target: a glint, a ring facing the caster (+x) and one out on the floor
        if (t < 0.12) q.at(TX, TY, 0, (pp) => sparkle(pp, 0, 0, 10 * (1 - t / 0.12), C[7], C[5], 0.6));
        const ru = t / 0.28;
        if (ru < 1) {
          const r = 4 + 16 * ease.outCubic(ru), w = Math.max(1, 2 * (1 - ru)), col = ru < 0.4 ? C[7] : C[5];
          q.ring(TX, TY, 0, r, w, col, 1, [1, 0, 0]);
          q.ring(TX, -0.5, 0, r * 1.5, w, col, 0.8 * (1 - ru));
        }
        // translucent: the wound's dark bloom, the tails' soft heads, far to near
        const k = 1 - smooth(0.1, 0.9, t);
        if (k > 0) q.disc(TX, TY, 0, 6 + t * 10, C[2], 0.5 * k);
        for (const s of q.sort(tails, (e) => [e.x, e.y, e.z])) q.disc(s.x, s.y, s.z, s.r, s.c, 0.8);
        ps.draw(q);
        // light: along the tails, round the orbs, the wound, the caster, then the flares
        for (const b of orbs) {
          if (b.done && t - b.at > 0.2) continue;
          const n = b.done ? Math.floor(b.trail.length * (1 - (t - b.at) / 0.2)) : b.trail.length;
          for (let i = 3; i < n; i += 6) q.glow(...b.trail[i], 6, C[5], 0.2 * (1 - i / 25));
          if (!b.done) q.glow(b.x, b.y, b.z, 9, C[5], 0.5);
        }
        if (k > 0) q.glow(TX, TY, 0, 30, C[4], 0.35 * k);
        if (A && fk > 0.03) q.glow(HX, HY, 0, 28, C[5], 0.45 * fk);
        lights.draw(q);
      },
    };
  },
};
