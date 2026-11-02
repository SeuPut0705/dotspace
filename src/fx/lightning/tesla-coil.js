// The arcs (forking bolts re-struck every frame, inked with halo, body, core and light), their flicker and the
// zaps that strike the floor in a spray of sparks follow Sprite Fusion's open-source lightning and energy orb
// (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, rng, rand, space, TAU, WHITE, hex, mix, ease } from "../../core/index.js";
import { VOLT, PLASMA, zigzag, stroke, crackle, flight, spark, puff, scorch, zigzag3, stroke3, crackle3, flight3, spark3, puff3, scorchDisc, pool } from "./_lib.js";

export const meta = {
  name: "Tesla coil",
  desc: "A copper coil under a steel torus throws branching arcs that lash out in volleys and now and then strike the floor in a spray of sparks, lighting the metal and the ground.",
  tags: ["lightning", "electric", "tesla", "machine", "prop", "loop"],
  size: [224, 136],
  origin: [112, 120],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: VOLT,
    sparks: PLASMA,
    copper: ["#2a120c", "#5a2814", "#8e4a1e", "#c4772f", "#eaa65a", "#ffd9a0"],
    steel: ["#0f121c", "#1f2433", "#353d52", "#556078", "#7f8ba3", "#b8c3d6", "#f2f6ff"],
    seed: 4,
  },
};

const FPS = 30, N = 72, P = N / FPS, TY = -57, RR = 12, TR = 3.6, SY = 0.45, CTOP = -50, CBOT = -12;
const IRON = ["#120f18", "#1e1a27", "#2c2637", "#3f374d", "#5a5068"].map(hex), ASH = hex("#5b5566");
// an arc's brightness over the frames it lives: struck, flickered, re-struck, gone
const FL = [1, 0.7, 0.95, 0.55, 0.85, 0.45, 0.7, 0.35];

// the loop's events, frame by frame: volleys of arcs off the torus, and two zaps to the floor
function plan(seed) {
  const r = rng(seed, 1), arcs = [], strikes = [];
  for (const [v, n] of [[2, 3], [20, 3], [30, 1], [38, 3], [56, 3], [66, 1]])
    for (let j = 0; j < n + r.int(0, 1); j++) {
      const side = r.chance(0.5) ? 1 : -1, front = r.chance(0.55), a = r.range(0.15, 1.1);
      const phi = side > 0 ? (front ? a : -a) : front ? Math.PI - a : Math.PI + a, th0 = r.range(-1.15, 0.35);
      arcs.push({ f0: (v + j * r.int(2, 4)) % N, len: r.int(3, 7), side, phi, front, th0, th1: th0 + r.range(-0.6, 0.6), L: r.range(24, 52) });
    }
  for (const [f0, side] of [[14, 1], [47, -1]]) strikes.push({ f0, side, x: side * r.range(38, 56), phi: side > 0 ? 0.4 : Math.PI - 0.4 });
  return { arcs, strikes };
}
const ageOf = (f, f0) => (((f - f0) % N) + N) % N;
const root = (phi, up = 0) => [Math.cos(phi) * (RR + TR * 0.6), TY + Math.sin(phi) * RR * SY - up];

