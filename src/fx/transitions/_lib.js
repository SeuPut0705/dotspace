// Shared by the screen transitions: a 320 x 180 screen with its origin at the top-left. Each one covers the
// screen in o.color by about 45% of its duration, holds, then uncovers so the last frame is empty.
// glint() is adapted from Sprite Fusion's open-source sparkle (https://www.spritefusion.com/pixel-art-vfx/sparkle),
// MIT License, Copyright (c) 2026 Hugo Duprez.

import { Painter, clamp, TAU, WHITE } from "../../core/index.js";

export const W = 320, H = 180;

/** The meta every transition shares; pass what differs. */
export function screenMeta({ name, desc, tags, duration, options }) {
  return {
    name, desc, tags: ["transition", "screen", ...tags, "one-shot"],
    size: [W, H], origin: [0, 0], duration, loop: false, fps: 30, bg: "sky",
    options: { color: "#0b0a10", seed: 1, ...options },
  };
}

// a painter that drops every pixel outside the screen
class Clipped extends Painter {
  inside(sx, sy) {
    const lx = this.fromX(sx + 0.5, sy + 0.5), ly = this.fromY(sx + 0.5, sy + 0.5);
    return lx >= 0 && ly >= 0 && lx < W && ly < H;
  }
  put(sx, sy, c, a) {
    if (this.inside(sx, sy)) super.put(sx, sy, c, a);
  }
  add(sx, sy, c, k) {
    if (this.inside(sx, sy)) super.add(sx, sy, c, k);
  }
  blendPx(sx, sy, c, a) {
    if (this.inside(sx, sy)) super.blendPx(sx, sy, c, a);
  }
}
const clips = new WeakMap();

/**
 * The painter, clipped to the screen: sparks, smoke and light that fly past an edge are cut there instead of
 * spilling outside the canvas. Every drawing call goes through it unchanged. (One per painter, kept in step
 * with it, so it stays the same shape of object every frame.)
 */
export function clipTo(p) {
  let q = clips.get(p);
  if (!q) clips.set(p, (q = new Clipped(p.frame)));
  q.reset();
  q.tx = p.tx; q.ty = p.ty; q.fx = p.fx; q.cs = p.cs; q.sn = p.sn;
  q.fade = p.fade; q.lightK = p.lightK; q.layer = p.layer;
  return q;
}

// screen column of local pixel column x, for an unrotated painter: x maps to b + fx * x
const unrotated = (p) => p.sn === 0 && p.cs === 1;
const col0 = (p) => (p.fx > 0 ? Math.floor(p.tx + 0.5) : Math.floor(p.tx - 0.5));

/**
 * p.rect(x, y, w, h, c) for opaque fills, mapping each row to the screen once instead of every pixel (the
 * transitions fill a lot of screen); through p.rect itself when the painter is rotated.
 */
export function rect(p, x, y, w, h, c) {
  if (!unrotated(p)) return p.rect(x, y, w, h, c);
  const X0 = Math.round(x), X1 = Math.round(x + w), Y0 = Math.round(y), Y1 = Math.round(y + h), fx = p.fx, b = col0(p);
  for (let yy = Y0; yy < Y1; yy++) {
    const sy = Math.floor(p.ty + yy + 0.5);
    for (let xx = X0; xx < X1; xx++) p.put(b + fx * xx, sy, c, 1);
  }
}

/**
 * Fill a convex polygon [[x, y], ...] row by row, clipped to the screen. c is a color or fn(x, y) -> color
 * (0 skips the pixel); a is the alpha (dithered).
 */
