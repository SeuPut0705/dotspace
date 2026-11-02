// The smear that trails the lash (white at its leading edge, cooling down the ramp as it thins), the glint and
// crack burst at the tip, are adapted from Sprite Fusion's open-source slash (https://www.spritefusion.com/pixel-art-vfx/slash),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, space, sparkle, clamp, smooth, ease, lerp, TAU, WHITE, rand } from "../../core/index.js";
import { Drops, drawLeaf, drawRock, stoneShape, tube, shade3, leaf3, bits3, rock3 } from "./_lib.js";

export const meta = {
  name: "Vine whip",
  desc: "A thorny vine bursts from the floor, rears back coiled, then lashes out right in a whip crack that sprays sap and tears off leaves, before sliding back into the ground.",
  tags: ["nature", "vine", "plant", "whip", "melee", "directional", "one-shot"],
  size: [216, 128],
  origin: [60, 114],
  duration: 1.4,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0c1a10", "#173a1a", "#24582a", "#357a34", "#52a03e", "#86c84e", "#c4ec7a", "#f4ffd0"],
    thorn: ["#2a1410", "#5e2a1a", "#a04c2e", "#e89a6a"],
    soil: ["#120c0c", "#251917", "#3b2a24", "#553d31", "#715440", "#8f6e52", "#b8966e", "#e6d0a8"],
    seed: 3,
  },
};

const N = 24, LS = 3.3, LASH = 0.36, LAG = 0.0052, TAU_S = 0.055, OMEGA = TAU / 0.21;
const CRACK = LASH + LAG * N + (Math.PI - Math.atan(OMEGA * TAU_S)) / OMEGA;

// a damped spring's step: 0 before u = 0, swings past 1, settles
const spring = (u) => (u <= 0 ? 0 : 1 - Math.exp(-u / TAU_S) * (Math.cos(OMEGA * u) + Math.sin(OMEGA * u) / (OMEGA * TAU_S)));

// the vine's points at time t: each segment's angle blends from standing, to reared back with the tip coiled
// over, to lashed out right; the lash runs up the vine as a wave, so the tip whips through last
function pose(t) {
  const grow = ease.outCubic(clamp(t / 0.14)) * (1 - ease.inCubic(clamp((t - 1.0) / 0.3))), rear = smooth(0.1, LASH, t), relax = smooth(0.82, 1.0, t);
  const pts = [[0, (1 - grow) * (N * LS + 6)]];
  for (let i = 0; i < N; i++) {
    const s = i / N, stand = -Math.PI / 2 + 0.25 * Math.sin(s * 3 + t * 7) * s;
    const back = -Math.PI / 2 - 0.3 - 1.65 * Math.pow(s, 1.3), out = -1.0 + 0.9 * Math.pow(s, 0.6);
    let a = lerp(stand, back, rear);
    a = lerp(a, out, spring(t - LASH - LAG * i));
    a = lerp(a, stand, relax);
    const [x, y] = pts[i];
    pts.push([x + Math.cos(a) * LS, y + Math.sin(a) * LS]);
  }
  return pts;
}

// a translucent polygon: the soft body of the smear under its streaks
function haze(p, pts, c, a) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) p.blend(x, y, c, a);
    }
}

const width = (s) => 1.2 + 4.8 * Math.pow(1 - s, 0.7);

// the vine itself: a thick stroke lit on its upper side with a bright edge, dark beneath, bark notches
function vine(p, pts, C) {
  for (let i = 0; i < N; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const w0 = width(i / N) / 2, w1 = width((i + 1) / N) / 2, up = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;
    const X0 = Math.floor(Math.min(ax, bx) - 4), X1 = Math.ceil(Math.max(ax, bx) + 4), Y0 = Math.floor(Math.min(ay, by) - 4), Y1 = Math.ceil(Math.max(ay, by) + 4);
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        if (y > 0) continue;
        const px = x + 0.5 - ax, py = y + 0.5 - ay, u = (px * dx + py * dy) / (L * L);
        if (u < -0.15 || u > 1.15) continue;
        const d = px * nx + py * ny, w = lerp(w0, w1, clamp(u)) + 0.35;
        if (Math.abs(d) > w) continue;
        const side = Math.sign(d) * up, q = Math.abs(d) / w, arc = (i + u) * LS;
        let c = q > 0.8 ? (side > 0 ? C[5] : C[1]) : side > 0 ? (q > 0.35 ? C[4] : C[3]) : q > 0.4 ? C[2] : C[3];
        if (w > 1.6 && Math.abs(((arc + d * 0.8) % 5) - 2.5) < 0.45 && q < 0.8) c = C[2];
        p.px(x, y, c);
      }
  }
}