// the coil: an iron plinth, two thick primary turns, the secondary wound in copper wire, catching arc light
function drawCoil(p, Cu, lit, C) {
  const n = Cu.length;
  p.shade(-14, -8, 14, 0, (x, y, o) => {
    if (x < -13 || x > 13 || y < -7) return;
    const edge = x < -12 ? 2 : x > 12 ? 0 : 1;
    o.c = y < -6 ? IRON[4] : y < -5 ? IRON[3] : y > -1 ? IRON[0] : IRON[edge + 1 > 2 ? 2 : edge + (y < -3 ? 1 : 0)];
  });
  for (const rx of [-10, 10]) (p.px(rx, -4, IRON[4]), p.px(rx, -3, IRON[0]));
  const turn = (y, front) => {
    for (let a = 0; a < TAU; a += 0.04) {
      if (Math.sin(a) >= 0 !== front) continue;
      const x = Math.cos(a) * 10, yy = y + Math.sin(a) * 2.2, l = 0.5 - 0.4 * Math.cos(a) + (front ? 0.25 : -0.2);
      p.px(x, yy, Cu[clamp(Math.round(l * (n - 1)), 0, n - 1)]);
      p.px(x, yy + 1, Cu[clamp(Math.round(l * (n - 1)) - 2, 0, n - 1)]);
    }
  };
  turn(-10.5, false);
  turn(-13.5, false);
  // the secondary: wire on every other row, lit from the left, a bright band down the front, arc light on the rims
  p.shade(-6, CTOP, 6, CBOT, (x, y, o) => {
    if (x < -5 || x > 5) return;
    const u = (x + 5.5) / 11, nx = u * 2 - 1, wire = (Math.floor(y) & 1) === 0;
    let l = 0.62 - 0.55 * nx - 0.35 * nx * nx + (Math.abs(nx + 0.35) < 0.12 ? 0.3 : 0);
    if (!wire) l -= 0.32;
    o.c = Cu[clamp(Math.round(l * (n - 1)), 0, n - 1)];
    if (wire && ((nx < -0.75 && lit[0] > 0.25) || (nx > 0.75 && lit[1] > 0.25))) o.c = nx < 0 ? (lit[0] > 0.6 ? C[6] : C[4]) : lit[1] > 0.6 ? C[6] : C[4];
  });
  p.line(-5, CTOP - 1, 5, CTOP - 1, IRON[3]);
  p.line(-4, CTOP - 2, 4, CTOP - 2, IRON[2]);
  turn(-10.5, true);
  turn(-13.5, true);
}

// the torus, solved once: for every pixel, the normal of the nearest point of a ring tube seen from a little above
let TORUS = null;
function torusMap() {
  if (TORUS) return TORUS;
  const sa = SY, ca = Math.sqrt(1 - SY * SY), X0 = -Math.ceil(RR + TR) - 1, Y0 = Math.floor(TY - RR * SY - TR) - 2;
  const W = 2 * -X0 + 2, H = Math.ceil(TY + RR * SY + TR) + 3 - Y0, z = new Float32Array(W * H).fill(-1e9), n = new Float32Array(W * H * 3);
  for (let i = 0; i < 480; i++) {
    const phi = (i / 480) * TAU, cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j < 96; j++) {
      const psi = (j / 96) * TAU, cs = Math.cos(psi), ss = Math.sin(psi), rr = RR + TR * cs, X = rr * cp, Y = TR * ss, Z = rr * sp;
      const px = Math.floor(X) - X0, py = Math.floor(TY - Y * ca + Z * sa) - Y0, d = Z * ca + Y * sa;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const k = py * W + px;
      if (d > z[k]) (z[k] = d), (n[k * 3] = cs * cp), (n[k * 3 + 1] = ss), (n[k * 3 + 2] = cs * sp);
    }
  }
  return (TORUS = { X0, Y0, W, H, z, n, ca, sa });
}
const norm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const KEY = norm(-0.55, 0.75, 0.45);

