import { fit, rand, sparkle, mix, hex, space, TAU, WHITE } from "../../core/index.js";
import { beat, tri3, quad3, tube, shadow3 } from "./_lib.js";

export const meta = {
  name: "Arrow",
  desc: "An arrow in flight: a steel broadhead catching the light, a wooden shaft, fletching fluttering in the wind, streaks of air peeling off its head and swirling off its feathers.",
  tags: ["projectile", "arrow", "bow", "medieval", "directional", "loop"],
  size: [112, 32],
  origin: [92, 16],
  duration: 0.6,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#7a1f2c", "#b8323c", "#e8e2d6", "#ffffff"],
    wood: ["#3a2414", "#6e4422", "#a8723c", "#d8a868"],
    steel: ["#2e3648", "#5a6680", "#9aa6ba", "#dfe7f2"],
    wind: "#b8c8e8",
    seed: 3,
  },
};

// the arrow, nose right, tip at (0, 0): fletching (three poses for the flutter), shaft, binding, broadhead
const HEAD = ["..LL....", "..sLLL..", "bbsSSSSW", "..dDDD..", "..DD...."];
const FLETCH = [
  ["AAa.........", ".aAAa.......", "..aaAAa.....", "nkkkkkkkkkkk", "..cCCc......", ".cCCc.......", "CCc........."],
  [".AAa........", "..aAAa......", "..aaAAAa....", "nkkkkkkkkkkk", "..cCCCc.....", "..cCCc......", ".CCc........"],
  ["AAAa........", "aAAa........", ".aaAAa......", "nkkkkkkkkkkk", "..ccCc......", "cCCc........", "CCc........."],
];

export function draw(p, t, o) {
  const PL = fit(o.palette, 4), W = fit(o.wood, 4), ST = fit(o.steel, 4), wind = hex(o.wind), S = o.seed, D = meta.duration;
  const fr = Math.floor(t * 30 + 1e-6), ph = t / D, left = -meta.origin[0] + 2, LEN = 36;

  // streaks of air peeling off the head and the fletching, stretching back and thinning
  beat(t, D, 9, S, (r) => r.range(0.14, 0.26), (age, life, r) => {
    const k = age / life, top = r.chance(0.5) ? -1 : 1, from = r.chance(0.6) ? -3 : -LEN + 6;
    const x0 = from - age * r.range(160, 240), len = r.range(8, 16) * (0.5 + k), y = 0.5 + top * (r.range(3, 5) + k * r.range(1, 2.5));
    if (x0 - len < left) return;
    const c = k < 0.4 ? wind : mix(wind, hex("#2a2540"), (k - 0.4) * 1.2);
    p.line(x0, y, x0 - len, y, (u) => (u < 0.25 && k < 0.4 ? mix(wind, WHITE, 0.5) : c), (u) => (u < 0.65 ? 1 : (1 - u) / 0.35));
  });
  // little eddies spinning off the feathers
  beat(t, D, 6, S + 3, (r) => r.range(0.15, 0.25), (age, life, r) => {
    const k = age / life, cx = -LEN - 2 - age * r.range(100, 150), cy = 0.5 + r.sign() * r.range(2, 4), a = age * 30 + r.range(0, TAU), rr = 1.2 + k * 1.5;
    if (cx < left + 4) return;
    for (let i = 0; i < 4; i++) p.dot(cx + Math.cos(a + i * 0.5) * rr, cy + Math.sin(a + i * 0.5) * rr, wind, (1 - k) * (1 - i * 0.2));
  });

  // the shaft with a lit top line
  p.line(-LEN + 11, 0, -7, 0, W[2]);
  for (let x = -LEN + 14; x < -8; x += 6) p.px(x, 0, W[3]);
  // the fletching flutters through its poses, faster than the frame rate can quite catch
  const pose = FLETCH[Math.floor(rand(fr, S) * 3)];
  p.sprite(pose, { a: PL[2], A: PL[3], c: PL[0], C: PL[1], k: W[1], n: W[0] }, -LEN, -3);
  // the binding and the broadhead: a lit upper bevel, a shaded lower one, a white point
  p.sprite(HEAD, { L: ST[3], s: ST[2], S: ST[2], d: ST[0], D: ST[1], b: W[0], W: WHITE }, -7, -2);
  // a glint runs down the blade now and then
  const g = (ph * 2) % 1;
  if (g < 0.25) sparkle(p, -5 + g * 16, -1, 1 + Math.round(2 * Math.sin((g / 0.25) * Math.PI)), WHITE, ST[3], 0.25);
}