export function fillConvex(p, pts, c, a = 1) {
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of pts) (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  const r0 = Math.max(0, Math.ceil(y0 - 0.5)), r1 = Math.min(H - 1, Math.floor(y1 - 0.5)), n = pts.length, fc = typeof c === "function";
  for (let y = r0; y <= r1; y++) {
    const yc = y + 0.5;
    let xl = Infinity, xr = -Infinity;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > yc === yj > yc) continue;
      const x = xi + ((yc - yi) * (xj - xi)) / (yj - yi);
      if (x < xl) xl = x;
      if (x > xr) xr = x;
    }
    const c0 = Math.max(0, Math.ceil(xl - 0.5)), c1 = Math.min(W - 1, Math.floor(xr - 0.5));
    if (unrotated(p)) {
      const fx = p.fx, b = col0(p), sy = Math.floor(p.ty + yc);
      for (let x = c0; x <= c1; x++) {
        const col = fc ? c(x + 0.5, yc) : c;
        if (col) p.put(b + fx * x, sy, col, a);
      }
    } else
      for (let x = c0; x <= c1; x++) {
        const col = fc ? c(x + 0.5, yc) : c;
        if (col) p.dot(x, y, col, a);
      }
  }
}

/** The part of polygon pts on the side of the line through (cx, cy) that normal (nx, ny) points to. */
export function halfPlane(pts, cx, cy, nx, ny) {
  const out = [], side = ([x, y]) => (x - cx) * nx + (y - cy) * ny;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const k = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
}

/**
 * A scalar field over the screen from fn(x, y) (pixel centers), plus g: one over its gradient's length, so
 * (k - f[i]) * g[i] is roughly the distance in pixels from pixel i to the level set f = k. Returns
 * { f, g, ny, lo, hi, order }: ny is the gradient's vertical share (-1 rising upward .. 1 downward), order
 * lists the pixels from the lowest value to the highest.
 */
export function field(fn, gmin = 0.45, gmax = 3) {
  const f = new Float32Array(W * H), g = new Float32Array(W * H), ny = new Float32Array(W * H);
  let lo = Infinity, hi = -Infinity;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = fn(x + 0.5, y + 0.5);
      f[y * W + x] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - 1), xb = Math.min(W - 1, x + 1), ya = Math.max(0, y - 1), yb = Math.min(H - 1, y + 1);
      const gx = (f[y * W + xb] - f[y * W + xa]) / (xb - xa), gy = (f[yb * W + x] - f[ya * W + x]) / (yb - ya);
      const L = Math.hypot(gx, gy);
      g[y * W + x] = 1 / clamp(L, gmin, gmax);
      ny[y * W + x] = L > 1e-6 ? gy / L : 0;
    }
  const order = Uint32Array.from({ length: W * H }, (_, i) => i).sort((a, b) => f[a] - f[b]);
  const sorted = Float32Array.from(order, (i) => f[i]);
  // the slice of `order` whose values are below v: pixels f < v are order[0 .. below(v))
  const below = (v) => {
    let a = 0, b = sorted.length;
    while (a < b) {
      const m = (a + b) >> 1;
      if (sorted[m] < v) a = m + 1;
      else b = m;
    }
    return a;
  };
  return { f, g, ny, lo, hi, order, below };
}

/**
 * Write whole screen pixels by index fast: at(i) picks pixel i = y * W + x, then put(c, a), add(c, k) and
 * blend(c, a) write it. Straight to the frame when the painter is unrotated (the usual case), else through it.
 */
export function pixels(p) {
  let sx = 0, sy = 0, i0 = 0;
  if (p.sn === 0 && p.cs === 1) {
    const tx = p.tx, ty = p.ty, fx = p.fx;
    return {
      at(i) {
        sx = Math.floor(tx + ((i % W) + 0.5) * fx);
        sy = Math.floor(ty + ((i / W) | 0) + 0.5);
      },
      put: (c, a = 1) => p.put(sx, sy, c, a),
      add: (c, k) => p.add(sx, sy, c, k),
      blend: (c, a) => p.blendPx(sx, sy, c, a),
    };
  }
  const x = () => (i0 % W) + 0.5, y = () => ((i0 / W) | 0) + 0.5;
  return {
    at(i) {
      i0 = i;
    },
    put: (c, a = 1) => p.dot(x(), y(), c, a),
    add: (c, k) => p.light(x(), y(), c, k),
    blend: (c, a) => p.blend(x(), y(), c, a),
  };
}

/**
 * A spinning 8-ray glint at (x, y): long rays white at the heart, c1 in the middle and c2 at the tips, short
 * diagonals, the long rays thickened near the heart, and two lights. ang spins it; a fades it (dithered).
 */
