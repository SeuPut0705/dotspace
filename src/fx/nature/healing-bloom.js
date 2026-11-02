// The healing light (a soft column of glow, a lit ring on the floor, motes and bevelled crosses drifting up and
// glinting) is adapted from Sprite Fusion's open-source heal (https://www.spritefusion.com/pixel-art-vfx/heal),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, space, sparkle, band, clamp, smooth, ease, lerp, TAU, WHITE } from "../../core/index.js";
import { drawLeaf, tube, shade3, leaf3, ellipsoid } from "./_lib.js";

export const meta = {
  name: "Healing bloom",
  desc: "A sprout pushes up and unfurls, a bud swells and opens round a glowing golden heart in a flare of healing light; its petals lift away one by one as motes.",
  tags: ["nature", "heal", "flower", "plant", "buff", "ground", "one-shot"],
  size: [124, 120],
  origin: [62, 108],
  duration: 3.3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0c1a10", "#173a1a", "#24582a", "#357a34", "#52a03e", "#86c84e", "#c4ec7a", "#f4ffd0"],
    petal: ["#4a1a3a", "#a8406e", "#ec8ab0", "#ffd8e8"],
    heart: ["#a8641a", "#f0b42e", "#ffe680", "#fffbe0"],
    seed: 4,
  },
};

const STEM = 0.42, BUD = 0.75, OPEN = 1.05, LIFT = 1.7, WILT = 2.4, H = 36, NPET = 6;

// a bevelled cross of light
function cross(p, x, y, L, C, a, glint) {
  const X = Math.round(x), Y = Math.round(y), ins = (dx, dy) => (dx === 0 && Math.abs(dy) <= L) || (dy === 0 && Math.abs(dx) <= L);
  for (let dy = -L - 1; dy <= L + 1; dy++)
    for (let dx = -L - 1; dx <= L + 1; dx++) {
      if (ins(dx, dy)) p.dot(X + dx, Y + dy, glint && !dx && !dy ? WHITE : dy < 0 || dx < 0 ? C[6] : C[5], a);
      else if (L > 1 && (ins(dx - 1, dy) || ins(dx + 1, dy) || ins(dx, dy - 1) || ins(dx, dy + 1))) p.dot(X + dx, Y + dy, C[2], a * 0.8);
    }
  p.glow(x, y, 5 + L * 2, C[6], 0.35 * a);
}

