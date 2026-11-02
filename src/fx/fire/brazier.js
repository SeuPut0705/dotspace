// The tongue, lick, flame-puff, smoke, ember and spark recipe is adapted from Sprite Fusion's open-source fire
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, mix, rand, clamp, space, lit, TAU, WHITE } from "../../core/index.js";
import { noiseFor, hotFirst, burn, burn3, looped, drift, spark, spark3, ember, floorLight, floorGlow, torus } from "./_lib.js";

export const meta = {
  name: "Brazier",
  desc: "An iron bowl on a tripod heaped with glowing coals and a big roaring fire, sparks and embers streaming up off it, light on the iron and the floor.",
  tags: ["fire", "brazier", "prop", "light", "sparks", "ambient", "loop"],
  size: [112, 148],
  origin: [56, 136],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    iron: ["#0b0910", "#1c1924", "#302c3a", "#4c4658", "#78708a"],
    seed: 8,
  },
};

const D = meta.duration, NL = noiseFor(D), RIM = -25, RX = 15, RY = 3;
// the fire: [x, y from the rim, height share, half-width, back row?]
const TONGUES = [
  [-7, -1.5, 0.5, 2.0, 1],
  [7.2, -1.5, 0.55, 2.0, 1],
  [-3, -2.5, 0.84, 2.2, 1],
  [3.3, -2.5, 0.86, 2.2, 1],
  [-11.5, 0.5, 0.2, 1.5, 0],
  [11.5, 0.5, 0.22, 1.5, 0],
  [-8.3, 0, 0.34, 2.0, 0],
  [8.5, 0, 0.38, 2.0, 0],
  [-4.7, -0.5, 0.6, 2.8, 0],
  [4.9, -0.5, 0.64, 2.8, 0],
  [0, -1, 1, 3.6, 0],
];

// the tripod: two legs splayed out and one coming at us, curled feet, a ring holding them together
function stand(p, I, H, fl) {
  const leg = (x0, y0, x1, y1) => {
    p.line(x0, y0, x1, y1, I[0]);
    p.line(x0 + 1, y0, x1 + 1, y1, I[2]);
    p.line(x0 + 2, y0, x1 + 2, y1, I[0]);
  };
  // the ring: its far half behind the front leg
  p.ellipse(0, -9, 9, 1.8, (d) => (d > 0.6 ? I[2] : 0));
  leg(-6, -17, -12, -1);
  leg(4, -17, 10, -1);
  p.rect(-14, -1, 5, 1, I[2]), p.rect(-15, 0, 6, 1, I[0]), p.px(-15, -1, I[3]);
  p.rect(9, -1, 5, 1, I[2]), p.rect(9, 0, 6, 1, I[0]), p.px(13, -1, I[3]);
  p.rect(-1, -16, 3, 15, I[0]);
  p.rect(0, -16, 1, 15, mix(I[3], H[4], 0.15 * fl));
  p.rect(-2, -1, 5, 1, I[2]), p.rect(-2, 0, 5, 1, I[0]);
  p.ellipse(0, -9, 9, 1.8, (d, a) => (Math.sin(a) > 0 && d > 0.55 ? (d > 0.85 ? I[0] : I[3]) : 0));
}

// the bowl, front half: a band of rivets under a rim lit by the fire, rounding down to a dark belly
function bowl(p, I, H, fl) {
  p.shade(-RX - 1, RIM - 1, RX + 1, RIM + 9, (x, y) => {
    const v = (y - RIM) / 9, hw = RX * Math.sqrt(Math.max(0, 1 - v * v * 0.9)) - (v > 0.5 ? (v - 0.5) * 6 : 0);
    if (Math.abs(x) > hw + 0.5 || y < RIM) return;
    if (Math.abs(x) > hw - 0.5 || v > 0.92) return I[0];
    if (y < RIM + 1) return mix(I[3], H[4], 0.5 * fl);
    if (y < RIM + 2) return I[2];
    if (y < RIM + 3) return Math.round(x) % 4 === 0 ? mix(I[4], H[4], 0.25 * fl) : I[0];
    return x < -RX * 0.45 ? I[2] : x < RX * 0.25 ? I[1] : I[0];
  });
}

// coals heaped in the bowl, showing over the rim, breathing in the heat
function coals(p, I, H, t, S) {
  p.shade(-RX, RIM - 6, RX, RIM + 1, (x, y, out) => {
    // a mound: highest in the middle, standing proud of the rim
    const top = RIM - 1 - 4 * Math.max(0, 1 - (x / (RX - 1)) ** 2);
    if (y < top || y > RIM + 0.5 || Math.abs(x) > RX - 0.5) return;
    const lump = rand(Math.floor((x + Math.floor(y) * 1.5) / 3), Math.floor(y / 2), S + 20), edge = y < top + 1;
    // the gaps between lumps stay dark; the lumps breathe, hottest deep in the heap
    if (rand(Math.floor(x), Math.floor(y), S + 21) < 0.16 || (edge && lump < 0.3)) return I[0];
    const g = (0.5 + 0.5 * Math.sin((t / D) * Math.PI * 4 + lump * 40)) * (edge ? 0.7 : 1);
    out.k = 0.3 * g;
    return g > 0.72 ? H[2] : g > 0.5 ? H[3] : g > 0.3 ? H[4] : g > 0.15 ? H[5] : H[6];
  });
}

