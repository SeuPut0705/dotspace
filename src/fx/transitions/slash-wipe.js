// The cut's tapered smear (white at the rim, cooling down the ramp with age), the dotted trace it leaves, the
// tip glint, the sparks off the end and the shavings flung off the line are adapted from Sprite Fusion's
// open-source slash (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, hex, mix, clamp, smooth, ease, sparkle, space, WHITE } from "../../core/index.js";
import { W, H, screenMeta, clipTo, fillConvex, halfPlane, rect, glint3, poly, outline, solid, rotAxis, turnPt } from "./_lib.js";

export const meta = screenMeta({
  name: "Slash wipe",
  desc: "A white-hot blade edge slices across the screen, light ahead of it and sparks spraying back over the cover; a second cut flashes through and the cover splits apart.",
  tags: ["slash", "blade", "cut", "sparks", "wipe"],
  duration: 1.7,
  options: {
    palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#b8c9e8", "#e8f1ff", "#ffffff"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    seed: 2,
  },
});

const D = meta.duration, SL = 0.55, CS = 1 / Math.hypot(1, SL), HALO = 18;
const T0 = 0.06, SWEEP = 0.62, E0 = -(H / 2) * SL - 4, E1 = W + (H / 2) * SL + 24;
const CUT = 0.84, CSW = 0.07, CHOLD = 0.05, CTRAIL = 0.12, SLIP = CUT + 0.12, SPLIT = CUT + CSW + CHOLD + CTRAIL;

// the blade edge: x where it crosses row y, and how fast it's moving
const edgeAt = (t) => E0 + (E1 - E0) * ease.outCubic(clamp((t - T0) / SWEEP));
const speedAt = (t) => (t < T0 || t > T0 + SWEEP ? 0 : ((E1 - E0) * 3 * (1 - (t - T0) / SWEEP) ** 2) / SWEEP);
const xAt = (e, y) => e + (H / 2 - y) * SL;

