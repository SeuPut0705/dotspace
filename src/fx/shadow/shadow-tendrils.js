import { Particles, P, Rng, fit, clamp, smooth, ease, noise, space, TAU, WHITE, mix } from "../../core/index.js";
import { VOID, Puffs, PK, Drops, floorPool, INK_LIGHT, InkDrops, inkPool, inkCollar, inkWalk, inkShade, inkBall } from "./_lib.js";

export const meta = {
  name: "Shadow tendrils",
  desc: "A dark pool opens on the floor; tentacles with lit rims and hooked tips lash up out of it with a splash, writhe, and sink back as it closes.",
  tags: ["shadow", "tentacle", "tendril", "ground", "dark", "magic", "one-shot"],
  size: [208, 130],
  origin: [104, 106],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: VOID, seed: 3 },
};

const RX = 40, OPEN = 0.34, SHUT = 2.5, SINK = 0.5, LX = -0.6, LY = -0.8;

// a tentacle's spine at t: it rises out of the pool along its own curve, a wave writhes up it, its lean sways
// and sometimes whips, and its tip curls into a hook; points every 0.5 px with angle and half-width
function spine(T, t) {
  const e = clamp((t - T.t0) / 0.2), s1 = clamp((t - T.t1) / SINK);
  if (e <= 0 || s1 >= 1) return null;
  // it lashes up past its length and settles; going, it lifts a little, then slides back under
  const lift = 0.07 * Math.sin(Math.PI * clamp(s1 / 0.3)), down = ease.inOutCubic(clamp((s1 - 0.12) / 0.88));
  const rise = ease.outBack(e, 1.8) * (1 + lift) * (1 - down), hidden = (1 - rise) * T.L;
  const writhe = T.A * (0.25 + 0.75 * smooth(T.t0 + 0.08, T.t0 + 0.5, t));
  const hook = (0.04 + T.H * ease.outBack(clamp((t - T.t0 - 0.1) / 0.32), 2.5)) * (1 + 0.5 * s1) * (1 + 0.18 * Math.sin(t * 2.3 + T.ph));
  let lean = T.lean + 0.12 * Math.sin(t * 1.6 + T.ph);
  if (T.whip) lean += T.whip.a * Math.exp(-(((t - T.whip.t) / 0.14) ** 2));
  let th = -Math.PI / 2 + lean, x = T.x - Math.cos(th) * hidden, y = T.y - Math.sin(th) * hidden;
  const pts = [], n = Math.ceil(T.L / 0.5);
  for (let i = 0; i <= n; i++) {
    const s = i * 0.5, u = s / T.L;
    pts.push({ x, y, th, w: T.W * Math.pow(1 - u, 0.75) + 0.45, u, s });
    th += 0.5 * (writhe * Math.sin((s / T.lam) * TAU - T.om * t + T.ph) + T.curl * hook * smooth(0.58, 1, u));
    x += Math.cos(th) * 0.5;
    y += Math.sin(th) * 0.5;
  }
  return pts;
}

