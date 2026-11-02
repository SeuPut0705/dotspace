// The hold-then-break (it closes round the character, holds with glints, cracks, then bursts into tumbling
// pieces, mist and light) is adapted from Sprite Fusion's open-source ice freeze (https://www.spritefusion.com/pixel-art-vfx/ice),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, space, sparkle, clamp, smooth, ease, lerp, rand, TAU, WHITE, READY } from "../../core/index.js";
import { drawRock, stoneShape, drawLeaf, floorCrack, tube, shade3, facing3, leaf3, bits3, rock3 } from "./_lib.js";

export const meta = {
  name: "Root snare",
  desc: "The floor cracks and roots burst up round the character, spiralling round its legs; they cinch tight with a snap, hold, then crack and crumble into bark and dust.",
  tags: ["nature", "roots", "plant", "snare", "root", "status", "actor", "one-shot"],
  size: [128, 96],
  origin: [64, 78],
  duration: 2.7,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#140c08", "#2a1a10", "#46301e", "#64462a", "#86623a", "#a8824e", "#ccaa70", "#ecd6a0"],
    glow: ["#123818", "#2f7a2a", "#6cb83a", "#c8f070"],
    seed: 7,
  },
};

const GRAB = { turn: 0.9, crouch: 3, fx: -12, fy: -34, bx: 12, by: -28, ffx: -2, fbx: 3 };
export const act = {
  poses: [
    [-0.24, { ...READY, ffx: -2, fbx: 3 }],
    [0.3, { turn: 0.9, lean: -1, crouch: 2, fx: -10, fy: -24, bx: 11, by: -24, ffx: -2, fbx: 3 }],
    [0.62, GRAB, "snap"],
    [0.86, { ...GRAB, lean: -3, fy: -37, by: -27 }],
    [1.1, { ...GRAB, lean: 3, fy: -27, by: -37 }],
    [1.34, { ...GRAB, lean: -3, fy: -37, by: -27 }],
    [1.58, { ...GRAB, lean: 3, fy: -27, by: -37 }],
    [1.75, { ...GRAB, crouch: 6 }],
    [1.8, { turn: 1.1, crouch: -1, y: -3, fx: -14, fy: -36, bx: 15, by: -36, ffx: -3, ffy: -6, fbx: 4, fby: -6 }, "snap"],
    [2.05, { ...READY, y: 0, crouch: 5 }],
    [2.7, { ...READY, ffx: -2, fbx: 3 }],
  ],
  hits: [{ t: 0.62, stop: 0.05, shake: 0.1, amp: 1 }, { t: 1.75, stop: 0.04, shake: 0.14, amp: 2 }],
};

const SY = 0.34, CINCH = 0.62, BREAK = 1.75, NP = 48;

// one root: from the floor outside the feet it spirals in round the legs and climbs, thinning to its tip
function path(r, cinch) {
  const pts = [];
  for (let i = 0; i <= NP; i++) {
    const s = i / NP, th = r.th0 + r.dir * TAU * r.turns * s, rad = lerp(r.r0, r.leg - cinch * 1.6, ease.outCubic(Math.min(1, s * 3.5)));
    pts.push({ x: Math.cos(th) * rad, y: -r.h * Math.pow(s, 1.05) + Math.sin(th) * rad * SY, z: Math.sin(th), s });
  }
  return pts;
}