// steel shaded by a key light from the upper left, a hard specular, dark inner faces, the arcs' light on the sides
function drawTorus(p, St, C, lit) {
  const T = torusMap(), m = St.length, HALF = norm(KEY[0], KEY[1] + T.sa, KEY[2] + T.ca);
  const on = (x, y) => x >= 0 && y >= 0 && x < T.W && y < T.H && T.z[y * T.W + x] > -1e8;
  for (let y = 0; y < T.H; y++)
    for (let x = 0; x < T.W; x++) {
      const k = y * T.W + x;
      if (T.z[k] < -1e8) continue;
      const nx = T.n[k * 3], ny = T.n[k * 3 + 1], nz = T.n[k * 3 + 2];
      const dif = Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2]), spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 28);
      const inner = nx * (x + T.X0 + 0.5) + nz * 0 < 0 && Math.abs(x + T.X0 + 0.5) < RR ? 0.75 : 1;
      let c = spec > 0.55 ? St[m - 1] : St[clamp(Math.floor((0.12 + 0.8 * dif * inner + spec) * (m - 1.01)), 0, m - 2)];
      for (const [s, l] of [[-1, lit[0]], [1, lit[1]]]) {
        const r = Math.max(0, s * nx * 0.85 + ny * 0.25 + nz * 0.45) * Math.min(1, l);
        if (r > 0.88) c = C[6];
        else if (r > 0.62) c = mix(c, C[5], 0.6);
        else if (r > 0.38) c = mix(c, C[4], 0.3);
      }
      if (!on(x, y + 1) && ny < 0.3) c = St[0];
      p.px(x + T.X0, y + T.Y0, c);
    }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), Cu = fit(o.copper, 6), St = fit(o.steel, 7), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N;
  const { arcs, strikes } = plan(o.seed), lit = [0, 0];
  const live = arcs.filter((a) => ageOf(f, a.f0) < a.len);
  for (const a of live) lit[a.side > 0 ? 1 : 0] += FL[ageOf(f, a.f0)] * 0.6;
  for (const s of strikes) {
    const a = ageOf(f, s.f0);
    if (a < 6) lit[s.side > 0 ? 1 : 0] += 1;
  }
  const act = Math.min(1, (lit[0] + lit[1]) * 0.5);

  // the floor: a cold pool of light under the coil, scorches and smoke where zaps landed
  p.glow(0, -10, 58, C[3], 0.14 + 0.25 * act);
  p.ellipse(0, 0.5, 15, 1.6, IRON[0]);
  for (const s of strikes) {
    const age = (((t - s.f0 / FPS) % P) + P) % P;
    scorch(p, s.x, 0, 7, Math.pow(clamp(1 - age / 1.1), 1.3), 1 - clamp((age - 1.4) / 0.6));
    for (let j = 0; j < 2; j++) {
      const u = (age - 0.12 - j * 0.18) / 1.2;
      if (u > 0 && u < 1) puff(p, s.x + (j ? 3 : -2) + u * 5 * s.side, -3 - u * 16 - j * 2, 2.6 + j, u, mix(ASH, C[2], 0.3));
    }
  }

  const drawArc = (a) => {
    const age = ageOf(f, a.f0), u = age / Math.max(1, a.len - 1), th = a.th0 + (a.th1 - a.th0) * ease.outQuad(u), ang = a.side > 0 ? th : Math.PI - th;
    const [x0, y0] = root(a.phi), L = a.L * (age === 0 ? 0.75 : 1), r = rng(o.seed, 21, a.f0, f);
    stroke(p, zigzag(r, x0, y0, x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L, 0.32, 0.75), FL[age], C, 0.6, { light: 0.4 });
    p.glow(x0, y0, 10, C[5], 0.5 * FL[age]);
  };
  // arcs off the back of the torus go behind the coil
  for (const a of live) if (!a.front) drawArc(a);
  drawCoil(p, Cu, lit, C);
  drawTorus(p, St, C, lit);
  // corona: a faint violet fuzz crawling over the torus
  const rc = rng(o.seed, 9, f);
  for (let i = 0; i < 6; i++) {
    const phi = rc.range(0, TAU), d = rc.range(1, 3), x = Math.cos(phi) * (RR + TR + d), y = TY + Math.sin(phi) * (RR * SY + TR + d * 0.7);
    p.px(x, y, rc.chance(0.3) ? C[5] : C[3]);
    if (rc.chance(0.4)) p.px(x + Math.cos(phi), y + Math.sin(phi) * 0.6, C[2]);
    p.glow(x, y, 4, C[3], 0.3);
  }
  // brush discharge: short streamers hiss off the rim every frame
  for (let i = 0; i < 2; i++) {
    const phi = rc.range(0, TAU), x0 = Math.cos(phi) * (RR + TR * 0.8), y0 = TY + Math.sin(phi) * (RR * SY + TR * 0.6), a = Math.atan2(Math.sin(phi) * 0.6 - 0.5, Math.cos(phi)) + rc.range(-0.5, 0.5), l = rc.range(4, 10);
    crackle(p, zigzag(rc, x0, y0, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, 0.4, 0.4), rc.range(0.35, 0.65), C, 0.3);
  }
  p.glow(0, TY, 34, C[3], 0.18 + 0.3 * act);
  for (const a of live) if (a.front) drawArc(a);

  // zaps to the floor: a full bolt, a flash where it lands, sparks thrown and bouncing
  for (const s of strikes) {
    const age = ageOf(f, s.f0);
    if (age < 6) {
      const k = [1, 0.75, 1, 0.6, 0.85, 0.4][age], [x0, y0] = root(s.phi, -2), r = rng(o.seed, 41, s.f0, f);
      stroke(p, zigzag(r, x0, y0, s.x, 0, 0.22, 0.55), k, C, age === 0 ? 0.95 : 0.8, { hero: age === 0 });
      p.circle(s.x, -1, 3 * k + 1.5, C[2]);
      p.circle(s.x, -1, 3 * k + 0.5, C[5]);
      p.circle(s.x, -1, 2 * k, WHITE);
      p.glow(s.x, -10, 40, C[4], 0.55 * k);
      p.glow(s.x, -3, 12, C[6], 0.5 * k);
      if (age < 2) p.glow(0, -50, 120, C[3], 0.25 * k);
    }
    const st = (((t - s.f0 / FPS) % P) + P) % P;
    for (let j = 0; j < 18; j++) {
      const r = rng(o.seed, 51, s.f0, j), life = r.range(0.3, 0.65);
      if (st >= life) continue;
      const a = -Math.PI / 2 + r.range(-1.3, 1.3), sp = r.range(50, 190), [x, y, vx, vy] = flight(s.x, -1, Math.cos(a) * sp, Math.sin(a) * sp, st, { floor: 0 });
      spark(p, x, y, vx, vy, 1 - st / life, S);
    }
  }
  // sparks spat off the arc tips as they strike
  for (const a of arcs) {
    const age = (((t - a.f0 / FPS) % P) + P) % P, ang = a.side > 0 ? a.th0 : Math.PI - a.th0, [x0, y0] = root(a.phi);
    for (let j = 0; j < 3; j++) {
      const r = rng(o.seed, 61, a.f0, j), life = r.range(0.15, 0.35);
      if (age >= life) continue;
      const tx = x0 + Math.cos(ang) * a.L * 0.75, ty = y0 + Math.sin(ang) * a.L * 0.75, b = ang + r.range(-0.9, 0.9), sp = r.range(50, 150);
      const [x, y, vx, vy] = flight(tx, ty, Math.cos(b) * sp, Math.sin(b) * sp, age, { floor: 0 });
      spark(p, x, y, vx, vy, 1 - age / life, S);
    }
  }
}