// 3D: the arrow flies along +x over the floor, rolling about its axis. Three vanes fan round the nock and a
// three-bladed head leads; the streaks of air peel off in a ring round the shaft and the eddies curl off the vanes.
// The origin is the middle of the arrow and its streaks, so the camera turns about the whole of it.
const SH = 33, FLY = -22;
export const three = {
  meta: { size: [80, 54], origin: [40, 40], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const PL = fit(o.palette, 4), W = fit(o.wood, 4), ST = fit(o.steel, 4), wind = hex(o.wind), S = o.seed, D = meta.duration, q = space(p, o);
    const fr = Math.floor(t * 30 + 1e-6), ph = t / D, left = -66, LEN = 36, roll = TAU * ph;
    // everything is placed about the arrow's own axis: X along it, (a, rad) round it
    const X = (x) => x + SH, ring = (az, rad) => [FLY + Math.cos(az) * rad, Math.sin(az) * rad];
    shadow3(q, X(-LEN / 2), 0, 24, 2.8, 0.5);

    // the head: three wings round the point, their ridges meeting in a white tip
    const blade = (i) => {
      const a = roll + (i * TAU) / 3, ca = Math.cos(a), sa = Math.sin(a), up = -ca;
      const A = [X(-6.5), FLY, 0], B = [X(-4.4), FLY + ca * 2.4, sa * 2.4], C = [X(0), FLY, 0];
      tri3(q, A, B, C, (wa, wb, wc) => (wb > 0.5 ? (up > 0.25 ? ST[2] : up < -0.25 ? ST[0] : ST[1]) : up > -0.25 ? ST[3] : ST[2]));
      q.line(...B, ...C, up > 0 ? ST[3] : ST[2]);
      q.line(...A, ...B, ST[1]);
    };
    const wings = [0, 1, 2].sort((i, j) => Math.sin(roll + (j * TAU) / 3) - Math.sin(roll + (i * TAU) / 3));
    // the shaft and the cord round its foot
    tube(q, X(-LEN + 4), FLY, 0, X(-8), FLY, 0, 0.9, 0.9, (nx, ny) => (ny < -0.35 ? W[3] : ny > 0.45 ? W[1] : W[2]));
    for (let x = -LEN + 14; x < -8; x += 6) q.px(X(x), FLY - 0.9, 0.3, W[3]);
    tube(q, X(-8.2), FLY, 0, X(-6), FLY, 0, 1.15, 1.15, (nx, ny) => (ny < 0 ? W[1] : W[0]));
    // the fletching: three vanes, the cock feather red, each fluttering through its own pose
    const K = hex("#2a2540"), cream = [mix(PL[2], K, 0.5), PL[2], PL[3]], red = [PL[0], PL[1], mix(PL[1], WHITE, 0.3)];
    for (let i = 0; i < 3; i++) {
      const pose = Math.floor(rand(fr, S, i) * 3), a = roll + 0.5 + (i * TAU) / 3 + (rand(fr, S, i + 7) - 0.5) * 0.18, ca = Math.cos(a), sa = Math.sin(a);
      const r = 2.8 + pose * 0.35, cock = i === 0, set = cock ? red : cream, ti = ca < -0.3 ? 2 : ca > 0.3 ? 0 : 1;
      const at = (x, rad) => [X(x), FLY + ca * rad, sa * rad];
      quad3(q, at(-23, 0), at(-33, 0), at(-35.5 - pose * 0.4, r), at(-27, r * 0.95), (u, v) => (v < 0.14 ? W[1] : v > 0.8 ? set[Math.min(2, ti + 1)] : set[ti]));
      q.line(...at(-23, 0), ...at(-27, r * 0.95), set[Math.min(2, ti + 1)]);
    }
    q.px(X(-LEN), FLY, 0, W[0]);
    for (const i of wings) blade(i);
    q.px(X(0.4), FLY, 0, WHITE);

    // streaks of air peeling off the head and the fletching in a ring round the shaft, stretching back and thinning
    beat(t, D, 9, S, (r) => r.range(0.14, 0.26), (age, life, r) => {
      const k = age / life, from = r.chance(0.6) ? -3 : -LEN + 6, az = r.range(0, TAU);
      const x0 = from - age * r.range(160, 240), len = r.range(8, 16) * (0.5 + k), rad = r.range(3, 5) + k * r.range(1, 2.5), [y, z] = ring(az, rad);
      if (x0 - len < left) return;
      const c = k < 0.4 ? wind : mix(wind, hex("#2a2540"), (k - 0.4) * 1.2);
      q.line(X(x0), y, z, X(x0 - len), y, z, (u) => (u < 0.25 && k < 0.4 ? mix(wind, WHITE, 0.5) : c), (u) => (u < 0.65 ? 1 : (1 - u) / 0.35));
    });
    // little eddies spinning off the feathers, curling in a plane through the arrow's axis
    beat(t, D, 6, S + 3, (r) => r.range(0.15, 0.25), (age, life, r) => {
      const k = age / life, az = r.range(0, TAU), cx = -LEN - 2 - age * r.range(100, 150), a = age * 30 + r.range(0, TAU), rr = 1.2 + k * 1.5, rad = r.range(2, 4);
      if (cx < left + 4) return;
      const ca = Math.cos(az), sa = Math.sin(az);
      for (let i = 0; i < 4; i++) {
        const u = Math.cos(a + i * 0.5) * rr, v = rad + Math.sin(a + i * 0.5) * rr;
        q.dot(X(cx + u), FLY + ca * v, sa * v, wind, (1 - k) * (1 - i * 0.2));
      }
    });
    // a glint runs down the blade now and then
    const g = (ph * 2) % 1;
    if (g < 0.25) q.at(X(-5 + g * 16), FLY - 1, 1.5, (pp) => sparkle(pp, 0, 0, 1 + Math.round(2 * Math.sin((g / 0.25) * Math.PI)), WHITE, ST[3], 0.25));
  },
};