export function draw(p, t, o) {
  const F = fit(o.palette, 9), H = hotFirst(F), I = fit(o.iron, 5), S = o.seed;
  const fl = 0.74 + 0.16 * NL(t, 7.3, S + 1) + 0.1 * NL(t, 19, S + 2), GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25);
  const SPARKS = [H[1], H[2], H[4], H[5]], EMB = [H[1], H[2], H[4], H[6]];
  floorLight(p, 0, 0.5, 40, 7, GLOW, 0.32 * fl);
  stand(p, I, H, fl);
  // the back of the rim, behind the fire
  p.ellipse(0, RIM, RX, RY, (d, a) => (Math.sin(a) < 0 && d > 0.7 ? (d > 0.88 ? I[0] : mix(I[3], H[4], 0.3 * fl)) : 0));
  burn(p, t, TONGUES, {
    H, D, NL, S, x: 0, y: RIM, height: 32, lean: 0.1, spread: 7,
    puffs: 8, licks: 4, smoke: 14, smokeSize: 3, smokeLife: [1.6, 2.4], embers: 10, glowR: 58, glow: 1.4, wind: 3,
    mid: () => {
      coals(p, I, H, t, S);
      bowl(p, I, H, fl);
    },
  });
  // sparks streaming up in the draught: fast streaks that slow, wander and cool to embers high above
  looped(t, D, 60, S + 600, (r) => {
    const side = r.range(-1, 1);
    return { x: side * 8, y: RIM - r.range(4, 18), vx: side * r.range(10, 40), vy: -r.range(70, 150), life: r.range(0.7, 1.7), a: r.range(0, 6.3), w: r.range(1.8, 3.2), m: r.range(3, 8), big: r.chance(0.12) };
  }, (q, age) => {
    const [x, y, vx, vy] = drift(q.x, q.y, q.vx, q.vy, age, 0, -22, 1.9, 1.9), k = 1 - age / q.life;
    // they bend and wander as the draught slows them
    const wob = q.m * (Math.sin(age * q.w + q.a) - Math.sin(q.a)) * Math.min(1, age * 1.5), wv = q.m * q.w * Math.cos(age * q.w + q.a) * Math.min(1, age * 1.5);
    if (Math.hypot(vx + wv, vy) > 40) spark(p, x + wob, y, vx + wv, vy, k, SPARKS);
    else ember(p, x + wob, y, k, q.big ? 2 : 1, EMB, age * 40 + q.a);
  });
}

// 3D: the same bowl turned on a lathe, a true tripod, heaped coals; the fire stands round the axis and the sparks leave in a
// full circle.
const HEAT = (H, g) => (g > 0.72 ? H[2] : g > 0.5 ? H[3] : g > 0.3 ? H[4] : g > 0.15 ? H[5] : H[6]);
// the bowl's radius going down from the rim: rounds in, then draws down to a point
const bowlR = (v) => RX * Math.sqrt(Math.max(0, 1 - v * v * 0.9)) - (v > 0.5 ? (v - 0.5) * 6 : 0);
const LEG = [0.5, 2.6, 4.7];