// ---- 3D: the coil on a round plinth, a real torus of steel, arcs lashing out in every direction from it and two
// bolts that stab the floor away from the base, scorching it. The round parts (plinth, winding) are the same from
// every side and stand as billboards; the primary turns, the torus and everything electric are in space.
const KEY3 = norm(-0.55, 0.75, 0.45), HALF3 = norm(-0.55, 0.75, 1.45);

// the plinth and the secondary winding seen from the side, for a camera tipped by pitch: ev are the arcs' directions
// in view space, so the wire catches their light on the side facing them
function coil3(pp, s, Cu, C, ev, yaw) {
  const n = Cu.length;
  const tint = (nx, nz) => {
    for (const e of ev) if (e.w > 0.25 && nx * e.v[0] + nz * e.v[2] > 0.94) return e.w > 0.6 ? C[6] : C[4];
    return 0;
  };
  // the plinth: iron, a lit left flank, a flat top
  for (let x = -14; x < 14; x++) {
    const nx = (x + 0.5) / 14, e = Math.sqrt(1 - nx * nx), yb = Math.ceil(e * 14 * s);
    for (let y = -8; y < yb; y++) pp.px(x, y, y > yb - 2 ? IRON[0] : IRON[clamp(Math.round((0.66 - 0.62 * nx) * 3 - (y > yb - 4 ? 0.6 : 0)), 0, 3)]);
  }
  pp.ellipse(0, -8, 14, Math.max(0.6, 14 * s), IRON[3]);
  pp.ellipse(0, -8, 12.6, Math.max(0.4, 12.6 * s), IRON[4]);
  // the secondary: copper wire on every other row, lit from the left, a bright band down the front
  for (let x = -5; x < 5; x++) {
    const u = (x + 5.5) / 11, nx = u * 2 - 1, nz = Math.sqrt(Math.max(0, 1 - nx * nx)), yb = Math.ceil(nz * 5.5 * s) - 8;
    for (let y = CTOP; y < yb; y++) {
      const wire = (Math.floor(y) & 1) === 0;
      let l = 0.62 - 0.55 * nx - 0.35 * nx * nx + (Math.abs(nx + 0.35) < 0.12 ? 0.3 : 0);
      if (!wire) l -= 0.32;
      const w = wire ? tint(nx, nz) : 0;
      pp.px(x, y, w || Cu[clamp(Math.round(l * (n - 1)), 0, n - 1)]);
    }
  }
  pp.ellipse(0, CTOP, 5.5, Math.max(0.5, 5.5 * s), IRON[3]);
  pp.ellipse(0, CTOP, 4.5, Math.max(0.4, 4.5 * s), IRON[4]);
}

