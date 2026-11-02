// The bubbles (lit and shaded rims, a highlight, a dotted pop) follow Sprite Fusion's open-source bubbles
// (https://www.spritefusion.com/pixel-art-vfx/bubbles), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rand, cycle, space, TAU, WHITE, hex, mix, scale } from "../../core/index.js";
import { Layer, blobShadow, glint, pool, trace, sdfHit, rotX, rotZ, matMul, toObject, sdCyl, glint3, floorShadow, floorPool } from "./_lib.js";

export const meta = {
  name: "Potion",
  desc: "A round glass flask of glowing brew rocks in the air: the brew sloshes behind the rock, bubbles rise and pop, light glows through the glass, wisps curl off the cork.",
  tags: ["pickup", "potion", "flask", "brew", "magic", "loop"],
  size: [56, 72],
  origin: [28, 64],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"], seed: 5 },
};

const RB = 7, HOVER = 17, NECK = 2, LIP = -12, CORK_TOP = -16;
const INK = hex("#120d1a"), GLASS = hex("#2a2236");
const CORK = ["#2a160c", "#4e2c16", "#7a4a26", "#a8703a", "#d09a5a"].map(hex);
const L = new Layer(40, 44);

// the flask hovers and rocks; the brew's surface stays level in the world and lags behind the rock
const pose = (ph) => ({ y: -HOVER - 1.4 * Math.sin(ph * TAU), tilt: 0.13 * Math.sin(ph * TAU + 0.4) });
const surface = (x, ph) => -0.5 + 0.17 * Math.sin(ph * TAU - 0.9) * x + 0.45 * Math.sin(x * 0.85 + ph * TAU * 3);

