// The flare, the twinkling crosses and the glitter are adapted from Sprite Fusion's open-source sparkle
// (https://www.spritefusion.com/pixel-art-vfx/sparkle), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, sparkle, ease, space, clamp, TAU, WHITE, hex, mix } from "../../core/index.js";

export const meta = {
  name: "Firework burst",
  desc: "A shell climbs, slows and bursts into a sphere of coloured trailing stars round a gold core; they droop, crackle into white pops and fade, leaving glitter.",
  tags: ["firework", "celebration", "sparkle", "sky", "burst", "one-shot"],
  size: [240, 248],
  origin: [120, 100],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"],
    core: ["#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4", "#ffffff"],
    seed: 9,
  },
};

const RISE = 0.42, Y0 = 72, DRAG = 2.6, G = 88, TRAIL = 0.34, TURN = 0.22;

export function create(o) {
  const C = fit(o.palette, 7), K = fit(o.core, 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [K[6], K[5], K[4], K[3]] }), lights = new Lights();
  const stars = [], pops = [];
  let t = 0, burst = false;

  // a shell of stars thrown over a sphere: seen side-on, the ones flying at us or away look slower
  // the outer stars burn gold for a beat, then turn to their color
  const shell = (n, speed, ramp, life, first) => {
    for (let i = 0; i < n; i++) {
      const z = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - z * z), v = speed * R.range(0.93, 1.05);
      stars.push({ x: 0, y: 0, vx: Math.cos(a) * s * v, vy: Math.sin(a) * s * v, life: R.range(life[0], life[1]), age: 0, ramp, first, big: R.chance(0.2), pts: [], acc: R.next(), seed: R.range(0, 100) });
    }
  };

  return {
    update(dt) {
      t += dt;
      // the shell climbs, slowing, shedding a fizz of gold sparks
      if (t < RISE) {
        const y = Y0 * (1 - ease.outCubic(t / RISE));
        if (R.chance(50 * dt)) ps.spawn(P.SPARK, R.range(-0.5, 0.5), y + 2, R.range(-25, 25), R.range(20, 70), R.range(0.15, 0.35));
        if (R.chance(14 * dt)) ps.spawn(P.VAPOUR, R.range(-1, 1), y + 3, R.range(-3, 3), R.range(5, 15), R.range(0.5, 0.8), hex("#4a4458"), R.range(1.5, 2.5));
      }
      if (!burst && t >= RISE) {
        burst = true;
        lights.add(0, 0, 110, C[4], 0.6, 1.5);
        lights.add(0, 0, 30, WHITE, 0.5, 0.07);
        shell(66, 236, C, [1.35, 1.9], K);
        shell(26, 120, K, [1.0, 1.4], K);
        // the burst charge's smoke, drifting where the shell broke
        for (let i = 0; i < 7; i++) {
          const a = R.range(0, TAU), d = R.range(0, 8);
          ps.spawn(P.VAPOUR, Math.cos(a) * d, Math.sin(a) * d, Math.cos(a) * R.range(10, 30), Math.sin(a) * R.range(10, 30), R.range(2.2, 3), hex("#4a4458"), R.range(6, 11));
        }
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), sp = R.range(40, 140);
          ps.spawn(P.SPARK, 0, 0, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.35));
        }
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.age += dt;
        const k = s.age / s.life;
        if (k >= 1) {
          // the star crackles out in a few white pops
          for (let j = 0; j < 2 + (s.big ? 1 : 0); j++) pops.push({ x: s.x + R.range(-3, 3), y: s.y + R.range(-3, 3), t0: t + R.range(0, 0.18), life: R.range(0.06, 0.12), c: R.chance(0.6) ? WHITE : s.ramp[5] });
          stars.splice(i, 1);
          continue;
        }
        s.vx -= s.vx * DRAG * dt;
        s.vy -= s.vy * DRAG * dt - G * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.pts.push(s.x, s.y, t);
        while (s.pts.length > 3 && t - s.pts[2] > TRAIL) s.pts.splice(0, 3);
        // glitter shed along the way: specks that hang, twinkle and fall
        for (s.acc += dt * (k < 0.25 ? 4 : 11); s.acc > 1; s.acc--) ps.spawn(P.STAR, s.x, s.y, s.vx * 0.15 + R.range(-6, 6), s.vy * 0.15 + R.range(0, 10), R.range(0.35, 0.8), R.chance(0.5) ? K[5] : WHITE, R.chance(0.15) ? R.range(1, 1.6) : 0.5);
      }
      for (let i = pops.length - 1; i >= 0; i--) if (t > pops[i].t0 + pops[i].life) pops.splice(i, 1);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      ps.draw(p, "back");
    },
    draw(p) {
      if (t < RISE) {
        // the shell: a hot dot with a short tail
        const u = t / RISE, y = Y0 * (1 - ease.outCubic(u));
        p.line(0, y, 0, y + 3 + 6 * (1 - u), (q) => (q < 0.3 ? K[5] : K[3]));
        p.px(0, y, WHITE);
        p.glow(0, y, 7, K[4], 0.5);
      }
      for (const s of stars) {
        const k = s.age / s.life, P2 = s.pts, n = P2.length / 3;
        // the trail: a 1 px line from the head back along where it has been, cooling and dithering out; the part
        // laid while the star burned gold stays gold
        for (let j = n - 1; j > 0; j--) {
          const u = (t - P2[j * 3 + 2]) / TRAIL;
          if (u >= 1) break;
          const ramp = s.age - (t - P2[j * 3 + 2]) < TURN ? s.first : s.ramp;
          const c = u < 0.3 ? ramp[5] : u < 0.6 ? ramp[4] : ramp[3];
          p.line(P2[j * 3], P2[j * 3 + 1], P2[j * 3 - 3], P2[j * 3 - 2], c, Math.pow(1 - u, 0.8) * (1.3 - k * 0.6));
        }
        // the head: white-hot, then its color; late on it flickers before it crackles out
        if (k > 0.72 && Math.sin(t * 60 + s.seed) < -0.2) continue;
        // white only on the burst frame; the glow comes in as the stars spread, so the heart never blooms into a blob
        const ramp = s.age < TURN ? s.first : s.ramp, head = s.age < 0.04 ? WHITE : k < 0.55 ? ramp[s.age < TURN ? 5 : 6] : ramp[5];
        p.px(s.x, s.y, head);
        if (s.big && k < 0.6 && s.age > 0.06) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(s.x + dx, s.y + dy, ramp[5]);
        p.glow(s.x, s.y, s.big ? 7 : 5, ramp[4], (s.big ? 0.7 : 0.5) * (1 - k * 0.6) * Math.min(1, s.age / 0.2));
      }
      for (const q of pops) {
        const u = (t - q.t0) / q.life;
        if (u < 0 || u > 1) continue;
        sparkle(p, q.x, q.y, 2.6 * Math.sin(Math.PI * u), q.c, mix(q.c, C[3], 0.5), 0.5);
      }
      // the burst: a flare and a white heart, the sky lit up behind it
      const b = t - RISE;
      if (b >= 0 && b < 0.28) {
        const u = b / 0.28, L = 32 * Math.pow(1 - u, 1.3);
        flareRays(p, 0, 0, L, u * 0.6, C, K);
        if (b < 0.07) p.circle(0, 0, 2.6 - b * 20, WHITE);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// an 8-ray flare: long rays on the axes with a white core and tinted ends, short gold diagonals, turning slowly
function flareRays(p, x, y, L, ang, C, K) {
  if (L < 1) return;
  for (let i = 0; i < 8; i++) {
    const diag = i % 2 === 1, an = ang + (i * TAU) / 8, len = diag ? L * 0.42 : L, ca = Math.cos(an), sa = Math.sin(an);
    for (let d = 0; d <= len; d += 0.5) {
      const u = d / len;
      p.dot(x + ca * d, y + sa * d, diag ? (u < 0.5 ? K[5] : K[4]) : u < 0.3 ? WHITE : u < 0.65 ? C[5] : C[4], u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35);
    }
  }
  p.glow(x, y, 4 + L * 1.2, C[4], 0.3);
  p.glow(x, y, 2 + L * 0.3, WHITE, 0.25);
}

// ---- 3D: the shell climbs, and the burst is a real sphere of stars with a tilted gold ring through it. Each star is a
// head, a glow and a streak of its own path in x, y and z; they droop together into a bowl. Stars on the far side are a
// shade dimmer, so the ball turns in depth from every side.
export const three = {
  meta: { size: [232, 296], origin: [116, 128], camera: { pitch: 0.25 } },
  create(o) {
    const C = fit(o.palette, 7), K = fit(o.core, 7), R = new Rng(o.seed);
    const ps = new Particles({ rng: R, sparks: [K[6], K[5], K[4], K[3]] }), lights = new Lights();
    const stars = [], pops = [];
    let t = 0, burst = false;

    // a uniform direction on the sphere, y up/down
    const sph = () => {
      const y = R.range(-1, 1), a = R.range(0, TAU), s = Math.sqrt(1 - y * y);
      return [Math.cos(a) * s, y, Math.sin(a) * s];
    };
    const star = (d, v, ramp, life, first, big) => stars.push({ x: 0, y: 0, z: 0, vx: d[0] * v, vy: d[1] * v, vz: d[2] * v, life, age: 0, ramp, first, big, pts: [], rec: 0, acc: R.next(), seed: R.range(0, 100) });
    // the two shells as in 2D: outer stars in the palette, an inner gold ball
    const shell = (n, speed, ramp, life, first) => {
      for (let i = 0; i < n; i++) star(sph(), speed * R.range(0.93, 1.05), ramp, R.range(life[0], life[1]), first, R.chance(0.2));
    };
    // and a gold ring on a tilted plane, so the burst isn't the same from every side
    const ring = (n, speed, life) => {
      const tilt = 0.62, az = 0.9, n3 = [Math.sin(tilt) * Math.cos(az), -Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
      const e1 = [Math.cos(az + Math.PI / 2), 0, Math.sin(az + Math.PI / 2)];
      const e2 = [n3[1] * e1[2], n3[2] * e1[0] - n3[0] * e1[2], -n3[1] * e1[0]];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + R.range(-0.08, 0.08), c = Math.cos(a), s = Math.sin(a);
        star([e1[0] * c + e2[0] * s, e1[1] * c + e2[1] * s, e1[2] * c + e2[2] * s], speed * R.range(0.97, 1.03), K, R.range(life[0], life[1]), K, true);
      }
    };
    // a star on the far side of the ball is dimmer
    const fade = (q, x, y, z) => 1 - 0.32 * (clamp(q.depth(x, y, z) / 100, -1, 1) * 0.5 + 0.5);

    return {
      update(dt) {
        t += dt;
        if (t < RISE) {
          const y = Y0 * (1 - ease.outCubic(t / RISE));
          if (R.chance(50 * dt)) ps.spawn3(P.SPARK, R.range(-0.5, 0.5), y + 2, R.range(-0.5, 0.5), R.range(-25, 25), R.range(20, 70), R.range(-25, 25), R.range(0.15, 0.35));
          if (R.chance(14 * dt)) ps.spawn3(P.VAPOUR, R.range(-1, 1), y + 3, R.range(-1, 1), R.range(-3, 3), R.range(5, 15), R.range(-3, 3), R.range(0.5, 0.8), hex("#4a4458"), R.range(1.5, 2.5));
        }
        if (!burst && t >= RISE) {
          burst = true;
          lights.add(0, 0, 110, C[4], 0.6, 1.5, 0);
          lights.add(0, 0, 30, WHITE, 0.5, 0.07, 0);
          shell(66, 236, C, [1.35, 1.9], K);
          shell(26, 120, K, [1.0, 1.4], K);
          ring(20, 178, [1.1, 1.5]);
          for (let i = 0; i < 7; i++) {
            const d = sph(), r = R.range(0, 8), v = R.range(10, 30);
            ps.spawn3(P.VAPOUR, d[0] * r, d[1] * r, d[2] * r, d[0] * v, d[1] * v, d[2] * v, R.range(2.2, 3), hex("#4a4458"), R.range(6, 11));
          }
          for (let i = 0; i < 24; i++) {
            const d = sph(), sp = R.range(40, 140);
            ps.spawn3(P.SPARK, 0, 0, 0, d[0] * sp, d[1] * sp, d[2] * sp, R.range(0.15, 0.35));
          }
        }
        for (let i = stars.length - 1; i >= 0; i--) {
          const s = stars[i];
          s.age += dt;
          const k = s.age / s.life;
          if (k >= 1) {
            for (let j = 0; j < 2 + (s.big ? 1 : 0); j++) pops.push({ x: s.x + R.range(-3, 3), y: s.y + R.range(-3, 3), z: s.z + R.range(-3, 3), t0: t + R.range(0, 0.18), life: R.range(0.06, 0.12), c: R.chance(0.6) ? WHITE : s.ramp[5] });
            stars.splice(i, 1);
            continue;
          }
          s.vx -= s.vx * DRAG * dt;
          s.vy -= s.vy * DRAG * dt - G * dt;
          s.vz -= s.vz * DRAG * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.z += s.vz * dt;
          // a point of the streak every 1/40 s is plenty
          if ((s.rec += dt) >= 1 / 40) (s.rec = 0), s.pts.push(s.x, s.y, s.z, t);
          while (s.pts.length && t - s.pts[3] > TRAIL) s.pts.splice(0, 4);
          for (s.acc += dt * (k < 0.25 ? 4 : 11); s.acc > 1; s.acc--) ps.spawn3(P.STAR, s.x, s.y, s.z, s.vx * 0.15 + R.range(-6, 6), s.vy * 0.15 + R.range(0, 10), s.vz * 0.15 + R.range(-6, 6), R.range(0.35, 0.8), R.chance(0.5) ? K[5] : WHITE, R.chance(0.15) ? R.range(1, 1.6) : 0.5);
        }
        for (let i = pops.length - 1; i >= 0; i--) if (t > pops[i].t0 + pops[i].life) pops.splice(i, 1);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), glows = [];
        if (t < RISE) {
          // the shell: a hot dot with a short tail
          const u = t / RISE, y = Y0 * (1 - ease.outCubic(u));
          q.line(0, y, 0, 0, y + 3 + 6 * (1 - u), 0, (v) => (v < 0.3 ? K[5] : K[3]));
          q.px(0, y, 0, WHITE);
          glows.push([0, y, 0, 7, K[4], 0.5]);
        }
        for (const s of stars) {
          const k = s.age / s.life, f = fade(q, s.x, s.y, s.z);
          // the streak, newest segment first: cooling and dithering out; what was laid while the star burned gold stays gold
          let ax = s.x, ay = s.y, az = s.z, at = t;
          for (let j = s.pts.length / 4 - 1; j >= 0; j--) {
            const bx = s.pts[j * 4], by = s.pts[j * 4 + 1], bz = s.pts[j * 4 + 2], bt = s.pts[j * 4 + 3];
            const u = (t - (at + bt) / 2) / TRAIL;
            if (u >= 1) break;
            const ramp = s.age - (t - bt) < TURN ? s.first : s.ramp, c = u < 0.3 ? ramp[5] : u < 0.6 ? ramp[4] : ramp[3];
            q.line(ax, ay, az, bx, by, bz, c, Math.pow(1 - u, 0.8) * (1.3 - k * 0.6) * f);
            (ax = bx), (ay = by), (az = bz), (at = bt);
          }
          // the head: white-hot, then its color (a step down on the far side); late on it flickers before it crackles out
          if (k > 0.72 && Math.sin(t * 60 + s.seed) < -0.2) continue;
          const ramp = s.age < TURN ? s.first : s.ramp, hi = (k < 0.55 ? (s.age < TURN ? 5 : 6) : 5) - (f < 0.82 ? 1 : 0), head = s.age < 0.04 ? WHITE : ramp[hi];
          q.px(s.x, s.y, s.z, head);
          if (s.big && k < 0.6 && s.age > 0.06) q.at(s.x, s.y, s.z, (pp) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pp.px(dx, dy, ramp[5]); });
          glows.push([s.x, s.y, s.z, s.big ? 7 : 5, ramp[4], (s.big ? 0.7 : 0.5) * (1 - k * 0.6) * Math.min(1, s.age / 0.2) * f]);
        }
        for (const m of pops) {
          const u = (t - m.t0) / m.life;
          if (u < 0 || u > 1) continue;
          q.at(m.x, m.y, m.z, (pp) => { pp.z -= 3; sparkle(pp, 0, 0, 2.6 * Math.sin(Math.PI * u), m.c, mix(m.c, C[3], 0.5), 0.5); });
        }
        ps.draw(q);
        for (const g of glows) q.glow(...g);
        // the burst: a flare of rays out in every direction and a white heart, the sky lit up round it
        const b = t - RISE;
        if (b >= 0 && b < 0.28) {
          const u = b / 0.28;
          flare3(q, 38 * Math.pow(1 - u, 1.3), u * 0.6, C, K);
          if (b < 0.07) q.ball(0, 0, 0, 2.6 - b * 20, WHITE);
        }
        lights.draw(q);
      },
    };
  },
};