export const three = {
  meta: { size: [216, 172], origin: [108, 142], bg: "ground", camera: { pitch: 0.3 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), Cu = fit(o.copper, 6), St = fit(o.steel, 7), S = o.sparks.map(hex), f = Math.floor(t * FPS + 1e-6) % N;
    const { arcs: A2, strikes: S2 } = plan(o.seed), sp = Math.sin(q.camera.pitch);
    const arcs = A2.map((a, i) => ({ ...a, phi: rng(o.seed, 77, i).range(0, TAU) }));
    const strikes = S2.map((st, i) => {
      const z = rng(o.seed, 78, i).range(-30, 30);
      return { ...st, sx: st.x, sz: z, phi: Math.atan2(z, st.x) };
    });
    const live = arcs.filter((a) => ageOf(f, a.f0) < a.len), ev = [];
    for (const a of live) ev.push({ phi: a.phi, w: FL[ageOf(f, a.f0)] * 0.6 });
    for (const st of strikes) if (ageOf(f, st.f0) < 6) ev.push({ phi: st.phi, w: 1 });
    for (const e of ev) {
      const [vx, vy, vz] = q.view(Math.cos(e.phi), 0, Math.sin(e.phi)), l = Math.hypot(vx, vz) || 1;
      e.v = [vx / l, vy, vz / l];
    }
    const act = Math.min(1, ev.reduce((a, e) => a + e.w, 0) * 0.5);
    const rootP = (phi, up = 0) => [Math.cos(phi) * (RR + TR * 0.6), TY - up, Math.sin(phi) * (RR + TR * 0.6)];

    // the coil: plinth and winding (billboards), the primary turns round it (true circles), the torus on top
    q.at(0, 0, 0, (pp) => coil3(pp, sp, Cu, C, ev));
    for (const y of [-10.5, -13.5])
      q.ring(0, y, 0, 10.5, 2, (v, g) => {
        const [vx, , vz] = q.view(Math.cos(g), 0, Math.sin(g));
        return Cu[clamp(Math.round((0.5 - 0.4 * vx + 0.22 * vz) * (Cu.length - 1)), 0, Cu.length - 1)];
      });
    const m = St.length, RT = 44;
    for (let i = 0; i < RT; i++) {
      const phi = (i / RT) * TAU;
      q.ball(Math.cos(phi) * RR, TY, Math.sin(phi) * RR, TR, (nx, ny, nz) => {
        const dif = Math.max(0, nx * KEY3[0] - ny * KEY3[1] + nz * KEY3[2]), spec = Math.pow(Math.max(0, nx * HALF3[0] - ny * HALF3[1] + nz * HALF3[2]), 28);
        let c = spec > 0.55 ? St[m - 1] : St[clamp(Math.floor((0.12 + 0.8 * dif + spec) * (m - 1.01)), 0, m - 2)];
        for (const e of ev) {
          const r = Math.max(0, nx * e.v[0] + nz * e.v[2]) * 0.85 * Math.max(0, Math.cos(phi - e.phi)) * Math.min(1, e.w) + 0.15 * Math.max(0, -ny) * Math.min(1, e.w) * Math.max(0, Math.cos(phi - e.phi));
          if (r > 0.6) c = C[6];
          else if (r > 0.42) c = mix(c, C[5], 0.6);
          else if (r > 0.25) c = mix(c, C[4], 0.3);
        }
        return c;
      });
    }
    // corona: a faint violet fuzz crawling over the torus; brush discharge, short streamers hissing off the rim
    const rc = rng(o.seed, 9, f);
    for (let i = 0; i < 6; i++) {
      const phi = rc.range(0, TAU), psi = rc.range(0, TAU), d = rc.range(1, 3), rr = RR + (TR + d) * Math.cos(psi);
      const x = Math.cos(phi) * rr, y = TY - (TR + d) * Math.sin(psi), z = Math.sin(phi) * rr;
      q.px(x, y, z, rc.chance(0.3) ? C[5] : C[3]);
      q.glow(x, y, z, 4, C[3], 0.3);
    }
    for (let i = 0; i < 2; i++) {
      const phi = rc.range(0, TAU), psi = rc.range(-1.2, 1.2), x0 = Math.cos(phi) * (RR + TR * 0.8), z0 = Math.sin(phi) * (RR + TR * 0.8), l = rc.range(4, 10), el = rc.range(-1.1, 0.2);
      crackle3(q, zigzag3(rc, [x0, TY + psi, z0], [x0 + Math.cos(phi) * Math.cos(el) * l, TY + psi + Math.sin(el) * l, z0 + Math.sin(phi) * Math.cos(el) * l], 0.4, 0.4), rc.range(0.35, 0.65), C, 0.3);
    }
    // arcs: forking bolts re-struck every frame, lashing out of the torus in every direction
    for (const a of live) {
      const age = ageOf(f, a.f0), u = age / Math.max(1, a.len - 1), th = a.th0 + (a.th1 - a.th0) * ease.outQuad(u), L = a.L * (age === 0 ? 0.75 : 1), r = rng(o.seed, 21, a.f0, f), x0 = rootP(a.phi);
      const dir = [Math.cos(a.phi) * Math.cos(th), Math.sin(th), Math.sin(a.phi) * Math.cos(th)];
      stroke3(q, zigzag3(r, x0, [x0[0] + dir[0] * L, x0[1] + dir[1] * L, x0[2] + dir[2] * L], 0.32, 0.75), FL[age], C, 0.6, { light: 0.4 });
      q.glow(...x0, 10, C[5], 0.5 * FL[age]);
    }
    // zaps to the floor: a full bolt, a flash where it lands, a scorch, smoke, sparks thrown and bouncing
    for (const st of strikes) {
      const age = ageOf(f, st.f0), time = (((t - st.f0 / FPS) % P) + P) % P;
      if (age < 6) {
        const k = [1, 0.75, 1, 0.6, 0.85, 0.4][age], x0 = rootP(st.phi, -2), r = rng(o.seed, 41, st.f0, f);
        stroke3(q, zigzag3(r, x0, [st.sx, 0, st.sz], 0.22, 0.55), k, C, age === 0 ? 0.95 : 0.8, { hero: age === 0 });
        q.plane(st.sx, -0.5, st.sz, null, 3 * k + 1.5, (u, v) => (Math.hypot(u, v) > 3 * k + 0.5 ? C[2] : Math.hypot(u, v) > 2 * k ? C[5] : WHITE));
        q.glow(st.sx, -10, st.sz, 40, C[4], 0.55 * k);
        q.glow(st.sx, -3, st.sz, 12, C[6], 0.5 * k);
        if (age < 2) q.glow(0, -50, 0, 120, C[3], 0.25 * k);
      }
      const T0 = Math.pow(clamp(1 - time / 1.1), 1.3), fade = 1 - clamp((time - 1.4) / 0.6);
      if (fade > 0 && T0 > 0.02) q.decal(st.sx, 0, st.sz, null, 10, (pp) => scorchDisc(pp, 8, T0, fade));
      for (let j = 0; j < 18; j++) {
        const r = rng(o.seed, 51, st.f0, j), life = r.range(0.3, 0.65);
        if (time >= life) continue;
        const a = -Math.PI / 2 + r.range(-1.3, 1.3), v = r.range(50, 190), phi = r.range(0, TAU), hz = Math.cos(a) * v;
        const [x, y, z, vx, vy, vz] = flight3(st.sx, -1, st.sz, hz * Math.cos(phi), Math.sin(a) * v, hz * Math.sin(phi), time, { floor: 0 });
        spark3(q, x, y, z, vx, vy, vz, 1 - time / life, S);
      }
    }
    // sparks spat off the arc tips as they strike
    for (const a of arcs) {
      const age = (((t - a.f0 / FPS) % P) + P) % P, x0 = rootP(a.phi);
      for (let j = 0; j < 3; j++) {
        const r = rng(o.seed, 61, a.f0, j), life = r.range(0.15, 0.35);
        if (age >= life) continue;
        const tl = a.L * 0.75, c = Math.cos(a.th0), tip = [x0[0] + Math.cos(a.phi) * c * tl, x0[1] + Math.sin(a.th0) * tl, x0[2] + Math.sin(a.phi) * c * tl];
        const el = a.th0 + r.range(-0.9, 0.9), az = a.phi + r.range(-0.9, 0.9), v = r.range(50, 150);
        const [x, y, z, vx, vy, vz] = flight3(...tip, Math.cos(az) * Math.cos(el) * v, Math.sin(el) * v, Math.sin(az) * Math.cos(el) * v, age, { floor: 0 });
        spark3(q, x, y, z, vx, vy, vz, 1 - age / life, S);
      }
    }
    // light: a cold pool under the coil, the torus glowing with the volleys
    pool(q, 0, 0, 58, C[3], (0.14 + 0.25 * act) * 1.5);
    q.glow(0, -10, 0, 58, C[3], 0.14 + 0.25 * act);
    q.glow(0, TY, 0, 34, C[3], 0.18 + 0.3 * act);
    // ozone smoke where zaps landed, drifting up and out
    const smoke = [];
    for (const st of strikes) {
      const age = (((t - st.f0 / FPS) % P) + P) % P;
      for (let j = 0; j < 2; j++) {
        const u = (age - 0.12 - j * 0.18) / 1.2;
        if (u > 0 && u < 1) smoke.push([st.sx + (j ? 3 : -2) + u * 5 * st.side, -3 - u * 16 - j * 2, st.sz + (j ? 2 : -2) * u * 3, u, 2.6 + j]);
      }
    }
    for (const [x, y, z, u, sz] of q.sort(smoke, (e) => e)) puff3(q, x, y, z, sz, u, mix(ASH, C[2], 0.3));
  },
};