export function create(o) {
  const C = fit(o.palette, 8), ink = hex(o.color), R = new Rng(o.seed), n = C.length;
  const ps = new Particles({ rng: R, sparks: o.sparks }), lights = new Lights();
  // the second cut: a "\\" through the middle, from where it enters the screen to where it leaves
  const th = R.range(0.42, 0.56), ux = Math.cos(th), uy = Math.sin(th), nx = uy, ny = -ux;
  const cx = W / 2 + R.range(-24, 24), cy = H / 2 + R.range(-10, 10);
  // the halves overhang the screen a little, so slipping along the cut never uncovers an edge
  const area = [[-24, -24], [W + 24, -24], [W + 24, H + 24], [-24, H + 24]];
  const ends = [-1, 1].map((s) => {
    // walk out along the cut until it leaves the screen
    let lo = 0, hi = 400;
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2, x = cx + s * ux * m, y = cy + s * uy * m;
      if (x >= 0 && x <= W && y >= 0 && y <= H) lo = m;
      else hi = m;
    }
    return [cx + s * ux * lo, cy + s * uy * lo];
  });
  const [A, B] = ends, LC = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const halves = [1, -1].map((s) => {
    const pts = halfPlane(area, cx, cy, s * nx, s * ny);
    let mx = 0, my = 0;
    for (const [x, y] of pts) (mx += x / pts.length), (my += y / pts.length);
    return { s, pts, mx, my, spin: s * R.range(0.5, 0.9) };
  });
  let t = 0, acc = 0, entered = false, tipped = false, split = false;
  const end = D - 0.05;

  // where a half of the cover is: it slips along the cut, then the halves fly apart, turning a little
  const placeOf = (hf) => {
    const slip = 5 * ease.outCubic(clamp((t - SLIP) / 0.12)) * (hf.s > 0 ? 1 : -0.4), u = Math.max(0, t - SPLIT);
    const sep = 30 * u + 0.5 * 1500 * u * u, rot = hf.spin * u * u;
    return { dx: ux * slip + hf.s * nx * sep, dy: uy * slip + hf.s * ny * sep, rot, sep };
  };
  const moved = (hf, pl, [x, y]) => {
    const c = Math.cos(pl.rot), s = Math.sin(pl.rot), lx = x - hf.mx, ly = y - hf.my;
    return [hf.mx + lx * c - ly * s + pl.dx, hf.my + lx * s + ly * c + pl.dy];
  };

  return {
    update(dt) {
      t += dt;
      // the blade grinds through: sparks spray back over the cover, shavings flake off, light rides the edge
      const sp = speedAt(t), e = edgeAt(t);
      if (!entered && t >= T0) {
        entered = true;
        lights.add(4, 4, 60, C[5], 0.6, 0.25);
      }
      // in bursts: each a fountain of sparks off one spot where the edge bites
      for (acc += sp * dt * 0.035; acc > 1; acc--) {
        const y = R.range(4, H - 4), x = xAt(e, y) - 1, a0 = Math.PI + R.range(-0.1, 0.6), n = R.int(5, 10);
        if (x < 0 || x >= W) continue;
        for (let i = 0; i < n; i++) {
          const a = a0 + R.range(-0.75, 0.75), v = R.range(0.2, 1) * (140 + 0.22 * sp);
          ps.spawn(P.SPARK, x, y + R.range(-2, 2), Math.cos(a) * v, Math.sin(a) * v, R.range(0.15, 0.4));
          if (R.chance(0.4)) ps.spawn(P.MOTE, x, y, Math.cos(a) * v * 0.45, Math.sin(a) * v * 0.45 - 20, R.range(0.2, 0.5), R.chance(0.5) ? C[6] : C[5], 0.7);
        }
        lights.add(x, y, R.range(30, 46), C[5], 0.35, 0.14);
      }
      // the second cut lands: a glint at its end, sparks thrown on along it, shavings off its length
      if (!tipped && t >= CUT + CSW) {
        tipped = true;
        for (let i = 0; i < 12; i++) {
          const a = Math.atan2(uy, ux) + R.range(-0.5, 0.5), v = R.range(150, 400);
          ps.spawn(P.SPARK, B[0] - ux * 2, B[1] - uy * 2, Math.cos(a) * v, Math.sin(a) * v, R.range(0.12, 0.35));
        }
        for (let i = 0; i < 18; i++) {
          const k = R.range(0.1, 1), x = A[0] + (B[0] - A[0]) * k, y = A[1] + (B[1] - A[1]) * k, s = R.sign(), v = R.range(30, 100);
          ps.spawn(P.MOTE, x, y, s * nx * v + ux * 20, s * ny * v - 10, R.range(0.25, 0.55), R.chance(0.5) ? C[5] : C[4], 0.6);
        }
        for (let i = 0; i < 5; i++) lights.add(A[0] + (B[0] - A[0]) * (i + 0.5) / 5, A[1] + (B[1] - A[1]) * (i + 0.5) / 5, 46, C[5], 0.45, 0.3);
      }
      // and the halves break apart: sparks spray out of the opening seam both ways
      if (!split && t >= SPLIT) {
        split = true;
        for (let i = 0; i < 46; i++) {
          const k = R.range(0, 1), x = A[0] + (B[0] - A[0]) * k, y = A[1] + (B[1] - A[1]) * k, s = R.sign(), v = R.range(80, 320);
          const a = Math.atan2(s * ny, s * nx) + R.range(-0.7, 0.7);
          ps.spawn(P.SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, Math.min(R.range(0.15, 0.45), end - t));
        }
        for (let i = 0; i < 6; i++) lights.add(A[0] + (B[0] - A[0]) * (i + 0.5) / 6, A[1] + (B[1] - A[1]) * (i + 0.5) / 6, 56, C[5], 0.5, 0.35);
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p0) {
      const p = clipTo(p0);
      if (t < CUT + CSW + CHOLD + 0.02 || t < SLIP) {
        // the cover behind the blade, row by row: ink, then the smear cooling from the white-hot edge, light ahead
        const e = edgeAt(t), sp = speedAt(t), Ls = clamp(sp * 0.0065, 1.5, 8), echo = clamp(sp / 900) * 0.6;
        for (let y = 0; y < H; y++) {
          const xe = xAt(e, y + 0.5), ia = clamp(Math.floor(xe - (Ls + 10) / CS), 0, W), ib = clamp(Math.ceil(xe + HALO / CS), 0, W);
          if (ia > 0) rect(p0, 0, y, ia, 1, ink);
          for (let x = ia; x < ib; x++) {
            const d = (xe - (x + 0.5)) * CS;
            if (d < 0) {
              const u = 1 + d / HALO;
              p0.light(x, y, C[5], 0.32 * u * u);
              if (d > -4) p0.light(x, y, WHITE, 0.3 * (1 + d / 4) ** 2);
              continue;
            }
            if (d < 1) p0.px(x, y, WHITE);
            else if (d < 2) p0.px(x, y, C[6]);
            else {
              const q = (d - 2) / Ls;
              p0.px(x, y, q < 0.3 ? C[5] : q < 0.55 ? C[4] : q < 0.8 ? C[3] : q < 1 ? C[2] : ink);
              // a dotted trace a beat behind the edge, while it's moving fast
              if (echo > 0 && Math.abs(d - Ls - 7) < 0.5 && (x + y) % 3 === 0) p0.dot(x, y, C[4], echo);
            }
            if (d < Ls + 2) p0.light(x, y, C[5], 0.3 * (1 - d / (Ls + 2)));
          }
        }
      }
      if (t >= SLIP) {
        // the two halves: dark, their cut edges white-hot and cooling to ice; light pours out of the seam
        const heat = 1 - clamp((t - CUT - 0.05) / 0.5);
        for (const hf of halves) {
          const pl = placeOf(hf), pts = hf.pts.map((q) => moved(hf, pl, q)), a = moved(hf, pl, A), b = moved(hf, pl, B);
          // the cut face of this half: white-hot at the edge, cooling and narrowing to an ice rim
          const c = Math.cos(pl.rot), sn = Math.sin(pl.rot), mx = hf.s * (nx * c - ny * sn), my = hf.s * (nx * sn + ny * c);
          const rim = [heat > 0.55 ? WHITE : heat > 0.25 ? C[6] : C[5], heat > 0.4 ? C[6] : C[4], heat > 0.3 ? C[5] : C[3], heat > 0.3 ? C[4] : ink];
          const deep = clamp(1 + pl.sep * 0.5, 1, 4); // the cut face shows more as the halves part
          fillConvex(p0, pts, (x, y) => {
            const d = (x - a[0]) * mx + (y - a[1]) * my;
            if (d < deep) {
              if (d < 2) p0.light(x, y, C[5], 0.4 * heat * (1 - d / 2));
              return rim[Math.max(0, Math.floor(d))];
            }
            return ink;
          });
          if (heat > 0)
            for (let i = 0; i < 8; i++) {
              const k = (i + 0.5) / 8;
              p.glow(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, 12 + pl.sep * 0.15, C[5], 0.3 * heat);
            }
        }
      }
      // the second cut: a smear that rips along the line, thickest just behind its head, white at its core,
      // cooling down the ramp, its tail dissolving; a dotted trace where it's gone; light riding its head
      const u = t - CUT;
      if (u >= 0 && u < CSW + CHOLD + CTRAIL + 0.25) {
        const head = LC * ease.outExpo(clamp(u / CSW)), tail = LC * smooth(CSW + CHOLD, CSW + CHOLD + CTRAIL, u), age = clamp(u / (CSW + CHOLD + CTRAIL));
        const Wc = 3.6 * (1 - (tail / LC) * 0.55), span = head - tail, sn = Math.abs(nx);
        if (span > 1 && tail < LC - 1 && t < SPLIT)
          for (let y = 0; y < H; y++) {
            // the cut crosses row y at x0; the smear spans Wc either side of it, measured square to the cut
            const x0 = A[0] + ((y + 0.5 - A[1]) * ux) / uy, hw = (Wc + 1) / sn;
            for (let x = Math.max(0, Math.floor(x0 - hw)); x < Math.min(W, Math.ceil(x0 + hw)); x++) {
              const px = x + 0.5 - A[0], py = y + 0.5 - A[1], s = px * ux + py * uy, v = (s - tail) / span;
              if (v < 0 || v > 1) continue;
              const w = Wc * Math.pow(Math.sin(Math.PI * Math.pow(v, 2.2)), 0.6);
              if (w < 0.35) continue;
              const q = Math.abs(px * nx + py * ny) / w;
              if (q > 1) continue;
              const ci = q < 0.34 && age < 0.5 ? 0 : Math.round(q * (n - 1) * 0.75 + age * 2.4 - v * 0.8 + 0.4);
              p0.dot(x, y, C[n - 1 - clamp(ci, 0, n - 1)], Math.min(1, v / 0.4));
              if (q < 0.5) p0.light(x, y, C[5], 0.4 * (1 - age));
            }
          }
        // the trace it leaves behind, until the cover parts
        if (tail > 2 && t < SPLIT)
          for (let s = 0; s < tail; s += 1.6) p.dot(A[0] + ux * s, A[1] + uy * s, C[5], 0.7 * (0.4 + (0.6 * s) / LC));
        if (u < 0.3) {
          const hx = A[0] + ux * head, hy = A[1] + uy * head;
          p.glow(hx, hy, 46, C[4], 0.55 * (1 - u / 0.3));
        }
        const g = u - CSW * 0.6;
        if (g > 0 && g < 0.24) sparkle(p, B[0] - ux * 3, B[1] - uy * 3, 11 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), C[6], C[4], 0.7);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// 3D: the cover is a block of ink standing on the stage (a twelve-sided drum). A blade plane sweeps through it on a slant,
// white-hot where it cuts, its smear cooling down the faces behind it, light thrown ahead of it on the floor and sparks
// spraying back; then a second cut flashes through the middle as a sheet of light, and the two halves slip, part, tilt
// and fall away from the cut, its face white-hot and cooling to ice.
const RC3 = 49.7, APO3 = 48, HC3 = 52, SIDES3 = 12;
const BASE3 = Array.from({ length: SIDES3 }, (_, k) => [Math.cos((k * 2 * Math.PI) / SIDES3), 0, Math.sin((k * 2 * Math.PI) / SIDES3), APO3]).concat([[0, -1, 0, HC3], [0, 1, 0, 0]]);
const unit3 = (x, y, z) => {
  const L = Math.hypot(x, y, z);
  return [x / L, y / L, z / L];
};
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const NS3 = unit3(1, SL * 0.8, 0.5), HN3 = Math.hypot(NS3[0], NS3[2]);
const DMIN3 = -RC3 * HN3 - HC3 * NS3[1] - 2, DMAX3 = RC3 * HN3 + 2, LW3 = [-0.45, -0.6, 0.66];
const prog3 = (t) => ease.outCubic(clamp((t - T0) / SWEEP));

export const three = {
  meta: { size: [216, 174], origin: [108, 86], bg: "ground", camera: { pitch: 0.34 } },
  create(o) {
    const C = fit(o.palette, 8), ink = hex(o.color), R = new Rng(o.seed), n = C.length;
    const ps = new Particles({ rng: R, ground: () => 0, sparks: o.sparks }), lights = new Lights();
    // the second cut: a plane through the middle, "\" on the screen, leaning a little in depth
    const th = R.range(0.42, 0.56), N2 = unit3(Math.sin(th), -Math.cos(th), R.range(0.25, 0.45) * R.sign());
    const c2 = [R.range(-8, 8), -HC3 / 2 + R.range(-4, 4), R.range(-6, 6)], d2 = dot3(N2, c2);
    const us = [Math.cos(th), Math.sin(th), 0], k0 = dot3(us, N2), U3 = unit3(us[0] - N2[0] * k0, us[1] - N2[1] * k0, us[2] - N2[2] * k0), L3 = cross3(N2, U3);
    const cap = solid([...BASE3, [...N2, d2]]).find((f) => f.i === BASE3.length).pts;
    let smin = Infinity, smax = -Infinity, lmax = 0, tip = cap[0];
    for (const P3 of cap) {
      const v = [P3[0] - c2[0], P3[1] - c2[1], P3[2] - c2[2]], s = dot3(v, U3);
      if (s < smin) smin = s;
      if (s > smax) (smax = s), (tip = P3);
      lmax = Math.max(lmax, Math.abs(dot3(v, L3)));
    }
    const LC = smax - smin;
    // a random point on the cut sheet, inside the drum
    const onCut = () => {
      for (let k = 0; k < 8; k++) {
        const s = R.range(smin, smax), l = R.range(-lmax, lmax), P3 = [c2[0] + U3[0] * s + L3[0] * l, c2[1] + U3[1] * s + L3[1] * l, c2[2] + U3[2] * s + L3[2] * l];
        if (Math.hypot(P3[0], P3[2]) < RC3 - 2 && P3[1] > -HC3 + 1 && P3[1] < -1) return P3;
      }
      return [c2[0] + U3[0] * smax * 0.5, c2[1] + U3[1] * smax * 0.5, c2[2]];
    };
    const halves = [1, -1].map((s) => ({ s, planes: [...BASE3, [s * N2[0], s * N2[1], s * N2[2], s * d2]], spin: s * R.range(0.5, 0.9) }));
    let t = 0, acc = 0, entered = false, tipped = false, split = false;
    const end = D - 0.05;
    const sweepSpeed = (tt) => (tt < T0 || tt > T0 + SWEEP ? 0 : ((DMAX3 - DMIN3) * 3 * (1 - (tt - T0) / SWEEP) ** 2) / SWEEP);
    // where a half of the cover is: it slips along the cut, then parts, tilts and drops
    const placeOf = (hf) => {
      const slip = 3 * ease.outCubic(clamp((t - SLIP) / 0.12)) * (hf.s > 0 ? 1 : -0.4), u = Math.max(0, t - SPLIT), sep = 12 * u + 90 * u * u, fall = 120 * u * u;
      return { dx: U3[0] * slip - hf.s * N2[0] * sep, dy: U3[1] * slip - hf.s * N2[1] * sep + fall, dz: U3[2] * slip - hf.s * N2[2] * sep, rot: hf.spin * u * u * 1.6, sep };
    };
    return {
      update(dt) {
        t += dt;
        // the blade grinds through: sparks spray back over the cover, light rides the edge
        const sp = sweepSpeed(t), d = DMIN3 + (DMAX3 - DMIN3) * prog3(t);
        if (!entered && t >= T0) {
          entered = true;
          lights.add(-RC3, -HC3 / 2, 34, C[5], 0.6, 0.25, 0);
        }
        for (acc += sp * dt * 0.05; acc > 1; acc--) {
          // a fountain of sparks off one spot where the edge bites
          let P3 = null;
          for (let k = 0; k < 8 && !P3; k++) {
            const y = R.range(-HC3 + 2, -2), z = R.range(-RC3, RC3), x = (d - NS3[1] * y - NS3[2] * z) / NS3[0];
            if (Math.hypot(x, z) < RC3 - 1) P3 = [x, y, z];
          }
          if (!P3) continue;
          const m = R.int(5, 10);
          for (let i = 0; i < m; i++) {
            const v = R.range(0.2, 1) * (60 + 0.08 * sp), a = [-NS3[0] + R.range(-0.7, 0.7), -NS3[1] + R.range(-0.7, 0.2), -NS3[2] + R.range(-0.7, 0.7)], L = Math.hypot(...a);
            ps.spawn3(P.SPARK, P3[0] - 1, P3[1], P3[2], (a[0] / L) * v, (a[1] / L) * v, (a[2] / L) * v, R.range(0.15, 0.4));
            if (R.chance(0.4)) ps.spawn3(P.MOTE, P3[0], P3[1], P3[2], (a[0] / L) * v * 0.45, (a[1] / L) * v * 0.45 - 10, (a[2] / L) * v * 0.45, R.range(0.2, 0.5), R.chance(0.5) ? C[6] : C[5], 0.7);
          }
          lights.add(P3[0], P3[1], R.range(16, 26), C[5], 0.35, 0.14, P3[2]);
        }
        // the second cut lands: a glint at its end, sparks thrown on along it, shavings off its length
        if (!tipped && t >= CUT + CSW) {
          tipped = true;
          for (let i = 0; i < 12; i++) {
            const v = R.range(40, 100), a = [U3[0] + R.range(-0.5, 0.5), U3[1] + R.range(-0.5, 0.5), U3[2] + R.range(-0.5, 0.5)], L = Math.hypot(...a);
            ps.spawn3(P.SPARK, tip[0] + U3[0] * 2, tip[1] + U3[1] * 2, tip[2] + U3[2] * 2, (a[0] / L) * v, (a[1] / L) * v, (a[2] / L) * v, R.range(0.12, 0.35));
          }
          for (let i = 0; i < 18; i++) {
            const P3 = onCut(), s = R.sign(), v = R.range(14, 46);
            ps.spawn3(P.MOTE, P3[0], P3[1], P3[2], s * N2[0] * v + U3[0] * 8, s * N2[1] * v + U3[1] * 8 - 5, s * N2[2] * v + U3[2] * 8, R.range(0.25, 0.55), R.chance(0.5) ? C[5] : C[4], 0.6);
          }
          for (let i = 0; i < 5; i++) {
            const P3 = onCut();
            lights.add(P3[0], P3[1], 28, C[5], 0.45, 0.3, P3[2]);
          }
        }
        // and the halves break apart: sparks spray out of the opening seam both ways
        if (!split && t >= SPLIT) {
          split = true;
          for (let i = 0; i < 46; i++) {
            const P3 = onCut(), s = R.sign(), v = R.range(25, 90), a = [s * N2[0] + R.range(-0.5, 0.5), s * N2[1] + R.range(-0.5, 0.5), s * N2[2] + R.range(-0.5, 0.5)], L = Math.hypot(...a);
            ps.spawn3(P.SPARK, P3[0], P3[1], P3[2], (a[0] / L) * v, (a[1] / L) * v, (a[2] / L) * v, Math.min(R.range(0.15, 0.45), end - t));
          }
          for (let i = 0; i < 6; i++) {
            const P3 = onCut();
            lights.add(P3[0], P3[1], 34, C[5], 0.5, 0.35, P3[2]);
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), tone = (nm) => mix(ink, C[1], clamp(0.7 * dot3(nm, LW3) + 0.2, 0, 0.6));
        if (t < SLIP) {
          // the cover behind the blade: the smear cooling from the white-hot edge down every face, light ahead on the floor
          const pr = prog3(t), d = DMIN3 + (DMAX3 - DMIN3) * pr, sp = sweepSpeed(t), Ls = clamp(sp * 0.0029, 1.2, 5), sweeping = t >= T0 && pr < 1;
          if (t >= T0) {
            const planes = sweeping ? [...BASE3, [...NS3, d]] : BASE3;
            for (const f of solid(planes)) {
              if (sweeping && f.i === BASE3.length) {
                poly(q, f.pts, WHITE);
                outline(q, f.pts, C[6], 1, 0.8);
                let cx = 0, cy = 0, cz = 0;
                for (const v of f.pts) (cx += v[0] / f.pts.length), (cy += v[1] / f.pts.length), (cz += v[2] / f.pts.length);
                q.glow(cx, cy, cz, 26, C[5], 0.5);
                continue;
              }
              const base = tone(f.n);
              poly(q, f.pts, sweeping ? (x, y, z) => {
                const dd = d - (NS3[0] * x + NS3[1] * y + NS3[2] * z);
                if (dd < 0.7) return WHITE;
                if (dd < 1.5) return C[6];
                const k = (dd - 1.5) / Ls;
                return k < 0.3 ? C[5] : k < 0.55 ? C[4] : k < 0.8 ? C[3] : k < 1 ? C[2] : base;
              } : base);
            }
            // light thrown ahead of the blade onto the floor
            if (sweeping)
              q.plane(0, 0, 0, null, 70, (x, z, out) => {
                const dd = d - (NS3[0] * x + NS3[2] * z);
                if (dd > 0 || dd < -18) return;
                out.l = C[5];
                out.k = 0.32 * (1 + dd / 18) ** 2;
              });
          }
        } else {
          // the two halves: dark, their cut faces white-hot and cooling to ice; light pours out of the seam
          const heat = 1 - clamp((t - CUT - 0.05) / 0.7), uS = Math.max(0, t - SPLIT), a = 1 - smooth(0.22, 0.56, uS);
          for (const hf of halves) {
            const pl = placeOf(hf), M = rotAxis(U3[0], U3[1], U3[2], pl.rot), mv = (v) => turnPt(M, c2, v, pl.dx, pl.dy, pl.dz);
            const rim = [heat > 0.55 ? WHITE : heat > 0.25 ? C[6] : C[5], heat > 0.4 ? C[6] : C[4]];
            for (const f of solid(hf.planes)) {
              const pts = f.pts.map(mv);
              if (f.i === BASE3.length) {
                poly(q, pts, rim[0], a);
                outline(q, pts, rim[1], a, 0.8);
                if (heat > 0) {
                  const m = mv([c2[0], c2[1], c2[2]]);
                  q.glow(m[0], m[1], m[2], 12 + pl.sep * 0.15, C[5], 0.3 * heat * a);
                }
              } else poly(q, pts, tone(f.n), a);
            }
          }
        }
        ps.draw(q);
        lights.draw(q);
        // the tip glint where the second cut leaves the drum
        const g = t - CUT - CSW * 0.6;
        if (g > 0 && g < 0.24) glint3(q, tip[0], tip[1], tip[2], 8 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.24), g * 20, C[6], C[4]);
        // the second cut: a sheet of light that rips along the cut plane, white at its core, cooling down the ramp, its tail
        // dissolving, a trace where it has gone; light riding its head. It cuts through the ink, so it is drawn through it.
        const u = t - CUT;
        if (u >= 0 && u < CSW + CHOLD + CTRAIL + 0.25 && t < SPLIT) {
          const head = ease.outExpo(clamp(u / CSW)), tail = smooth(CSW + CHOLD, CSW + CHOLD + CTRAIL, u), age = clamp(u / (CSW + CHOLD + CTRAIL));
          if (head - tail > 0.01 && tail < 0.99)
            poly(q, cap, (x, y, z) => {
              const v3 = [x - c2[0], y - c2[1], z - c2[2]], s = (dot3(v3, U3) - smin) / LC;
              if (s < tail || s > head) return 0;
              const v = (s - tail) / (head - tail), lat = Math.abs(dot3(v3, L3)) / lmax, w = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.7)), 0.6);
              if (lat > w) return 0;
              const qq = lat / w, ci = qq < 0.34 && age < 0.5 ? 0 : Math.round(qq * (n - 1) * 0.75 + age * 2.4 - v * 0.8 + 0.4);
              return C[n - 1 - clamp(ci, 0, n - 1)];
            }, 1, -130);
          // the trace it leaves on the drum's skin, until the cover parts
          if (tail > 0.02) outline(q, cap, C[5], 0.7, 0.8);
          if (u < 0.3) {
            const hs = smin + LC * head;
            q.glow(c2[0] + U3[0] * hs, c2[1] + U3[1] * hs, c2[2] + U3[2] * hs, 30, C[4], 0.55 * (1 - u / 0.3));
          }
        }
      },
    };
  },
};