export function create(o) {
  const C = fit(o.palette, 8), Pt = fit(o.petal, 4), Ht = fit(o.heart, 4), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [Ht[3], Ht[2], Ht[1], Ht[0]] });
  const lights = new Lights(), flying = [], glyphs = [];
  const petals = Array.from({ length: NPET }, (_, i) => ({ az: (i / NPET) * TAU + 0.3, off: (i * 0.7) % 1, gone: false, at: LIFT + ((i * 0.37) % 1) * 0.55 }));
  let t = 0, popped = false, sprouted = false;
  const grow = () => ease.outCubic(clamp(t / STEM)) * (1 - ease.inCubic(clamp((t - WILT) / 0.6)));
  const sway = () => Math.sin(t * 2.6) * 1.4 * smooth(0.2, 0.6, t);
  // the stem's points, base to tip: a gentle S that sways
  const stem = () => {
    const g = grow(), pts = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      pts.push([Math.sin(s * 3.2) * 2.2 * s + sway() * s * s, (1 - g) * H * 1.1 - s * H]);
    }
    return pts;
  };
  const open = () => ease.outBack(clamp((t - BUD) / (OPEN - BUD)), 1.4);
  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120), top = stem()[12];
      if (!sprouted) {
        sprouted = true;
        for (let i = 0; i < 8; i++) ps.spawn(P.GRIT, R.range(-3, 3), -1, R.range(-40, 40), -R.range(40, 100), R.range(0.5, 0.8), R.pick([C[2], C[3]]), 1);
        for (let i = 0; i < 3; i++) ps.spawn(P.DUST, R.range(-3, 3), -1, R.sign() * R.range(10, 30), -R.range(4, 10), R.range(0.4, 0.6), C[3], R.range(1.5, 2.5));
      }
      // the bud draws light in as it swells
      if (t > STEM && t < BUD && R.chance(0.3 * f)) {
        const a = R.range(0, TAU), d = R.range(14, 26), x = top[0] + Math.cos(a) * d, y = top[1] - 3 + Math.sin(a) * d * 0.8;
        ps.spawn(P.STREAK, x, y, (top[0] - x) * 3.4, (top[1] - 3 - y) * 3.4, R.range(0.18, 0.26), R.chance(0.5) ? Ht[2] : C[6]);
      }
      if (!popped && t >= OPEN - 0.12) {
        popped = true;
        lights.add(top[0], top[1] - 3, 22, WHITE, 0.45, 0.08);
        lights.add(top[0], top[1] - 3, 70, Ht[2], 0.5, 0.8);
        for (let i = 0; i < 16; i++) {
          const a = R.range(0, TAU), sp = R.range(40, 120);
          ps.spawn(P.MOTE, top[0], top[1] - 3, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.4, 0.8), R.chance(0.5) ? Ht[3] : C[7], 0.7);
        }
        for (let i = 0; i < 5; i++) ps.spawn(P.STAR, top[0] + R.range(-10, 10), top[1] - R.range(0, 14), 0, -6, R.range(0.3, 0.6), Ht[3], R.range(1, 2.4), R.range(0, 0.3));
      }
      // while it blooms: crosses and motes of light drift up round it
      if (t > OPEN && t < WILT && R.chance(0.13 * f)) glyphs.push({ x: R.range(-22, 22), y: -R.range(2, 36), t0: t, life: Math.min(R.range(0.7, 1.1), meta.duration - 0.05 - t), L: R.chance(0.35) ? 3 : 2, seed: R.next() * 9 });
      if (t > OPEN - 0.1 && t < WILT && R.chance(0.35 * f)) ps.spawn(P.EMBER, R.range(-20, 20), -R.range(0, 8), R.range(-6, 6), -R.range(25, 55), Math.min(R.range(0.6, 1.1), meta.duration - 0.05 - t), R.chance(0.6) ? C[6] : Ht[2], R.chance(0.3) ? 2 : 1);
      for (let i = glyphs.length - 1; i >= 0; i--) if (t - glyphs[i].t0 > glyphs[i].life) glyphs.splice(i, 1);
      // petals let go one by one and lift away, turning, until they twinkle out
      for (const q of petals)
        if (!q.gone && t >= q.at) {
          q.gone = true;
          const e = Math.PI / 2 - 0.15, dx = Math.sin(e) * Math.cos(q.az), L = 10;
          flying.push({ x: top[0] + dx * L * 0.6, y: top[1] - 3 - Math.cos(e) * L * 0.6, vx: dx * 30 + R.range(-10, 10), vy: -R.range(25, 45), a: Math.atan2(-Math.cos(e), dx), va: R.range(-5, 5), fl: 0, vf: R.range(5, 9), life: Math.min(R.range(0.75, 1.0), meta.duration - 0.45 - t), max: 0 });
          flying[flying.length - 1].max = flying[flying.length - 1].life;
        }
      for (let i = flying.length - 1; i >= 0; i--) {
        const q = flying[i];
        if ((q.life -= dt) <= 0) {
          ps.spawn(P.STAR, q.x, q.y, 0, -8, Math.min(0.35, meta.duration - 0.05 - t), Pt[3], 1.8);
          flying.splice(i, 1);
          continue;
        }
        q.vx -= q.vx * 1.5 * dt;
        q.vy -= q.vy * 0.8 * dt + 10 * dt;
        q.x += q.vx * dt + Math.sin(q.fl) * 12 * dt;
        q.y += q.vy * dt;
        q.a += q.va * dt;
        q.fl += q.vf * dt;
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const bloom = smooth(OPEN - 0.15, OPEN + 0.2, t) * (1 - smooth(WILT - 0.2, WILT + 0.5, t)), top = stem()[12];
      // a column of soft healing light, and a lit ring on the floor that blooms out as it opens
      for (let h = 0; h < 70; h += 7) p.glow(0, -h, 22, C[5], 0.12 * bloom * (1 - h / 80));
      const k = clamp((t - OPEN + 0.12) / 0.6);
      if (k > 0 && k < 1) band(p, 0, 0.5, 6 + 30 * ease.outCubic(k), 0.18, Math.max(1, 3 * (1 - k)), 1.1 - k, [C[3], C[5], Ht[2], Ht[3]], (g) => Math.sin(g) < 0);
      const fw = 6 + 16 * smooth(0, 0.8, t);
      for (let x = Math.floor(-fw); x <= fw; x++) {
        const u = Math.abs(x) / fw, a = Math.sqrt(1 - u) * smooth(0, 0.4, t) * (1 - smooth(WILT, WILT + 0.6, t));
        p.dot(x, 0, u < 0.3 ? C[6] : u < 0.65 ? C[5] : C[4], a);
        if ((x % 5) === 0) p.glow(x, 0, 8, C[5], 0.2 * a * (1 - u));
      }
      // the far petals sit behind the heart
      if (t > BUD - 0.05) for (const q of petals) if (Math.sin(q.az) < 0 && !q.gone) petal(p, q, top);
      ps.draw(p, "back");
    },
    draw(p) {
      const pts = stem(), top = pts[12], g = grow();
      if (g > 0.02) {
        // the stem: a 2 px shoot, lit down its left side
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          if (y1 > 0) continue;
          p.line(x0, y0, x1, y1, C[5]);
          p.line(x0 + 1, y0, x1 + 1, y1, C[3]);
        }
        // leaves unfurl off it
        for (const [i, sd, d] of [[4, -1, 0.1], [7, 1, 0.22]]) {
          const lk = ease.outBack(clamp((t - d - 0.12) / 0.3), 1.6) * (1 - smooth(WILT, WILT + 0.5, t) * 0.4), [x, y] = pts[i];
          if (lk <= 0 || y > -1) continue;
          const la = sd < 0 ? -2.6 + 0.4 * (1 - lk) : -0.55 - 0.4 * (1 - lk);
          drawLeaf(p, x + Math.cos(la) * 6 * lk, y + Math.sin(la) * 6 * lk, 12 * lk, 3.4, la, 0.25, [C[1], C[3], C[5], C[6]]);
        }
        // the bud, then the heart once it opens
        if (t > STEM - 0.1 && t < OPEN - 0.1) {
          const b = clamp((t - STEM + 0.1) / (BUD - STEM)), w = 2 + 2.5 * b, h = 3.5 + 5 * b;
          p.ellipse(top[0], top[1] - h * 0.6, w, h, (d, a) => (Math.cos(a) < -0.2 ? Pt[2] : d > 0.7 ? Pt[0] : Pt[1]));
          p.glow(top[0], top[1] - h * 0.6, 8 + 8 * b, Ht[2], 0.25 * b);
        }
      }
      for (const q of petals) if (Math.sin(q.az) >= 0 && !q.gone && t > BUD - 0.05) petal(p, q, top);
      if (t > OPEN - 0.12 && t < WILT + 0.3) {
        const pulse = 0.85 + 0.15 * Math.sin(t * 9), k = 1 - smooth(WILT - 0.3, WILT + 0.3, t), cy = top[1] - 4;
        p.circle(top[0], cy, 3.3 * k, Ht[1]);
        p.circle(top[0] - 0.5, cy - 0.5, 2.2 * k, Ht[2]);
        p.px(top[0] - 1, cy - 1, Ht[3]);
        p.glow(top[0], cy, 16 * pulse, Ht[2], 0.5 * k);
        p.glow(top[0], cy, 34, C[5], 0.2 * k);
      }
      const e = t - OPEN + 0.12;
      if (e > 0 && e < 0.16) sparkle(p, top[0], top[1] - 3, 10 * (1 - e / 0.16), Ht[3], Ht[2], 0.6);
      for (const q of flying) drawLeaf(p, q.x, q.y, 6, 2.2, q.a, q.fl, [Pt[0], Pt[1], Pt[2], Pt[3]], Math.min(1, q.life / 0.3));
      for (const q of glyphs) {
        const k = (t - q.t0) / q.life;
        cross(p, q.x + Math.sin(k * 5 + q.seed) * 2, q.y - k * 24, q.L, C, Math.sin(Math.PI * k), Math.sin(k * 14 + q.seed) > 0.8);
      }
      ps.draw(p, "front");
      lights.draw(p);
    },
  };

  // a petal: from closed round the bud to splayed open round the heart, foreshortened by where it points
  function petal(p, q, top) {
    const op = open(), e = lerp(0.15, Math.PI / 2 - 0.2, op), dx = Math.sin(e) * Math.cos(q.az), dz = Math.sin(e) * Math.sin(q.az), dy = -Math.cos(e);
    const L = lerp(8, 12, op), len = L * Math.hypot(dx, dy), ang = Math.atan2(dy, dx), back = dz < 0, cy = top[1] - 3;
    if (len < 1.5) return;
    drawLeaf(p, top[0] + dx * L * 0.5, cy + dy * L * 0.5, len + 1, 3 + (1 - Math.abs(dz)) * 0.8, ang, back ? 0.9 : 0.2, back ? [Pt[0], Pt[0], Pt[1], Pt[2]] : [Pt[0], Pt[1], Pt[2], Pt[3]]);
  }
}

