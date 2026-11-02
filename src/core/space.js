// Effects that live in 3D. World space is the 2D local space with depth added: x right, y down (the floor is
// y = 0, up is negative y), z towards the viewer at yaw 0, 1 unit = 1 px. A Space projects through a camera into
// the 2D painter and sets the painter's depth (p.z) for every pixel, so nearer things hide what's behind them, a
// 2D character drawn at depth 0 stands inside the effect, and any 2D drawing works as a billboard (at()).
// Seen from yaw 0, pitch 0, a Space draws exactly what the 2D painter would at z = 0.

import { clamp } from "./math.js";
import { hex } from "./color.js";
import { Painter } from "./painter.js";

/** The default camera: front on, a little above (a floor circle reads as an ellipse 0.3 tall), orthographic. */
export const CAMERA = { yaw: 0, pitch: 0.3, dist: Infinity, zoom: 1 };
/** The floor's normal: planes and rings lie on the floor unless told otherwise. */
export const UP = [0, -1, 0];

const OUT = { c: 0, a: 1, l: 0, k: 0, blend: false };
const call = (v, ...args) => (typeof v === "function" ? v(...args) : v);
const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * A camera over a 2D painter. camera: { yaw (radians, the camera orbits right as it grows), pitch (radians,
 * above the floor), dist (px from the origin for perspective, Infinity for orthographic), zoom, at ([x, y, z]:
 * where this effect's origin sits in a bigger scene, so effects inside a move share one space) }.
 * Every drawing call leaves the painter's depth (p.z) as it found it.
 */
export class Space {
  constructor(p, camera = {}) {
    this.p = p;
    this.x = this.y = this.d = 0;
    this.k = 1;
    this.setCamera(camera);
  }

  setCamera(camera = {}) {
    const c = { ...CAMERA, ...camera }, p = this.p;
    this.camera = c;
    this.cy = Math.cos(c.yaw); this.sy = Math.sin(c.yaw); this.cp = Math.cos(c.pitch); this.sp = Math.sin(c.pitch);
    this.dist = c.dist > 0 ? c.dist : Infinity;
    this.zoom = c.zoom;
    [this.ax, this.ay, this.az] = c.at ?? [0, 0, 0];
    if (!p.frame.depth) p.frame.depth = new Float32Array(p.w * p.h).fill(Infinity);
    p.D = p.frame.depth;
    return this;
  }

  // view space of a direction (no offset): [right, down on screen, towards the camera], before perspective
  view(x, y, z) {
    const vz = x * this.sy + z * this.cy;
    return [x * this.cy - z * this.sy, y * this.cp + vz * this.sp, vz * this.cp - y * this.sp];
  }
  // how far a point is towards the camera, from the plane through the scene's origin
  toward(x, y, z) {
    return ((x + this.ax) * this.sy + (z + this.az) * this.cy) * this.cp - (y + this.ay) * this.sp;
  }

  /**
   * Project (x, y, z). Sets this.x, this.y (the 2D painter's local px), this.d (depth: smaller is nearer, 0 on the
   * origin's plane facing the camera) and this.k (px per unit: zoom times perspective). False behind the camera.
   */
  project(x, y, z) {
    x += this.ax; y += this.ay; z += this.az;
    const vz = x * this.sy + z * this.cy, toward = vz * this.cp - y * this.sp;
    let k = this.zoom;
    if (this.dist !== Infinity) {
      const w = this.dist - toward;
      if (w <= 1) return false;
      k *= this.dist / w;
    }
    this.x = (x * this.cy - z * this.sy) * k;
    this.y = (y * this.cp + vz * this.sp) * k;
    this.d = -toward;
    this.k = k;
    return true;
  }
  /** Depth of a point: sort far to near by it (bigger is further). */
  depth(x, y, z) {
    return -this.toward(x, y, z);
  }
  /** Items sorted far to near; pos(item) gives [x, y, z]. Draw translucent things in this order. */
  sort(items, pos) {
    return items
      .map((it) => [this.depth(...pos(it)), it])
      .sort((a, b) => b[0] - a[0])
      .map((e) => e[1]);
  }
  // a segment cut where it passes behind a perspective camera: [x0, y0, z0, x1, y1, z1, u0, u1] or null
  clip(x0, y0, z0, x1, y1, z1) {
    if (this.dist === Infinity) return [x0, y0, z0, x1, y1, z1, 0, 1];
    const lim = this.dist - 2, t0 = this.toward(x0, y0, z0), t1 = this.toward(x1, y1, z1);
    if (t0 > lim && t1 > lim) return null;
    let u0 = 0, u1 = 1;
    if (t0 > lim) u0 = (t0 - lim) / (t0 - t1);
    if (t1 > lim) u1 = (t0 - lim) / (t0 - t1);
    const at = (u) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z0 + (z1 - z0) * u];
    return [...at(u0), ...at(u1), u0, u1];
  }

  // ---- points and lines
  // one pixel at a point's depth, through the 2D painter's own call
  pixel(x, y, z, draw) {
    if (!this.project(x, y, z)) return;
    const p = this.p, z0 = p.z;
    p.z = this.d;
    draw(p, this.x, this.y);
    p.z = z0;
  }
  /** One opaque pixel. */
  px(x, y, z, c) {
    this.pixel(x, y, z, (p, sx, sy) => p.px(sx, sy, c));
  }
  /** One pixel at alpha a, dithered. */
  dot(x, y, z, c, a = 1) {
    this.pixel(x, y, z, (p, sx, sy) => p.dot(sx, sy, c, a));
  }
  /** One translucent pixel. */
  blend(x, y, z, c, a) {
    this.pixel(x, y, z, (p, sx, sy) => p.blend(sx, sy, c, a));
  }
  /** Light on one pixel. */
  light(x, y, z, c, k = 1) {
    this.pixel(x, y, z, (p, sx, sy) => p.light(sx, sy, c, k));
  }
  /** 1 px line with depth along it. c and a may be functions of u (0 at the start, 1 at the end). */
  line(x0, y0, z0, x1, y1, z1, c, a = 1) {
    const s = this.clip(x0, y0, z0, x1, y1, z1);
    if (!s) return;
    const [X0, Y0, Z0, X1, Y1, Z1, u0, u1] = s, p = this.p, z0p = p.z;
    this.project(X0, Y0, Z0);
    const ax = this.x, ay = this.y, w0 = this.dist - this.toward(X0, Y0, Z0);
    this.project(X1, Y1, Z1);
    const w1 = this.dist - this.toward(X1, Y1, Z1), persp = this.dist !== Infinity;
    const n = Math.max(1, Math.ceil(Math.hypot(this.x - ax, this.y - ay) * 1.5)), fc = typeof c === "function", fa = typeof a === "function";
    for (let i = 0; i <= n; i++) {
      // even steps on screen; in perspective, the point along the segment that lands there
      const sc = i / n, f = persp ? (sc * w0) / (sc * w0 + (1 - sc) * w1) : sc, u = u0 + (u1 - u0) * f;
      if (!this.project(X0 + (X1 - X0) * f, Y0 + (Y1 - Y0) * f, Z0 + (Z1 - Z0) * f)) continue;
      p.z = this.d;
      p.dot(this.x, this.y, fc ? c(u) : c, fa ? a(u) : a);
    }
    p.z = z0p;
  }
  /** Lines through points [[x, y, z], ...]. */
  polyline(pts, c, a = 1) {
    for (let i = 1; i < pts.length; i++) this.line(...pts[i - 1], ...pts[i], c, a);
  }

  /**
   * Any 2D drawing as a billboard: fn(p, k) draws with the 2D painter around (0, 0), at the depth of (x, y, z);
   * k is px per unit there (scale sizes by it for perspective). Draw with p only inside fn, not with this Space;
   * set p.z lower inside it to bring a part forward (a highlight on a ball's face).
   */
  at(x, y, z, fn) {
    if (!this.project(x, y, z)) return;
    const p = this.p, tx = p.tx, ty = p.ty, z0 = p.z, k = this.k;
    p.tx = p.toX(this.x, this.y);
    p.ty = p.toY(this.x, this.y);
    p.z = this.d;
    fn(p, k);
    p.tx = tx; p.ty = ty; p.z = z0;
  }

  // ---- volumes
  /**
   * An opaque ball with a depth for every pixel. c and a may be functions of its normal (nx, ny, nz: screen right,
   * screen down, towards the viewer); lit(ramp) shades one from a light at the top left.
   */
  ball(x, y, z, r, c, a = 1) {
    if (!this.project(x, y, z)) return;
    const p = this.p, cx = this.x, cy = this.y, d0 = this.d, R = r * this.k, z0 = p.z;
    if (R < 0.6) {
      p.z = d0 - r;
      p.dot(cx, cy, call(c, 0, 0, 1), call(a, 0, 0, 1));
    } else {
      const fc = typeof c === "function", fa = typeof a === "function";
      p.each(cx - R, cy - R, cx + R, cy + R, (lx, ly, sx, sy) => {
        const nx = (lx - cx) / R, ny = (ly - cy) / R, q = nx * nx + ny * ny;
        if (q > 1) return;
        const nz = Math.sqrt(1 - q);
        p.z = d0 - nz * r;
        p.put(sx, sy, fc ? c(nx, ny, nz) : c, fa ? a(nx, ny, nz) : a);
      });
    }
    p.z = z0;
  }
  /**
   * A translucent puff (smoke, vapour, mist) that thins into whatever is in front of it. c and a may be functions
   * of (d: 0 center to 1 rim, angle), as in the 2D disc.
   */
  disc(x, y, z, r, c, a) {
    if (!this.project(x, y, z)) return;
    const p = this.p, cx = this.x, cy = this.y, d0 = this.d, R = r * this.k, z0 = p.z;
    if (R < 0.5) {
      p.z = d0;
      p.blend(cx, cy, call(c, 0, 0), call(a, 0, 0));
    } else
      p.each(cx - R, cy - R, cx + R, cy + R, (lx, ly, sx, sy) => {
        const dx = lx - cx, dy = ly - cy, q = (dx * dx + dy * dy) / (R * R);
        if (q > 1) return;
        const d = Math.sqrt(q), ang = Math.atan2(dy, dx);
        p.z = d0 - Math.sqrt(1 - q) * r;
        p.blendPx(sx, sy, call(c, d, ang), call(a, d, ang));
      });
    p.z = z0;
  }
  /**
   * A thick segment with round ends, a depth for every pixel. c and a may be functions of (u along, v across:
   * 0 center, 1 edge). Width w is in world units.
   */
  beam(x0, y0, z0, x1, y1, z1, w, c, a = 1) {
    const s = this.clip(x0, y0, z0, x1, y1, z1);
    if (!s) return;
    const [X0, Y0, Z0, X1, Y1, Z1, u0, u1] = s;
    this.project(X0, Y0, Z0);
    const ax = this.x, ay = this.y, ad = this.d, ra = (w / 2) * this.k;
    this.project(X1, Y1, Z1);
    const bx = this.x, by = this.y, bd = this.d, rb = (w / 2) * this.k, r = Math.max(ra, rb), p = this.p, zp = p.z;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9;
    p.each(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (lx, ly, sx, sy) => {
      const f = clamp(((lx - ax) * dx + (ly - ay) * dy) / L2), ex = ax + dx * f - lx, ey = ay + dy * f - ly;
      const rr = ra + (rb - ra) * f, dist = Math.sqrt(ex * ex + ey * ey);
      if (dist > rr || rr <= 0) return;
      const v = dist / rr, u = u0 + (u1 - u0) * f;
      p.z = ad + (bd - ad) * f - Math.sqrt(1 - v * v) * (w / 2);
      p.put(sx, sy, call(c, u, v), call(a, u, v));
    });
    p.z = zp;
  }

  // ---- light
  /**
   * Radial glow at a point. It lights whatever lies within r of it, the floor under it included, and is hidden by
   * anything solid already drawn more than r in front of it: draw solid things first (nearest first), light after.
   */
  glow(x, y, z, r, c, k = 0.5) {
    if (!this.project(x, y, z)) return;
    const p = this.p, z0 = p.z;
    p.z = this.d - r;
    p.glow(this.x, this.y, r * this.k, c, k);
    p.z = z0;
  }
  /** Glow around a segment. */
  glowLine(x0, y0, z0, x1, y1, z1, r, c, k = 0.5) {
    const s = this.clip(x0, y0, z0, x1, y1, z1);
    if (!s) return;
    this.project(s[0], s[1], s[2]);
    const ax = this.x, ay = this.y, ad = this.d, ak = this.k, p = this.p, zp = p.z;
    this.project(s[3], s[4], s[5]);
    p.z = Math.min(ad, this.d) - r;
    p.glowLine(ax, ay, this.x, this.y, r * Math.max(ak, this.k), c, k);
    p.z = zp;
  }

  // ---- shapes on a plane
  /**
   * A pixel shader on a disc of radius R in the plane through (cx, cy, cz) with normal n (default the floor).
   * fn(u, v, out) gets plane coordinates and returns a color, or sets out.c, out.a, out.l, out.k (light) and
   * out.blend (true: translucent instead of dithered). On the floor u is x and v is z; on a plane facing the
   * viewer (n = [0, 0, 1]) u is x and v is y, so 2D shape code ports as it is. bias pushes its depth back, for a
   * backdrop that things lying on it must never sink into.
   */
  plane(cx, cy, cz, n, R, fn, bias = 0) {
    const [e1, e2] = basis(n), V0 = this.view(cx + this.ax, cy + this.ay, cz + this.az), V1 = this.view(...e1), V2 = this.view(...e2);
    const D = this.dist, z = this.zoom, w = (v) => (D === Infinity ? 0 : -v[2] / D);
    // homography from (u, v, 1) to the painter's local px, homogeneous
    const H = [z * V1[0], z * V2[0], z * V0[0], z * V1[1], z * V2[1], z * V0[1], w(V1), w(V2), 1 + w(V0)];
    const det = H[0] * (H[4] * H[8] - H[5] * H[7]) - H[1] * (H[3] * H[8] - H[5] * H[6]) + H[2] * (H[3] * H[7] - H[4] * H[6]);
    if (Math.abs(det) < 1e-6) return; // edge on
    const I = [
      H[4] * H[8] - H[5] * H[7], H[2] * H[7] - H[1] * H[8], H[1] * H[5] - H[2] * H[4],
      H[5] * H[6] - H[3] * H[8], H[0] * H[8] - H[2] * H[6], H[2] * H[3] - H[0] * H[5],
      H[3] * H[7] - H[4] * H[6], H[1] * H[6] - H[0] * H[7], H[0] * H[4] - H[1] * H[3],
    ].map((v) => v / det);
    // its outline on screen; part of it behind a perspective camera: the whole frame, rows checked one by one
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = 0;
    for (let i = 0; i < 24; i++) {
      const g = (i / 24) * Math.PI * 2, s = R / Math.cos(Math.PI / 24), u = Math.cos(g) * s, v = Math.sin(g) * s;
      if (!this.project(cx + e1[0] * u + e2[0] * v, cy + e1[1] * u + e2[1] * v, cz + e1[2] * u + e2[2] * v)) {
        behind++;
        continue;
      }
      x0 = Math.min(x0, this.x); x1 = Math.max(x1, this.x); y0 = Math.min(y0, this.y); y1 = Math.max(y1, this.y);
    }
    const p = this.p, o = OUT, R2 = R * R, near = D - 2, zp = p.z;
    if (behind === 24) return;
    if (behind) (x0 = y0 = -1e5), (x1 = y1 = 1e5);
    p.each(x0 - 1, y0 - 1, x1 + 1, y1 + 1, (lx, ly, sx, sy) => {
      const W = I[6] * lx + I[7] * ly + I[8];
      if (Math.abs(W) < 1e-9) return;
      const u = (I[0] * lx + I[1] * ly + I[2]) / W, v = (I[3] * lx + I[4] * ly + I[5]) / W;
      if (u * u + v * v > R2) return;
      const tw = V0[2] + u * V1[2] + v * V2[2];
      if (tw > near) return;
      o.c = 0; o.a = 1; o.l = 0; o.k = 0; o.blend = false;
      const c = fn(u, v, o) || o.c;
      p.z = bias - tw;
      if (c) o.blend ? p.blendPx(sx, sy, c, o.a) : p.put(sx, sy, c, o.a);
      if (o.k > 0) p.add(sx, sy, o.l || c, o.k);
    });
    p.z = zp;
  }
  /**
   * Any 2D drawing laid flat on a plane (default the floor): draw(p) paints with the 2D painter around (0, 0)
   * inside radius R, as if looking straight at the plane (on the floor: x right, y towards the viewer at yaw 0;
   * facing the viewer, n = [0, 0, 1]: as on screen), and it lands on the plane in perspective, depth and all.
   * A scorch mark, a rune circle, cracks, a puddle, a slash drawn with p.arc: draw it in 2D, lay it down. Thin
   * lines survive the squash: each screen pixel keeps the strongest of the drawing's pixels it covers.
   */
  decal(cx, cy, cz, n, R, draw, bias = 0) {
    const S = Math.ceil(R) * 2 + 2, h = S >> 1, off = scratch(S);
    off.f.color.fill(0);
    off.f.light.fill(0);
    off.p.reset().place(h, h);
    draw(off.p);
    // how far a screen pixel reaches across the drawing: the inverse of the plane's scale on screen at its center
    const [e1, e2] = basis(n), V1 = this.view(...e1), V2 = this.view(...e2);
    const k = this.project(cx, cy, cz) ? this.k : this.zoom;
    const ja = V1[0] * k, jb = V2[0] * k, jc = V1[1] * k, jd = V2[1] * k, det = ja * jd - jb * jc;
    if (Math.abs(det) < 1e-6) return;
    const ax = jd / det, ay = -jc / det, bx = -jb / det, by = ja / det;
    const C = off.f.color, L = off.f.light, SS = [-1 / 3, 0, 1 / 3];
    const at = (u, v) => {
      const x = Math.floor(u + h), y = Math.floor(v + h);
      return x < 0 || y < 0 || x >= S || y >= S ? -1 : y * S + x;
    };
    this.plane(cx, cy, cz, n, R + 1, (u, v, out) => {
      let best = -1, ba = 0, lr = 0, lg = 0, lb = 0;
      for (const s of SS)
        for (const t of SS) {
          const i = at(u + s * ax + t * bx, v + s * ay + t * by);
          if (i < 0) continue;
          const a = C[i] >>> 24, l = L[i];
          if (a > ba) (ba = a), (best = i);
          if (l) (lr = Math.max(lr, l & 255)), (lg = Math.max(lg, (l >>> 8) & 255)), (lb = Math.max(lb, (l >>> 16) & 255));
        }
      if (best >= 0) {
        const c = C[best];
        out.c = ba === 255 ? c : (c & 0xffffff) | 0xff000000;
        out.a = ba / 255;
        out.blend = ba < 255;
      }
      if (lr || lg || lb) (out.l = 0xff000000 | (lb << 16) | (lg << 8) | lr), (out.k = 1);
    }, bias);
  }
  /** A ring from radius r - w to r in a plane (default the floor). c and a may be functions of (v: 0 inner to 1 outer, angle). */
  ring(cx, cy, cz, r, w, c, a = 1, n = UP) {
    const r0 = Math.max(0, r - w);
    this.plane(cx, cy, cz, n, r, (u, v, o) => {
      const d = Math.hypot(u, v);
      if (d < r0) return;
      const t = w > 0 ? (d - r0) / (r - r0 || 1) : 1, g = Math.atan2(v, u);
      o.c = call(c, t, g);
      o.a = call(a, t, g);
    });
  }
  /**
   * A band of a ring from angle a0 to a1 (a1 > a0) in a plane: a slash or a smear in any direction. Angles run from
   * u towards v. c and a may be functions of (u: 0 at a0 to 1 at a1, v: 0 inner to 1 outer); w may taper with u.
   */
  arc(cx, cy, cz, r, w, a0, a1, c, a = 1, n = UP) {
    const span = a1 - a0, wf = typeof w === "function";
    this.plane(cx, cy, cz, n, r, (pu, pv, o) => {
      const d = Math.hypot(pu, pv);
      let g = Math.atan2(pv, pu) - a0;
      g -= Math.floor(g / (Math.PI * 2)) * Math.PI * 2;
      if (g > span) return;
      const u = g / span, ww = wf ? w(u) : w;
      if (ww <= 0 || d < r - ww) return;
      const v = (d - (r - ww)) / ww;
      o.c = call(c, u, v);
      o.a = call(a, u, v);
    });
  }
}

// the plane's own axes (u, v) for a normal: on the floor u is x and v is z, facing the viewer u is x and v is y
function basis(n) {
  const N = norm(n ?? UP), e1 = Math.abs(N[1]) > 0.9 ? norm(cross(cross(N, [1, 0, 0]), N)) : norm(cross(N, [0, -1, 0]));
  return [e1, cross(N, e1)];
}
// one offscreen 2D frame per size, reused, for decals
const scratches = new Map();
function scratch(S) {
  let s = scratches.get(S);
  if (!s) {
    const f = { w: S, h: S, ox: 0, oy: 0, color: new Uint32Array(S * S), light: new Uint32Array(S * S) };
    scratches.set(S, (s = { f, p: new Painter(f) }));
  }
  return s;
}

/** The Space for a painter, with the effect's camera (o.camera over meta.camera over CAMERA). */
export function space(p, o = {}) {
  if (!p.space) p.space = new Space(p);
  return p.space.setCamera(o.camera);
}

/**
 * Shade a ball from a light at the top left and in front: hard ramp steps (dark to bright), the darkest on the rim.
 * Pass it as a ball's color: q.ball(x, y, z, r, lit(C)).
 */
export function lit(ramp, light = [-0.45, -0.6, 0.66]) {
  const R = ramp.map(hex), n = R.length, [lx, ly, lz] = norm(light);
  return (nx, ny, nz) => {
    if (nz < 0.2) return R[0];
    const d = clamp(nx * lx + ny * ly + nz * lz);
    return R[Math.min(n - 1, 1 + Math.floor(d * (n - 1)))];
  };
}

/**
 * The camera that sees an effect from a direction: (dx, up, dz) from the effect to the eye in an engine with y up
 * and the default camera looking down -z (Godot, three.js, Unity with z flipped). Pick the matching view of a
 * multi-view sheet with it, or pass it as o.camera to play an effect live.
 */
export function cameraToward(dx, up, dz) {
  return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(up, Math.hypot(dx, dz)) };
}
