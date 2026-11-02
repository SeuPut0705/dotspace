// The swirl's texture (streaks laid along a differentially wound flow, light on the brightest pixels) is adapted
// from Sprite Fusion's open-source black hole (https://www.spritefusion.com/pixel-art-vfx/black-hole), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, clamp, smooth, space, TAU, WHITE } from "../../core/index.js";
import { WATER } from "./_lib.js";

export const meta = {
  name: "Whirlpool",
  desc: "Seen from above, dark water winds into a vortex: foam arms spiral in, darkening as they're drawn down into a deep eye with a lit far rim, flecks of foam circling in after them.",
  tags: ["water", "whirlpool", "vortex", "maelstrom", "swirl", "top-down", "loop"],
  size: [128, 84],
  origin: [64, 42],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "dark",
  options: { palette: WATER, seed: 5 },
};

const D = meta.duration, R = 60, SY = 0.6, K = 2.4, EYE = 0.16;

// the flow at radius rho (0 eye, 1 rim), angle th: thin streaks of foam laid along a log spiral that turns once a
// loop (a turning log spiral reads as water drawn inward), dashed and brightest where two sets of streaks cross
function foam(rho, th, ph) {
  const s = Math.log(Math.max(rho, 0.02)), a = th + K * s + ph * TAU, b = th + K * 1.35 * s + ph * TAU * 2;
  const one = Math.pow(0.5 + 0.5 * Math.cos(7 * a + 0.9 * Math.sin(3 * a + s * 4)), 26);
  const two = Math.pow(0.5 + 0.5 * Math.cos(11 * b + 1.3), 34) * 0.7;
  // finer streaks crowd in near the eye, where the water runs fastest
  const three = Math.pow(0.5 + 0.5 * Math.cos(17 * (th + K * 0.8 * s + ph * TAU * 3)), 30) * 0.8 * Math.max(0, 1 - (rho - EYE) * 2.2);
  const dash = 0.55 + 0.45 * Math.sin(s * 22 - ph * TAU * 4 + a * 2);
  return (one + two + three) * dash;
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, ry = R * SY;
  p.shade(-R, -ry, R, ry, (x, y, out) => {
    const dx = x / R, dy = y / ry, rho = Math.hypot(dx, dy);
    if (rho > 1) return;
    const th = Math.atan2(dy, dx);
    // the eye: a hole down into the dark, its far wall lit, a ring of foam racing round its lip
    if (rho < EYE) {
      const far = -dy / rho;
      // the far wall of the funnel, lit, falling off into the dark below the lip on the near side
      const wall = (rho / EYE - 0.35) / 0.65;
      if (far > 0) out.c = wall > 0.8 ? (far > 0.6 ? C[5] : C[4]) : wall > 0.45 ? C[3] : wall > 0.15 ? C[2] : C[0];
      else out.c = wall > 0.85 && far > -0.5 ? C[2] : C[0];
      return;
    }
    const k = (rho - EYE) / (1 - EYE), fade = 1 - smooth(0.62, 1, k);
    // dark see-through water, darker toward the eye, a faint sheen mid-way
    p.blend(x, y, k < 0.25 ? C[0] : C[1], (0.75 - 0.25 * k) * (1 - smooth(0.8, 1, k)));
    if (k > 0.3 && k < 0.8) p.blend(x, y, C[2], 0.18 * Math.sin(Math.PI * (k - 0.3) / 0.5));
    // the foam ring round the eye
    if (k < 0.035) {
      const g = 0.5 + 0.5 * Math.cos(th * 9 - ph * TAU * 6);
      out.c = g > 0.7 ? WHITE : g > 0.3 ? C[6] : C[4];
      return;
    }
    const I = foam(rho, th, ph) * fade * Math.min(1, (k - 0.08) * 4) * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.25)));
    if (I > 0.12) {
      out.c = I > 0.75 ? WHITE : I > 0.45 ? C[6] : I > 0.25 ? C[5] : C[4];
      if (I > 0.25) (out.l = C[5]), (out.k = 0.08 + 0.14 * Math.min(1, I));
    }
  });
  // flecks of foam drawn round and in along the arms, each a short streak along its path
  cycle(t, D, 30, o.seed, (g) => g.range(1.2, 2.2), (age, life, r) => {
    const u = age / life, rho = 0.8 - 0.62 * u * u, a0 = r.range(0, TAU), th = a0 - K * Math.log(rho);
    const ang = th - age * (1.5 + 2.2 / rho), x = Math.cos(ang) * rho * R, y = Math.sin(ang) * rho * ry;
    const ang2 = ang + 0.12 / rho, x2 = Math.cos(ang2) * rho * R, y2 = Math.sin(ang2) * rho * ry;
    if (u > 0.85 && r.next() < (u - 0.85) * 6) return;
    p.line(x2, y2, x, y, u < 0.2 ? C[5] : u < 0.6 ? WHITE : C[6]);
  });
  // glints winking on the foam
  cycle(t, D, 8, o.seed + 3, (g) => g.range(0.25, 0.45), (age, life, r) => {
    const rho = r.range(0.35, 0.8), th = r.range(0, TAU) - age * 2.5, k = Math.sin((Math.PI * age) / life);
    const x = Math.cos(th) * rho * R, y = Math.sin(th) * rho * ry;
    if (foam(rho, th, ph) < 0.35) return;
    p.px(x, y, WHITE);
    if (k > 0.55) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.px(x + dx, y + dy, C[6]);
    p.glow(x, y, 5, C[5], 0.4 * k);
  });
  // light: a cool sheen on the swirl, a glow off the eye's lit rim
  p.glow(0, 0, R * 0.9, C[4], 0.2);
  p.glow(0, 0, R * EYE * 1.6 + 6, C[5], 0.28);
  p.glow(0, -ry * EYE * 0.8, 14, C[5], 0.32);
}