// a stroke of bark along the path: lit on its upper side, dark beneath, a ridge of grain, rootlet hairs
function root(p, pts, g, C, back, a) {
  const n = Math.floor(NP * g);
  for (let i = 0; i < n; i++) {
    const A = pts[i], Bp = pts[i + 1], front = (A.z + Bp.z) / 2 >= 0;
    if (front === back) continue;
    const dx = Bp.x - A.x, dy = Bp.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, up = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;
    const w = (1.4 + 3.6 * Math.pow(1 - A.s, 0.8)) / 2 + 0.35, dim = back ? 1 : 0;
    for (let y = Math.floor(Math.min(A.y, Bp.y) - w - 1); y <= Math.ceil(Math.max(A.y, Bp.y) + w + 1); y++)
      for (let x = Math.floor(Math.min(A.x, Bp.x) - w - 1); x <= Math.ceil(Math.max(A.x, Bp.x) + w + 1); x++) {
        if (y > 0) continue;
        const px = x + 0.5 - A.x, py = y + 0.5 - A.y, u = (px * dx + py * dy) / (L * L);
        if (u < -0.2 || u > 1.2) continue;
        const d = px * nx + py * ny;
        if (Math.abs(d) > w) continue;
        const side = Math.sign(d) * up, q = Math.abs(d) / w;
        let i2 = q > 0.72 ? (side > 0 ? 7 : 1) : side > 0 ? (q > 0.3 ? 6 : 5) : q > 0.35 ? 2 : 3;
        if (q < 0.25 && rand(Math.round(A.s * 40), 3) < 0.4) i2 = 4;
        p.dot(x, y, C[Math.max(1, i2 - dim)], a);
      }
    // rootlet hairs off its underside now and then
    if (i % 7 === 3 && w > 1.2) p.dot(A.x - nx * up * (w + 1), A.y - ny * up * (w + 1), C[2 - dim], a);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.glow, 4), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [G[3], G[2], G[1], G[0]] });
  const lights = new Lights(), chips = [];
  const roots = Array.from({ length: 5 }, (_, i) => ({
    th0: (i / 5) * TAU + R.range(-0.3, 0.3), dir: i % 2 ? 1 : -1, turns: R.range(1.1, 1.6), r0: R.range(14, 19), leg: R.range(8, 10),
    h: R.range(13, 21), at: 0.16 + i * 0.07 + R.range(0, 0.04), buds: [R.range(0.35, 0.55), R.range(0.6, 0.85)],
  }));
  const cracks = [floorCrack(R, -1, R.range(18, 26)), floorCrack(R, 1, R.range(18, 26))];
  let t = 0, cinched = false, broken = false;
  const grow = (r) => ease.outCubic(clamp((t - r.at) / 0.32));
  const squeeze = () => smooth(CINCH - 0.03, CINCH + 0.05, t) * (1 - 0.4 * smooth(CINCH + 0.05, CINCH + 0.25, t));
  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);
      if (t < 0.4 && R.chance(0.3 * f)) {
        const sd = R.sign();
        ps.spawn(P.GRIT, sd * R.range(4, 22), -1, R.range(-20, 20), -R.range(30, 90), R.range(0.5, 0.9), R.pick([C[5], C[4]]), 1);
      }
      for (const r of roots)
        if (!r.burst && t >= r.at) {
          r.burst = true;
          const x = Math.cos(r.th0) * r.r0;
          for (let i = 0; i < 4; i++) chips.push({ x, y: -1, vx: R.range(-60, 60), vy: -R.range(60, 160), a: R.range(0, TAU), va: R.range(-15, 15), s: R.range(1.2, 2), pts: stoneShape(R), life: R.range(0.6, 0.9) });
          for (let i = 0; i < 3; i++) ps.spawn(P.DUST, x, -1, R.range(-25, 25), -R.range(4, 18), R.range(0.4, 0.8), C[5], R.range(2, 3.5));
          lights.add(x, -4, 20, G[2], 0.35, 0.3);
        }
      if (!cinched && t >= CINCH) {
        cinched = true;
        lights.add(0, -10, 40, G[3], 0.5, 0.3);
        lights.add(0, -10, 16, WHITE, 0.4, 0.06);
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.range(-12, 12), -R.range(0, 4), R.sign() * R.range(20, 60), -R.range(4, 14), R.range(0.5, 0.9), C[5], R.range(2, 3.5));
        for (let i = 0; i < 6; i++) ps.spawn(P.STAR, R.range(-9, 9), -R.range(4, 20), 0, -4, R.range(0.25, 0.5), G[3], R.range(0.8, 1.8), R.range(0, 0.1));
      }
      // while it holds, motes of green rise off the roots
      if (t > CINCH && t < BREAK && R.chance(0.06 * f)) ps.spawn(P.MOTE, R.range(-9, 9), -R.range(3, 18), R.range(-6, 6), -R.range(14, 30), R.range(0.5, 0.9), G[3], 0.6);
      if (!broken && t >= BREAK) {
        broken = true;
        lights.add(0, -10, 36, G[2], 0.4, 0.25);
        // every root crumbles into bark chunks and splinters along its length
        for (const r of roots) {
          const pts = path(r, 1);
          for (let i = 2; i < NP; i += 4) {
            const q = pts[i], w = 1.4 + 3.6 * Math.pow(1 - q.s, 0.8);
            chips.push({ x: q.x, y: Math.min(q.y, -1), vx: (Math.sign(q.x) || 1) * R.range(25, 85) + q.x * 3, vy: -R.range(50, 150), a: R.range(0, TAU), va: R.range(-10, 10), s: clamp(w * 0.75, 1.5, 3), pts: stoneShape(R), life: Math.min(R.range(0.7, 0.95), meta.duration - 0.05 - t) });
            if (i % 10 === 2) ps.spawn(P.GRIT, q.x, Math.min(q.y, -1), R.range(-40, 40), -R.range(20, 80), Math.min(R.range(0.6, 0.9), meta.duration - 0.05 - t), R.pick([C[4], C[3], C[2]]), R.chance(0.3) ? 2 : 1);
          }
        }
        for (let i = 0; i < 10; i++) ps.spawn(P.SMOKE, R.range(-12, 12), -R.range(2, 16), R.range(-25, 25), -R.range(5, 20), Math.min(R.range(0.6, 0.9), meta.duration - 0.05 - t), C[5], R.range(3, 5), 0, 0);
      }
      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i];
        if ((c.life -= dt) <= 0) chips.splice(i, 1);
        c.vy += 950 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.a += c.va * dt;
        if (c.y > 0 && c.vy > 0) c.vy > 110 ? ((c.y = 0), (c.vy *= -0.3), (c.vx *= 0.5)) : ((c.y = 0), (c.vy = c.vx = c.va = 0));
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // cracks run out from the feet, a mossy light seeping up from them
      const open = ease.outCubic(clamp(t / 0.25)), hot = smooth(0, 0.3, t) * (1 - smooth(0.5, 1.4, t)), fade = 1 - smooth(meta.duration - 0.6, meta.duration - 0.15, t);
      for (const c of cracks) {
        const m = Math.max(2, Math.ceil(c.length * open));
        for (let k = 1; k < m; k++) {
          const [x0, y0] = c[k - 1], [x1, y1] = c[k];
          p.line(x0, y0 + 1, x1, y1 + 1, C[0], fade);
          p.line(x0, y0, x1, y1, hot > 0.5 ? G[3] : hot > 0.2 ? G[2] : C[1], fade);
          if (k % 2 === 0) p.glow(x1, y1, 6, G[2], 0.3 * hot);
        }
      }
      const hold = smooth(0.3, CINCH, t) * (1 - smooth(BREAK, BREAK + 0.3, t)) * (0.8 + 0.2 * Math.sin(t * 8));
      if (hold > 0) p.glow(0, -12, 30, G[2], 0.3 * hold), p.glow(0, -1, 22, G[3], 0.16 * hold);
      if (t < BREAK) for (const r of roots) if (t > r.at) root(p, path(r, squeeze()), grow(r), C, true, 1);
      ps.draw(p, "back");
    },
    draw(p) {
      if (t < BREAK) {
        for (const r of roots) {
          if (t <= r.at) continue;
          const pts = path(r, squeeze()), g = grow(r);
          root(p, pts, g, C, false, 1);
          // buds open into small leaves once it has hold of them
          for (const b of r.buds) {
            const q = pts[Math.floor(b * NP)], lk = clamp((t - CINCH - 0.1 - b * 0.2) / 0.25);
            if (b > g || lk <= 0 || q.z < 0) continue;
            drawLeaf(p, q.x + 2, q.y - 2, 5 * lk, 1.6, -0.6 + Math.sin(t * 5 + b * 9) * 0.2, 0.3, [G[0], G[1], G[2], G[3]]);
          }
        }
        // the snap as they cinch
        const e = t - CINCH;
        if (e > 0 && e < 0.12) for (const [x, y] of [[-8, -6], [8, -10], [-7, -15]]) sparkle(p, x, y, 5 * (1 - e / 0.12), C[7], G[3], 0.4);
        // the white flash just before they go
        const w = BREAK - t;
        if (w > 0 && w < 0.05) for (const r of roots) for (const q of path(r, 1)) if (q.z >= 0) p.px(q.x, q.y, WHITE);
      }
      const BARK = [C[0], C[1], C[2], C[2], C[3], C[4], C[5]];
      for (const c of chips) drawRock(p, c.x, c.y, c.s, c.a, c.pts, BARK, Math.min(1, c.life / 0.25));
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: the roots really wind round his legs, a true helix in space that passes behind him and in front; they burst
// up from a ring on the floor, cracks run out from his feet every way and the bark flies out all round.
const path3 = (r, cinch) => {
  const pts = [];
  for (let i = 0; i <= NP; i++) {
    const s = i / NP, th = r.th0 + r.dir * TAU * r.turns * s, rad = lerp(r.r0, r.leg - cinch * 1.6, ease.outCubic(Math.min(1, s * 3.5)));
    pts.push([Math.cos(th) * rad, -r.h * Math.pow(s, 1.05), Math.sin(th) * rad, s]);
  }
  return pts;
};

export const three = {
  meta: { size: [144, 108], origin: [72, 88], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), G = fit(o.glow, 4), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [G[3], G[2], G[1], G[0]] });
    const bits = new Bits({ ground: floor }), lights = new Lights(), BARK = [C[0], C[1], C[2], C[2], C[3], C[4], C[5]];
    const roots = Array.from({ length: 5 }, (_, i) => ({
      th0: (i / 5) * TAU + R.range(-0.3, 0.3), dir: i % 2 ? 1 : -1, turns: R.range(1.1, 1.6), r0: R.range(14, 19), leg: R.range(8, 10),
      h: R.range(13, 21), at: 0.16 + i * 0.07 + R.range(0, 0.04), buds: [R.range(0.35, 0.55), R.range(0.6, 0.85)],
    }));
    // cracks out from his feet every way
    const cracks = Array.from({ length: 7 }, (_, i) => {
      const len = R.range(18, 28);
      let a = (i / 7) * TAU + R.range(-0.25, 0.25), r = 3;
      const pts = [[Math.cos(a) * r, Math.sin(a) * r]];
      while (r < len) (r += R.range(2, 5)), (a += R.range(-0.16, 0.16)), pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      return pts;
    });
    const dir = (cone) => {
      const e = R.range(0, cone), h = R.range(0, TAU);
      return [Math.sin(e) * Math.cos(h), -Math.cos(e), Math.sin(e) * Math.sin(h)];
    };
    let t = 0, cinched = false, broken = false;
    const chip = (x, y, z, vx, vz, s, life) => {
      const d = dir(1.2);
      bits.add({ kind: B.CHUNK, x, y, z, vx: vx + d[0] * 40, vy: d[1] * R.range(50, 150), vz: vz + d[2] * 40, a: R.range(0, TAU), va: R.range(-15, 15), s, g: 1, drag: 0.1, bounce: 0.3, life, ...rock3(R, 8) });
    };
    const grow = (r) => ease.outCubic(clamp((t - r.at) / 0.32));
    const squeeze = () => smooth(CINCH - 0.03, CINCH + 0.05, t) * (1 - 0.4 * smooth(CINCH + 0.05, CINCH + 0.25, t));
    return {
      update(dt) {
        t += dt;
        const f = Math.min(1, dt * 120);
        if (t < 0.4 && R.chance(0.3 * f)) {
          const a = R.range(0, TAU), r = R.range(4, 22);
          ps.spawn3(P.GRIT, Math.cos(a) * r, -1, Math.sin(a) * r, R.range(-20, 20), -R.range(30, 90), R.range(-20, 20), R.range(0.5, 0.9), R.pick([C[5], C[4]]), 1);
        }
        for (const r of roots)
          if (!r.burst && t >= r.at) {
            r.burst = true;
            const x = Math.cos(r.th0) * r.r0, z = Math.sin(r.th0) * r.r0;
            for (let i = 0; i < 4; i++) chip(x, -1, z, R.range(-30, 30), R.range(-30, 30), R.range(1.2, 2), R.range(0.6, 0.9));
            for (let i = 0; i < 3; i++) ps.spawn3(P.DUST, x, -1, z, R.range(-25, 25), -R.range(4, 18), R.range(-25, 25), R.range(0.4, 0.8), C[5], R.range(2, 3.5));
            lights.add(x, -4, 20, G[2], 0.35, 0.3, z);
          }
        if (!cinched && t >= CINCH) {
          cinched = true;
          lights.add(0, -10, 40, G[3], 0.5, 0.3, 0);
          lights.add(0, -10, 16, WHITE, 0.4, 0.06, 0);
          for (let i = 0; i < 8; i++) {
            const a = R.range(0, TAU), v = R.range(20, 60);
            ps.spawn3(P.DUST, R.range(-12, 12), -R.range(0, 4), R.range(-12, 12), Math.cos(a) * v, -R.range(4, 14), Math.sin(a) * v, R.range(0.5, 0.9), C[5], R.range(2, 3.5));
          }
          for (let i = 0; i < 6; i++) ps.spawn3(P.STAR, R.range(-9, 9), -R.range(4, 20), R.range(-9, 9), 0, -4, 0, R.range(0.25, 0.5), G[3], R.range(0.8, 1.8), R.range(0, 0.1));
        }
        // while it holds, motes of green rise off the roots
        if (t > CINCH && t < BREAK && R.chance(0.06 * f)) ps.spawn3(P.MOTE, R.range(-9, 9), -R.range(3, 18), R.range(-9, 9), R.range(-6, 6), -R.range(14, 30), R.range(-6, 6), R.range(0.5, 0.9), G[3], 0.6);
        if (!broken && t >= BREAK) {
          broken = true;
          lights.add(0, -10, 36, G[2], 0.4, 0.25, 0);
          // every root crumbles into bark chunks and splinters along its length
          for (const r of roots) {
            const pts = path3(r, 1);
            for (let i = 2; i < NP; i += 4) {
              const q = pts[i], w = 1.4 + 3.6 * Math.pow(1 - q[3], 0.8), m = Math.hypot(q[0], q[2]) || 1;
              chip(q[0], Math.min(q[1], -1), q[2], (q[0] / m) * R.range(25, 85), (q[2] / m) * R.range(25, 85), clamp(w * 0.75, 1.5, 3), Math.min(R.range(0.7, 0.95), meta.duration - 0.05 - t));
              if (i % 10 === 2) ps.spawn3(P.GRIT, q[0], Math.min(q[1], -1), q[2], R.range(-40, 40), -R.range(20, 80), R.range(-40, 40), Math.min(R.range(0.6, 0.9), meta.duration - 0.05 - t), R.pick([C[4], C[3], C[2]]), R.chance(0.3) ? 2 : 1);
            }
          }
          for (let i = 0; i < 10; i++) ps.spawn3(P.SMOKE, R.range(-12, 12), -R.range(2, 16), R.range(-12, 12), R.range(-25, 25), -R.range(5, 20), R.range(-25, 25), Math.min(R.range(0.6, 0.9), meta.duration - 0.05 - t), C[5], R.range(3, 5), 0, 0);
        }
        bits.update(dt);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // cracks run out from the feet, a mossy light seeping up from them
        const open = ease.outCubic(clamp(t / 0.25)), hot = smooth(0, 0.3, t) * (1 - smooth(0.5, 1.4, t)), fade = 1 - smooth(meta.duration - 0.6, meta.duration - 0.15, t);
        for (const c of cracks) {
          const m = Math.max(2, Math.ceil(c.length * open));
          for (let k = 1; k < m; k++) {
            const [x0, z0] = c[k - 1], [x1, z1] = c[k];
            q.line(x0, 0, z0 + 1, x1, 0, z1 + 1, C[0], fade);
            q.line(x0, 0, z0, x1, 0, z1, hot > 0.5 ? G[3] : hot > 0.2 ? G[2] : C[1], fade);
            if (k % 2 === 0) q.glow(x1, 0, z1, 6, G[2], 0.3 * hot);
          }
        }
        const hold = smooth(0.3, CINCH, t) * (1 - smooth(BREAK, BREAK + 0.3, t)) * (0.8 + 0.2 * Math.sin(t * 8));
        if (hold > 0) q.glow(0, -12, 0, 30, G[2], 0.3 * hold), q.glow(0, -1, 0, 22, G[3], 0.16 * hold);
        if (t < BREAK) {
          const white = BREAK - t < 0.05, sq = squeeze();
          for (const r of roots) {
            if (t <= r.at) continue;
            const pts = path3(r, sq), g = grow(r), n = Math.floor(NP * g);
            if (n < 1) continue;
            // a stroke of bark, lit on its upper side, dark beneath, a ridge of grain
            tube(q, pts.slice(0, n + 1), (u) => (1.2 + 3 * Math.pow(1 - pts[Math.min(NP, Math.round(u * n))][3], 0.8)) / 2 + 0.3, (nx, ny, nz, u) => {
              if (white) return WHITE;
              if (nz < 0.22) return C[1];
              const c = shade3(C.slice(1, 7), nx, ny, nz, 0.75), grain = rand(Math.round(u * 40), 3) < 0.35;
              return facing3(nx, ny, nz) > 0.93 ? C[7] : grain ? C[Math.max(1, C.indexOf(c) - 1)] : c;
            }, 0);
            // buds open into small leaves once it has hold of them
            for (const b of r.buds) {
              const q0 = pts[Math.floor(b * NP)], lk = clamp((t - CINCH - 0.1 - b * 0.2) / 0.25);
              if (b > g || lk <= 0) continue;
              const m = Math.hypot(q0[0], q0[2]) || 1, e = 0.5 + Math.sin(t * 5 + b * 9) * 0.15;
              leaf3(q, q0[0], q0[1], q0[2], [(q0[0] / m) * Math.cos(e), -Math.sin(e), (q0[2] / m) * Math.cos(e)], 5.5 * lk, 1.6, 0.3, [G[0], G[1], G[2], G[3]]);
            }
          }
          // the snap as they cinch
          const e = t - CINCH;
          if (e > 0 && e < 0.12) for (const [x, y, z] of [[-8, -6, 4], [8, -10, -4], [-7, -15, -5], [6, -4, 7]]) q.at(x, y, z, (pp) => sparkle(pp, 0, 0, 5 * (1 - e / 0.12), C[7], G[3], 0.4));
        }
        bits3(q, bits, BARK);
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
