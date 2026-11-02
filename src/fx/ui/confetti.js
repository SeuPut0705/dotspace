// The flutter (a swing that slows at its ends, a tilt that follows it, a paper flip that shows the back) adapts
// Sprite Fusion's open-source falling leaves (https://www.spritefusion.com/pixel-art-vfx/falling-leaves),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, space, sparkle, clamp, seg, ease, TAU, WHITE, hex, scale, mix } from "../../core/index.js";

export const meta = {
  name: "Confetti",
  desc: "Two party poppers bang one after the other: paper bits and curly streamers burst out, stall, then tumble and flutter down, flipping, and settle on the floor.",
  tags: ["ui", "celebration", "confetti", "party", "reward", "one-shot"],
  size: [200, 140],
  origin: [100, 126],
  duration: 3.4,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#ff4a5a", "#ff9a2a", "#ffe03c", "#5ad84a", "#3cc8ff", "#7a6cff", "#f53cd1"], seed: 11 },
};

const POPPERS = [
  { x: -74, y: -1, a: -Math.PI / 2 + 0.62, t: 0.1 },
  { x: 74, y: -1, a: -Math.PI / 2 - 0.62, t: 0.26 },
];
const INK = hex("#141019");

// a party popper: a striped cone pointing along a, kicked back k px when it fires
function popper(p, x, y, a, k, C, alpha) {
  const ca = Math.cos(a), sa = Math.sin(a), bx = x - ca * k, by = y - sa * k;
  p.shade(bx - 12, by - 12, bx + 12, by + 12, (px, py, o) => {
    const dx = px - bx, dy = py - by, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    // u along the cone (0 at its tip on the floor, 11 at its mouth), v across
    if (u < 0 || u > 11) return;
    const hw = 0.8 + u * 0.32;
    if (Math.abs(v) > hw + 0.6) return;
    o.a = alpha;
    if (Math.abs(v) > hw - 0.4 || u > 10.2 || u < 0.8) return INK;
    const stripe = Math.floor((u + v * 0.6) / 2.2) % 2 === 0;
    return stripe ? (v < 0 ? C[2] : scale(C[2], 0.75)) : v < 0 ? WHITE : hex("#c8c0d8");
  });
}

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a"] }), lights = new Lights();
  const bits = [], ribbons = [], fired = [false, false], end = meta.duration - 0.05;
  const kick = (t, pp) => (t < pp.t ? 0 : 3 * Math.exp(-(t - pp.t) * 14));

  function fire(pp) {
    const mx = pp.x + Math.cos(pp.a) * 11, my = pp.y + Math.sin(pp.a) * 11;
    lights.add(mx, my, 34, WHITE, 0.6, 0.12);
    lights.add(mx, my, 50, C[2], 0.4, 0.4);
    for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, mx, my, Math.cos(pp.a) * R.range(20, 60) + R.range(-10, 10), Math.sin(pp.a) * R.range(20, 60), R.range(0.6, 1), hex("#5d5660"), R.range(2.5, 4));
    for (let i = 0; i < 12; i++) {
      const an = pp.a + R.range(-0.5, 0.5), sp = R.range(120, 260);
      ps.spawn(P.SPARK, mx, my, Math.cos(an) * sp, Math.sin(an) * sp, R.range(0.1, 0.25));
    }
    // paper: thrown hard up the cone, the air soon stalls it
    for (let i = 0; i < 46; i++) {
      const an = pp.a + R.range(-0.38, 0.38), sp = R.range(200, 380);
      bits.push({ x: mx, y: my, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, c: R.pick(C), w: R.range(2, 3), h: R.range(3, 4.6), ang: R.range(0, TAU), spin: R.range(-14, 14), flip: R.range(0, TAU), fs: R.range(5, 13), ph: R.range(0, TAU), amp: R.range(5, 12), fw: R.range(2, 3.4), x0: 0, mode: 0, rest: 0, fall: R.range(26, 40) });
    }
    // streamers: a head that flies like the paper, a tail that follows it and curls
    for (let i = 0; i < 4; i++) {
      const an = pp.a + R.range(-0.25, 0.25), sp = R.range(220, 330), n = 11;
      ribbons.push({ pts: Array.from({ length: n }, () => [mx, my]), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, c: R.pick(C), ph: R.range(0, TAU), amp: R.range(6, 12), fw: R.range(1.5, 2.4), mode: 0, x0: 0, curl: R.range(0.7, 1.1), fall: R.range(22, 32) });
    }
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      POPPERS.forEach((pp, i) => !fired[i] && t >= pp.t && ((fired[i] = true), fire(pp)));
      for (const b of bits) {
        if (b.mode === 2) {
          b.rest += dt;
          continue;
        }
        b.flip += b.fs * dt;
        if (b.mode === 0) {
          // the burst: heavy drag, a little gravity, tumbling fast; once slow it starts to flutter
          b.vx -= b.vx * 3.4 * dt;
          b.vy -= b.vy * 3.4 * dt - 140 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.ang += b.spin * dt;
          if (Math.hypot(b.vx, b.vy) < 40) (b.mode = 1), (b.x0 = b.x - Math.sin(b.ph) * b.amp);
        } else {
          b.ph += b.fw * dt;
          b.x0 += b.vx * dt;
          b.vx -= b.vx * 2 * dt;
          b.x = b.x0 + Math.sin(b.ph) * b.amp;
          b.y += b.fall * (0.4 + 0.9 * Math.abs(Math.cos(b.ph))) * dt;
          b.ang = Math.cos(b.ph) * 0.9;
          if (b.y >= -1) (b.y = -0.5), (b.mode = 2), (b.ang = R.range(-0.3, 0.3)), (b.flip = 0);
        }
      }
      for (const r of ribbons) {
        const h = r.pts[0];
        if (r.mode === 0) {
          r.vx -= r.vx * 3 * dt;
          r.vy -= r.vy * 3 * dt - 120 * dt;
          h[0] += r.vx * dt;
          h[1] += r.vy * dt;
          if (Math.hypot(r.vx, r.vy) < 35) (r.mode = 1), (r.x0 = h[0] - Math.sin(r.ph) * r.amp);
        } else if (h[1] < -1) {
          r.ph += r.fw * dt;
          r.x0 += r.vx * dt;
          r.vx -= r.vx * 2 * dt;
          h[0] = r.x0 + Math.sin(r.ph) * r.amp;
          h[1] += r.fall * (0.5 + 0.7 * Math.abs(Math.cos(r.ph))) * dt;
        }
        // the tail follows the head link by link and hangs a little
        for (let i = 1; i < r.pts.length; i++) {
          const a = r.pts[i - 1], b = r.pts[i];
          b[1] = Math.min(-0.5, b[1] + 20 * dt);
          const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
          if (d > 2.6) (b[0] = a[0] + (dx / d) * 2.6), (b[1] = a[1] + (dy / d) * 2.6);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      ps.draw(p, "back");
    },

    draw(p) {
      const fade = 1 - seg(t, end - 0.45, end - 0.05);
      for (const pp of POPPERS) {
        const k = kick(t, pp);
        popper(p, pp.x, pp.y, pp.a, k, C, 1 - seg(t, 2.5, 2.9));
        const ft = t - pp.t;
        if (ft > 0 && ft < 0.12) sparkle(p, pp.x + Math.cos(pp.a) * 13, pp.y + Math.sin(pp.a) * 13, 7 * (1 - ft / 0.12), WHITE, C[2], 0.7);
      }
      // streamers: a two-tone ribbon that curls along its length
      for (const r of ribbons) {
        const pts = r.pts.map(([x, y], i) => [x + Math.sin(i * r.curl + t * 9 + r.ph) * (i ? 1.6 : 0), y]);
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], front = Math.sin(i * r.curl + t * 9 + r.ph) > 0;
          p.line(x0, y0, x1, y1, front ? r.c : scale(r.c, 0.6), fade);
          p.line(x0 + 1, y0, x1 + 1, y1, front ? mix(r.c, WHITE, 0.35) : scale(r.c, 0.45), fade);
        }
      }
      // paper bits: a little card turned by its tilt, its width by its flip; the back side shows darker
      for (const b of bits) {
        if (b.y > 1) continue;
        const fw = b.mode === 2 ? 1 : Math.cos(b.flip), w = Math.max(0.5, Math.abs(fw) * b.w), ca = Math.cos(b.ang), sa = Math.sin(b.ang);
        const c = fw >= 0 ? b.c : scale(b.c, 0.62), a = fade;
        if (b.mode === 2) {
          p.dot(b.x, b.y, scale(b.c, 0.8), a);
          p.dot(b.x + 1, b.y, scale(b.c, 0.6), a);
          continue;
        }
        p.shade(b.x - 4, b.y - 4, b.x + 4, b.y + 4, (x, y, out) => {
          const dx = x - b.x, dy = y - b.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
          if (Math.abs(u) > w / 2 + 0.2 || Math.abs(v) > b.h / 2) return;
          out.a = a;
          return Math.abs(fw) > 0.92 && v < -b.h / 2 + 1 ? WHITE : c;
        });
        // it catches the light as it turns face-on
        if (Math.abs(fw) > 0.97) p.glow(b.x, b.y, 5, mix(b.c, WHITE, 0.5), 0.35 * fade);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: two party poppers stand on the floor, one back left, one front right, and fire across each other. The
// paper bursts out in a true cone, stalls, then tumbles and flutters down as little cards that turn in space (each
// painted by projecting its own tilt), streamers curl in a helix, and the bits settle all over the floor.
const LEAN = 0.62, PS = 1.5;
const aim = (x, z, tx, tz) => Math.atan2(tz - z, tx - x);
const POPPERS3 = [
  { x: -74, z: -24, t: 0.1, h: aim(-74, -24, -4, 8) },
  { x: 74, z: 24, t: 0.26, h: aim(74, 24, 4, -8) },
];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const axisOf = (pp) => [Math.sin(LEAN) * Math.cos(pp.h), -Math.cos(LEAN), Math.sin(LEAN) * Math.sin(pp.h)];
const mouthOf = (pp, k = 0) => {
  const D = axisOf(pp), u = PS * 11 - k;
  return [pp.x + D[0] * u, -1 + D[1] * u, pp.z + D[2] * u];
};
// a card's axes from three turns: spin about its own normal, a flip about its width, a yaw about the vertical
function orient(yw, f, a) {
  const ca = Math.cos(a), sa = Math.sin(a), cf = Math.cos(f), sf = Math.sin(f), cy = Math.cos(yw), sy = Math.sin(yw);
  const rot = (x, y, z) => {
    const y1 = y * cf - z * sf, z1 = y * sf + z * cf;
    return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
  };
  return [rot(ca, sa, 0), rot(-sa, ca, 0), rot(0, 0, 1)];
}

// a popper in space: a striped cone, tip on the floor, kicked back k px when it fires. Every pixel is a ray cast at the
// cone (a depth, a normal, a stripe that spirals round it), so it turns with the camera and its open mouth shows.
const LIGHT = unit3([-0.55, -0.6, 0.58]);
const LIP = [hex("#e4def0"), hex("#a89fbf")];
function popper3(q, pp, k, C, alpha) {
  const D = axisOf(pp), L = 11 * PS, r0 = 0.8 * PS, m = 0.32, h = L / 2 - k;
  const e1 = unit3(cross3(D, [0, 1, 0])), e2 = cross3(D, e1);
  const WELL = [scale(C[2], 0.5), scale(C[2], 0.3)], YEL = [mix(C[2], WHITE, 0.45), C[2], scale(C[2], 0.72), scale(C[2], 0.5)], WHT = [WHITE, hex("#e4def0"), hex("#c8c0d8"), hex("#8b84a0")];
  q.at(pp.x + D[0] * h, -1 + D[1] * h, pp.z + D[2] * h, (p, kk) => {
    const z0 = p.z, Dv = q.view(D[0], D[1], D[2]), T = q.view(-D[0] * L / 2, -D[1] * L / 2, -D[2] * L / 2), E1 = q.view(e1[0], e1[1], e1[2]), E2 = q.view(e2[0], e2[1], e2[2]);
    const A = 1 - Dv[2] * Dv[2] * (1 + m * m), R = (L / 2 + r0 + m * L + 2) * kk;
    p.shade(-R, -R, R, R, (px, py, out) => {
      const wx = px / kk - T[0], wy = py / kk - T[1], wz = -T[2], u0 = wx * Dv[0] + wy * Dv[1] + wz * Dv[2];
      const B = 2 * wz - 2 * u0 * Dv[2] - 2 * m * Dv[2] * (r0 + m * u0), Cc = wx * wx + wy * wy + wz * wz - u0 * u0 - (r0 + m * u0) * (r0 + m * u0);
      let s1, s2;
      if (Math.abs(A) < 1e-6) (s1 = -Cc / B), (s2 = -Infinity);
      else {
        const disc = B * B - 4 * A * Cc;
        if (disc < 0) return;
        const sq = Math.sqrt(disc);
        s1 = (-B + sq) / (2 * A);
        s2 = (-B - sq) / (2 * A);
        if (s1 < s2) [s1, s2] = [s2, s1];
      }
      // the nearest root on the cone's length; one beyond the mouth means we look in: the inner wall
      const u1 = u0 + s1 * Dv[2];
      let s = s1, u = u1, inner = false;
      if (u1 > L && s2 > -Infinity) (s = s2), (u = u0 + s2 * Dv[2]), (inner = true);
      else if (u1 < 0 || u1 > L) {
        if (s2 === -Infinity) return;
        (s = s2), (u = u0 + s2 * Dv[2]);
      }
      if (u < 0 || u > L) return;
      p.z = z0 - s;
      out.a = alpha;
      if (inner) return u > L * 0.65 ? WELL[0] : u > L * 0.3 ? WELL[1] : INK;
      const vx = px / kk - T[0], vy = py / kk - T[1], vz = s - T[2], rx = vx - Dv[0] * u, ry = vy - Dv[1] * u, rz = vz - Dv[2] * u, rl = Math.hypot(rx, ry, rz) || 1;
      const n = unit3([rx / rl - m * Dv[0], ry / rl - m * Dv[1], rz / rl - m * Dv[2]]);
      const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2], lv = d > 0.55 ? 0 : d > 0.1 ? 1 : d > -0.4 ? 2 : 3;
      if (u > L - 1.8) return d > -0.1 ? LIP[0] : LIP[1];
      if (Math.abs(n[2]) < 0.26 || u < 0.9) return INK;
      const phi = Math.atan2(rx * E2[0] + ry * E2[1] + rz * E2[2], rx * E1[0] + ry * E1[1] + rz * E1[2]);
      return (Math.floor((u / PS + phi * 0.9) / 2.2) & 1 ? WHT : YEL)[lv];
    });
  });
}

