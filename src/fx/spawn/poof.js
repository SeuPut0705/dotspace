// The soft, top-lit smoke puffs (a body, a denser core, a lit cap) follow Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, flare, clamp, smooth, ease, space, TAU, WHITE, hex } from "../../core/index.js";
import { sphere } from "./_lib.js";

export const meta = {
  name: "Poof",
  desc: "A cartoon death poof: a white pop, a ring of soft round smoke balls bursting out between speed lines, little stars spinning off, and the cloud lifting and thinning away.",
  tags: ["spawn", "death", "despawn", "smoke", "poof", "cartoon", "one-shot"],
  size: [112, 92],
  origin: [56, 80],
  duration: 1.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#2a2440", "#5e5878", "#9a94b4", "#cdc8e0", "#f2f0fa", "#ffffff"],
    stars: ["#ffd84a", "#fff3a6", "#ffffff"],
    seed: 21,
  },
};

const CY = -17;

export function create(o) {
  const C = fit(o.palette, 6), S = fit(o.stars, 3), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, S[1], S[0], C[2]] }), lights = new Lights();
  const balls = [], lines = [];
  // a ring of fat balls round a fat core, thrown out fast and stopped by drag, each swelling as it slows
  const ring = 9;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * TAU + R.range(-0.2, 0.2), sp = R.range(95, 140), r = R.range(5, 7);
    balls.push({ x: Math.cos(a) * 3, y: CY + Math.sin(a) * 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 12, r0: r * 0.5, r1: r, life: R.range(0.7, 1.05), delay: R.range(0, 0.03) });
  }
  for (let i = 0; i < 5; i++) {
    const a = R.range(0, TAU), sp = R.range(20, 60);
    balls.push({ x: Math.cos(a) * 2, y: CY + Math.sin(a) * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 16, r0: 4, r1: R.range(6.5, 8.5), life: R.range(0.85, 1.2), delay: R.range(0.02, 0.06) });
  }
  // a few small puffs flung further out, gone quickly, so the cloud's edge is ragged
  for (let i = 0; i < 7; i++) {
    const a = R.range(0, TAU), sp = R.range(170, 240), r = R.range(2.2, 3.6);
    balls.push({ x: Math.cos(a) * 4, y: CY + Math.sin(a) * 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75 - 10, r0: r * 0.6, r1: r, life: R.range(0.32, 0.5), delay: R.range(0.01, 0.04) });
  }
  for (const b of balls) b.max = b.life;
  // speed lines between the balls, flicked out and gone in a few frames
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + R.range(-0.12, 0.12) + 0.13, sa = Math.sin(a);
    // the ones that point down stop at the floor
    lines.push({ a, r1: Math.min(R.range(24, 34), sa > 0.1 ? (-2 - CY) / sa : 99), d: R.range(0, 0.04) });
  }
  // little stars spun off the pop
  for (let i = 0; i < 7; i++) {
    const a = R.range(-Math.PI, 0.3), sp = R.range(70, 125);
    ps.spawn(P.STAR, Math.cos(a) * 6, CY + Math.sin(a) * 6, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.55, 0.95), R.pick([S[2], S[1], S[1], S[0]]), R.range(1.3, 2.4), R.range(0.02, 0.1));
  }
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU), sp = R.range(40, 110);
    ps.spawn(P.STAR, Math.cos(a) * 5, CY + Math.sin(a) * 5, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.3, 0.6), R.pick([WHITE, S[1]]), 0.6, R.range(0, 0.08));
  }
  // the feet go too: a skid of dust along the floor
  for (let i = 0; i < 6; i++) {
    const s = R.sign();
    ps.spawn(P.DUST, s * R.range(1, 6), -1, s * R.range(25, 70), -R.range(2, 10), R.range(0.4, 0.7), C[2], R.range(1.6, 3), R.range(0.02, 0.08));
  }
  lights.add(0, CY, 46, C[4], 0.8, 0.4);
  lights.add(0, CY, 22, WHITE, 0.8, 0.1);
  let t = 0;

  // a ball swells out, breathes, then shrinks to nothing (a cartoon puff goes out ball by ball, it doesn't fade)
  const radius = (b) => {
    const age = b.max - b.life, u = age / b.max;
    const grow = b.r0 + (b.r1 - b.r0) * ease.outBack(clamp(age / 0.22), 2), breathe = 1 + 0.06 * Math.sin(age * 14 + b.r1);
    return grow * breathe * (u < 0.62 ? 1 : 1 - ease.inBack(clamp((u - 0.62) / 0.38), 1.4));
  };
  const drawBall = (p, b, layer) => {
    const age = b.max - b.life, r = radius(b), a = Math.min(1, age * 20), lit = age < 0.12;
    if (r < 0.6) return;
    // the whole cloud is lit from above: the balls underneath are a step darker
    const hy = (b.y - CY + 6) / 14, lo = hy > 0.4, hi = hy < -0.3;
    if (layer === "shade") p.disc(b.x + r * 0.16, b.y + r * 0.2, r, lit ? C[3] : lo ? C[1] : C[2], 0.8 * a);
    else if (layer === "body") p.disc(b.x - r * 0.06, b.y - r * 0.08, r * 0.86, lit ? C[4] : lo ? C[2] : C[3], 0.88 * a);
    else if (!lo || lit) {
      p.disc(b.x - r * 0.28, b.y - r * 0.34, r * 0.42, lit || hi ? WHITE : C[4], 0.85 * a);
      if (age < 0.25) p.disc(b.x - r * 0.3, b.y - r * 0.38, r * 0.2, WHITE, 0.9 * a * (1 - age / 0.25));
    }
  };

  return {
    update(dt) {
      t += dt;
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        if (b.delay > 0) {
          b.delay -= dt;
          continue;
        }
        if ((b.life -= dt) <= 0) {
          // each ball goes with a pip of light
          if (b.r1 > 4) ps.spawn(P.STAR, b.x, b.y, 0, -8, 0.22, WHITE, 0.6);
          balls.splice(i, 1);
          continue;
        }
        // fast burst, hard drag, then a slow lift
        b.vx -= b.vx * 7 * dt;
        b.vy -= b.vy * 7 * dt + 30 * dt;
        b.x += b.vx * dt;
        b.y = Math.min(b.y + b.vy * dt, -radius(b) * 0.7);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a soft shadow where the body stood, and the light of the pop on the floor
      const s = 1 - smooth(0.1, 0.9, t);
      if (s > 0) p.glow(0, -1, 26, C[4], 0.25 * s);
      ps.draw(p, "back");
    },
    draw(p) {
      // the cloud: shade, body, then caps, so neighbouring balls merge into one lumpy cloud
      const live = balls.filter((b) => b.delay <= 0);
      for (const layer of ["shade", "body", "cap"]) for (const b of live) drawBall(p, b, layer);
      // the pop: a white ball and an 8-ray flare for a couple of frames, then a ring
      if (t < 0.07) {
        const k = t / 0.07;
        p.circle(0, CY, 9 + 3 * k, C[4]);
        p.circle(0, CY, 7 + 3 * k, WHITE);
        flare(p, 0, CY, 20 * (1 - k * 0.5), 1 - k, C);
      }
      const rk = (t - 0.03) / 0.2;
      if (rk > 0 && rk < 1) p.ring(0, CY, 8 + 18 * ease.outCubic(rk), Math.max(1, 2.5 * (1 - rk)), rk < 0.3 ? WHITE : C[4], 1.1 - rk);
      for (const l of lines) {
        const u = (t - l.d) / 0.2;
        if (u <= 0 || u >= 1) continue;
        const head = 8 + (l.r1 - 8) * ease.outExpo(clamp(u / 0.6)), tail = 8 + (l.r1 - 8) * ease.inCubic(u), ca = Math.cos(l.a), sa = Math.sin(l.a);
        p.line(ca * tail, CY + sa * tail, ca * head, CY + sa * head, (v) => (v > 0.6 ? WHITE : C[4]));
        p.glowLine(ca * tail, CY + sa * tail, ca * head, CY + sa * head, 3, C[4], 0.25);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// 3D: the pop in the middle of a room. The balls fly out over a whole sphere (the ones thrown down stop at the
// floor) and stay soft billboards, sorted far to near; the speed lines are rays in space, the pop's ring a true
// circle round it, the stars and the skid of dust leave in every direction.
export const three = {
  meta: { size: [112, 112], origin: [56, 94], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 6), S = fit(o.stars, 3), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, S[1], S[0], C[2]] }), lights = new Lights();
    const balls = [], lines = [];
    const add = (dir, sp, r0, r1, life, delay, off = 3) => {
      const [dx, up, dz] = dir, dy = -up;
      balls.push({ x: dx * off, y: CY + dy * off, z: dz * off, vx: dx * sp, vy: dy * sp * 0.8 - 12, vz: dz * sp, r0, r1, life, delay });
    };
    for (let i = 0; i < 12; i++) {
      const r = R.range(5, 7);
      add(sphere(i, 12, 0.7, R.range(-0.2, 0.2)), R.range(120, 175), r * 0.5, r, R.range(0.7, 1.05), R.range(0, 0.03));
    }
    for (let i = 0; i < 5; i++) add(sphere(i + 4, 5, 1, R.range(-0.3, 0.3)), R.range(20, 60), 4, R.range(6.5, 8.5), R.range(0.85, 1.2), R.range(0.02, 0.06), 2);
    for (let i = 0; i < 7; i++) {
      const r = R.range(2.2, 3.6);
      add(sphere(i, 7, 0.9, 1 + R.range(-0.4, 0.4)), R.range(170, 240), r * 0.6, r, R.range(0.32, 0.5), R.range(0.01, 0.04), 4);
    }
    for (const b of balls) b.max = b.life;
    // speed lines between the balls: rays over the sphere, the ones that point down stop at the floor
    for (let i = 0; i < 12; i++) {
      const d = sphere(i, 12, 0.95, 0.13 + R.range(-0.12, 0.12)), down = -d[1];
      lines.push({ d: [d[0], down, d[2]], r1: Math.min(R.range(24, 34), down > 0.1 ? (-2 - CY) / down : 99), at: R.range(0, 0.04) });
    }
    // little stars spun off the pop, up and out every way round
    for (let i = 0; i < 7; i++) {
      const az = R.range(0, TAU), e = R.range(-0.2, 1.3), sp = R.range(70, 125), h = Math.cos(e) * sp;
      ps.spawn3(P.STAR, Math.cos(az) * 6, CY - Math.sin(e) * 6, Math.sin(az) * 6, Math.cos(az) * h, -Math.sin(e) * sp - 30, Math.sin(az) * h, R.range(0.55, 0.95), R.pick([S[2], S[1], S[1], S[0]]), R.range(1.3, 2.4), R.range(0.02, 0.1));
    }
    for (let i = 0; i < 10; i++) {
      const [dx, up, dz] = sphere(i, 10, 1, R.range(0, 1)), sp = R.range(40, 110);
      ps.spawn3(P.STAR, dx * 5, CY - up * 5, dz * 5, dx * sp, -up * sp - 20, dz * sp, R.range(0.3, 0.6), R.pick([WHITE, S[1]]), 0.6, R.range(0, 0.08));
    }
    // the feet go too: a skid of dust all round along the floor
    for (let i = 0; i < 9; i++) {
      const az = (i / 9) * TAU + R.range(-0.3, 0.3), sp = R.range(25, 70);
      ps.spawn3(P.DUST, Math.cos(az) * R.range(1, 6), -1, Math.sin(az) * R.range(1, 6), Math.cos(az) * sp, -R.range(2, 10), Math.sin(az) * sp, R.range(0.4, 0.7), C[2], R.range(1.6, 3), R.range(0.02, 0.08));
    }
    lights.add(0, CY, 46, C[4], 0.8, 0.4, 0);
    lights.add(0, CY, 22, WHITE, 0.8, 0.1, 0);
    let t = 0;

    const radius = (b) => {
      const age = b.max - b.life, u = age / b.max;
      const grow = b.r0 + (b.r1 - b.r0) * ease.outBack(clamp(age / 0.22), 2), breathe = 1 + 0.06 * Math.sin(age * 14 + b.r1);
      return grow * breathe * (u < 0.62 ? 1 : 1 - ease.inBack(clamp((u - 0.62) / 0.38), 1.4));
    };
    // one ball as a billboard (a puff looks the same from every side): shade, body, cap, lit from above
    const drawBall = (p, b, k) => {
      const age = b.max - b.life, r = radius(b) * k, a = Math.min(1, age * 20), lit = age < 0.12;
      if (r < 0.6) return;
      const hy = (b.y - CY + 6) / 14, lo = hy > 0.4, hi = hy < -0.3;
      p.disc(r * 0.16, r * 0.2, r, lit ? C[3] : lo ? C[1] : C[2], 0.8 * a);
      p.disc(-r * 0.06, -r * 0.08, r * 0.86, lit ? C[4] : lo ? C[2] : C[3], 0.88 * a);
      if (!lo || lit) {
        p.disc(-r * 0.28, -r * 0.34, r * 0.42, lit || hi ? WHITE : C[4], 0.85 * a);
        if (age < 0.25) p.disc(-r * 0.3, -r * 0.38, r * 0.2, WHITE, 0.9 * a * (1 - age / 0.25));
      }
    };

    return {
      update(dt) {
        t += dt;
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          if (b.delay > 0) {
            b.delay -= dt;
            continue;
          }
          if ((b.life -= dt) <= 0) {
            if (b.r1 > 4) ps.spawn3(P.STAR, b.x, b.y, b.z, 0, -8, 0, 0.22, WHITE, 0.6);
            balls.splice(i, 1);
            continue;
          }
          b.vx -= b.vx * 7 * dt;
          b.vz -= b.vz * 7 * dt;
          b.vy -= b.vy * 7 * dt + 30 * dt;
          b.x += b.vx * dt;
          b.z += b.vz * dt;
          b.y = Math.min(b.y + b.vy * dt, -radius(b) * 0.7);
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), s = 1 - smooth(0.1, 0.9, t);
        // solid first: the pop's white heart, the flare on it, the rays and the shock ring
        if (t < 0.07) {
          const k = t / 0.07;
          q.ball(0, CY, 0, 9 + 3 * k, (nx, ny, nz) => (nz > 0.5 ? WHITE : C[4]));
          q.at(0, CY, 0, (pp, kk) => {
            pp.z -= 14;
            flare(pp, 0, 0, 20 * (1 - k * 0.5) * kk, 1 - k, C);
          });
        }
        for (const l of lines) {
          const u = (t - l.at) / 0.2;
          if (u <= 0 || u >= 1) continue;
          const head = 8 + (l.r1 - 8) * ease.outExpo(clamp(u / 0.6)), tail = 8 + (l.r1 - 8) * ease.inCubic(u), [dx, dy, dz] = l.d;
          q.line(dx * tail, CY + dy * tail, dz * tail, dx * head, CY + dy * head, dz * head, (v) => (v > 0.6 ? WHITE : C[4]));
          q.glowLine(dx * tail, CY + dy * tail, dz * tail, dx * head, CY + dy * head, dz * head, 3, C[4], 0.25);
        }
        const rk = (t - 0.03) / 0.2;
        if (rk > 0 && rk < 1) {
          const r = 8 + 18 * ease.outCubic(rk), th = Math.max(1, 2.5 * (1 - rk)), c = rk < 0.3 ? WHITE : C[4], a = 1.1 - rk;
          q.ring(0, CY, 0, r, th, c, a);
          q.at(0, CY, 0, (pp, k) => pp.ring(0, 0, r * k, th, c, a));
        }
        if (s > 0) q.glow(0, -1, 0, 26, C[4], 0.25 * s);
        // the cloud: soft balls, far to near
        for (const b of q.sort(balls.filter((b) => b.delay <= 0), (b) => [b.x, b.y, b.z])) q.at(b.x, b.y, b.z, (pp, k) => drawBall(pp, b, k));
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