export const three = {
  meta: { size: [120, 156], origin: [60, 140], bg: "ground", camera: { pitch: 0.28 } },
  draw(p, t, o) {
    const F = fit(o.palette, 9), H = hotFirst(F), I = fit(o.iron, 5), S = o.seed, q = space(p, o);
    const fl = 0.74 + 0.16 * NL(t, 7.3, S + 1) + 0.1 * NL(t, 19, S + 2), SPARKS = [H[1], H[2], H[4], H[5]], EMB = [H[1], H[2], H[4], H[6]];
    const side = (g) => -0.45 * Math.cos(g) + 0.66 * Math.sin(g); // how far a point of the wall faces the light (top left, in front)
    // the tripod: three legs splayed out from under the bowl, curled feet, a ring holding them, a post up the middle
    const leg = (a) => ({ x: Math.cos(a), z: Math.sin(a) });
    const legs = LEG.map(leg);
    for (const { x, z } of legs) {
      q.beam(x * 7, RIM + 8, z * 7, x * 14, -1.2, z * 14, 3.2, (u, v) => (v > 0.8 ? I[0] : v < 0.4 ? mix(I[4], H[4], 0.2 * fl) : I[3]));
      q.beam(x * 14, -1, z * 14, x * 18, -0.8, z * 18, 2.2, (u, v) => (v > 0.7 ? I[0] : I[3]));
      q.ball(x * 18.5, -1.2, z * 18.5, 1.3, I[3]);
    }
    q.beam(0, RIM + 9, 0, 0, -1, 0, 3.4, (u, v) => (v > 0.75 ? I[0] : v < 0.4 ? mix(I[4], H[4], 0.2 * fl) : I[2]));
    q.ring(0, -9, 0, 10.8, 1.8, (v, g) => (v > 0.7 ? I[0] : side(g) > 0 ? I[4] : I[3]));
    // the bowl, from the rim down: a band of rivets, the lit side the fire's, a dark belly
    for (let y = 0; y <= 9.5; y += 0.4) {
      const v = y / 9, r = bowlR(Math.min(1, v));
      if (r < 0.8) continue;
      q.ring(0, RIM + y, 0, r + 0.6, 2.4, (w, g) => {
        if (y < 0.8) return mix(I[3], H[4], 0.5 * fl);
        if (y < 1.8) return I[2];
        if (y < 3.2) return Math.round((g * r) / 2.4) % 2 === 0 ? mix(I[4], H[4], 0.25 * fl) : I[0];
        const d = side(g);
        return y > 7 ? I[0] : d > 0.3 ? I[3] : d > -0.2 ? I[2] : I[1];
      });
    }
    torus(q, 0, RIM + 0.6, 0, RX + 0.2, 2.2, (g, v) => (v > 0.85 ? I[0] : mix(side(g) > -0.1 ? I[4] : I[3], H[4], 0.45 * fl)), 32);
    q.ring(0, RIM, 0, RX + 0.8, 2.4, (w, g) => (w > 0.85 ? I[0] : mix(side(g) > -0.1 ? I[4] : I[3], H[4], 0.45 * fl))); // the lip
    // coals heaped in the bowl, breathing in the heat: a bed, and lumps standing proud of the rim
    q.plane(0, RIM + 0.5, 0, null, RX - 0.6, (u, v, out) => {
      const lump = rand(Math.floor((u + Math.floor(v) * 1.5) / 3), Math.floor(v / 2), S + 20);
      if (rand(Math.floor(u), Math.floor(v), S + 21) < 0.16) return I[0];
      const g = (0.5 + 0.5 * Math.sin((t / D) * Math.PI * 4 + lump * 40)) * (1 - Math.hypot(u, v) / (RX + 4));
      out.k = 0.3 * g;
      return HEAT(H, g);
    });
    for (let i = 0; i < 11; i++) {
      const a = i * 2.399963, d = Math.sqrt((i + 0.5) / 11) * (RX - 5), x = Math.cos(a) * d, z = Math.sin(a) * d;
      const lump = rand(i, S + 22), g = 0.5 + 0.5 * Math.sin((t / D) * Math.PI * 4 + lump * 40), top = RIM - 1.4 - 3.4 * Math.max(0, 1 - (d / (RX - 2)) ** 2);
      q.ball(x, top + 1.2, z, 2.5 + lump * 0.9, (nx, ny, nz) => (nz < 0.3 ? I[0] : HEAT(H, g * (0.7 + 0.3 * -ny + 0.15 * -nx))));
    }
    // the fire, round the axis
    burn3(q, t, TONGUES, { H, D, NL, S, x: 0, y: RIM, z: 0, height: 32, lean: 0.1, spread: 7, puffs: 8, licks: 4, smoke: 14, smokeSize: 3, smokeLife: [1.6, 2.4], embers: 10, glowR: 58, glow: 1.4, wind: 3, floor: 46 });
    // sparks streaming up in the draught: fast streaks that slow, wander and cool to embers high above
    looped(t, D, 60, S + 600, (r) => {
      const a = r.range(0, TAU), rad = r.range(0, 1), v = r.range(10, 40);
      return { x: Math.cos(a) * rad * 8, z: Math.sin(a) * rad * 8, y: RIM - r.range(4, 18), vx: Math.cos(a) * rad * v, vz: Math.sin(a) * rad * v, vy: -r.range(70, 150), life: r.range(0.7, 1.7), a: r.range(0, 6.3), w: r.range(1.8, 3.2), m: r.range(3, 8), big: r.chance(0.12) };
    }, (s, age) => {
      const [x, y, vx, vy] = drift(s.x, s.y, s.vx, s.vy, age, 0, -22, 1.9, 1.9), [z, , vz] = drift(s.z, 0, s.vz, 0, age, 0, 0, 1.9, 1.9), k = 1 - age / s.life, f = Math.min(1, age * 1.5);
      const wob = s.m * (Math.sin(age * s.w + s.a) - Math.sin(s.a)) * f, wv = s.m * s.w * Math.cos(age * s.w + s.a) * f;
      const wobz = s.m * (Math.cos(age * s.w + s.a) - Math.cos(s.a)) * f, wvz = -s.m * s.w * Math.sin(age * s.w + s.a) * f;
      if (Math.hypot(vx + wv, vy, vz + wvz) > 40) spark3(q, x + wob, y, z + wobz, vx + wv, vy, vz + wvz, k, SPARKS);
      else q.at(x + wob, y, z + wobz, (pp) => ember(pp, 0, 0, k, s.big ? 2 : 1, EMB, age * 40 + s.a));
    });
  },
};