// a tentacle in cross-sections: a dark body with a lighter half toward the light, then the rims: bright where it
// faces the light (white where it faces it squarely), violet on the side the pool lights, suckers inside the hook
function tentacle(p, T, pts, C, t) {
  const surf = T.y;
  for (const q of pts) {
    if (q.y > surf) continue;
    const nx = -Math.sin(q.th), ny = Math.cos(q.th), ks = nx * LX + ny * LY >= 0 ? 1 : -1;
    for (let v = -q.w; v <= q.w; v += 0.5) {
      const x = q.x + nx * v, y = q.y + ny * v;
      const u = (v / q.w) * ks;
      if (y <= surf) p.px(x, y, u > 0.55 ? C[2] : u > -0.45 ? C[1] : C[0]);
    }
  }
  // a pulse of light runs up it as it lashes, then slower ones while it writhes
  const pulse = (t - T.t0) * 150, slow = (((t - T.t0) * 55) % (T.L * 1.8)) - 4;
  for (const q of pts) {
    if (q.y > surf) continue;
    const nx = -Math.sin(q.th), ny = Math.cos(q.th), f = nx * LX + ny * LY, ks = f >= 0 ? 1 : -1;
    const lit = ks * q.w, x0 = q.x + nx * lit, y0 = q.y + ny * lit, x1 = q.x - nx * lit, y1 = q.y - ny * lit;
    if (y1 <= surf) p.px(x1, y1, C[3]);
    if (y0 <= surf) p.px(x0, y0, Math.abs(f) > 0.8 && q.u > 0.15 ? C[7] : q.u > 0.85 ? C[6] : Math.abs(f) > 0.3 ? C[6] : C[5]);
    if (q.u > 0.62 && q.u < 0.93 && q.s % 3 < 0.5) p.px(q.x + nx * T.curl * q.w * 0.45, q.y + ny * T.curl * q.w * 0.45, C[4]);
    const dp = Math.min(Math.abs(q.s - pulse), Math.abs(q.s - slow) * 1.6);
    if (dp < 2.5) p.px(q.x, q.y, dp < 1 ? C[7] : C[5]);
  }
  // the tip catches the light, and light runs along it
  const tip = pts[pts.length - 1];
  if (tip.y <= surf) {
    p.px(tip.x, tip.y, WHITE);
    p.glow(tip.x, tip.y, 6, C[6], 0.25);
  }
  for (let i = 0; i < pts.length; i += 8) if (pts[i].y < surf) p.glow(pts[i].x, pts[i].y, 9, C[4], 0.1);
  const pq = pts[Math.min(pts.length - 1, Math.max(0, Math.round(pulse * 2)))];
  if (pulse < T.L && pq.y < surf) p.glow(pq.x, pq.y, 10, C[6], 0.45);
  // where it breaks the surface: a lit collar of ink
  const base = pts.find((q) => q.y <= surf);
  if (base) {
    const w = base.w + 1.5;
    p.line(base.x - w, surf, base.x + w, surf, C[5]);
    p.px(base.x - w - 1, surf + 0.5, C[3]);
    p.px(base.x + w + 1, surf + 0.5, C[3]);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const DIM = [C[0], C[0], C[1], C[1], C[3], C[4], C[5], C[6]];
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[4] });
  const puffs = new Puffs({ rng: R, flame: [C[7], C[6], C[5], C[4], C[3], C[2], C[1], C[1], C[0]], soot: [mix(C[3], C[2], 0.55), mix(C[2], C[1], 0.5)], cap: mix(C[4], C[2], 0.5), rim: [C[6], C[5], C[4]], floor });
  const ripples = [], splats = [], lights = [];
  let t = 0, acc = 0;
  const rx = (tt) => RX * ease.outCubic(clamp(tt / OPEN)) * (1 - ease.inCubic(clamp((tt - SHUT) / 0.45)));
  const inPool = (x, tt) => Math.abs(x) < rx(tt) * 0.95;
  const drops = new Drops({
    onLand: (x, y, v, s) => {
      if (inPool(x, t)) ripples.push({ x, t0: t, life: 0.5, w: 0.6 });
      else splats.push({ x, t0: t, s });
    },
  });
  // seven tentacles in two rows: the back row taller and dimmer, hooks mostly curling inward
  const rows = [[-22, -2.5], [-8, -3], [7, -3], [21, -2.5], [-28, 2.5], [-1, 3], [27, 2.5]];
  const order = [3, 0, 5, 2, 4, 1, 6], last = [1, 5, 0, 6, 3, 2, 4];
  const tents = rows.map(([x, y], i) => {
    const back = y < 0, sx = Math.sign(x) || 1;
    return {
      x: x + R.range(-3, 3), y, back,
      L: back ? R.range(46, 62) : R.range(32, 46), W: back ? R.range(3.2, 4) : R.range(3.8, 4.6),
      lean: sx * (0.06 + Math.abs(x) / 120) + R.range(-0.06, 0.06), curl: R.chance(0.75) ? -sx : sx,
      lam: R.range(36, 50), om: R.range(4.5, 7) * R.sign(), ph: R.range(0, TAU), A: R.range(0.06, 0.085), H: R.range(0.15, 0.32),
      t0: 0.3 + order[i] * 0.045 + R.range(0, 0.03), t1: 1.5 + last[i] * 0.1 + R.range(0, 0.05),
      whip: R.chance(0.45) ? { t: R.range(0.9, 1.5), a: R.range(0.28, 0.45) * R.sign() } : null,
      up: false, down: false,
    };
  });

  function splash(x, y, n, power) {
    for (let i = 0; i < n; i++) drops.add(x + R.range(-2, 2), y - 1, R.range(-70, 70) * power, -R.range(90, 230) * power, R.chance(0.4) ? 2 : 1);
    ripples.push({ x, t0: t, life: 0.7, w: 1 });
    lights.push({ x, y: y - 7, r: 30, k: 0.6 * power, life: 0.25, max: 0.25 });
  }

  return {
    update(dt) {
      t += dt;
      for (const T of tents) {
        if (!T.up && t >= T.t0) {
          T.up = true;
          splash(T.x, T.y, 12, 1);
          for (let i = 0; i < 4; i++) ps.spawn(P.SPARK, T.x, T.y - 2, R.range(-80, 80), -R.range(120, 260), R.range(0.2, 0.45));
        }
        if (!T.down && t >= T.t1 + SINK * 0.8) {
          T.down = true;
          splash(T.x, T.y, 6, 0.6);
        }
        // glints run over the rims while they stand
        if (t > T.t0 + 0.2 && t < T.t1 && R.chance(dt * 1.6)) {
          const pts = spine(T, t), q = pts && pts[Math.floor(R.range(0.3, 0.95) * pts.length)];
          if (q && q.y < T.y) ps.spawn(P.STAR, q.x - Math.sin(q.th) * q.w, q.y + Math.cos(q.th) * q.w, 0, -4, R.range(0.25, 0.5), C[6], R.range(1, 2.2));
        }
      }
      // the pool breathes out wisps and motes while it's open
      const r = rx(t);
      if (r > 8 && t < SHUT - 0.4) {
        for (acc += dt * 9; acc > 1; acc--) puffs.spawn(PK.SOOT, R.range(-0.8, 0.8) * r, -R.range(1, 4), R.range(-8, 8), -R.range(14, 30), R.range(0.6, 0.85), R.range(3, 6));
        if (R.chance(dt * 16)) ps.spawn(P.MOTE, R.range(-0.8, 0.8) * r, -2, R.range(-8, 8), -R.range(30, 80), R.range(0.5, 1), R.pick([C[7], C[6], C[6], C[5]]), R.range(0.6, 1.1));
        if (R.chance(dt * 5)) ps.spawn(P.EMBER, R.range(-0.8, 0.8) * r, -3, R.range(-10, 10), -R.range(20, 45), R.range(0.6, 1), C[6]);
        if (R.chance(dt * 3)) ripples.push({ x: R.range(-0.7, 0.7) * r, t0: t, life: 0.6, w: 0.5 });
        // a violet haze hangs over the pool, lit from inside
        if (R.chance(dt * 7)) ps.spawn(P.VAPOUR, R.range(-0.7, 0.7) * r, -R.range(2, 8), R.range(-6, 6), -R.range(10, 22), R.range(0.6, 0.9), R.chance(0.5) ? C[3] : C[4], R.range(3, 6));
      }
      for (const a of [ripples, splats]) for (let i = a.length - 1; i >= 0; i--) if (t - a[i].t0 > (a[i].life ?? 0.6)) a.splice(i, 1);
      for (let i = lights.length - 1; i >= 0; i--) if ((lights[i].life -= dt) <= 0) lights.splice(i, 1);
      drops.update(dt);
      puffs.update(dt);
      ps.update(dt);
    },
    drawBack(p) {
      const r = rx(t), k = r / RX;
      floorPool(p, C, r, t, ripples);
      if (k > 0) {
        p.glow(0, -16, 86, C[4], 0.22 * k);
        p.glow(0, -8, r * 1.7 + 12, C[4], 0.32 * k * (0.9 + 0.1 * Math.sin(t * 5)));
        p.glow(0, 0, r * 1.15, C[5], 0.18 * k);
      }
      puffs.draw(p, PK.SOOT, { x: 0, y: 6, k: k, reach: 70 });
      ps.draw(p, "back");
      for (const T of tents) if (T.back) {
        const pts = spine(T, t);
        if (pts) tentacle(p, T, pts, DIM, t);
      }
    },
    draw(p) {
      for (const T of tents) if (!T.back) {
        const pts = spine(T, t);
        if (pts) tentacle(p, T, pts, C, t);
      }
      drops.draw(p, C[1], C[5]);
      for (const s of splats) {
        const a = 1 - (t - s.t0) / 0.6;
        p.dot(s.x, -0.5, C[1], a * 1.5);
        p.dot(s.x + 1, -0.5, C[2], a);
        if (s.s > 1) p.dot(s.x - 1, -0.5, C[2], a);
        p.dot(s.x, -1.5, C[5], a);
      }
      ps.draw(p, "front");
      for (const l of lights) {
        const q = l.life / l.max;
        p.glow(l.x, l.y, l.r * (0.6 + 0.4 * q), C[5], l.k * q * q);
      }
    },
  };
}