// flareRays in space: long rays out along the three axes (the four on the floor plane turning slowly), short gold rays
// out of the cube's corners; fading out along their length
function flare3(q, L, ang, C, K) {
  if (L < 1) return;
  const dirs = [];
  for (let i = 0; i < 4; i++) dirs.push([Math.cos(ang + (i * TAU) / 4), 0, Math.sin(ang + (i * TAU) / 4), false]);
  dirs.push([0, -1, 0, false], [0, 1, 0, false]);
  for (let i = 0; i < 8; i++) {
    const a = ang + (i % 4) * (TAU / 4) + TAU / 8, up = i < 4 ? -0.7 : 0.7;
    dirs.push([Math.cos(a) * 0.7, up, Math.sin(a) * 0.7, true]);
  }
  for (const [dx, dy, dz, diag] of dirs) {
    const len = diag ? L * 0.42 : L;
    for (let d = 0; d <= len; d += 0.65) {
      const u = d / len;
      q.dot(dx * d, dy * d, dz * d, diag ? (u < 0.5 ? K[5] : K[4]) : u < 0.3 ? WHITE : u < 0.65 ? C[5] : C[4], u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35);
    }
  }
  q.glow(0, 0, 0, 4 + L * 1.2, C[4], 0.3);
  q.glow(0, 0, 0, 2 + L * 0.3, WHITE, 0.25);
}