// 3D: a real funnel in the water. Every pixel casts a ray into a surface of revolution (a lip that rolls over, a wall that
// steepens towards the eye, a cup at the bottom) so the bowl shows its far wall from any side and the near lip hides its
// own near wall; the foam streaks of the 2D flow are laid on it, the arms rise off it as crests, and flecks of foam
// race in on it as points in space. bg stays dark: the funnel goes down below y = 0.
const R3 = 54, DEP = 30, CUP = 16, K1 = 1 / (1 - EYE);
// the funnel's depth below the surface (y, down is positive) at radius r, and its slope dy/dr
const funnelY = (r) => {
  const rho = r / R3;
  if (rho >= EYE) {
    const u = (1 - rho) * K1;
    return DEP * u * u;
  }
  const c = rho / EYE;
  return DEP + CUP * Math.sqrt(1 - c * c);
};
const funnelSlope = (r) => {
  const rho = r / R3;
  if (rho >= EYE) return (-2 * DEP * (1 - rho) * K1 * K1) / R3;
  const c = rho / EYE;
  return -Math.min(6, (CUP * c) / Math.sqrt(Math.max(1e-4, 1 - c * c)) / (EYE * R3));
};

function funnel(q, p, C, ph) {
  const { cy, sy, cp, sp, dist: D, zoom: zm, ax, ay, az } = q, R2 = R3 * R3, persp = D !== Infinity;
  // the light, from the top left of the screen and in front, as a world direction
  const ln = Math.hypot(-0.45, -0.6, 0.66), lv = [-0.45 / ln, -0.6 / ln, 0.66 / ln], lz = lv[1] * sp + lv[2] * cp;
  const L = [lv[0] * cy + lz * sy, lv[1] * cp - lv[2] * sp, -lv[0] * sy + lz * cy];
  // its outline on the screen
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU, pts = [[Math.cos(a) * R3, 0, Math.sin(a) * R3], [Math.cos(a) * 6, DEP + CUP, Math.sin(a) * 6]];
    for (const [x, y, z] of pts) {
      if (!q.project(x, y, z)) continue;
      (x0 = Math.min(x0, q.x)), (x1 = Math.max(x1, q.x)), (y0 = Math.min(y0, q.y)), (y1 = Math.max(y1, q.y));
    }
  }
  if (x0 === Infinity) return;
  const z0 = p.z;
  p.each(x0 - 1, y0 - 1, x1 + 1, y1 + 1, (lx, ly, sx, sy2) => {
    // the ray through this pixel meets the plane y = 0 at t (t is how far towards the camera); march down and away from there
    const a = ly / zm, b = persp ? ly / (zm * D) : 0;
    let t = (a * cp - ay) / (sp + b * cp), X, Y, Z;
    const at = (tt) => {
      const g = persp ? (D - tt) / (zm * D) : 1 / zm, vx = lx * g, vy = ly * g, vz = vy * sp + tt * cp;
      X = vx * cy + vz * sy - ax;
      Z = -vx * sy + vz * cy - az;
      Y = vy * cp - tt * sp - ay;
    };
    at(t);
    if (X * X + Z * Z >= R2) return;
    let gap = funnelY(Math.hypot(X, Z)) - Y, hit = false;
    for (let i = 0; i < 60; i++) {
      const tn = t - Math.max(0.5, gap / 2.2);
      at(tn);
      const r = Math.hypot(X, Z);
      if (r >= R3) return;
      const gn = funnelY(r) - Y;
      if (gn <= 0.1) {
        // across the surface: settle between the last two steps
        let lo = tn, hi = t;
        for (let j = 0; j < 4; j++) {
          const mid = (lo + hi) / 2;
          at(mid);
          if (funnelY(Math.hypot(X, Z)) - Y > 0.05) hi = mid;
          else lo = mid;
        }
        t = lo;
        at(t);
        hit = true;
        break;
      }
      t = tn;
      gap = gn;
    }
    if (!hit) return;
    const r = Math.max(0.01, Math.hypot(X, Z)), rho = r / R3, c = X / r, s = Z / r, fp = funnelSlope(r), nl = Math.hypot(fp, 1);
    const lit = (fp * c * L[0] - L[1] + fp * s * L[2]) / nl;
    p.z = -t;
    // the eye: a dark cup, its far wall catching light
    if (rho < EYE) {
      const deep = (Y - DEP) / CUP;
      p.put(sx, sy2, deep > 0.3 ? C[0] : lit > 0.65 ? C[2] : lit > 0.35 ? C[1] : C[0]);
      return;
    }
    const th = Math.atan2(Z, X), k = (rho - EYE) / (1 - EYE), fade = 1 - smooth(0.62, 1, k);
    // dark see-through water, darker toward the eye, a faint sheen where the wall faces the light
    if (k > 0.955) return void p.put(sx, sy2, lit > 0.25 ? C[3] : C[2]);
    p.put(sx, sy2, k < 0.25 || lit < 0.4 ? C[0] : C[1]);
    if (k > 0.3 && k < 0.8 && lit > 0.45) p.put(sx, sy2, C[2], 0.2 * Math.sin((Math.PI * (k - 0.3)) / 0.5));
    // the foam ring round the lip of the eye
    if (k < 0.035) {
      const g = 0.5 + 0.5 * Math.cos(th * 9 - ph * TAU * 6);
      p.put(sx, sy2, g > 0.7 ? WHITE : g > 0.3 ? C[6] : C[4]);
      return;
    }
    const I = foam(rho, th, ph) * fade * Math.min(1, (k - 0.08) * 4) * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, k * 1.25)));
    if (I > 0.12) {
      p.put(sx, sy2, I > 0.75 ? WHITE : I > 0.45 ? C[6] : I > 0.25 ? C[5] : C[4]);
      if (I > 0.25) p.add(sx, sy2, C[5], 0.08 + 0.14 * Math.min(1, I));
    }
  });
  p.z = z0;
}