export const three = {
  meta: { size: [204, 134], origin: [102, 100], camera: { pitch: 0.34 } },
  create(o) {
    const C = fit(o.palette, 7), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, ground: () => 0, sparks: ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a"] }), lights = new Lights();
    const bits = [], ribbons = [], fired = [false, false], end = meta.duration - 0.05;
    const kick = (t, pp) => (t < pp.t ? 0 : 3 * Math.exp(-(t - pp.t) * 14));

    // a direction inside a cone of half-angle ang round axis D
    function inCone(D, ang) {
      const e1 = unit3(cross3(D, [0, 1, 0])), e2 = cross3(D, e1), a = ang * Math.sqrt(R.range(0, 1)), g = R.range(0, TAU), s = Math.sin(a), c = Math.cos(a);
      return [0, 1, 2].map((i) => D[i] * c + (e1[i] * Math.cos(g) + e2[i] * Math.sin(g)) * s);
    }

    function fire(pp) {
      const D = axisOf(pp), [mx, my, mz] = mouthOf(pp);
      lights.add(mx, my, 34, WHITE, 0.6, 0.12, mz);
      lights.add(mx, my, 50, C[2], 0.4, 0.4, mz);
      for (let i = 0; i < 6; i++) {
        const d = inCone(D, 0.5), sp = R.range(20, 60);
        ps.spawn3(P.SMOKE, mx, my, mz, d[0] * sp + R.range(-10, 10), d[1] * sp, d[2] * sp + R.range(-10, 10), R.range(0.6, 1), hex("#5d5660"), R.range(2.5, 4));
      }
      for (let i = 0; i < 12; i++) {
        const d = inCone(D, 0.5), sp = R.range(120, 260);
        ps.spawn3(P.SPARK, mx, my, mz, d[0] * sp, d[1] * sp, d[2] * sp, R.range(0.1, 0.25));
      }
      // paper: thrown hard up the cone, the air soon stalls it
      for (let i = 0; i < 46; i++) {
        const d = inCone(D, 0.4), sp = R.range(200, 380);
        bits.push({
          x: mx, y: my, z: mz, vx: d[0] * sp, vy: d[1] * sp, vz: d[2] * sp, c: R.pick(C), w: R.range(2, 3) * 1.4, h: R.range(3, 4.6) * 1.4,
          a: R.range(0, TAU), spin: R.range(-14, 14), f: R.range(0, TAU), fs: R.range(5, 13), yw: R.range(0, TAU), ph: R.range(0, TAU), amp: R.range(5, 12), fw: R.range(2, 3.4),
          x0: 0, z0: 0, mode: 0, fall: R.range(26, 40), roll: R.range(0, TAU),
        });
      }
      // streamers: a head that flies like the paper, a tail that follows it and curls in a helix
      for (let i = 0; i < 4; i++) {
        const d = inCone(D, 0.25), sp = R.range(220, 330), n = 11;
        ribbons.push({ pts: Array.from({ length: n }, () => [mx, my, mz]), vx: d[0] * sp, vy: d[1] * sp, vz: d[2] * sp, c: R.pick(C), ph: R.range(0, TAU), amp: R.range(6, 12), fw: R.range(1.5, 2.4), yw: R.range(0, TAU), mode: 0, x0: 0, z0: 0, curl: R.range(0.7, 1.1), fall: R.range(22, 32) });
      }
    }

    let t = 0;
    return {
      update(dt) {
        t += dt;
        POPPERS3.forEach((pp, i) => !fired[i] && t >= pp.t && ((fired[i] = true), fire(pp)));
        for (const b of bits) {
          if (b.mode === 2) continue;
          const sx = Math.sin(b.yw), sz = Math.cos(b.yw), ax = Math.cos(b.yw), az = -Math.sin(b.yw);
          if (b.mode === 0) {
            // the burst: heavy drag, a little gravity, tumbling fast; once slow it starts to flutter
            b.f += b.fs * dt;
            b.a += b.spin * dt;
            b.vx -= b.vx * 3.4 * dt;
            b.vy -= b.vy * 3.4 * dt - 140 * dt;
            b.vz -= b.vz * 3.4 * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.z += b.vz * dt;
            if (Math.hypot(b.vx, b.vy, b.vz) < 40) {
              b.mode = 1;
              b.x0 = b.x - sx * Math.sin(b.ph) * b.amp - ax * 0.45 * b.amp * Math.cos(b.ph);
              b.z0 = b.z - sz * Math.sin(b.ph) * b.amp - az * 0.45 * b.amp * Math.cos(b.ph);
            }
          } else {
            b.ph += b.fw * dt;
            b.x0 += b.vx * dt;
            b.z0 += b.vz * dt;
            b.vx -= b.vx * 2 * dt;
            b.vz -= b.vz * 2 * dt;
            b.x = b.x0 + sx * Math.sin(b.ph) * b.amp + ax * 0.45 * b.amp * Math.cos(b.ph);
            b.z = b.z0 + sz * Math.sin(b.ph) * b.amp + az * 0.45 * b.amp * Math.cos(b.ph);
            b.y += b.fall * (0.4 + 0.9 * Math.abs(Math.cos(b.ph))) * dt;
            // it rocks over the swing and rolls a little: the tumble eases into a rocking fall
            b.roll += b.fs * 0.35 * dt;
            const ease = Math.min(1, dt * 9), ft = 1.0 + (Math.PI / 2 - 1.0) * seg(b.y, -9, -1) + Math.cos(b.ph) * 0.9 + 0.9 * Math.sin(b.roll);
            b.f += (ft + TAU * Math.round((b.f - ft) / TAU) - b.f) * ease;
            b.a += (TAU * Math.round(b.a / TAU) - b.a) * ease;
            if (b.y >= -1) (b.y = -0.5), (b.mode = 2), (b.f = Math.PI / 2), (b.a = R.range(-1.5, 1.5)), (b.yw = R.range(0, TAU));
          }
        }
        for (const r of ribbons) {
          const h = r.pts[0], sx = Math.sin(r.yw), sz = Math.cos(r.yw), ax = Math.cos(r.yw), az = -Math.sin(r.yw);
          if (r.mode === 0) {
            r.vx -= r.vx * 3 * dt;
            r.vy -= r.vy * 3 * dt - 120 * dt;
            r.vz -= r.vz * 3 * dt;
            h[0] += r.vx * dt;
            h[1] += r.vy * dt;
            h[2] += r.vz * dt;
            if (Math.hypot(r.vx, r.vy, r.vz) < 35) {
              r.mode = 1;
              r.x0 = h[0] - sx * Math.sin(r.ph) * r.amp - ax * 0.45 * r.amp * Math.cos(r.ph);
              r.z0 = h[2] - sz * Math.sin(r.ph) * r.amp - az * 0.45 * r.amp * Math.cos(r.ph);
            }
          } else if (h[1] < -1) {
            r.ph += r.fw * dt;
            r.x0 += r.vx * dt;
            r.z0 += r.vz * dt;
            r.vx -= r.vx * 2 * dt;
            r.vz -= r.vz * 2 * dt;
            h[0] = r.x0 + sx * Math.sin(r.ph) * r.amp + ax * 0.45 * r.amp * Math.cos(r.ph);
            h[2] = r.z0 + sz * Math.sin(r.ph) * r.amp + az * 0.45 * r.amp * Math.cos(r.ph);
            h[1] += r.fall * (0.5 + 0.7 * Math.abs(Math.cos(r.ph))) * dt;
          }
          // the tail follows the head link by link and hangs a little
          for (let i = 1; i < r.pts.length; i++) {
            const a = r.pts[i - 1], b = r.pts[i];
            b[1] = Math.min(-0.5, b[1] + 20 * dt);
            const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1;
            if (d > 2.6) (b[0] = a[0] + (dx / d) * 2.6), (b[1] = a[1] + (dy / d) * 2.6), (b[2] = a[2] + (dz / d) * 2.6);
          }
        }
        ps.update(dt);
        lights.update(dt);
      },

      draw(p) {
        const q = space(p, o), fade = 1 - seg(t, end - 0.45, end - 0.05);
        // which way the camera looks, for lighting and for which side of a card or ribbon shows
        const right = [q.cy, 0, -q.sy];
        // the poppers
        for (const pp of POPPERS3) popper3(q, pp, kick(t, pp), C, 1 - seg(t, 2.5, 2.9));
        // streamers: a two-tone ribbon that curls round its own length, bright on the side towards us
        for (const r of ribbons) {
          const pts = r.pts.map((pt, i) => {
            if (!i) return pt;
            const a = r.pts[i - 1], d = unit3([pt[0] - a[0], pt[1] - a[1], pt[2] - a[2]]);
            let e1 = cross3(d, [0, 1, 0]);
            e1 = Math.hypot(...e1) < 0.05 ? [1, 0, 0] : unit3(e1);
            const e2 = cross3(d, e1), g = i * r.curl + t * 9 + r.ph, s = Math.sin(g), c = Math.cos(g), m = 1.8;
            return [pt[0] + (e1[0] * s + e2[0] * c) * m, pt[1] + (e1[1] * s + e2[1] * c) * m, pt[2] + (e1[2] * s + e2[2] * c) * m, s * q.view(e1[0], e1[1], e1[2])[2] + c * q.view(e2[0], e2[1], e2[2])[2]];
          });
          for (let i = 1; i < pts.length; i++) {
            const A = pts[i - 1], B = pts[i], front = (B[3] ?? 0) > 0;
            q.line(A[0], A[1], A[2], B[0], B[1], B[2], front ? r.c : scale(r.c, 0.6), fade);
            q.line(A[0] + right[0], A[1], A[2] + right[2], B[0] + right[0], B[1], B[2] + right[2], front ? mix(r.c, WHITE, 0.35) : scale(r.c, 0.45), fade);
          }
        }
        // paper bits: a little card, tilted and flipped in space; the back side shows darker
        const glints = [];
        for (const b of bits) {
          if (b.y > 1) continue;
          if (b.mode < 2) q.blend(b.x, 0, b.z, INK, 0.3 * fade);
          const [eu, ev, n] = orient(b.yw, b.f, b.a), hw = b.w / 2, hh = b.h / 2, face = q.view(n[0], n[1], n[2])[2];
          const U = q.view(eu[0] * hw, eu[1] * hw, eu[2] * hw), V = q.view(ev[0] * hh, ev[1] * hh, ev[2] * hh);
          const c = b.mode === 2 ? scale(b.c, 0.8) : face >= 0 ? b.c : scale(b.c, 0.62);
          q.at(b.x, b.y, b.z, (pp, k) => {
            const ux = U[0] * k, uy = U[1] * k, vx = V[0] * k, vy = V[1] * k, det = ux * vy - vx * uy;
            if (Math.abs(det) < 1.2) {
              // seen edge on: a sliver
              const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy), [sx, sy] = lu > lv ? [ux, uy] : [vx, vy];
              pp.line(-sx, -sy, sx, sy, c, fade);
              return;
            }
            const r = Math.abs(ux) + Math.abs(vx) + 1, r2 = Math.abs(uy) + Math.abs(vy) + 1;
            pp.shade(-r, -r2, r, r2, (x, y, out) => {
              const A = (vy * x - vx * y) / det, B = (ux * y - uy * x) / det;
              if (Math.abs(A) > 1.08 || Math.abs(B) > 1.08) return;
              out.a = fade;
              return Math.abs(face) > 0.92 && B < -0.55 && b.mode < 2 ? WHITE : c;
            });
          });
          // it catches the light as it turns face-on
          if (b.mode < 2 && Math.abs(face) > 0.97) glints.push(b);
        }
        // the floor takes the burst's ring
        for (const pp of POPPERS3) {
          const k = (t - pp.t) / 0.22;
          if (k > 0 && k < 1) q.ring(pp.x, 0, pp.z, 4 + 18 * ease.outCubic(k), 1.2, mix(C[2], WHITE, 0.5), (1 - k) * 0.8);
        }
        ps.draw(q);
        for (const b of glints) q.glow(b.x, b.y, b.z, 5, mix(b.c, WHITE, 0.5), 0.35 * fade);
        for (const pp of POPPERS3) {
          const ft = t - pp.t;
          if (ft > 0 && ft < 0.12) {
            const [mx, my, mz] = mouthOf(pp, kick(t, pp));
            q.at(mx, my, mz, (pa) => sparkle(pa, 0, 0, 7 * (1 - ft / 0.12), WHITE, C[2], 0.7));
          }
        }
        lights.draw(q);
      },
    };
  },
};