export function glint(p, x, y, L, ang, c1, c2, a = 1) {
  if (L < 0.8 || a <= 0) return;
  for (let i = 0; i < 8; i++) {
    const diag = i % 2 === 1, an = ang + (i * TAU) / 8, len = diag ? L * 0.42 : L, ca = Math.cos(an), sa = Math.sin(an);
    for (let d = 0; d <= len; d += 0.5) {
      const u = d / len, c = diag ? (u < 0.5 ? c1 : c2) : u < 0.3 ? WHITE : u < 0.65 ? c1 : c2;
      p.dot(x + ca * d, y + sa * d, c, a * (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35));
      if (!diag && u < 0.22 && L > 4) p.dot(x + ca * d - sa, y + sa * d + ca, c1, a), p.dot(x + ca * d + sa, y + sa * d - ca, c1, a);
    }
  }
  p.dot(x, y, WHITE, a);
  p.glow(x, y, 4 + L * 1.4, c1, 0.5 * a);
  p.glow(x, y, 2 + L * 0.5, WHITE, 0.4 * a);
}

/** Particle lives cut so nothing outlives the effect: the smaller of life and what's left before `end`. */
export const lifeLeft = (life, t, end) => Math.min(life, end - t);

// ---- the 3D variants ------------------------------------------------------------------------------------------
// The Space has balls, beams, rings and planes but no filled polygon. The 3D transitions are made of slabs, slats,
// shards and gems, so a convex face with a depth for every pixel lives here, with the little geometry it needs.

const SX = new Float64Array(64), SY = new Float64Array(64), SD = new Float64Array(64);
const WX = new Float64Array(64), WY = new Float64Array(64), WZ = new Float64Array(64);

function fillTri(p, b, c2, col, fc, a, bias) {
  const x0 = SX[0], y0 = SY[0], x1 = SX[b], y1 = SY[b], x2 = SX[c2], y2 = SY[c2];
  const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(det) < 1e-6) return;
  const k = 1 / det, d0 = SD[0], d1 = SD[b], d2 = SD[c2];
  p.each(Math.min(x0, x1, x2), Math.min(y0, y1, y2), Math.max(x0, x1, x2), Math.max(y0, y1, y2), (lx, ly, sx, sy) => {
    const l0 = ((y1 - y2) * (lx - x2) + (x2 - x1) * (ly - y2)) * k, l1 = ((y2 - y0) * (lx - x2) + (x0 - x2) * (ly - y2)) * k, l2 = 1 - l0 - l1;
    if (l0 < -0.002 || l1 < -0.002 || l2 < -0.002) return;
    p.z = l0 * d0 + l1 * d1 + l2 * d2 + bias;
    let c = col;
    if (fc) {
      c = col(l0 * WX[0] + l1 * WX[b] + l2 * WX[c2], l0 * WY[0] + l1 * WY[b] + l2 * WY[c2], l0 * WZ[0] + l1 * WZ[b] + l2 * WZ[c2]);
      if (!c) return;
    }
    p.put(sx, sy, c, a);
  });
}

/**
 * A convex polygon in world space, [[x, y, z], ...], with a depth for every pixel. c is a color or fn(x, y, z) of the
 * point on the face (0 skips it); a is the alpha (dithered); bias pushes its depth back, so what is laid on it wins.
 * A face seen all but edge-on shrinks to its outline, so a thin slab never drops out of a view.
 */
export function poly(q, pts, c, a = 1, bias = 0) {
  const n = Math.min(pts.length, 63), fc = typeof c === "function";
  if (n < 3) return;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const v = pts[i];
    if (!q.project(v[0], v[1], v[2])) return;
    SX[i] = q.x; SY[i] = q.y; SD[i] = q.d; WX[i] = v[0]; WY[i] = v[1]; WZ[i] = v[2];
  }
  for (let i = 0, j = n - 1; i < n; j = i++) area += SX[j] * SY[i] - SX[i] * SY[j];
  if (Math.abs(area) < 2.5) {
    const col = fc ? c(WX[0], WY[0], WZ[0]) : c;
    if (col) outline(q, pts, col, a, 0.5 - bias);
    return;
  }
  const p = q.p, z0 = p.z;
  for (let i = 1; i < n - 1; i++) fillTri(p, i, i + 1, c, fc, a, bias);
  p.z = z0;
}