function flask(p, C, t, ph, cy, tilt, seed) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  L.begin(-20, Math.floor(cy) - 22);
  L.fill(-20, Math.floor(cy) - 22, 19, Math.floor(cy) + 12, (px, py) => {
    const wx = px, wy = py - cy, fx = wx * ct + wy * st, fy = -wx * st + wy * ct, d = Math.hypot(fx, fy);
    // the cork, the lip, the neck and the bulb, in the flask's own frame
    if (fy < LIP - 0.5 && fy >= CORK_TOP && Math.abs(fx) <= NECK + 0.2) return CORK[fy < CORK_TOP + 1 ? 4 : fx < -0.6 ? 3 : fx > 1 ? 1 : 2];
    if (fy >= LIP - 0.5 && fy < LIP + 1 && Math.abs(fx) <= NECK + 1.4) return fx < 0 ? mix(WHITE, C[6], 0.4) : mix(GLASS, C[5], 0.45);
    const inNeck = fy >= LIP + 1 && fy < -RB + 2 && Math.abs(fx) <= NECK + 0.6;
    if (d > RB && !inNeck) return 0;
    const wall = inNeck ? Math.abs(fx) > NECK - 0.5 : d > RB - 1;
    // the brew: below its sloshing surface, glowing from within, a bright skin on top
    const s = surface(wx, ph), depth = wy - s;
    if (!wall && !inNeck && depth > 0) {
      // dark at the bottom and the edges, a lit heart, a bright skin with a sheen on its left
      const core = 1 - Math.hypot(wx * 0.85, wy - 1.8) / RB;
      if (depth < 0.9) return wx < -1.5 && wx > -4.5 ? WHITE : C[6];
      let k = core > 0.62 ? 5 : core > 0.38 ? 4 : core > 0.18 ? 3 : 2;
      if (depth < 1.9 && k < 5) k++;
      if (wx > 1.5 && wy > 2) k--;
      return C[Math.max(2, Math.min(6, k))];
    }
    if (wall) {
      // the glass: catching light on its left, showing the brew through its lower half
      const lit = (-fx * 0.75 - fy * 0.66) / Math.max(1, d);
      if (inNeck) return fx < 0 ? mix(GLASS, C[6], 0.55) : mix(GLASS, C[5], 0.3);
      if (lit > 0.82) return mix(WHITE, C[6], 0.3);
      if (lit > 0.3) return mix(GLASS, C[6], 0.5);
      return depth > 0 ? C[3] : mix(GLASS, C[5], 0.28);
    }
    // empty glass above the brew
    return GLASS;
  });
  L.outline(INK).draw(p);
  // a curved streak of light on the glass, and a pin-point
  for (let a = 3.45; a < 4.35; a += 0.04) {
    const lx = Math.cos(a + tilt) * (RB - 2.2), ly = Math.sin(a + tilt) * (RB - 2.2);
    p.px(lx, cy + ly, a > 3.7 && a < 4.1 ? WHITE : mix(WHITE, C[6], 0.5));
  }
  p.px(Math.round(2 * Math.cos(tilt) + 3 * Math.sin(tilt)), Math.round(cy - 3), WHITE);
  // bubbles rising through the brew and popping at its surface
  cycle(t, meta.duration, 10, seed, (g) => g.range(0.7, 1.3), (age, life, r) => {
    const x0 = r.range(-4, 4), r0 = r.range(0.6, 1.7), vy = r.range(7, 13);
    const x = x0 + Math.sin(age * r.range(5, 9) + r.range(0, TAU)) * 0.7, y = cy + 5.5 - vy * age, ph2 = (t + age) / meta.duration;
    const top = cy + surface(x, ph2);
    if (y > top + 0.8) {
      const rr = r0 * (0.7 + 0.5 * (age / life));
      if (Math.hypot(x, y - cy) > RB - 1.5) return;
      if (rr < 0.95) p.px(x, y, C[6]);
      else {
        p.px(x, y, C[3]), p.px(x + 1, y, C[6]), p.px(x, y - 1, WHITE), p.px(x + 1, y - 1, C[6]);
        if (rr > 1.4) p.px(x - 1, y, C[5]), p.px(x, y + 1, C[4]);
      }
      p.glow(x + 0.5, y, 3, C[6], 0.15);
    } else {
      // the pop: a little arc of light and two flecks thrown up
      const k = clamp((top + 0.8 - y) / 3);
      if (k >= 1) return;
      for (let a = Math.PI; a < TAU; a += 0.6) p.dot(x + Math.cos(a) * (1 + k * 2), top - 0.5 + Math.sin(a) * (1 + k * 2) * 0.5, k < 0.5 ? WHITE : C[6], 1.2 - k);
      p.dot(x - 1, top - 1.5 - k * 3, C[6], 1 - k), p.dot(x + 1.5, top - 2 - k * 4, WHITE, 1 - k);
    }
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, { y } = pose(ph);
  blobShadow(p, 0, 7.5, 0.8 - (-y - HOVER + 1.4) * 0.06);
  // light thrown on the floor through the brew
  pool(p, 0, 0.5, 18, 3, C[5], 0.3);
  // wisps curling up off the cork: thin trails of light that sway wider as they rise and fade
  cycle(t, meta.duration, 7, o.seed + 1, (g) => g.range(1.2, 1.8), (age, life, r) => {
    const side = r.sign(), f = r.range(3, 4.5), ph0 = r.range(0, TAU), vy = r.range(11, 16), x0 = r.range(-1, 1);
    const at = (a) => [x0 + Math.sin(a * f + ph0) * (0.8 + a * 3.2) * side, y + CORK_TOP - 1 - a * vy];
    for (let i = 0; i < 9; i++) {
      const a = age - i * 0.04;
      if (a < 0) break;
      const [x, yy] = at(a), k = (1 - a / life) * Math.min(1, a / 0.15) * (1 - i / 9);
      p.dot(x, yy, i === 0 ? WHITE : i < 3 ? C[6] : C[5], k * 1.4);
      if (i === 0) p.glow(x, yy, 4, C[5], 0.3 * k);
    }
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / meta.duration, { y, tilt } = pose(ph);
  // the brew glows through the glass
  p.glow(0, y + 1.5, 26, C[4], 0.22);
  flask(p, C, t, ph, y, tilt, o.seed);
  p.glow(0, y + 2, 10, C[5], 0.38 + 0.08 * Math.sin(ph * TAU * 2));
  // a glint on the glass now and then
  const g = ((ph + 0.2) % 0.5) / 0.5;
  if (g < 0.16) glint(p, -4, y - 4, 2.6 * Math.sin((g / 0.16) * Math.PI), WHITE, 0.4);
}

// The same flask, a real glass solid: a bulb, a neck, a lip and a cork, traced from the camera and rocking about two axes.
// The brew inside is found along each ray (a level surface that swirls and ripples in the world, seen through the glass
// from above), so it stays level as the flask tilts, from every side. Bubbles rise through it; wisps curl off the cork.
const RI = RB - 0.9, FR = 19;
const part = (x, y, z) => [Math.hypot(x, y, z) - RB, sdCyl(x, y + 8, z, 2.6, 4), sdCyl(x, y + 11.75, z, 3.4, 0.75), sdCyl(x, y + 14.25, z, 2.2, 1.75)];
const FLASK = (x, y, z) => Math.min(...part(x, y, z));
// the brew's surface, relative to the flask's middle in the world: a tilt that swirls round, and ripples spreading out
const level = (x, z, ph) => -0.5 + 0.17 * (x * Math.sin(ph * TAU - 0.9) + z * Math.cos(ph * TAU - 0.9)) + 0.45 * Math.sin(Math.hypot(x, z) * 0.85 - ph * TAU * 3);
export const three = {
  meta: { size: [80, 88], origin: [40, 70], camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / meta.duration, { y, tilt } = pose(ph), M = matMul(rotZ(tilt), rotX(0.1 * Math.sin(ph * TAU + 2)));
    floorShadow(q, 0, 0, 7.5, 0.8 - (-y - HOVER + 1.4) * 0.06);
    // light thrown on the floor through the brew
    floorPool(q, 0, 0, 18, C[5], 0.3);
    q.glow(0, y + 1.5, 0, 26, C[4], 0.22);
    const world = (fx, fy, fz) => [M[0] * fx + M[1] * fy + M[2] * fz, M[3] * fx + M[4] * fy + M[5] * fz, M[6] * fx + M[7] * fy + M[8] * fz];
    const f = (x, yy, z) => FLASK(M[0] * x + M[3] * yy + M[6] * z, M[1] * x + M[4] * yy + M[7] * z, M[2] * x + M[5] * yy + M[8] * z);
    trace(q, 0, y, 0, FR, sdfHit(f, { grad: 0.3 }), (h) => {
      const [fx, fy, fz] = toObject(M, h), d = part(fx, fy, fz), n = [h.nx, h.ny, h.nz], l = n[0] * h.L[0] + n[1] * h.L[1] + n[2] * h.L[2];
      const id = d.indexOf(Math.min(...d)), nv = n[0] * h.V[0] + n[1] * h.V[1] + n[2] * h.V[2];
      if (id === 3) return fy < -15.2 ? CORK[4] : CORK[l > 0.45 ? 3 : l > 0 ? 2 : 1];
      if (id === 2) return l > 0.2 ? mix(WHITE, C[6], 0.4) : mix(GLASS, C[5], 0.45);
      // glass: is there brew behind this pixel? walk the ray through the inner sphere (bulb only)
      let brew = 0, ds = 0, cross = null;
      if (id === 0 && nv > 0.12) {
        const rd = [-(M[0] * h.V[0] + M[3] * h.V[1] + M[6] * h.V[2]), -(M[1] * h.V[0] + M[4] * h.V[1] + M[7] * h.V[2]), -(M[2] * h.V[0] + M[5] * h.V[1] + M[8] * h.V[2])];
        const b = fx * rd[0] + fy * rd[1] + fz * rd[2], c = fx * fx + fy * fy + fz * fz - RI * RI, disc = b * b - c;
        if (disc > 0) {
          const sq = Math.sqrt(disc), s0 = Math.max(0, -b - sq), s1 = -b + sq, at = (s) => [h.x + (-h.V[0]) * s, h.y - h.V[1] * s, h.z - h.V[2] * s];
          const g = (s) => { const w = at(s); return w[1] - level(w[0], w[2], ph); };
          const g0 = g(s0), g1 = g(s1);
          if (g0 > 0) (brew = 1), (ds = g0);
          else if (g1 > 0) {
            let a = s0, bb = s1;
            for (let i = 0; i < 6; i++) { const m = (a + bb) / 2; if (g(m) > 0) bb = m; else a = m; }
            brew = 2;
            cross = at(bb);
          }
        }
      }
      const wall = id === 1 ? nv < 0.5 : nv < 0.4;
      if (wall) {
        if (l > 0.82) return mix(WHITE, C[6], 0.3);
        if (l > 0.3) return mix(GLASS, C[6], 0.5);
        if (id === 1) return mix(GLASS, C[5], 0.3);
        return brew ? C[3] : mix(GLASS, C[5], 0.28);
      }
      if (id === 1) return l > 0.1 ? mix(GLASS, C[6], 0.55) : mix(GLASS, C[5], 0.3);
      if (brew === 1) {
        // dark at the bottom and the edges, a lit heart, a bright skin on top
        if (ds < 0.9) return h.vx < -1.5 && h.vx > -4.5 ? WHITE : C[6];
        const core = 1 - Math.hypot(h.vx * 0.85, h.vy - 1.8) / RB;
        let k = core > 0.62 ? 5 : core > 0.38 ? 4 : core > 0.18 ? 3 : 2;
        if (ds < 1.9 && k < 5) k++;
        if (h.vx > 1.5 && h.vy > 2) k--;
        return C[Math.max(2, Math.min(6, k))];
      }
      if (brew === 2) {
        // the brew's surface seen through the glass from above: a bright skin, a sheen on its left, ripples catching the light
        const rip = Math.sin(Math.hypot(cross[0], cross[2]) * 0.85 - ph * TAU * 3);
        return h.vx < -2 && h.vx > -3.6 && rip > 0 ? WHITE : rip > 0.6 ? C[6] : rip > -0.4 ? C[5] : C[4];
      }
      return GLASS;
    }, { ink: INK });
    // a curved streak of light on the glass, and a pin-point
    q.at(0, y, 0, (pp) => {
      pp.z -= 6;
      for (let a = 3.45; a < 4.35; a += 0.04) pp.px(Math.cos(a + tilt) * (RB - 2.2), Math.sin(a + tilt) * (RB - 2.2), a > 3.7 && a < 4.1 ? WHITE : mix(WHITE, C[6], 0.5));
      pp.px(2, -3, WHITE);
    });
    // bubbles rising through the brew and popping at its surface
    cycle(t, meta.duration, 10, o.seed, (g) => g.range(0.7, 1.3), (age, life, r) => {
      const x0 = r.range(-4, 4), z0 = r.range(-4, 4), r0 = r.range(0.6, 1.7), vy = r.range(7, 13);
      const x = x0 + Math.sin(age * r.range(5, 9) + r.range(0, TAU)) * 0.7, z = z0 + Math.cos(age * 6 + x0) * 0.7, yy = 5.5 - vy * age, ph2 = (t + age) / meta.duration;
      const top = level(x, z, ph2);
      if (Math.hypot(x, yy, z) > RB - 1.4 && yy > top) return;
      if (yy > top + 0.8) {
        const rr = r0 * (0.7 + 0.5 * (age / life));
        q.at(x, y + yy, z, (pp) => {
          pp.z -= 8;
          if (rr < 0.95) pp.px(0, 0, C[6]);
          else {
            pp.px(0, 0, C[3]), pp.px(1, 0, C[6]), pp.px(0, -1, WHITE), pp.px(1, -1, C[6]);
            if (rr > 1.4) pp.px(-1, 0, C[5]), pp.px(0, 1, C[4]);
          }
        });
        q.glow(x, y + yy, z, 3, C[6], 0.15);
      } else {
        // the pop: a little ring of light flat on the surface and two flecks thrown up
        const k = clamp((top + 0.8 - yy) / 3);
        if (k >= 1) return;
        q.at(x, y + top - 0.5, z, (pp) => {
          pp.z -= 8;
          for (let a = 0; a < TAU; a += 0.7) pp.dot(Math.cos(a) * (1 + k * 2), Math.sin(a) * (1 + k * 2) * 0.4, k < 0.5 ? WHITE : C[6], 1.2 - k);
          pp.dot(-1, -1.5 - k * 3, C[6], 1 - k), pp.dot(1.5, -2 - k * 4, WHITE, 1 - k);
        });
      }
    });
    // wisps curling up off the cork: thin trails of light that sway wider as they rise and fade, every way round
    cycle(t, meta.duration, 7, o.seed + 1, (g) => g.range(1.2, 1.8), (age, life, r) => {
      const az = r.range(0, TAU), f = r.range(3, 4.5), ph0 = r.range(0, TAU), vy = r.range(11, 16), x0 = r.range(-1, 1);
      const pos = (a) => {
        const sw = Math.sin(a * f + ph0) * (0.8 + a * 3.2), cw = Math.cos(a * f + ph0) * (0.5 + a * 2);
        return [x0 + Math.cos(az) * sw - Math.sin(az) * cw, y + CORK_TOP - 1 - a * vy, Math.sin(az) * sw + Math.cos(az) * cw];
      };
      for (let i = 0; i < 9; i++) {
        const a = age - i * 0.04;
        if (a < 0) break;
        const [x, yy, z] = pos(a), k = (1 - a / life) * Math.min(1, a / 0.15) * (1 - i / 9);
        q.dot(x, yy, z, i === 0 ? WHITE : i < 3 ? C[6] : C[5], k * 1.4);
        if (i === 0) q.glow(x, yy, z, 4, C[5], 0.3 * k);
      }
    });
    q.glow(0, y + 2, 0, 10, C[5], 0.38 + 0.08 * Math.sin(ph * TAU * 2));
    // a glint on the glass now and then
    const g = ((ph + 0.2) % 0.5) / 0.5;
    if (g < 0.16) glint3(q, -4 * q.cy + 8 * q.sy, y - 4 * q.cp - 8 * q.sp, 4 * q.sy + 8 * q.cy, 2.6 * Math.sin((g / 0.16) * Math.PI), WHITE, 0.4);
  },
};
