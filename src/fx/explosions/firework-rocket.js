// The flare, the twinkling glitter and the crackle are adapted from Sprite Fusion's open-source sparkle
// (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, sparkle, clamp, ease, space, TAU, WHITE, hex, mix } from "../../core/index.js";
import { cull } from "./_lib.js";

export const meta = {
  name: "Firework rocket",
  desc: "A rocket fizzes off the ground on a sparkling gold trail, coasts, and bursts into a palm: heavy gold fronds arc out, droop on glittering trails and crackle at the tips.",
  tags: ["firework", "rocket", "celebration", "sparkle", "sky", "one-shot"],
  size: [300, 300],
  origin: [150, 288],
  duration: 3.8,
  loop: false,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#2a1406", "#6a3a0c", "#b8701a", "#f0a830", "#ffd860", "#fff2b0", "#ffffff"],
    tips: ["#0c2a3a", "#1a5a78", "#36a2c8", "#7cd8f0", "#c8f4ff", "#ffffff"],
    seed: 12,
  },
};

const FLY = 1.05, HIGH = 192, DRAG = 1.35, G = 105, TRAIL = 1.15;

export function create(o) {
  const C = fit(o.palette, 7), T = fit(o.tips, 6), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [C[6], C[5], C[4], C[3]] }), lights = new Lights();
  const fronds = [], pops = [];
  const at = (t) => [Math.sin(t * 8) * 1.6 * (t / FLY), -8 - HIGH * ease.outQuad(clamp(t / FLY))];
  let t = 0, burst = false, bx = 0, by = 0, acc = 0;
  lights.add(0, -14, 24, C[4], 0.7, 0.35);
  // ignition: a puff of smoke and a spray of sparks off the ground
  for (let i = 0; i < 18; i++) {
    const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(60, 180);
    ps.spawn(P.SPARK, 0, -2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, R.range(0.15, 0.4));
  }
  for (let i = 0; i < 5; i++) ps.spawn(P.VAPOUR, R.range(-3, 3), -2, R.range(-20, 20), -R.range(2, 10), R.range(0.6, 1), hex("#5a5468"), R.range(3, 5));
  return {
    update(dt) {
      t += dt;
      if (t < FLY) {
        // the climb: a hot tail spitting gold sparks, glitter left hanging, a thread of smoke
        const [x, y] = at(t), [x2, y2] = at(Math.max(0, t - 0.02)), vy = (y - y2) / 0.02, vx = (x - x2) / 0.02;
        for (acc += dt * 90; acc > 1; acc--) {
          const a = Math.PI / 2 + R.range(-0.45, 0.45), sp = R.range(30, 110);
          ps.spawn(P.SPARK, x, y + 4, Math.cos(a) * sp + vx * 0.2, Math.sin(a) * sp + vy * 0.15, R.range(0.15, 0.4));
          if (R.chance(0.25)) ps.spawn(P.STAR, x + R.range(-1.5, 1.5), y + R.range(2, 6), R.range(-6, 6), R.range(5, 20), R.range(0.4, 0.9), R.chance(0.5) ? C[5] : WHITE, R.chance(0.15) ? 1.2 : 0.5);
          if (R.chance(0.18)) ps.spawn(P.VAPOUR, x, y + 5, R.range(-4, 4), R.range(4, 12), R.range(0.6, 1.1), hex("#4a4458"), R.range(1.2, 2.2));
        }
      } else if (!burst) {
        burst = true;
        [bx, by] = at(FLY);
        lights.add(bx, by, 82, C[4], 0.8, 1.6);
        lights.add(bx, by, 40, WHITE, 0.6, 0.08);
        // the palm: heavy comets thrown up and out, a few low ones to the sides
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + ((i - 4) / 4) * 1.4 + R.range(-0.1, 0.1), sp = R.range(180, 210) * (1 - 0.12 * Math.abs(i - 4) / 4);
          fronds.push({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: R.range(1.8, 2.15), pts: [], acc: R.next(), seed: R.range(0, 100) });
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.VAPOUR, bx + R.range(-4, 4), by + R.range(-4, 4), R.range(-20, 20), R.range(-15, 15), R.range(1.8, 2.6), hex("#4a4458"), R.range(6, 10));
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), sp = R.range(40, 160);
          ps.spawn(P.SPARK, bx, by, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.35));
        }
      }
      for (let i = fronds.length - 1; i >= 0; i--) {
        const f = fronds[i];
        f.age += dt;
        const k = f.age / f.life;
        if (k >= 1) {
          for (let j = 0; j < 4; j++) pops.push({ x: f.x + R.range(-5, 5), y: f.y + R.range(-5, 5), t0: t + R.range(0, 0.2), life: R.range(0.06, 0.12), c: R.chance(0.5) ? WHITE : T[3] });
          fronds.splice(i, 1);
          continue;
        }
        f.vx -= f.vx * DRAG * dt;
        f.vy -= f.vy * DRAG * dt - G * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.pts.push(f.x, f.y, t);
        while (f.pts.length > 3 && t - f.pts[2] > TRAIL) f.pts.splice(0, 3);
        // glitter shed all along: specks that hang, twinkle and drift down
        for (f.acc += dt * 34; f.acc > 1; f.acc--) ps.spawn(P.STAR, f.x + R.range(-1, 1), f.y + R.range(-1, 1), f.vx * 0.1 + R.range(-5, 5), R.range(0, 14), R.range(0.5, 1.1), R.chance(0.6) ? C[5] : WHITE, R.chance(0.12) ? R.range(1, 1.5) : 0.5);
      }
      for (let i = pops.length - 1; i >= 0; i--) if (t > pops[i].t0 + pops[i].life) pops.splice(i, 1);
      ps.update(dt);
      cull(ps, -meta.origin[0] + 2, -meta.origin[1] + 2, meta.size[0] - meta.origin[0] - 2, meta.size[1] - meta.origin[1] - 2);
      lights.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
    },
    draw(p) {
      if (t < FLY) {
        // the rocket: a little tube on a stick, a white-hot tail flickering under it
        const [x, y] = at(t);
        p.line(x, y + 4, x, y + 12, hex("#5a4030"));
        p.rect(x - 1, y - 3, 3, 7, hex("#b8303a"));
        p.px(x - 1, y - 3, hex("#e86070"));
        p.px(x, y - 4, hex("#d8d0c0"));
        const fl = 2 + (Math.sin(t * 70) > 0 ? 1 : 0);
        p.line(x, y + 4, x, y + 4 + fl, (u) => (u < 0.4 ? WHITE : C[5]));
        p.glow(x, y + 5, 9, C[4], 0.6);
      }
      for (const f of fronds) {
        const k = f.age / f.life, P2 = f.pts, n = P2.length / 3;
        // the frond: a thick gold trail, hot near the head, cooling and dithering out behind
        for (let j = n - 1; j > 0; j--) {
          const u = (t - P2[j * 3 + 2]) / TRAIL;
          if (u >= 1) break;
          const c = u < 0.08 ? C[6] : u < 0.25 ? C[5] : u < 0.5 ? C[4] : u < 0.75 ? C[3] : C[2], a = Math.pow(1 - u, 0.6) * (1.25 - k * 0.45);
          p.line(P2[j * 3], P2[j * 3 + 1], P2[j * 3 - 3], P2[j * 3 - 2], c, a);
          if (u < 0.7) p.line(P2[j * 3] + 1, P2[j * 3 + 1], P2[j * 3 - 3] + 1, P2[j * 3 - 2], u < 0.25 ? C[5] : u < 0.5 ? C[3] : C[2], a * 0.85);
          if (u < 0.35) p.line(P2[j * 3], P2[j * 3 + 1] + 1, P2[j * 3 - 3], P2[j * 3 - 2] + 1, C[3], a * 0.6);
        }
        if (k > 0.8 && Math.sin(t * 55 + f.seed) < 0) continue;
        p.rect(f.x - 0.5, f.y - 0.5, 2, 2, k < 0.5 ? WHITE : C[6]);
        if (k < 0.6) for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [0, 2]]) p.px(f.x + dx, f.y + dy, C[5]);
        p.glow(f.x, f.y, 10, C[4], 0.6 * (1 - k * 0.5));
      }
      for (const q of pops) {
        const u = (t - q.t0) / q.life;
        if (u < 0 || u > 1) continue;
        sparkle(p, q.x, q.y, 2.8 * Math.sin(Math.PI * u), q.c, T[2], 0.5);
      }
      // the burst: a white heart for two frames, a flare turning
      const b = t - FLY;
      if (b >= 0 && b < 0.26) {
        const u = b / 0.26, L = 30 * Math.pow(1 - u, 1.3);
        for (let i = 0; i < 8; i++) {
          const diag = i % 2 === 1, an = u * 0.5 + (i * TAU) / 8, len = diag ? L * 0.45 : L, ca = Math.cos(an), sa = Math.sin(an);
          for (let d = 0; d <= len; d += 0.5) {
            const v = d / len;
            p.dot(bx + ca * d, by + sa * d, v < 0.3 ? WHITE : v < 0.65 ? C[5] : C[4], v < 0.7 ? 1 : 1 - (v - 0.7) / 0.35);
          }
        }
        if (b < 0.07) p.circle(bx, by, 2.5, WHITE);
        p.glow(bx, by, 4 + L * 1.2, C[4], 0.35);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: the rocket climbs on a little helix with its spark trail in space and bursts into a gold palm that opens all
// the way round (rings of heavy fronds from the crown to the horizon), with a ball of cold stars inside it. The
// fronds are real paths in x, y and z, drooping on their glittering trails; far ones are a shade dimmer.
export const three = {
  meta: { size: [304, 312], origin: [152, 296], bg: "ground", camera: { pitch: 0.22 } },
  create(o) {
    const C = fit(o.palette, 7), T = fit(o.tips, 6), R = new Rng(o.seed);
    const floor = () => 0, TUBE = [hex("#e86070"), hex("#b8303a"), hex("#7a1c26")];
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]] }), lights = new Lights();
    const fronds = [], pops = [];
    const at = (t) => {
      const k = t / FLY, r = 3 * k;
      return [Math.sin(t * 8) * r, -8 - HIGH * ease.outQuad(clamp(k)), Math.cos(t * 8) * r];
    };
    let t = 0, burst = false, bx = 0, by = 0, bz = 0, acc = 0;
    lights.add(0, -14, 24, C[4], 0.7, 0.35, 0);
    // a unit direction by polar angle from straight up and azimuth
    const dir = (th, ph) => [Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const sph = () => {
      const y = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - y * y);
      return [Math.cos(a) * s, y, Math.sin(a) * s];
    };
    // ignition: a puff of smoke and a spray of sparks off the ground
    for (let i = 0; i < 18; i++) {
      const d = dir(R.range(0, 1.2), R.range(0, TAU)), sp = R.range(60, 180);
      ps.spawn3(P.SPARK, 0, -2, 0, d[0] * sp, d[1] * sp * 0.6, d[2] * sp, R.range(0.15, 0.4));
    }
    for (let i = 0; i < 5; i++) {
      const a = R.range(0, TAU), v = R.range(0, 20);
      ps.spawn3(P.VAPOUR, Math.cos(a) * R.range(0, 3), -2, Math.sin(a) * R.range(0, 3), Math.cos(a) * v, -R.range(2, 10), Math.sin(a) * v, R.range(0.6, 1), hex("#5a5468"), R.range(3, 5));
    }
    const comet = (d, sp, life, tint) => fronds.push({ x: bx, y: by, z: bz, vx: d[0] * sp, vy: d[1] * sp, vz: d[2] * sp, age: 0, life, pts: [], rec: 0, acc: R.next(), seed: R.range(0, 100), tint });
    // the nearer to us, the brighter
    const fade = (q, x, y, z) => 1 - 0.3 * (clamp(q.depth(x, y, z) / 150, -1, 1) * 0.5 + 0.5);

    return {
      update(dt) {
        t += dt;
        if (t < FLY) {
          // the climb: a hot tail spitting gold sparks, glitter left hanging, a thread of smoke
          const [x, y, z] = at(t), [x2, y2, z2] = at(Math.max(0, t - 0.02)), vx = (x - x2) / 0.02, vy = (y - y2) / 0.02, vz = (z - z2) / 0.02;
          for (acc += dt * 90; acc > 1; acc--) {
            const d = dir(Math.PI - R.range(0, 0.45), R.range(0, TAU)), sp = R.range(30, 110);
            ps.spawn3(P.SPARK, x, y + 4, z, d[0] * sp + vx * 0.2, d[1] * sp + vy * 0.15, d[2] * sp + vz * 0.2, R.range(0.15, 0.4));
            if (R.chance(0.25)) ps.spawn3(P.STAR, x + R.range(-1.5, 1.5), y + R.range(2, 6), z + R.range(-1.5, 1.5), R.range(-6, 6), R.range(5, 20), R.range(-6, 6), R.range(0.4, 0.9), R.chance(0.5) ? C[5] : WHITE, R.chance(0.15) ? 1.2 : 0.5);
            if (R.chance(0.18)) ps.spawn3(P.VAPOUR, x, y + 5, z, R.range(-4, 4), R.range(4, 12), R.range(-4, 4), R.range(0.6, 1.1), hex("#4a4458"), R.range(1.2, 2.2));
          }
        } else if (!burst) {
          burst = true;
          [bx, by, bz] = at(FLY);
          lights.add(bx, by, 82, C[4], 0.8, 1.6, bz);
          lights.add(bx, by, 40, WHITE, 0.6, 0.08, bz);
          // the palm: heavy comets thrown up and out, ring on ring down to the horizon
          for (const [n, th, off] of [[1, 0, 0], [6, 0.45, 0.3], [10, 0.9, 0.1], [12, 1.35, 0.5]]) {
            for (let i = 0; i < n; i++) {
              const a = th + R.range(-0.07, 0.07), ph = (i / n) * TAU + off + R.range(-0.1, 0.1);
              comet(dir(a, ph), R.range(180, 210) * (1 - (0.12 * th) / 1.4), R.range(1.8, 2.15), false);
            }
          }
          // inside it, a ball of cold stars
          for (let i = 0; i < 24; i++) comet(sph(), R.range(100, 130), R.range(1.25, 1.7), true);
          for (let i = 0; i < 6; i++) {
            const d = sph(), v = R.range(0, 20), r = R.range(0, 4);
            ps.spawn3(P.VAPOUR, bx + d[0] * r, by + d[1] * r, bz + d[2] * r, d[0] * v, d[1] * v, d[2] * v, R.range(1.8, 2.6), hex("#4a4458"), R.range(6, 10));
          }
          for (let i = 0; i < 30; i++) {
            const d = sph(), sp = R.range(40, 160);
            ps.spawn3(P.SPARK, bx, by, bz, d[0] * sp, d[1] * sp, d[2] * sp, R.range(0.15, 0.35));
          }
        }
        for (let i = fronds.length - 1; i >= 0; i--) {
          const f = fronds[i];
          f.age += dt;
          const k = f.age / f.life;
          if (k >= 1) {
            for (let j = 0; j < (f.tint ? 2 : 4); j++) pops.push({ x: f.x + R.range(-5, 5), y: f.y + R.range(-5, 5), z: f.z + R.range(-5, 5), t0: t + R.range(0, 0.2), life: R.range(0.06, 0.12), c: R.chance(0.5) ? WHITE : T[3] });
            fronds.splice(i, 1);
            continue;
          }
          f.vx -= f.vx * DRAG * dt;
          f.vy -= f.vy * DRAG * dt - G * dt;
          f.vz -= f.vz * DRAG * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.z += f.vz * dt;
          if ((f.rec += dt) >= 1 / 36) (f.rec = 0), f.pts.push(f.x, f.y, f.z, t);
          const trail = f.tint ? 0.45 : TRAIL;
          while (f.pts.length && t - f.pts[3] > trail) f.pts.splice(0, 4);
          // glitter shed all along: specks that hang, twinkle and drift down
          for (f.acc += dt * (f.tint ? 9 : 13); f.acc > 1; f.acc--) ps.spawn3(P.STAR, f.x + R.range(-1, 1), f.y + R.range(-1, 1), f.z + R.range(-1, 1), f.vx * 0.1 + R.range(-5, 5), R.range(0, 14), f.vz * 0.1 + R.range(-5, 5), Math.min(R.range(0.5, 1.1), meta.duration - t), R.chance(0.6) ? (f.tint ? T[4] : C[5]) : WHITE, R.chance(0.12) ? R.range(1, 1.5) : 0.5);
        }
        for (let i = pops.length - 1; i >= 0; i--) if (t > pops[i].t0 + pops[i].life) pops.splice(i, 1);
        ps.update(dt);
        // keep everything inside the canvas, whichever side it is seen from
        const L = ps.list;
        for (let i = L.length - 1; i >= 0; i--) if (Math.hypot(L[i].x, L[i].z) > 146 || L[i].y < -286 || L[i].y > 8) L.splice(i, 1);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), glows = [], right = [q.cy, 0, -q.sy];
        if (t < FLY) {
          // the rocket: a little tube on a stick, a white-hot tail flickering under it
          const [x, y, z] = at(t);
          q.line(x, y + 4, z, x, y + 12, z, hex("#5a4030"));
          q.beam(x, y - 2, z, x, y + 3, z, 3, (u, v) => (v < 0.35 ? TUBE[0] : v < 0.8 ? TUBE[1] : TUBE[2]));
          q.ball(x, y - 3.5, z, 1.2, hex("#d8d0c0"));
          const fl = 2 + (Math.sin(t * 70) > 0 ? 1 : 0);
          q.line(x, y + 4, z, x, y + 4 + fl, z, (u) => (u < 0.4 ? WHITE : C[5]));
          glows.push([x, y + 5, z, 9, C[4], 0.6]);
        }
        for (const f of fronds) {
          const k = f.age / f.life, P2 = f.pts, g = fade(q, f.x, f.y, f.z), trail = f.tint ? 0.45 : TRAIL, cold = f.tint;
          // the frond: a thick trail, hot near the head, cooling and dithering out behind
          let ax = f.x, ay = f.y, az = f.z, at0 = t;
          for (let j = P2.length / 4 - 1; j >= 0; j--) {
            const bx2 = P2[j * 4], by2 = P2[j * 4 + 1], bz2 = P2[j * 4 + 2], bt = P2[j * 4 + 3], u = (t - (at0 + bt) / 2) / trail;
            if (u >= 1) break;
            const a = Math.pow(1 - u, 0.6) * (1.25 - k * 0.45) * g;
            const c = cold ? (u < 0.1 ? T[5] : u < 0.35 ? T[4] : u < 0.65 ? T[3] : T[2]) : u < 0.08 ? C[6] : u < 0.25 ? C[5] : u < 0.5 ? C[4] : u < 0.75 ? C[3] : C[2];
            q.line(ax, ay, az, bx2, by2, bz2, c, a);
            if (u < 0.7) q.line(ax + right[0], ay, az + right[2], bx2 + right[0], by2, bz2 + right[2], cold ? (u < 0.3 ? T[4] : T[2]) : u < 0.25 ? C[5] : u < 0.5 ? C[3] : C[2], a * 0.85);
            (ax = bx2), (ay = by2), (az = bz2), (at0 = bt);
          }
          if (k > 0.8 && Math.sin(t * 55 + f.seed) < 0) continue;
          q.at(f.x, f.y, f.z, (pp) => {
            pp.rect(-0.5, -0.5, 2, 2, k < 0.5 ? WHITE : cold ? T[5] : C[6]);
            if (k < 0.6) for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [0, 2]]) pp.px(dx, dy, cold ? T[4] : C[5]);
          });
          glows.push([f.x, f.y, f.z, 10, cold ? T[3] : C[4], 0.6 * (1 - k * 0.5) * g]);
        }
        for (const m of pops) {
          const u = (t - m.t0) / m.life;
          if (u < 0 || u > 1) continue;
          q.at(m.x, m.y, m.z, (pp) => { pp.z -= 3; sparkle(pp, 0, 0, 2.8 * Math.sin(Math.PI * u), m.c, T[2], 0.5); });
        }
        ps.draw(q);
        for (const g of glows) q.glow(...g);
        // the burst: a white heart for two frames, a flare turning
        const b = t - FLY;
        if (b >= 0 && b < 0.26) {
          const u = b / 0.26, L = 30 * Math.pow(1 - u, 1.3);
          flare3(q, bx, by, bz, L, u * 0.5, C);
          if (b < 0.07) q.ball(bx, by, bz, 2.5, WHITE);
          q.glow(bx, by, bz, 4 + L * 1.2, C[4], 0.35);
        }
        // the sky lights the ground under the palm
        if (b > 0 && b < 1.8) {
          const f = 1 - b / 1.8, R2 = 130;
          q.plane(bx, 0, bz, null, R2, (u, v, out) => {
            const d = 1 - Math.hypot(u, v) / R2;
            if (d <= 0) return;
            out.l = C[3];
            out.k = d * d * 0.2 * f * f;
          });
        }
        lights.draw(q);
      },
    };
  },
};

// the 8-ray flare in space: long rays out along the axes (the horizontal ones turning), short ones out of the corners
function flare3(q, x, y, z, L, ang, C) {
  if (L < 1) return;
  const dirs = [];
  for (let i = 0; i < 4; i++) dirs.push([Math.cos(ang + (i * TAU) / 4), 0, Math.sin(ang + (i * TAU) / 4), false]);
  dirs.push([0, -1, 0, false], [0, 1, 0, false]);
  for (let i = 0; i < 8; i++) {
    const a = ang + (i % 4) * (TAU / 4) + TAU / 8, up = i < 4 ? -0.7 : 0.7;
    dirs.push([Math.cos(a) * 0.7, up, Math.sin(a) * 0.7, true]);
  }
  for (const [dx, dy, dz, diag] of dirs) {
    const len = diag ? L * 0.45 : L;
    for (let d = 0; d <= len; d += 0.5) {
      const v = d / len;
      q.dot(x + dx * d, y + dy * d, z + dz * d, v < 0.3 ? WHITE : v < 0.65 ? C[5] : C[4], v < 0.7 ? 1 : 1 - (v - 0.7) / 0.35);
    }
  }
}