/** A 1 px line from A to B with a depth along it, nearer by `front` so it sits on the faces it runs along. c, a may be fn(u). */
export function edge(q, A, B, c, a = 1, front = 0.6) {
  if (!q.project(A[0], A[1], A[2])) return;
  const ax = q.x, ay = q.y, ad = q.d;
  if (!q.project(B[0], B[1], B[2])) return;
  const bx = q.x, by = q.y, bd = q.d, p = q.p, z0 = p.z, N = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
  const fc = typeof c === "function", fa = typeof a === "function";
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    p.z = ad + (bd - ad) * u - front;
    p.dot(ax + (bx - ax) * u, ay + (by - ay) * u, fc ? c(u) : c, fa ? a(u) : a);
  }
  p.z = z0;
}

/** The outline of a polygon (closed unless told otherwise) as edges. */
export function outline(q, pts, c, a = 1, front = 0.6, closed = true) {
  for (let i = closed ? 0 : 1; i < pts.length; i++) edge(q, pts[closed ? (i + pts.length - 1) % pts.length : i - 1], pts[i], c, a, front);
}

/** The part of a 3D polygon on the side of the plane n . x = d that n points away from (n . x <= d). */
export function clipPoly(pts, n, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length];
    const sa = n[0] * A[0] + n[1] * A[1] + n[2] * A[2] - d, sb = n[0] * B[0] + n[1] * B[1] + n[2] * B[2] - d;
    if (sa <= 0) out.push(A);
    if (sa <= 0 !== sb <= 0) {
      const k = sa / (sa - sb);
      out.push([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
    }
  }
  return out;
}

/** The faces [{pts, n}] of the convex solid {x : n . x <= d for every [nx, ny, nz, d]} (unit normals). */
export function solid(planes) {
  const faces = [], BIG = 700;
  planes.forEach(([nx, ny, nz, d], i) => {
    // a big square lying on this plane, cut down by every other plane
    const up = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [ny * up[2] - nz * up[1], nz * up[0] - nx * up[2], nx * up[1] - ny * up[0]];
    const L = Math.hypot(...e1);
    e1 = e1.map((v) => (v / L) * BIG);
    const e2 = [ny * e1[2] - nz * e1[1], nz * e1[0] - nx * e1[2], nx * e1[1] - ny * e1[0]], c = [nx * d, ny * d, nz * d];
    let pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [c[0] + e1[0] * s + e2[0] * t, c[1] + e1[1] * s + e2[1] * t, c[2] + e1[2] * s + e2[2] * t]);
    for (let j = 0; j < planes.length && pts.length; j++) if (j !== i) pts = clipPoly(pts, planes[j], planes[j][3]);
    if (pts.length >= 3) faces.push({ pts, n: [nx, ny, nz], i });
  });
  return faces;
}

/** A rotation matrix (row major, 9 numbers) of ang about the axis (ax, ay, az). */
export function rotAxis(ax, ay, az, ang) {
  const L = Math.hypot(ax, ay, az) || 1, x = ax / L, y = ay / L, z = az / L, c = Math.cos(ang), s = Math.sin(ang), k = 1 - c;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
}
/** Point v turned by M about c, then moved by (dx, dy, dz). */
export function turnPt(M, c, v, dx = 0, dy = 0, dz = 0) {
  const x = v[0] - c[0], y = v[1] - c[1], z = v[2] - c[2];
  return [c[0] + M[0] * x + M[1] * y + M[2] * z + dx, c[1] + M[3] * x + M[4] * y + M[5] * z + dy, c[2] + M[6] * x + M[7] * y + M[8] * z + dz];
}

/** glint() as a billboard at a point in space, brought a little forward so it is never cut by what it sits on. */
export function glint3(q, x, y, z, L, ang, c1, c2, a = 1) {
  if (L < 0.8 || a <= 0) return;
  q.at(x, y, z, (pp, k) => {
    pp.z -= 3 + L * 0.4;
    glint(pp, 0, 0, L * k, ang, c1, c2, a);
  });
}