// ---- 3D: the pool is a true circle on the floor and seven tentacles rise from points over the whole disc, each a chain
// of lit ink balls on its own 3D curve (a writhe wave in its azimuth plane, a quarter-turn wave across it so it
// corkscrews, a hook at the tip). The floor cuts them: nothing below y = 0 is drawn, a lit collar rings each.
const DS = 1.4;

function spine3(T, t) {
  const e = clamp((t - T.t0) / 0.2), s1 = clamp((t - T.t1) / SINK);
  if (e <= 0 || s1 >= 1) return null;
  const lift = 0.07 * Math.sin(Math.PI * clamp(s1 / 0.3)), down = ease.inOutCubic(clamp((s1 - 0.12) / 0.88));
  const rise = ease.outBack(e, 1.8) * (1 + lift) * (1 - down), hidden = Math.max(0, 1 - rise) * T.L, len = T.L * Math.max(1, rise);
  const writhe = T.A * (0.25 + 0.75 * smooth(T.t0 + 0.08, T.t0 + 0.5, t));
  const hook = (0.04 + T.H * ease.outBack(clamp((t - T.t0 - 0.1) / 0.32), 2.5)) * (1 + 0.5 * s1) * (1 + 0.18 * Math.sin(t * 2.3 + T.ph));
  // the lean (outward from the pool's middle) sways and sometimes whips, in any direction
  const ta = T.lean + 0.12 * Math.sin(t * 1.6 + T.ph), tb = 0.1 * Math.sin(t * 1.3 + T.ph * 1.7), ca = Math.cos(T.az), sa = Math.sin(T.az);
  let hx = ca * ta - sa * tb, hz = sa * ta + ca * tb;
  if (T.whip) {
    const w = T.whip.a * Math.exp(-(((t - T.whip.t) / 0.14) ** 2));
    hx += w * Math.cos(T.whip.az);
    hz += w * Math.sin(T.whip.az);
  }
  const tl = Math.hypot(hx, 1, hz), Tv = [hx / tl, -1 / tl, hz / tl];
  let nx = Math.cos(T.caz), nz = Math.sin(T.caz);
  const d = nx * Tv[0] + nz * Tv[2];
  nx -= d * Tv[0];
  const ny = -d * Tv[1];
  nz -= d * Tv[2];
  const nl = Math.hypot(nx, ny, nz);
  const pts = inkWalk(T.x - Tv[0] * hidden, -Tv[1] * hidden, T.z - Tv[2] * hidden, Tv, [nx / nl, ny / nl, nz / nl], len, DS, (s) => {
    const ph = (s / T.lam) * TAU - T.om * t + T.ph;
    return [writhe * Math.sin(ph) + hook * smooth(0.58, 1, s / len), T.A2 * writhe * Math.sin(ph + 1.9)];
  });
  for (const q of pts) {
    q.u = q.s / len;
    q.w = T.W * Math.pow(1 - q.u, 0.75) + 0.45;
  }
  return pts;
}

