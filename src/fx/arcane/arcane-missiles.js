// The bolt and its pop (a layered head with spinning rays, a flash disc, a cross, a ring, plasma sparks and stars)
// are adapted from Sprite Fusion's open-source energy bolt (https://www.spritefusion.com/pixel-art-vfx/energy),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, PAL, fit, sparkle, space, clamp, smooth, ease, TAU, WHITE, READY } from "../../core/index.js";

const HX = 15, HY = -24, TX = 152, TY = -22, N = 5, TRAIL = 18;

export const meta = {
  name: "Arcane missiles",
  desc: "A volley of violet bolts fans out of the hand, curls round on twisting ribbons and pops on the target one after another.",
  tags: ["arcane", "missile", "projectile", "homing", "volley", "magic", "directional", "one-shot"],
  size: [240, 116],
  origin: [26, 88],
  duration: 1.75,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: PAL.arcane, seed: 3 },
};

const OPEN = { ...READY, x: -3, crouch: 4, lean: 4, fx: 18, fy: -24, bx: -6, by: -22, ffx: 11, fbx: -9 };
const KICK = { ...OPEN, fx: 15, fy: -26, lean: 2 };
const GATHER = { ...READY, x: -3, crouch: 4, lean: -2, fx: 6, fy: -24, bx: 8, by: -24, ffx: 9, fbx: -7 };
export const act = {
  target: { x: 152 },
  poses: [
    [-0.52, { ...READY, x: -3 }],
    [-0.24, GATHER],
    [0, { ...GATHER, crouch: 5 }],
    [0.05, KICK, "snap"],
    [0.1, OPEN, "snap"],
    [0.15, KICK, "snap"],
    [0.2, OPEN, "snap"],
    [0.25, KICK, "snap"],
    [0.29, OPEN, "snap"],
    [0.33, KICK, "snap"],
    [0.38, OPEN, "snap"],
    [0.43, KICK, "snap"],
    [0.48, OPEN, "snap"],
    [1.2, { ...OPEN, crouch: 3 }],
    [1.7, { ...READY, x: -3 }],
  ],
  hits: [
    { t: 0.77, stop: 0.02, push: 0.7, straw: 4, y: -24, flash: 0.03 },
    { t: 0.85, stop: 0.02, push: 0.7, straw: 4, y: -24, flash: 0.03 },
    { t: 0.95, stop: 0.02, push: 0.7, straw: 4, y: -24, flash: 0.03 },
    { t: 1.08, stop: 0.02, push: 0.7, straw: 4, y: -24, flash: 0.03 },
    { t: 1.2, stop: 0.07, shake: 0.14, amp: 1, push: 1.4, straw: 9, y: -24 },
  ],
};

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
  // each bolt leaves the hand on its own heading, then homes in harder and faster until it lands
  const fan = [-1.05, 0.7, -0.5, 1.1, -1.4];
  const bolts = fan.map((a, i) => {
    a += R.range(-0.12, 0.12);
    const sp = R.range(130, 165);
    return { t0: 0.05 + i * 0.1, x: HX, y: HY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, trail: [], hit: -1, on: false, tx: TX + R.range(-3, 3), ty: TY + R.range(-6, 6), tw: R.range(0, TAU), acc: 0 };
  });
  const pops = [];
  let t = 0;

  function ribbon(p, b) {
    const pts = b.trail, n = pts.length, fade = b.hit < 0 ? 1 : 1 - clamp((t - b.hit) / 0.16);
    if (n < 2 || fade <= 0) return;
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let d = 0; d < L; d += 0.5) {
        const u = (i + d / L) / (n - 1), x = x0 + ((x1 - x0) * d) / L, y = y0 + ((y1 - y0) * d) / L, a = (1 - u) * 1.7 * fade;
        // the body: a capsule that tapers down the tail, white along its middle near the head, cooling outward
        const w = 2.6 * Math.pow(1 - u, 0.8) + 0.3;
        for (let q = -w; q <= w; q += 0.5) {
          const v = Math.abs(q) / w;
          p.dot(x + nx * q, y + ny * q, v < 0.35 ? (u < 0.25 ? WHITE : C[6]) : v < 0.7 ? (u < 0.4 ? C[6] : C[5]) : u < 0.5 ? C[5] : C[4], a * (v < 0.7 ? 1 : 0.75));
        }
        // two strands twisting round it: bright where they come round the front, dim behind
        for (const s of [0, Math.PI]) {
          const ph = u * 10 - t * 26 + b.tw + s, off = Math.sin(ph) * (w + 1.4);
          if (Math.cos(ph) > -0.2) p.dot(x + nx * off, y + ny * off, Math.cos(ph) > 0.4 ? (u < 0.35 ? WHITE : C[6]) : C[4], a);
        }
      }
      if (i % 3 === 0) p.glow(x0, y0, 9 * (1 - i / n) + 3, C[5], 0.3 * (1 - i / n) * fade);
    }
  }

  function head(p, b) {
    const x = b.x, y = b.y;
    for (let i = 0; i < 4; i++) {
      const a = t * 24 + (i * TAU) / 4 + b.tw, l = 5.5 + 1.5 * Math.sin(t * 50 + i);
      p.line(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, x + Math.cos(a) * l, y + Math.sin(a) * l, C[6]);
    }
    p.circle(x, y, 3.8, C[4]);
    p.circle(x, y, 3, C[5]);
    p.circle(x, y, 2.1, C[6]);
    p.circle(x, y, 1.2, WHITE);
    p.glow(x, y, 24, C[5], 0.6);
    p.glow(x, y, 7, WHITE, 0.4);
  }

  function pop(p, q, x, y) {
    if (q < 0.16) {
      const r = 9 * (1 - q / 0.16) + 1.5;
      p.circle(x, y, r + 1.5, C[5]);
      p.circle(x, y, r, WHITE);
    }
    if (q < 0.4) {
      const l = 15 * (1 - q / 0.4) + 3;
      for (let d = -l; d <= l; d++) {
        const a = Math.abs(d) / l, c = a < 0.3 ? WHITE : a < 0.65 ? C[6] : C[5];
        p.dot(x + d, y, c, 1.15 - a);
        p.dot(x, y + d * 0.7, c, 1.15 - a);
      }
    }
    const rr = 3 + 18 * ease.outCubic(q);
    p.ring(x, y, rr + 0.5, Math.max(1, 3 * (1 - q)), q < 0.3 ? WHITE : C[6], 1.2 - q);
  }

  // the lock: four brackets close on the target and pulse as each bolt lands
  function lock(p) {
    const k = smooth(0, 0.22, t) * (1 - smooth(1.15, 1.45, t));
    if (k <= 0) return;
    let kick = 0;
    for (const q of pops) kick = Math.max(kick, Math.exp(-(((t - q.t) / 0.06) ** 2)));
    const r = 9 + 10 * (1 - ease.outCubic(smooth(0, 0.22, t))) + 3 * kick, spin = t * 1.5;
    for (let i = 0; i < 4; i++) {
      const a0 = spin + (i * TAU) / 4 - 0.38;
      for (let a = a0; a <= a0 + 0.76; a += 0.06) p.dot(TX + Math.cos(a) * r, TY + Math.sin(a) * r, kick > 0.4 ? WHITE : C[5], k);
    }
    p.glow(TX, TY, 12, C[4], 0.2 * k);
  }

  return {
    update(dt) {
      t += dt;
      for (const b of bolts) {
        if (t < b.t0 || b.hit >= 0) continue;
        if (!b.on) {
          b.on = true;
          lights.add(HX, HY, 28, C[5], 0.7, 0.14);
          for (let i = 0; i < 4; i++) ps.spawn(P.MOTE, HX, HY, Math.cos(Math.atan2(b.vy, b.vx) + R.range(-0.6, 0.6)) * R.range(60, 140), Math.sin(Math.atan2(b.vy, b.vx) + R.range(-0.6, 0.6)) * R.range(60, 140), R.range(0.12, 0.25), C[6], 0.6);
        }
        const age = t - b.t0, dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = 150 + 560 * age * age, steer = Math.min(1, (1.4 + 15 * age) * dt);
        b.vx += ((dx / d) * sp - b.vx) * steer;
        b.vy += ((dy / d) * sp - b.vy) * steer;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.trail.unshift([b.x, b.y]);
        if (b.trail.length > TRAIL) b.trail.pop();
        if ((b.acc += dt) > 0.012) {
          b.acc = 0;
          if (R.chance(0.6)) ps.spawn(P.MOTE, b.x, b.y, -b.vx * 0.08 + R.range(-25, 25), -b.vy * 0.08 + R.range(-25, 25), R.range(0.2, 0.4), R.chance(0.5) ? C[6] : C[5], 0.55);
        }
        if (d < 3 || age > 1.3) {
          b.hit = t;
          pops.push({ t, x: b.x, y: b.y });
          lights.add(b.x, b.y, 70, C[5], 0.9, 0.3);
          lights.add(b.x, b.y, 24, WHITE, 0.85, 0.09);
          for (let i = 0; i < 16; i++) {
            const a = R.range(0, TAU), v = R.range(80, 230);
            ps.spawn(P.SPARK, b.x, b.y, Math.cos(a) * v, Math.sin(a) * v - 40, R.range(0.15, 0.45));
          }
          for (let i = 0; i < 7; i++) {
            const a = R.range(-Math.PI, 0.3), v = R.range(40, 140);
            ps.spawn(i % 2 ? P.STAR : P.MOTE, b.x, b.y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.25, 0.48), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.6));
          }
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // the floor catches the light of each pop
      for (const q of pops) {
        const k = 1 - clamp((t - q.t) / 0.5);
        if (k > 0) p.glow(q.x, -1, 22, C[5], 0.25 * k * k);
      }
    },
    draw(p) {
      lock(p);
      for (const b of bolts) if (b.on) ribbon(p, b);
      for (const b of bolts) if (b.on && b.hit < 0) head(p, b);
      for (const q of pops) {
        const k = (t - q.t) / 0.35;
        if (k < 1) pop(p, k, q.x, q.y);
      }
      if (t < 0.55) sparkle(p, HX, HY, 3 + 2 * Math.sin(t * 40), C[6], C[5], 0.45 * (1 - t / 0.55));
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// 3D: the bolts leave the hand in a cone (not a fan in one plane) and home in on the target along real curling
// paths: a tapered capsule trail with two strands wound round it in space, a ball head with rays turning round its
// heading. The lock is a gimbal cage of bracket arcs round the target; each pop is a flash ball, a three-axis cross,
// a sphere of three rings and a ring on the floor, with sparks thrown in every direction.
const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// two unit vectors spanning the plane with normal n
const spanOf = (n) => {
  const e1 = norm3(cross3(n, Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
  return [e1, cross3(n, e1)];
};
const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
// (polar angle off the +x axis, heading round it: 0 is straight up)
const CONE = [[1.05, 0.2], [1.0, 1.5], [0.7, 3.0], [1.2, 4.6], [1.4, 5.8]];

export const three = {
  meta: { size: [432, 190], origin: [216, 134], bg: "ground", camera: { pitch: 0.28 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[6], C[5], C[4]] }), lights = new Lights();
    const bolts = CONE.map(([th, hd], i) => {
      th += R.range(-0.12, 0.12);
      hd += R.range(-0.12, 0.12);
      const sp = R.range(130, 165);
      return {
        t0: 0.05 + i * 0.1, x: HX, y: HY, z: 0, vx: Math.cos(th) * sp, vy: -Math.sin(th) * Math.cos(hd) * sp, vz: Math.sin(th) * Math.sin(hd) * sp,
        trail: [], hit: -1, on: false, tx: TX + R.range(-3, 3), ty: TY + R.range(-6, 6), tz: R.range(-5, 5), tw: R.range(0, TAU), acc: 0,
      };
    });
    const pops = [];
    let t = 0;
    // a point on the unit sphere, s the height (1 straight up)
    const sphere = (s0, s1) => {
      const s = R.range(s0, s1), a = R.range(0, TAU), c = Math.sqrt(1 - s * s);
      return [Math.cos(a) * c, -s, Math.sin(a) * c];
    };

    function ribbon(q, b, glows) {
      const pts = b.trail, n = pts.length, fade = b.hit < 0 ? 1 : 1 - clamp((t - b.hit) / 0.16);
      if (n < 2 || fade <= 0) return;
      for (let i = 0; i < n - 1; i++) {
        const A = pts[i], B = pts[i + 1], len = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) || 1, u0 = i / (n - 1), u1 = (i + 1) / (n - 1);
        // the body: a capsule that tapers down the tail, white along its middle near the head, cooling outward
        const wid = (u) => 2.6 * Math.pow(1 - u, 0.8) + 0.3;
        q.beam(...A, ...B, wid((u0 + u1) / 2) * 2, (uu, v) => {
          const u = u0 + uu * (u1 - u0);
          return v < 0.35 ? (u < 0.25 ? WHITE : C[6]) : v < 0.7 ? (u < 0.4 ? C[6] : C[5]) : u < 0.5 ? C[5] : C[4];
        }, (uu, v) => (1 - (u0 + uu * (u1 - u0))) * 1.7 * fade * (v < 0.7 ? 1 : 0.75));
        // two strands wound round it: bright where they come round to the camera, dim behind
        const [e1, e2] = spanOf([(B[0] - A[0]) / len, (B[1] - A[1]) / len, (B[2] - A[2]) / len]);
        for (let d = 0; d < len; d += 0.5) {
          const f = d / len, u = u0 + (u1 - u0) * f, a = (1 - u) * 1.7 * fade, rad = wid(u) + 1.4;
          for (const s of [0, Math.PI]) {
            const g = u * 10 - t * 26 + b.tw + s, ox = Math.cos(g) * e1[0] + Math.sin(g) * e2[0], oy = Math.cos(g) * e1[1] + Math.sin(g) * e2[1], oz = Math.cos(g) * e1[2] + Math.sin(g) * e2[2];
            const front = q.view(ox, oy, oz)[2];
            q.dot(A[0] + (B[0] - A[0]) * f + ox * rad, A[1] + (B[1] - A[1]) * f + oy * rad, A[2] + (B[2] - A[2]) * f + oz * rad, front > 0.4 ? (u < 0.35 ? WHITE : C[6]) : C[4], a);
          }
        }
        if (i % 3 === 0) glows.push(() => q.glow(A[0], A[1], A[2], 9 * (1 - i / n) + 3, C[5], 0.3 * (1 - i / n) * fade));
      }
    }

    function head(q, b, glows) {
      const { x, y, z } = b, sp = Math.hypot(b.vx, b.vy, b.vz) || 1, [e1, e2] = spanOf([b.vx / sp, b.vy / sp, b.vz / sp]);
      // rays turning round the heading, in the plane it flies through
      for (let i = 0; i < 4; i++) {
        const a = t * 24 + (i * TAU) / 4 + b.tw, l = 5.5 + 1.5 * Math.sin(t * 50 + i), c = Math.cos(a), s = Math.sin(a);
        const dx = c * e1[0] + s * e2[0], dy = c * e1[1] + s * e2[1], dz = c * e1[2] + s * e2[2];
        q.line(x + dx * 3.2, y + dy * 3.2, z + dz * 3.2, x + dx * l, y + dy * l, z + dz * l, C[6]);
      }
      q.ball(x, y, z, 3.8, (nx, ny) => {
        const d = Math.hypot(nx, ny) * 3.8;
        return d > 3 ? C[4] : d > 2.1 ? C[5] : d > 1.2 ? C[6] : WHITE;
      });
      glows.push(() => q.glow(x, y, z, 24, C[5], 0.6), () => q.glow(x, y, z, 7, WHITE, 0.4));
    }

    function pop(q, u, x, y, z, glows) {
      if (u < 0.16) {
        const r = 9 * (1 - u / 0.16) + 1.5;
        q.ball(x, y, z, r + 1.5, (nx, ny) => (Math.hypot(nx, ny) * (r + 1.5) > r ? C[5] : WHITE));
      }
      // a cross along all three axes, so it never goes edge on
      if (u < 0.4) {
        const l = 15 * (1 - u / 0.4) + 3, col = (v) => { const a = Math.abs(2 * v - 1); return a < 0.3 ? WHITE : a < 0.65 ? C[6] : C[5]; };
        const al = (v) => 1.15 - Math.abs(2 * v - 1);
        q.line(x - l, y, z, x + l, y, z, col, al);
        q.line(x, y - l * 0.7, z, x, y + l * 0.7, z, col, al);
        q.line(x, y, z - l, x, y, z + l, col, al);
      }
      // the shock: a sphere of three rings, and a ring running out across the floor beneath
      const rr = 3 + 18 * ease.outCubic(u) + 0.5, w = Math.max(1, 3 * (1 - u)), col = u < 0.3 ? WHITE : C[6], a = 1.2 - u;
      for (const n of [[0, -1, 0], [1, 0, 0], [0, 0, 1]]) q.ring(x, y, z, rr, w, col, a, n);
      q.ring(x, 0, z, rr * 1.3, Math.max(1, w - 1), C[5], a * 0.55);
      const k = 1 - clamp(u * 0.35 / 0.5);
      glows.push(() => q.glow(x, -1, z, 22, C[5], 0.25 * k * k));
    }

    // the lock: a cage of bracket arcs on three rings closes on the target and pulses as each bolt lands
    function lock(q) {
      const k = smooth(0, 0.22, t) * (1 - smooth(1.15, 1.45, t));
      if (k <= 0) return;
      let kick = 0;
      for (const b of pops) kick = Math.max(kick, Math.exp(-(((t - b.t) / 0.06) ** 2)));
      const r = 9 + 10 * (1 - ease.outCubic(smooth(0, 0.22, t))) + 3 * kick, spin = t * 1.5;
      const rings = [[[0, -1, 0], spin], [rotY([1, 0, 0], spin), -spin], [rotY([0, 0, 1], spin), spin]];
      for (const [n, s] of rings) {
        const [e1, e2] = spanOf(n);
        for (let i = 0; i < 4; i++) {
          const a0 = s + (i * TAU) / 4 - 0.38;
          for (let a = a0; a <= a0 + 0.76; a += 0.06) {
            const c = Math.cos(a) * r, s2 = Math.sin(a) * r;
            q.dot(TX + e1[0] * c + e2[0] * s2, TY + e1[1] * c + e2[1] * s2, e1[2] * c + e2[2] * s2, kick > 0.4 ? WHITE : C[6], k);
          }
        }
      }
      return () => q.glow(TX, TY, 0, 12, C[4], 0.2 * k);
    }

    return {
      update(dt) {
        t += dt;
        for (const b of bolts) {
          if (t < b.t0 || b.hit >= 0) continue;
          if (!b.on) {
            b.on = true;
            lights.add(HX, HY, 28, C[5], 0.7, 0.14, 0);
            const sp = Math.hypot(b.vx, b.vy, b.vz);
            for (let i = 0; i < 4; i++) ps.spawn3(P.MOTE, HX, HY, 0, (b.vx / sp) * R.range(60, 140) + R.range(-60, 60), (b.vy / sp) * R.range(60, 140) + R.range(-60, 60), (b.vz / sp) * R.range(60, 140) + R.range(-60, 60), R.range(0.12, 0.25), C[6], 0.6);
          }
          const age = t - b.t0, dx = b.tx - b.x, dy = b.ty - b.y, dz = b.tz - b.z, d = Math.hypot(dx, dy, dz) || 1;
          const sp = 150 + 560 * age * age, steer = Math.min(1, (1.4 + 15 * age) * dt);
          b.vx += ((dx / d) * sp - b.vx) * steer;
          b.vy += ((dy / d) * sp - b.vy) * steer;
          b.vz += ((dz / d) * sp - b.vz) * steer;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.z += b.vz * dt;
          if (b.y > -1.5) (b.y = -1.5), (b.vy = Math.min(b.vy, 0)); // the floor turns them
          b.trail.unshift([b.x, b.y, b.z]);
          if (b.trail.length > TRAIL) b.trail.pop();
          if ((b.acc += dt) > 0.012) {
            b.acc = 0;
            if (R.chance(0.6)) ps.spawn3(P.MOTE, b.x, b.y, b.z, -b.vx * 0.08 + R.range(-25, 25), -b.vy * 0.08 + R.range(-25, 25), -b.vz * 0.08 + R.range(-25, 25), R.range(0.2, 0.4), R.chance(0.5) ? C[6] : C[5], 0.55);
          }
          if (d < 3 || age > 1.3) {
            b.hit = t;
            pops.push({ t, x: b.x, y: b.y, z: b.z });
            lights.add(b.x, b.y, 70, C[5], 0.9, 0.3, b.z);
            lights.add(b.x, b.y, 24, WHITE, 0.85, 0.09, b.z);
            for (let i = 0; i < 16; i++) {
              const [ux, uy, uz] = sphere(-1, 1), v = R.range(80, 230);
              ps.spawn3(P.SPARK, b.x, b.y, b.z, ux * v, uy * v - 40, uz * v, R.range(0.15, 0.45));
            }
            for (let i = 0; i < 7; i++) {
              const [ux, uy, uz] = sphere(-0.3, 1), v = R.range(40, 140);
              ps.spawn3(i % 2 ? P.STAR : P.MOTE, b.x, b.y, b.z, ux * v, uy * v, uz * v, R.range(0.25, 0.48), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.6));
            }
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), glows = [];
        const lk = lock(q);
        if (lk) glows.push(lk);
        for (const b of bolts) if (b.on) ribbon(q, b, glows);
        for (const b of bolts) if (b.on && b.hit < 0) head(q, b, glows);
        for (const b of pops) {
          const k = (t - b.t) / 0.35;
          if (k < 1) pop(q, k, b.x, b.y, b.z, glows);
        }
        if (t < 0.55) q.at(HX, HY, 0, (pp) => sparkle(pp, 0, 0, 3 + 2 * Math.sin(t * 40), C[6], C[5], 0.45 * (1 - t / 0.55)));
        ps.draw(q);
        for (const g of glows) g();
        lights.draw(q);
      },
    };
  },
};