export const three = {
  meta: { size: [124, 92], origin: [62, 42], camera: { pitch: 0.75 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, S = o.seed;
    funnel(q, p, C, ph);
    // the arms: crests of the first set of streaks, rising off the water as they wind in
    for (let m = 0; m < 7; m++)
      for (let rho = 0.9; rho > EYE + 0.05; rho -= 0.006) {
        const s = Math.log(rho), th = (m / 7) * TAU - K * s - ph * TAU, a = th + K * s + ph * TAU;
        const dash = 0.55 + 0.45 * Math.sin(s * 22 - ph * TAU * 4 + a * 2), k = (rho - EYE) / (1 - EYE), vis = (1 - smooth(0.62, 1, k)) * Math.min(1, (k - 0.08) * 4) * dash;
        if (vis < 0.62) continue;
        const r = rho * R3, y = funnelY(r) - 0.9 - 1.2 * Math.sin(Math.PI * k);
        q.px(Math.cos(th) * r, y, Math.sin(th) * r, vis > 0.85 ? WHITE : C[6]);
      }
    // flecks of foam drawn round and in along the arms, each a short streak along its path
    cycle(t, D, 30, S, (g) => g.range(1.2, 2.2), (age, life, r) => {
      const u = age / life, rho = 0.8 - 0.62 * u * u, a0 = r.range(0, TAU), th = a0 - K * Math.log(rho);
      const ang = th - age * (1.5 + 2.2 / rho), ang2 = ang + 0.12 / rho, rr = rho * R3, y = funnelY(rr) - 1;
      if (u > 0.85 && r.next() < (u - 0.85) * 6) return;
      q.line(Math.cos(ang2) * rr, y, Math.sin(ang2) * rr, Math.cos(ang) * rr, y, Math.sin(ang) * rr, u < 0.2 ? C[5] : u < 0.6 ? WHITE : C[6]);
    });
    // glints winking on the foam
    cycle(t, D, 8, S + 3, (g) => g.range(0.25, 0.45), (age, life, r) => {
      const rho = r.range(0.35, 0.8), th = r.range(0, TAU) - age * 2.5, k = Math.sin((Math.PI * age) / life);
      if (foam(rho, th, ph) < 0.35) return;
      const rr = rho * R3, x = Math.cos(th) * rr, z = Math.sin(th) * rr, y = funnelY(rr) - 1;
      q.px(x, y, z, WHITE);
      if (k > 0.55) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.px(x + dx, y, z + dz, C[6]);
      q.glow(x, y, z, 5, C[5], 0.4 * k);
    });
    // light: a cool sheen on the swirl, a glow off the eye's lit far lip
    q.glow(0, DEP * 0.45, 0, R3 * 0.9, C[4], 0.2);
    q.glow(0, DEP - 2, 0, R3 * EYE * 1.4 + 4, C[5], 0.16);
    q.glow(-q.sy * R3 * EYE * 0.8, DEP - 3, -q.cy * R3 * EYE * 0.8, 10, C[5], 0.22);
  },
};