// a tentacle as a chain of lit balls cut by the floor, a pulse of light running up it, suckers inside the hook, a white
// tip, a lit collar where it breaks the surface
function tentacle3(q, shade, C, T, pts, t) {
  const pulse = (t - T.t0) * 150, slow = (((t - T.t0) * 55) % (T.L * 1.8)) - 4;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], dp = Math.min(Math.abs(a.s - pulse), Math.abs(a.s - slow) * 1.6);
    inkBall(q, shade, a.x, a.y, a.z, Math.max(0.6, a.w), dp < 1 ? 1 : dp < 2.5 ? 0.5 : 0);
  }
  for (const a of pts) {
    if (a.u > 0.62 && a.u < 0.93 && a.y < -1 && Math.round(a.s / DS) % 2 === 0) q.ball(a.x + a.nx * a.w * 0.8, a.y + a.ny * a.w * 0.8, a.z + a.nz * a.w * 0.8, 0.8, C[4]);
  }
  const first = pts.findIndex((a) => a.y <= 0);
  if (first >= 0) {
    const b = pts[first], a = first > 0 ? pts[first - 1] : b, f = a.y === b.y ? 0 : a.y / (a.y - b.y);
    inkCollar(q, C, a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, b.w * 1.05 + 1.4);
  }
  const tip = pts[pts.length - 1];
  if (tip.y < 0) q.px(tip.x, tip.y, tip.z, WHITE);
}