// ---- 3D: a stem that curves through space, leaves unfurling off it to either side, a bud that opens into a ring of
// petals laid out round the golden heart (a real flower seen from above, the side and below), crosses of light and
// motes drifting up all round, a true ring of light spreading across the floor.
export const three = {
  meta: { size: [136, 128], origin: [68, 112], camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), Pt = fit(o.petal, 4), Ht = fit(o.heart, 4), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [Ht[3], Ht[2], Ht[1], Ht[0]] });
    const lights = new Lights(), flying = [], glyphs = [];
    const petals = Array.from({ length: NPET }, (_, i) => ({ az: (i / NPET) * TAU + 0.3, gone: false, at: LIFT + ((i * 0.37) % 1) * 0.55 }));
    let t = 0, popped = false, sprouted = false;
    const grow = () => ease.outCubic(clamp(t / STEM)) * (1 - ease.inCubic(clamp((t - WILT) / 0.6)));
    const sway = () => Math.sin(t * 2.6) * 1.4 * smooth(0.2, 0.6, t);
    // the stem's points, base to tip: a gentle S that sways, and leans out of the plane
    const stem = () => {
      const g = grow(), pts = [];
      for (let i = 0; i <= 12; i++) {
        const s = i / 12;
        pts.push([Math.sin(s * 3.2) * 2.2 * s + sway() * s * s, (1 - g) * H * 1.1 - s * H, Math.sin(s * 2.4 + 0.8) * 2 * s + Math.cos(t * 2.1) * 0.8 * s * s]);
      }
      return pts;
    };
    const open = () => ease.outBack(clamp((t - BUD) / (OPEN - BUD)), 1.4);
    const dir = (cone) => {
      const e = R.range(0, cone), h = R.range(0, TAU);
      return [Math.sin(e) * Math.cos(h), -Math.cos(e), Math.sin(e) * Math.sin(h)];
    };
    return {
      update(dt) {
        t += dt;
        const f = Math.min(1, dt * 120), top = stem()[12];
        if (!sprouted) {
          sprouted = true;
          for (let i = 0; i < 8; i++) ps.spawn3(P.GRIT, R.range(-3, 3), -1, R.range(-3, 3), R.range(-40, 40), -R.range(40, 100), R.range(-40, 40), R.range(0.5, 0.8), R.pick([C[2], C[3]]), 1);
          for (let i = 0; i < 3; i++) {
            const a = R.range(0, TAU), v = R.range(10, 30);
            ps.spawn3(P.DUST, R.range(-3, 3), -1, R.range(-3, 3), Math.cos(a) * v, -R.range(4, 10), Math.sin(a) * v, R.range(0.4, 0.6), C[3], R.range(1.5, 2.5));
          }
        }
        // the bud draws light in as it swells, from every side
        if (t > STEM && t < BUD && R.chance(0.3 * f)) {
          const a = R.range(0, TAU), el = R.range(-0.3, 0.8), d = R.range(14, 26), x = top[0] + Math.cos(a) * Math.cos(el) * d, y = top[1] - 3 + Math.sin(el) * d * 0.8, z = top[2] + Math.sin(a) * Math.cos(el) * d;
          ps.spawn3(P.STREAK, x, y, z, (top[0] - x) * 3.4, (top[1] - 3 - y) * 3.4, (top[2] - z) * 3.4, R.range(0.18, 0.26), R.chance(0.5) ? Ht[2] : C[6]);
        }
        if (!popped && t >= OPEN - 0.12) {
          popped = true;
          lights.add(top[0], top[1] - 3, 22, WHITE, 0.45, 0.08, top[2]);
          lights.add(top[0], top[1] - 3, 70, Ht[2], 0.5, 0.8, top[2]);
          for (let i = 0; i < 18; i++) {
            const d = dir(2.4), sp = R.range(40, 120);
            ps.spawn3(P.MOTE, top[0], top[1] - 3, top[2], d[0] * sp, d[1] * sp * 0.6 - 10, d[2] * sp, R.range(0.4, 0.8), R.chance(0.5) ? Ht[3] : C[7], 0.7);
          }
          for (let i = 0; i < 5; i++) {
            const a = R.range(0, TAU), r = R.range(0, 10);
            ps.spawn3(P.STAR, top[0] + Math.cos(a) * r, top[1] - R.range(0, 14), top[2] + Math.sin(a) * r, 0, -6, 0, R.range(0.3, 0.6), Ht[3], R.range(1, 2.4), R.range(0, 0.3));
          }
        }
        // while it blooms: crosses and motes of light drift up round it
        if (t > OPEN && t < WILT && R.chance(0.15 * f)) glyphs.push({ a: R.range(0, TAU), r: R.range(4, 24), y: -R.range(2, 36), t0: t, life: Math.min(R.range(0.7, 1.1), meta.duration - 0.05 - t), L: R.chance(0.35) ? 3 : 2, seed: R.next() * 9 });
        if (t > OPEN - 0.1 && t < WILT && R.chance(0.35 * f)) {
          const a = R.range(0, TAU), r = R.range(0, 22);
          ps.spawn3(P.EMBER, Math.cos(a) * r, -R.range(0, 8), Math.sin(a) * r, R.range(-6, 6), -R.range(25, 55), R.range(-6, 6), Math.min(R.range(0.6, 1.1), meta.duration - 0.05 - t), R.chance(0.6) ? C[6] : Ht[2], R.chance(0.3) ? 2 : 1);
        }
        for (let i = glyphs.length - 1; i >= 0; i--) if (t - glyphs[i].t0 > glyphs[i].life) glyphs.splice(i, 1);
        // petals let go one by one and lift away, turning, until they twinkle out
        for (const q of petals)
          if (!q.gone && t >= q.at) {
            q.gone = true;
            const e = Math.PI / 2 - 0.15, L = 10, dx = Math.sin(e) * Math.cos(q.az), dz = Math.sin(e) * Math.sin(q.az);
            const life = Math.min(R.range(0.75, 1.0), meta.duration - 0.45 - t);
            flying.push({ x: top[0] + dx * L * 0.6, y: top[1] - 3 - Math.cos(e) * L * 0.6, z: top[2] + dz * L * 0.6, vx: dx * 30 + R.range(-10, 10), vy: -R.range(25, 45), vz: dz * 30 + R.range(-10, 10), a: Math.atan2(-Math.cos(e), dx), va: R.range(-5, 5), fl: 0, vf: R.range(5, 9), b: q.az, life, max: life });
          }
        for (let i = flying.length - 1; i >= 0; i--) {
          const q = flying[i];
          if ((q.life -= dt) <= 0) {
            ps.spawn3(P.STAR, q.x, q.y, q.z, 0, -8, 0, Math.min(0.35, meta.duration - 0.05 - t), Pt[3], 1.8);
            flying.splice(i, 1);
            continue;
          }
          q.vx -= q.vx * 1.5 * dt;
          q.vz -= q.vz * 1.5 * dt;
          q.vy -= q.vy * 0.8 * dt + 10 * dt;
          q.x += q.vx * dt + Math.sin(q.fl) * 12 * dt * Math.cos(q.b);
          q.z += q.vz * dt + Math.sin(q.fl) * 12 * dt * Math.sin(q.b);
          q.y += q.vy * dt;
          q.a += q.va * dt;
          q.fl += q.vf * dt;
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), pts = stem(), top = pts[12], g = grow(), bloom = smooth(OPEN - 0.15, OPEN + 0.2, t) * (1 - smooth(WILT - 0.2, WILT + 0.5, t));
        // a column of soft healing light, and a lit ring on the floor that blooms out as it opens
        for (let h = 0; h < 70; h += 7) q.glow(0, -h, 0, 22, C[5], 0.12 * bloom * (1 - h / 80));
        const k = clamp((t - OPEN + 0.12) / 0.6);
        if (k > 0 && k < 1) {
          const r = 6 + 30 * ease.outCubic(k), w = Math.max(1.5, 4 * (1 - k)), a = 1.1 - k;
          q.plane(0, 0.5, 0, null, r + 1, (u, v, out) => {
            const d = Math.hypot(u, v), b = (d - (r - w)) / w;
            if (b < 0 || b > 1) return;
            out.c = b > 0.78 ? Ht[3] : b > 0.5 ? Ht[2] : b > 0.25 ? C[5] : C[3];
            out.a = Math.min(1, a);
            out.l = Ht[2];
            out.k = 0.3 * a * b;
          });
        }
        const fw = 6 + 16 * smooth(0, 0.8, t), fk = smooth(0, 0.4, t) * (1 - smooth(WILT, WILT + 0.6, t));
        if (fk > 0.02)
          q.plane(0, 0, 0, null, fw + 1, (u, v, out) => {
            const d = Math.hypot(u, v) / fw;
            if (d > 1) return;
            out.c = d < 0.3 ? C[6] : d < 0.65 ? C[5] : C[4];
            out.a = Math.sqrt(1 - d) * fk;
            out.l = C[5];
            out.k = 0.2 * fk * (1 - d);
          });
        if (g > 0.02) {
          // the stem: a 2 px shoot, lit down its left side
          tube(q, pts, (u) => 1.5 - 0.5 * u, (nx, ny, nz) => (nz < 0.2 ? C[2] : shade3(C.slice(2, 7), nx, ny, nz)), 0);
          // leaves unfurl off it, one to each side
          for (const [i, az, d] of [[4, 2.5, 0.1], [7, -0.45, 0.22]]) {
            const lk = ease.outBack(clamp((t - d - 0.12) / 0.3), 1.6) * (1 - smooth(WILT, WILT + 0.5, t) * 0.4), [x, y, z] = pts[i];
            if (lk <= 0 || y > -1) continue;
            const e = 0.45 - 0.3 * lk;
            leaf3(q, x, y, z, [Math.cos(az) * Math.cos(e), -Math.sin(e) + 0.15 * (1 - lk), Math.sin(az) * Math.cos(e)], 12 * lk, 3.4, 0.25, [C[1], C[3], C[5], C[6]]);
          }
          // the bud, then the heart once it opens
          if (t > STEM - 0.1 && t < OPEN - 0.1) {
            const b = clamp((t - STEM + 0.1) / (BUD - STEM)), w = 2 + 2.5 * b, h = 3.5 + 5 * b;
            ellipsoid(q, top[0], top[1] - h * 0.6, top[2], w, h, w, (nx, ny, nz) => (nz < 0.15 ? Pt[0] : shade3(Pt, nx, ny, nz)));
            q.glow(top[0], top[1] - h * 0.6, top[2], 8 + 8 * b, Ht[2], 0.25 * b);
          }
        }
        // the petals: closed round the bud, splayed open round the heart, a ring of long ones and a ring of short ones between
        if (t > BUD - 0.05) {
          const op = open(), e = lerp(0.15, 1.2, op), L = lerp(9, 15, op), cy = top[1] - 3;
          for (const pe of petals) {
            if (pe.gone) continue;
            const sw = Math.sin(t * 3 + pe.az) * 0.04;
            leaf3(q, top[0], cy, top[2], [Math.sin(e + sw) * Math.cos(pe.az), -Math.cos(e + sw), Math.sin(e + sw) * Math.sin(pe.az)], L, 4.2, 0, [Pt[0], Pt[1], Pt[2], Pt[3]]);
            const e2 = e * 0.7, a2 = pe.az + TAU / NPET / 2;
            leaf3(q, top[0], cy + 0.5, top[2], [Math.sin(e2) * Math.cos(a2), -Math.cos(e2), Math.sin(e2) * Math.sin(a2)], L * 0.72, 3.2, 0, [Pt[0], Pt[1], Pt[2], Pt[3]]);
          }
        }
        if (t > OPEN - 0.12 && t < WILT + 0.3) {
          const pulse = 0.85 + 0.15 * Math.sin(t * 9), kk = 1 - smooth(WILT - 0.3, WILT + 0.3, t), cy = top[1] - 4;
          q.ball(top[0], cy, top[2], 3.3 * kk, (nx, ny, nz) => (nz < 0.2 ? Ht[0] : shade3(Ht, nx, ny, nz, 1.1, 0.35)));
          q.glow(top[0], cy, top[2], 14 * pulse, Ht[2], 0.34 * kk);
          q.glow(top[0], cy, top[2], 30, C[5], 0.1 * kk);
        }
        const e = t - OPEN + 0.12;
        if (e > 0 && e < 0.16) q.at(top[0], top[1] - 3, top[2], (pp) => sparkle(pp, 0, 0, 10 * (1 - e / 0.16), Ht[3], Ht[2], 0.6));
        for (const f of flying) leaf3(q, f.x, f.y, f.z, [Math.cos(f.a) * Math.cos(f.b + f.fl * 0.3), Math.sin(f.a) * 0.8, Math.cos(f.a) * Math.sin(f.b + f.fl * 0.3)], 6, 2.2, f.fl, [Pt[0], Pt[1], Pt[2], Pt[3]], Math.min(1, f.life / 0.3));
        for (const gl of glyphs) {
          const kk = (t - gl.t0) / gl.life, a = gl.a + kk * 0.8;
          q.at(Math.cos(a) * gl.r + Math.sin(kk * 5 + gl.seed) * 2, gl.y - kk * 24, Math.sin(a) * gl.r, (pp) => cross(pp, 0, 0, gl.L, C, Math.sin(Math.PI * kk), Math.sin(kk * 14 + gl.seed) > 0.8));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