// thorns along it, alternating sides, hooked back toward the root; leaves on short stalks
function thorns(p, pts, T, C, t, R) {
  for (let i = 2; i < N - 1; i += 2) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, side = (i / 2) % 2 ? 1 : -1;
    const nx = (-dy / L) * side, ny = (dx / L) * side, w = width(i / N) / 2, len = 1.8 + 2.4 * (1 - i / N), tx0 = dx / L, ty0 = dy / L;
    const x0 = ax + nx * (w - 0.5), y0 = ay + ny * (w - 0.5), tx = x0 + nx * len - tx0 * len * 0.7, ty = y0 + ny * len - ty0 * len * 0.7;
    if (y0 > 0) continue;
    // a hooked thorn: a broad foot on the stem, a sharp lit point raking back toward the root
    p.tri(x0 - tx0 * 1.6, y0 - ty0 * 1.6, x0 + tx0 * 1.4, y0 + ty0 * 1.4, tx, ty, T[1]);
    p.line(x0 + tx0 * 0.8, y0 + ty0 * 0.8, tx, ty, T[2]);
    p.px(tx, ty, T[3]);
  }
  for (const k of [7, 13, 18]) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], a = Math.atan2(by - ay, bx - ax), side = k % 2 ? 1 : -1;
    if (ay > -2) continue;
    const la = a + side * 1.1 + Math.sin(t * 9 + k) * 0.2, lx = ax + Math.cos(la) * 4, ly = ay + Math.sin(la) * 4;
    drawLeaf(p, lx, ly, 7, 2.2, la, 0.3 + Math.sin(t * 5 + k) * 0.4, [C[1], C[3], C[5], C[6]]);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), T = fit(o.thorn, 4), S = fit(o.soil, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]] });
  const drops = new Drops(floor), lights = new Lights(), chips = [], torn = [], spots = [];
  let t = 0, burst = false, cracked = false, sunk = false;
  const dirt = (n, sp) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + R.range(-1.2, 1.2), v = R.range(60, 200) * sp;
      chips.push({ x: R.range(-3, 3), y: -1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: R.range(0, TAU), va: R.range(-15, 15), s: R.range(1.4, 2.6), pts: stoneShape(R), life: Math.min(R.range(0.6, 0.9), meta.duration - 0.05 - t) });
    }
    for (let i = 0; i < n * 3; i++) {
      const a = -Math.PI / 2 + R.range(-1, 1), v = R.range(50, 200) * sp;
      ps.spawn(P.GRIT, R.range(-3, 3), -1, Math.cos(a) * v, Math.sin(a) * v, Math.min(R.range(0.5, 0.9), meta.duration - 0.05 - t), R.pick([S[5], S[4], S[3]]), R.chance(0.3) ? 2 : 1);
    }
    for (let i = 0; i < n; i++) ps.spawn(P.DUST, R.range(-4, 4), -R.range(0, 3), R.sign() * R.range(15, 60), -R.range(4, 20), Math.min(R.range(0.4, 0.8), meta.duration - 0.05 - t), S[5], R.range(2, 4));
  };
  return {
    update(dt) {
      t += dt;
      if (!burst) (burst = true), dirt(6, 1);
      if (!cracked && t >= CRACK) {
        cracked = true;
        const a = pose(t), b = pose(t - 0.01), [x, y] = a[N], vx = (x - b[N][0]) / 0.01, vy = (y - b[N][1]) / 0.01, sp = Math.hypot(vx, vy) || 1;
        lights.add(x, y, 22, WHITE, 0.5, 0.08);
        lights.add(x, y, 50, C[5], 0.35, 0.4);
        for (let i = 0; i < 18; i++) {
          const ang = Math.atan2(vy, vx) + R.range(-0.7, 0.7), v = R.range(80, 260);
          drops.add(x, y, Math.cos(ang) * v, Math.sin(ang) * v - R.range(0, 60), R.chance(0.3) ? 2 : 1);
        }
        for (let i = 0; i < 4; i++) torn.push({ x, y, vx: (vx / sp) * R.range(40, 120) + R.range(-30, 30), vy: R.range(-90, -20), a: R.range(0, TAU), va: R.range(-12, 12), fl: R.range(0, TAU), vf: R.range(8, 16), life: R.range(0.65, 0.8), max: 0 });
        for (const l of torn) l.max = l.life;
        for (let i = 0; i < 8; i++) ps.spawn(P.STAR, x + R.range(-6, 6), y + R.range(-6, 6), R.range(-20, 20), R.range(-20, 20), R.range(0.15, 0.35), C[7], R.range(0.6, 1.6));
      }
      if (!sunk && t >= 1.08) (sunk = true), dirt(3, 0.5);
      drops.update(dt, (d) => spots.push({ x: d.x, t0: t, w: d.s * 0.7 + R.range(0.2, 1) }));
      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i];
        if ((c.life -= dt) <= 0) chips.splice(i, 1);
        c.vy += 950 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.a += c.va * dt;
        if (c.y > 0) (c.y = 0), (c.vy *= -0.3), (c.vx *= 0.6);
      }
      for (let i = torn.length - 1; i >= 0; i--) {
        const l = torn[i];
        if ((l.life -= dt) <= 0) torn.splice(i, 1);
        l.vy += 160 * dt;
        l.vx -= l.vx * 2.5 * dt;
        l.vy -= l.vy * 2 * dt;
        l.x += l.vx * dt + Math.sin(l.fl) * 20 * dt;
        l.y += l.vy * dt;
        l.a += l.va * dt;
        l.fl += l.vf * dt;
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a hole torn in the floor where it comes up, sap spots where it sprays
      const k = 1 - smooth(1.15, 1.35, t);
      for (let x = -5; x <= 5; x++) p.dot(x, 0, Math.abs(x) < 3 ? S[0] : S[1], k * (1 - Math.abs(x) / 7));
      for (const s of spots) {
        const a = (1 - smooth(0.25, 0.6, t - s.t0)) * (1 - smooth(1.2, 1.35, t));
        for (let x = Math.floor(s.x - s.w); x <= Math.ceil(s.x + s.w); x++) p.dot(x, 0, t - s.t0 < 0.1 ? C[6] : C[4], a);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      const pts = pose(t);
      // the smear: a fan of streaks, each the path one point of the outer vine just swept, the tip's white,
      // the ones further in cooling down the ramp, all fading back along their length
      if (t > LASH + 0.04 && t < CRACK + 0.1) {
        const age = clamp((t - CRACK + 0.02) / 0.12), hist = [];
        for (let k = 0; k < 12; k++) hist.push(pose(t - k * 0.0045));
        for (let k = 0; k < 6; k++) haze(p, [hist[k][N], hist[k + 1][N], hist[k + 1][N - 12], hist[k][N - 12]], k < 2 ? C[6] : C[5], 0.4 * (1 - k / 6) * (1 - age));
        for (let i = N - 12; i <= N; i += 2) {
          const q = (N - i) / 12, col = q < 0.1 ? WHITE : q < 0.3 ? C[7] : q < 0.55 ? C[6] : q < 0.8 ? C[5] : C[4], len = Math.round(11 * (1 - q * 0.6));
          for (let k = 0; k < len; k++) p.line(hist[k][i][0], hist[k][i][1], hist[k + 1][i][0], hist[k + 1][i][1], k < 2 && q < 0.1 ? WHITE : col, (1 - age) * (k < len * 0.5 ? 1 : 2 * (1 - k / len)));
        }
        p.glowLine(hist[0][N][0], hist[0][N][1], hist[6][N][0], hist[6][N][1], 14, C[5], 0.35 * (1 - age));
      }
      vine(p, pts, C);
      thorns(p, pts, T, C, t, null);
      const lk = smooth(LASH, CRACK, t) * (1 - smooth(CRACK, CRACK + 0.35, t));
      if (lk > 0) for (let i = 6; i <= N; i += 6) p.glow(pts[i][0], pts[i][1], 12, C[5], 0.18 * lk);
      // the crack: a white burst of air lines and a glint at the tip
      const e = t - CRACK;
      if (e >= 0 && e < 0.12) {
        const [x, y] = pts[N], k = 1 - e / 0.12;
        for (let j = 0; j < 7; j++) {
          const a = (j / 7) * TAU + 0.3, r0 = 4 + 10 * (1 - k), r1 = r0 + 5 * k;
          p.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, k > 0.5 ? WHITE : C[6]);
        }
        p.ring(x, y, 3 + 8 * (1 - k), 1, C[7], k);
        sparkle(p, x, y, 7 * k, C[7], C[5], 0.4);
      }
      for (const c of chips) drawRock(p, c.x, c.y, c.s, c.a, c.pts, S, Math.min(1, c.life / 0.25));
      for (const l of torn) drawLeaf(p, l.x, l.y, 6, 2, l.a, l.fl, [C[1], C[3], C[5], C[6]], Math.min(1, l.life / 0.3));
      drops.draw(p, C);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: the vine coils back round to the front and whips out across the scene (to +x, a little away from us), so you
// see the lash from the side and head on; round and thorny all over, its smear a swept sheet of light, its spray and
// torn leaves flung over a full cone, the hole it comes out of a true circle in the floor.
const pose3 = (t) => {
  const pts = pose(t), out = [];
  const rear = smooth(0.1, LASH, t), relax = smooth(0.82, 1.0, t);
  for (let i = 0; i <= N; i++) {
    const [x, y] = pts[i], s = i / N, sp = i === 0 ? 0 : clamp(spring(t - LASH - LAG * i), 0, 1.2);
    const kz = (-0.45 * rear * (1 - Math.min(1, sp)) - 0.3 * sp) * (1 - relax);
    out.push([x, y, x * kz + 3 * Math.sin(s * 5 + t * 8) * s * (1 - rear) * (1 - sp)]);
  }
  return out;
};

export const three = {
  meta: { size: [212, 120], origin: [106, 86], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), T = fit(o.thorn, 4), S = fit(o.soil, 8), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[4]] });
    const drops = new Drops(floor), bits = new Bits({ ground: floor }), lights = new Lights(), torn = [], spots = [];
    let t = 0, burst = false, cracked = false, sunk = false;
    const dir = (cone) => {
      const e = R.range(0, cone), h = R.range(0, TAU);
      return [Math.sin(e) * Math.cos(h), -Math.cos(e), Math.sin(e) * Math.sin(h)];
    };
    const dirt = (n, sp) => {
      for (let i = 0; i < n; i++) {
        const d = dir(1.2), v = R.range(60, 200) * sp;
        bits.add({ kind: B.CHUNK, x: R.range(-3, 3), y: -1, z: R.range(-3, 3), vx: d[0] * v, vy: d[1] * v, vz: d[2] * v, a: R.range(0, TAU), va: R.range(-15, 15), s: R.range(1.4, 2.6), g: 1, drag: 0.1, bounce: 0.3, life: Math.min(R.range(0.6, 0.9), meta.duration - 0.05 - t), ...rock3(R, 8) });
      }
      for (let i = 0; i < n * 3; i++) {
        const d = dir(1), v = R.range(50, 200) * sp;
        ps.spawn3(P.GRIT, R.range(-3, 3), -1, R.range(-3, 3), d[0] * v, d[1] * v, d[2] * v, Math.min(R.range(0.5, 0.9), meta.duration - 0.05 - t), R.pick([S[5], S[4], S[3]]), R.chance(0.3) ? 2 : 1);
      }
      for (let i = 0; i < n; i++) {
        const a = R.range(0, TAU), v = R.range(15, 60);
        ps.spawn3(P.DUST, R.range(-4, 4), -R.range(0, 3), R.range(-4, 4), Math.cos(a) * v, -R.range(4, 20), Math.sin(a) * v, Math.min(R.range(0.4, 0.8), meta.duration - 0.05 - t), S[5], R.range(2, 4));
      }
    };
    return {
      update(dt) {
        t += dt;
        if (!burst) (burst = true), dirt(6, 1);
        if (!cracked && t >= CRACK) {
          cracked = true;
          const a = pose3(t), b = pose3(t - 0.01), [x, y, z] = a[N], vx = (x - b[N][0]) / 0.01, vy = (y - b[N][1]) / 0.01, vz = (z - b[N][2]) / 0.01, sp = Math.hypot(vx, vy, vz) || 1;
          lights.add(x, y, 22, WHITE, 0.5, 0.08, z);
          lights.add(x, y, 50, C[5], 0.35, 0.4, z);
          for (let i = 0; i < 18; i++) {
            // sprayed off the tip's path over a cone round the way it is going
            const rx = R.range(-0.7, 0.7), rz = R.range(-0.7, 0.7), v = R.range(80, 260);
            drops.add(x, y, (vx / sp + rx) * v, (vy / sp + R.range(-0.5, 0.5)) * v - R.range(0, 60), R.chance(0.3) ? 2 : 1, 0, z, (vz / sp + rz) * v);
          }
          for (let i = 0; i < 4; i++) torn.push({ x, y, z, vx: (vx / sp) * R.range(40, 120) + R.range(-30, 30), vy: R.range(-90, -20), vz: (vz / sp) * R.range(40, 120) + R.range(-30, 30), a: R.range(0, TAU), va: R.range(-12, 12), fl: R.range(0, TAU), vf: R.range(8, 16), b: R.range(0, TAU), life: R.range(0.65, 0.8), max: 0 });
          for (const l of torn) l.max = l.life;
          for (let i = 0; i < 8; i++) ps.spawn3(P.STAR, x + R.range(-6, 6), y + R.range(-6, 6), z + R.range(-6, 6), R.range(-20, 20), R.range(-20, 20), R.range(-20, 20), R.range(0.15, 0.35), C[7], R.range(0.6, 1.6));
        }
        if (!sunk && t >= 1.08) (sunk = true), dirt(3, 0.5);
        drops.update(dt, (d) => spots.push({ x: d.x, z: d.z, t0: t, w: d.s * 0.7 + R.range(0.2, 1) }));
        for (let i = torn.length - 1; i >= 0; i--) {
          const l = torn[i];
          if ((l.life -= dt) <= 0) torn.splice(i, 1);
          l.vy += 160 * dt;
          l.vx -= l.vx * 2.5 * dt;
          l.vz -= l.vz * 2.5 * dt;
          l.vy -= l.vy * 2 * dt;
          l.x += l.vx * dt + Math.sin(l.fl) * 20 * dt;
          l.z += l.vz * dt;
          l.y += l.vy * dt;
          l.a += l.va * dt;
          l.fl += l.vf * dt;
        }
        bits.update(dt);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), pts = pose3(t), k = 1 - smooth(1.15, 1.35, t);
        // a hole torn in the floor where it comes up, sap spots where it sprays
        q.plane(0, 0, 0, null, 7, (u, v, out) => {
          const d = Math.hypot(u, v);
          if (d > 6) return;
          out.c = d < 3.4 ? S[0] : S[1];
          out.a = k * (1 - d / 8);
        });
        for (const s of spots) {
          const a = (1 - smooth(0.25, 0.6, t - s.t0)) * (1 - smooth(1.2, 1.35, t));
          if (a > 0.02) q.ring(s.x, 0, s.z, s.w, s.w, t - s.t0 < 0.1 ? C[6] : C[4], a);
        }
        // the smear: the paths the outer vine just swept, the tip's white, the ones further in cooling down the ramp,
        // with a sheet of light stretched across them
        if (t > LASH + 0.04 && t < CRACK + 0.1) {
          const age = clamp((t - CRACK + 0.02) / 0.12), hist = [];
          for (let j = 0; j < 12; j++) hist.push(pose3(t - j * 0.0045));
          for (let j = 0; j < 6; j++) for (let i = N - 12; i <= N; i += 3) q.line(...hist[j][i], ...hist[j][Math.min(N, i + 3)], j < 2 ? C[6] : C[5], 0.4 * (1 - j / 6) * (1 - age));
          for (let i = N - 12; i <= N; i += 2) {
            const qq = (N - i) / 12, col = qq < 0.1 ? WHITE : qq < 0.3 ? C[7] : qq < 0.55 ? C[6] : qq < 0.8 ? C[5] : C[4], len = Math.round(11 * (1 - qq * 0.6));
            for (let j = 0; j < len; j++) q.line(...hist[j][i], ...hist[j + 1][i], j < 2 && qq < 0.1 ? WHITE : col, (1 - age) * (j < len * 0.5 ? 1 : 2 * (1 - j / len)));
          }
          q.glowLine(...hist[0][N], ...hist[6][N], 14, C[5], 0.35 * (1 - age));
        }
        // the vine itself: a round stem, lit on its upper side, dark beneath, bark notches, thorns spiralling up it
        const grow = ease.outCubic(clamp(t / 0.14)) * (1 - ease.inCubic(clamp((t - 1.0) / 0.3)));
        if (grow > 0.02) {
          let L = 0;
          const cum = pts.map((pt, i) => (i ? (L += Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1], pt[2] - pts[i - 1][2])) : 0));
          tube(q, pts, (u) => width(u) * 0.62 + 0.4, (nx, ny, nz, u) => {
            if (nz < 0.2) return C[1];
            if (Math.abs(((u * L) % 5) - 2.5) < 0.45 && width(u) > 3.2) return C[2];
            return shade3(C.slice(1, 7), nx, ny, nz, 1);
          }, 0);
          for (let i = 2; i < N - 1; i += 2) {
            const A = pts[i], B = pts[i + 1], tx = B[0] - A[0], ty = B[1] - A[1], tz = B[2] - A[2], tl = Math.hypot(tx, ty, tz) || 1;
            if (A[1] > -1) continue;
            const ux = tx / tl, uy = ty / tl, uz = tz / tl;
            // two directions across the stem, turning as the thorns climb
            let bx = uy * 1 - uz * 0, by = uz * 0 - ux * 1, bz = 0;
            const bl = Math.hypot(bx, by, bz) || 1;
            bx /= bl; by /= bl;
            const cx = uy * bz - uz * by, cy = uz * bx - ux * bz, cz = ux * by - uy * bx, ph = i * 1.9, sx = bx * Math.cos(ph) + cx * Math.sin(ph), sy = by * Math.cos(ph) + cy * Math.sin(ph), sz = bz * Math.cos(ph) + cz * Math.sin(ph);
            const w = width(i / N) / 2, len = 1.8 + 2.4 * (1 - i / N), x0 = A[0] + sx * (w - 0.5), y0 = A[1] + sy * (w - 0.5), z0 = A[2] + sz * (w - 0.5);
            const tx2 = x0 + sx * len - ux * len * 0.7, ty2 = y0 + sy * len - uy * len * 0.7, tz2 = z0 + sz * len - uz * len * 0.7;
            q.beam(x0, y0, z0, (x0 + tx2) / 2, (y0 + ty2) / 2, (z0 + tz2) / 2, 1.8, (uu, v) => (v > 0.5 ? T[1] : T[2]));
            q.line((x0 + tx2) / 2, (y0 + ty2) / 2, (z0 + tz2) / 2, tx2, ty2, tz2, T[2]);
            q.px(tx2, ty2, tz2, T[3]);
          }
          for (const kk of [7, 13, 18]) {
            const A = pts[kk], B = pts[kk + 1], side = kk % 2 ? 1 : -1;
            if (A[1] > -2) continue;
            const a = Math.atan2(B[1] - A[1], B[0] - A[0]) + side * 1.1 + Math.sin(t * 9 + kk) * 0.2, h = kk * 1.3;
            leaf3(q, A[0], A[1], A[2], [Math.cos(a) * Math.cos(h), Math.sin(a), Math.cos(a) * Math.sin(h) * 0.6 + 0.3 * side], 7, 2.2, 0.3 + Math.sin(t * 5 + kk) * 0.4, [C[1], C[3], C[5], C[6]]);
          }
          const lk = smooth(LASH, CRACK, t) * (1 - smooth(CRACK, CRACK + 0.35, t));
          if (lk > 0) for (let i = 6; i <= N; i += 6) q.glow(pts[i][0], pts[i][1], pts[i][2], 12, C[5], 0.18 * lk);
        }
        // the crack: a white burst of air lines every way and a glint at the tip
        const e = t - CRACK;
        if (e >= 0 && e < 0.12) {
          const [x, y, z] = pts[N], kk = 1 - e / 0.12;
          for (let j = 0; j < 10; j++) {
            const a = j * 2.399963, yy = -1 + (2 * (j + 0.5)) / 10, r = Math.sqrt(1 - yy * yy), r0 = 4 + 10 * (1 - kk), r1 = r0 + 5 * kk, dx = Math.cos(a) * r, dz = Math.sin(a) * r;
            q.line(x + dx * r0, y + yy * r0, z + dz * r0, x + dx * r1, y + yy * r1, z + dz * r1, kk > 0.5 ? WHITE : C[6]);
          }
          q.at(x, y, z, (pp) => {
            pp.ring(0, 0, 3 + 8 * (1 - kk), 1, C[7], kk);
            sparkle(pp, 0, 0, 7 * kk, C[7], C[5], 0.4);
          });
        }
        bits3(q, bits, S);
        for (const l of torn) leaf3(q, l.x, l.y, l.z, [Math.cos(l.a) * Math.cos(l.b + l.fl * 0.2), Math.sin(l.a), Math.cos(l.a) * Math.sin(l.b + l.fl * 0.2)], 6, 2, l.fl, [C[1], C[3], C[5], C[6]], Math.min(1, l.life / 0.3));
        drops.draw3(q, C);
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