function glows3(q, C, T, pts, t) {
  const tip = pts[pts.length - 1], pulse = (t - T.t0) * 150;
  if (tip.y < 0) q.glow(tip.x, tip.y, tip.z, 6, C[6], 0.25);
  for (let i = 0; i < pts.length; i += 3) if (pts[i].y < -1) q.glow(pts[i].x, pts[i].y, pts[i].z, 9, C[4], 0.06);
  const pq = pts[Math.min(pts.length - 1, Math.max(0, Math.round(pulse / DS)))];
  if (pulse < T.L && pq.y < 0) q.glow(pq.x, pq.y, pq.z, 10, C[6], 0.45);
}

export const three = {
  meta: { size: [176, 138], origin: [88, 106], camera: { pitch: 0.32 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]], haze: C[4] });
    const puffs = new Puffs({ rng: R, flame: [C[7], C[6], C[5], C[4], C[3], C[2], C[1], C[1], C[0]], soot: [mix(C[3], C[2], 0.55), mix(C[2], C[1], 0.5)], cap: mix(C[4], C[2], 0.5), rim: [C[6], C[5], C[4]], floor });
    const ripples = [], splats = [], lights = [];
    let t = 0, acc = 0;
    const rx = (tt) => RX * ease.outCubic(clamp(tt / OPEN)) * (1 - ease.inCubic(clamp((tt - SHUT) / 0.45)));
    const drops = new InkDrops({
      onLand: (x, z, v, s) => {
        if (Math.hypot(x, z) < rx(t) * 0.95) ripples.push({ x, z, t0: t, life: 0.5, w: 0.6 });
        else if (t < 3.1) splats.push({ x, z, t0: t, s, life: Math.min(0.6, 3.1 - t) });
      },
    });
    // a point over the pool's disc: k is the share of its radius
    const onPool = (k) => {
      const a = R.range(0, TAU), d = Math.sqrt(R.next()) * k * rx(t);
      return [Math.cos(a) * d, Math.sin(a) * d];
    };
    // seven tentacles: one near the middle (the tallest), six spread round the disc
    const order = [3, 0, 5, 2, 4, 1, 6], last = [1, 5, 0, 6, 3, 2, 4];
    const tents = order.map((_, i) => {
      const mid = i === 0, ra = mid ? R.range(0, TAU) : ((i - 1) / 6) * TAU + R.range(-0.3, 0.3), rr = mid ? R.range(0, 4) : R.range(19, 28);
      return {
        x: Math.cos(ra) * rr, z: Math.sin(ra) * rr, az: ra,
        L: mid ? R.range(54, 62) : R.range(34, 56), W: R.range(3.4, 4.5),
        lean: mid ? R.range(0.02, 0.08) : 0.06 + rr / 120 + R.range(-0.06, 0.06),
        caz: ra + (R.chance(0.75) ? Math.PI : 0) + R.range(-0.6, 0.6),
        lam: R.range(36, 50), om: R.range(4.5, 7) * R.sign(), ph: R.range(0, TAU), A: R.range(0.06, 0.085), H: R.range(0.15, 0.32), A2: R.range(0.35, 0.7) * R.sign(),
        t0: 0.3 + order[i] * 0.045 + R.range(0, 0.03), t1: 1.5 + last[i] * 0.1 + R.range(0, 0.05),
        whip: R.chance(0.45) ? { t: R.range(0.9, 1.5), a: R.range(0.28, 0.45), az: R.range(0, TAU) } : null,
        up: false, down: false,
      };
    });

    function splash(x, z, n, power) {
      for (let i = 0; i < n; i++) {
        const a = R.range(0, TAU), sp = R.range(5, 70) * power;
        drops.add(x + R.range(-2, 2), -1, z + R.range(-2, 2), Math.cos(a) * sp, -R.range(90, 230) * power, Math.sin(a) * sp, R.chance(0.4) ? 2 : 1);
      }
      ripples.push({ x, z, t0: t, life: 0.7, w: 1 });
      lights.push({ x, y: -7, z, r: 30, k: 0.6 * power, life: 0.25, max: 0.25 });
    }

    return {
      update(dt) {
        t += dt;
        for (const T of tents) {
          if (!T.up && t >= T.t0) {
            T.up = true;
            splash(T.x, T.z, 12, 1);
            for (let i = 0; i < 4; i++) {
              const a = R.range(0, TAU), sp = R.range(0, 80);
              ps.spawn3(P.SPARK, T.x, -2, T.z, Math.cos(a) * sp, -R.range(120, 260), Math.sin(a) * sp, R.range(0.2, 0.45));
            }
          }
          if (!T.down && t >= T.t1 + SINK * 0.8) {
            T.down = true;
            splash(T.x, T.z, 6, 0.6);
          }
          // glints run over the rims, on the side toward the light, while they stand
          if (t > T.t0 + 0.2 && t < T.t1 && R.chance(dt * 1.6)) {
            const pts = spine3(T, t), a = pts && pts[Math.floor(R.range(0.3, 0.95) * pts.length)];
            if (a && a.y < 0) {
              const dl = INK_LIGHT[0] * a.tx + INK_LIGHT[1] * a.ty + INK_LIGHT[2] * a.tz;
              let lx = INK_LIGHT[0] - dl * a.tx, ly = INK_LIGHT[1] - dl * a.ty, lz = INK_LIGHT[2] - dl * a.tz;
              const l = Math.hypot(lx, ly, lz) || 1;
              (lx /= l), (ly /= l), (lz /= l);
              ps.spawn3(P.STAR, a.x + lx * a.w, a.y + ly * a.w, a.z + lz * a.w, 0, -4, 0, R.range(0.25, 0.5), C[6], R.range(1, 2.2));
            }
          }
        }
        // the pool breathes out wisps and motes while it's open
        const r = rx(t);
        if (r > 8 && t < SHUT - 0.4) {
          for (acc += dt * 9; acc > 1; acc--) {
            const [x, z] = onPool(0.8);
            puffs.spawn(PK.SOOT, x, -R.range(1, 4), R.range(-8, 8), -R.range(14, 30), R.range(0.6, 0.85), R.range(3, 6), 0, false, z, R.range(-8, 8));
          }
          if (R.chance(dt * 16)) {
            const [x, z] = onPool(0.8);
            ps.spawn3(P.MOTE, x, -2, z, R.range(-8, 8), -R.range(30, 80), R.range(-8, 8), R.range(0.5, 1), R.pick([C[7], C[6], C[6], C[5]]), R.range(0.6, 1.1));
          }
          if (R.chance(dt * 5)) {
            const [x, z] = onPool(0.8);
            ps.spawn3(P.EMBER, x, -3, z, R.range(-10, 10), -R.range(20, 45), R.range(-10, 10), R.range(0.6, 1), C[6]);
          }
          if (R.chance(dt * 3)) {
            const [x, z] = onPool(0.7);
            ripples.push({ x, z, t0: t, life: 0.6, w: 0.5 });
          }
          // a violet haze hangs over the pool, lit from inside
          if (R.chance(dt * 7)) {
            const [x, z] = onPool(0.7);
            ps.spawn3(P.VAPOUR, x, -R.range(2, 8), z, R.range(-6, 6), -R.range(10, 22), R.range(-6, 6), R.range(0.6, 0.9), R.chance(0.5) ? C[3] : C[4], R.range(3, 6));
          }
        }
        for (const a of [ripples, splats]) for (let i = a.length - 1; i >= 0; i--) if (t - a[i].t0 > (a[i].life ?? 0.6)) a.splice(i, 1);
        for (let i = lights.length - 1; i >= 0; i--) if ((lights[i].life -= dt) <= 0) lights.splice(i, 1);
        drops.update(dt);
        puffs.update(dt);
        ps.update(dt);
      },
      draw(p) {
        const q = space(p, o), shade = inkShade(q, C), r = rx(t), k = r / RX, spines = tents.map((T) => spine3(T, t));
        // solid things first: the pool, the tentacles, the drops
        inkPool(q, C, r, t, ripples);
        tents.forEach((T, i) => spines[i] && tentacle3(q, shade, C, T, spines[i], t));
        drops.draw(q, C[1], C[5]);
        for (const s of splats) {
          const a = 1 - (t - s.t0) / s.life;
          q.dot(s.x, -0.4, s.z, C[1], a * 1.5);
          q.dot(s.x + 1, -0.4, s.z, C[2], a);
          if (s.s > 1) q.dot(s.x - 1, -0.4, s.z, C[2], a);
          q.dot(s.x, -1.4, s.z, C[5], a);
        }
        // then light
        if (k > 0) {
          q.glow(0, -16, 0, 86, C[4], 0.22 * k);
          q.glow(0, -8, 0, r * 1.7 + 12, C[4], 0.32 * k * (0.9 + 0.1 * Math.sin(t * 5)));
          q.glow(0, 0, 0, r * 1.15, C[5], 0.18 * k);
        }
        tents.forEach((T, i) => spines[i] && glows3(q, C, T, spines[i], t));
        for (const l of lights) {
          const f = l.life / l.max;
          q.glow(l.x, l.y, l.z, l.r * (0.6 + 0.4 * f), C[5], l.k * f * f);
        }
        // translucent last: smoke and the lot of particles, far to near
        puffs.draw(q, PK.SOOT, { x: 0, y: -2, z: 0, k, reach: 70 });
        ps.draw(q);
      },
    };
  },
};
