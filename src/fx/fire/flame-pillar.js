// The flame-puff, smoke, spark, debris and floor-ring recipe is adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), and the column's levels, pulses and strands from its
// holy light (https://www.spritefusion.com/pixel-art-vfx/holy-light), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, clamp, smooth, ease, noise, rand, TAU, WHITE, hex, mix, scale, rgb, space, lit } from "../../core/index.js";
import { hotFirst, flameTongue, simDraw, floorLight, LAYERS, BACK_LAYERS, floorGlow, simDraw3 } from "./_lib.js";

export const meta = {
  name: "Flame pillar",
  desc: "The floor cracks and glows, a column of fire erupts white-hot and roars, spewing embers and shedding flame, then collapses into rolling smoke.",
  tags: ["fire", "pillar", "eruption", "spell", "ground", "one-shot"],
  size: [184, 256],
  origin: [92, 232],
  duration: 5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    stone: "#4a3f69",
    height: 140,
    seed: 5,
  },
};

const ERUPT = 0.55, RISE = 0.12, FALL = 1.95, GONE = 2.45, SOOT = hex("#0d0a12"), OUTLINE = hex("#1a1422"), WARM = rgb(255, 176, 96);

function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3) };
}
function rock(p, b, st) {
  const r = 0.6 + b.s * 0.75, fade = Math.min(1, b.life / 0.5), lx = Math.cos(b.a) * r * 0.4, ly = Math.sin(b.a) * r * 0.4;
  p.shade(b.x - r - 1, b.y - r - 1, b.x + r + 1, b.y + r + 1, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx * 1.15, dy);
    if (d > r + 0.9) return;
    const lit = dx * lx + dy * ly;
    out.c = d > r ? OUTLINE : lit < -0.4 ? st.light : lit > 0.6 ? st.shade : st.body;
    out.a = fade;
  });
}

export function create(o) {
  const F = fit(o.palette, 9), H = hotFirst(F), HMAX = o.height, st = stone(o.stone), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [H[1], H[2], H[4], H[5]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), S = o.seed * 13;
  // the cracks: jagged lines racing out from the middle across the floor (squashed for perspective), with branches
  const cracks = [];
  const crack = (x, y, a, len, t0, w) => {
    const pts = [[x, y]];
    for (let d = 0; d < len; d += 2) (a += R.range(-0.55, 0.55)), (x += Math.cos(a) * 2), (y += Math.sin(a) * 0.76), pts.push([x, y]);
    cracks.push({ pts, t0, grow: R.range(0.22, 0.36), w });
    return pts;
  };
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R.range(-0.25, 0.25), pts = crack(R.range(-1, 1), R.range(-0.3, 0.3), a, R.range(20, 40), R.range(0, 0.16), 1);
    const j = 3 + R.int(0, pts.length - 6);
    if (pts.length > 8) crack(pts[j][0], pts[j][1], a + R.sign() * R.range(0.5, 1), R.range(6, 14), 0.18 + R.range(0, 0.15), 0);
  }
  // strands of hotter flame running up the column
  const strands = Array.from({ length: 7 }, (_, i) => ({ o: (rand(i, S, 1) - 0.5) * 1.4, w: 0.05 + rand(i, S, 2) * 0.06, f: 1 + rand(i, S, 3) * 2 }));
  let t = 0, erupted = false, fell = false;

  const height = (tt) => (tt < ERUPT ? 0 : tt < ERUPT + RISE ? HMAX * ease.outCubic((tt - ERUPT) / RISE) : tt < FALL ? HMAX * (1 + 0.05 * noise(tt * 3, S)) : HMAX * (1 - ease.inQuad(clamp((tt - FALL) / (GONE - FALL)))));
  const width = (tt) => (tt < ERUPT ? 0 : tt < FALL ? 12 * (1 + 0.45 * Math.exp(-(tt - ERUPT) * 7)) * (0.94 + 0.06 * noise(tt * 9, S + 1)) : 12 * (1 - smooth(FALL, GONE, tt)) + 1.5 * (1 - smooth(GONE - 0.1, GONE, tt)));
  const heat = (tt) => smooth(0, ERUPT, tt) * 0.75 + 0.25 * smooth(ERUPT - 0.05, ERUPT + 0.1, tt) - smooth(GONE - 0.3, meta.duration - 0.6, tt) * 1.05;

  function column(p) {
    const h = height(t), w0 = width(t);
    if (h < 1 || w0 < 0.3) return;
    // a crown of tongues where the column breaks into the air, drawn first so the column flows up into them
    if (t < FALL + 0.25) {
      const k = clamp(w0 / 12), NZ = (rate, seed, off) => noise(t * rate + off, seed);
      for (let i = 0; i < 5; i++) {
        const n = (S + i) * 17, dx = (i - 2) * w0 * 0.4, th = (12 + 12 * (0.5 + 0.5 * noise(t * 3.3 + i, n))) * k * (i === 2 ? 1.2 : i % 4 === 0 ? 0.6 : 0.9);
        flameTongue(p, dx + noise(t * 2, n + 2) * 1.5, -h + 12, th, 3.4 * k * (i % 4 === 0 ? 0.7 : 1), -dx * 0.3 + noise(t * 2.2, n + 1) * 3, NZ, n, H, LAYERS);
      }
    }
    const lvlC = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];
    for (let y = 0; y >= -h; y--) {
      const v = -y / h, cx = noise(-y * 0.04 + t * 1.6, S + 2) * 1.6 * v;
      // licks bulge out of the sides and run up them; a wider splash at the foot; the top thins into tongues
      const foot = 1 + 0.7 * Math.max(0, 1 - -y / 12) ** 2, top = 1 - smooth(0.82, 1, v) * 0.7;
      const wl = w0 * foot * top * (1 + 0.65 * Math.max(0, noise(y * 0.2 + t * 8, S + 3)) ** 1.5), wr = w0 * foot * top * (1 + 0.65 * Math.max(0, noise(y * 0.2 + t * 8, S + 4)) ** 1.5);
      const pulse = ((-y * 0.032 + t * 3.6) % 1) < 0.09 ? 1 : 0;
      for (let x = Math.floor(cx - wl * 1.15); x <= Math.ceil(cx + wr * 1.15); x++) {
        const dx = x + 0.5 - cx, q = Math.abs(dx) / (dx < 0 ? wl : wr);
        if (q > 1.15) continue;
        let lvl = q < 0.12 ? 0 : q < 0.26 ? 1 : q < 0.42 ? 2 : q < 0.56 ? 3 : q < 0.7 ? 4 : q < 0.84 ? 5 : q < 0.96 ? 6 : 7;
        for (const s of strands) if (Math.abs(dx / w0 - s.o - 0.06 * Math.sin(t * s.f * 3 + s.o * 9)) < s.w) lvl = Math.max(0, lvl - 1);
        lvl = Math.max(0, lvl - pulse);
        if (lvl === 7 && rand(x, y, Math.floor(t * 20)) < 0.5) continue;
        p.px(x, y, lvlC[lvl]);
      }
      if (y % 12 === 0) p.glow(cx, y, w0 * 2.4 + 8, GLOW, 0.28 * clamp(w0 / 12));
    }
    p.glow(0, -h * 0.45, 92, GLOW, 0.3 * clamp(w0 / 12));
  }

  function cracksDraw(p) {
    const k = heat(t);
    if (k <= -0.05) return;
    for (const c of cracks) {
      const n = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow));
      for (let i = 1; i < n; i++) {
        const u = i / c.pts.length, hot = k * (1 - 0.45 * u), [x0, y0] = c.pts[i - 1], [x1, y1] = c.pts[i];
        if (hot < 0) {
          // cooled: soot that fades away
          const a = 1 + hot * 3;
          if (a > 0) p.line(x0, y0, x1, y1, SOOT, a);
          continue;
        }
        const col = hot > 0.85 ? H[1] : hot > 0.65 ? H[2] : hot > 0.45 ? H[4] : hot > 0.25 ? H[5] : hot > 0.1 ? H[6] : H[7];
        // the crack: a hot seam with a darker glowing lip, wider near the middle
        if (c.w && i < c.pts.length * 0.5 && hot > 0.2) p.line(x0, y0 + 1, x1, y1 + 1, hot > 0.6 ? H[5] : H[6]), p.line(x0, y0 - 1, x1, y1 - 1, H[7]);
        p.line(x0, y0, x1, y1, col);
        if (i % 2 === 0) p.glow(x1, y1, 5 + 7 * hot, GLOW, 0.3 * hot);
      }
    }
    // the floor glows from beneath while it's hot
    if (k > 0) floorLight(p, 0, 0.5, 44, 8, GLOW, 0.35 * k);
  }

  return {
    update(dt) {
      t += dt;
      // the charge: the crust in the middle glows, little flames lick out of it, heat leaks up the cracks
      if (t < ERUPT && R.chance(0.6 * dt * 60 * smooth(0.15, ERUPT, t))) ps.spawn(P.FIRE, R.range(-5, 5), -1, R.range(-6, 6), -R.range(20, 45), R.range(0.15, 0.3), 0, R.range(1, 2.2));
      if (t < ERUPT && R.chance(0.5 * dt * 60 * smooth(0, ERUPT, t))) {
        const c = R.pick(cracks), i = R.int(0, Math.floor(c.pts.length * clamp((t - c.t0) / c.grow)) - 1);
        if (i >= 0) {
          const [x, y] = c.pts[i];
          if (R.chance(0.5)) ps.spawn(P.FIRE, x, y - 1, R.range(-5, 5), -R.range(15, 35), R.range(0.15, 0.3), 0, R.range(0.8, 1.6));
          else ps.spawn(P.EMBER, x, y - 1, R.range(-15, 15), -R.range(30, 70), R.range(0.5, 1), H[3], 1);
        }
      }
      if (!erupted && t >= ERUPT) {
        erupted = true;
        lights.add(0, -40, 90, WARM, 0.7, 0.6);
        lights.add(0, -8, 44, WHITE, 0.7, 0.1);
        for (let i = 0; i < 70; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(100, 260);
          ps.spawn(P.SPARK, R.range(-4, 4), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.7));
        }
        for (let i = 0; i < 18; i++) bits.add({ kind: B.CHUNK, x: R.range(-6, 6), y: -2, vx: R.range(-110, 110), vy: -R.range(150, 330), g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.6, 2.4), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
        for (let i = 0; i < 60; i++) {
          const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(80, 260);
          ps.spawn(P.GRIT, R.range(-5, 5), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1, 1.8), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.4) ? 2 : 1);
        }
        for (let i = 0; i < 14; i++) {
          const s = R.sign();
          ps.spawn(P.SMOKE, s * R.range(2, 10), -R.range(1, 4), s * R.range(40, 110), -R.range(2, 10), R.range(1, 1.8), st.dust, R.range(4, 7), R.range(0, 0.06), PF.BIG);
        }
      }
      // the roar: flame shed off the sides, a billowing cap, embers spewed high
      const h = height(t), w = width(t);
      if (t > ERUPT && t < GONE && h > 4) {
        if (R.chance(0.9 * dt * 60)) {
          const s = R.sign(), y = -R.range(4, h * 0.9);
          ps.spawn(P.FIRE, s * w * R.range(0.7, 1.1), y, s * R.range(15, 40), -R.range(30, 70), R.range(0.25, 0.5), 0, R.range(1.6, 3.2), 0, R.chance(0.35) ? PF.SMOKES : 0);
        }
        if (R.chance(0.7 * dt * 60)) ps.spawn(P.FIRE, R.range(-w, w), -h + R.range(0, 6), R.range(-20, 20), -R.range(30, 80), R.range(0.35, 0.7), 0, R.range(3, 5.5), 0, R.chance(0.6) ? PF.SMOKES | (t < FALL - 0.3 ? PF.BIG : 0) : 0);
        if (t < FALL && R.chance(0.5 * dt * 60)) ps.spawn(P.EMBER, R.range(-w, w) * 0.6, -h + 4, R.range(-60, 60), -R.range(50, 110), R.range(0.7, 1.3), H[3], R.chance(0.2) ? 2 : 1);
      }
      // the collapse: the falling top breaks into puffs that roll off as smoke
      if (t >= FALL && !fell) fell = true;
      if (fell && t < GONE - 0.1 && R.chance(1.6 * dt * 60)) ps.spawn(P.FIRE, R.range(-w - 2, w + 2), -h - R.range(0, 8), R.range(-30, 30), -R.range(10, 50), R.range(0.4, 0.75), 0, R.range(3.5, 6.5), 0, PF.SMOKES);
      bits.update(dt);
      for (const b of bits.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 3; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 18), R.range(0.3, 0.6), st.dust, R.range(1.3, 2.6));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      cracksDraw(p);
      simDraw(p, ps, H, "back");
      const k = (t - ERUPT) / 0.45;
      if (k > 0 && k < 1) band(p, 0, 0.5, 84 * ease.outCubic(k), 0.18, Math.max(1, 4 * (1 - k)), 1.15 - k, [st.body, st.light, H[4], H[1]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      column(p);
      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      const k = (t - ERUPT) / 0.45;
      if (k > 0 && k < 1) band(p, 0, 0.5, 84 * ease.outCubic(k), 0.18, Math.max(1, 4 * (1 - k)), 1.15 - k, [st.body, st.light, H[4], H[1]], (g) => Math.sin(g) >= 0, k < 0.15);
      // the eruption's white flash at the foot
      const f = (t - ERUPT) / 0.08;
      if (f > 0 && f < 1) {
        p.ellipse(0, -2, 16 * (1 - f * 0.3), 6, H[2]);
        p.ellipse(0, -3, 11 * (1 - f * 0.3), 4, f < 0.5 ? WHITE : H[1]);
      }
      lights.draw(p);
    },
  };
}

// 3D: the same eruption standing in space. The floor cracks run out in a full circle as true lines on the floor, the
// column is a cylinder of fire (a stack of capsules, white-hot at the axis and red at the rim) with spiral strands of
// hotter flame winding up it, licks of flame running up its sides at real x and z, a crown of tongues on top and
// rising halos; the shock ring is a true circle on the floor, and sparks, grit, rocks and smoke leave in every direction.
export const three = {
  meta: { size: [208, 262], origin: [104, 226], camera: { pitch: 0.35 } },
  create(o) {
    const F = fit(o.palette, 9), H = hotFirst(F), HMAX = o.height, st = stone(o.stone), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [H[1], H[2], H[4], H[5]] });
    const bits = new Bits({ ground: floor }), lights = new Lights();
    const GLOW = mix(mix(H[3], H[4], 0.5), WHITE, 0.25), S = o.seed * 13, ROCK = lit([OUTLINE, st.shade, st.body, st.light]);
    const lvlC = [H[0], H[1], H[2], H[3], H[4], H[5], H[6], H[7]];
    const lvlOf = (q) => (q < 0.12 ? 0 : q < 0.26 ? 1 : q < 0.42 ? 2 : q < 0.56 ? 3 : q < 0.7 ? 4 : q < 0.84 ? 5 : q < 0.96 ? 6 : 7);
    // the cracks: jagged lines racing out across the floor in a full circle, with branches
    const cracks = [];
    const crack = (x, z, a, len, t0, w) => {
      const pts = [[x, z]];
      for (let d = 0; d < len; d += 2) (a += R.range(-0.55, 0.55)), (x += Math.cos(a) * 2), (z += Math.sin(a) * 2), pts.push([x, z]);
      cracks.push({ pts, t0, grow: R.range(0.22, 0.36), w });
      return pts;
    };
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + R.range(-0.2, 0.2), pts = crack(R.range(-1, 1), R.range(-1, 1), a, R.range(26, 46), R.range(0, 0.16), 1);
      const j = 3 + R.int(0, pts.length - 6);
      if (pts.length > 8) crack(pts[j][0], pts[j][1], a + R.sign() * R.range(0.5, 1), R.range(8, 16), 0.18 + R.range(0, 0.15), 0);
      if (i % 2 === 0 && pts.length > 14) crack(pts[Math.min(j + 4, pts.length - 1)][0], pts[Math.min(j + 4, pts.length - 1)][1], a - R.sign() * R.range(0.5, 1), R.range(6, 12), 0.2 + R.range(0, 0.15), 0);
    }
    // strands of hotter flame spiralling up the column, and licks of flame running up its sides
    const strands = Array.from({ length: 7 }, (_, i) => ({ a: rand(i, S, 1) * TAU, k: 0.012 + rand(i, S, 2) * 0.014, f: 0.5 + rand(i, S, 3) * 0.8, s: rand(i, S, 4) < 0.5 ? 1 : -1 }));
    const licks = Array.from({ length: 16 }, (_, i) => ({ a: rand(i, S, 5) * TAU, f: 0.55 + rand(i, S, 6) * 0.6, ph: rand(i, S, 7), s: rand(i, S, 8), sp: rand(i, S, 9) * 2 - 1 }));
    let t = 0, erupted = false, fell = false;

    const height = (tt) => (tt < ERUPT ? 0 : tt < ERUPT + RISE ? HMAX * ease.outCubic((tt - ERUPT) / RISE) : tt < FALL ? HMAX * (1 + 0.05 * noise(tt * 3, S)) : HMAX * (1 - ease.inQuad(clamp((tt - FALL) / (GONE - FALL)))));
    const width = (tt) => (tt < ERUPT ? 0 : tt < FALL ? 12 * (1 + 0.45 * Math.exp(-(tt - ERUPT) * 7)) * (0.94 + 0.06 * noise(tt * 9, S + 1)) : 12 * (1 - smooth(FALL, GONE, tt)) + 1.5 * (1 - smooth(GONE - 0.1, GONE, tt)));
    const heat = (tt) => smooth(0, ERUPT, tt) * 0.75 + 0.25 * smooth(ERUPT - 0.05, ERUPT + 0.1, tt) - smooth(GONE - 0.3, meta.duration - 0.6, tt) * 1.05;
    const polar = (th, ph, sp) => [Math.sin(th) * Math.cos(ph) * sp, -Math.cos(th) * sp, Math.sin(th) * Math.sin(ph) * sp];

    function cracksDraw(q) {
      const k = heat(t);
      if (k <= -0.05) return;
      for (const c of cracks) {
        const n = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow));
        for (let i = 1; i < n; i++) {
          const u = i / c.pts.length, hot = k * (1 - 0.45 * u), [x0, z0] = c.pts[i - 1], [x1, z1] = c.pts[i];
          if (hot < 0) {
            const a = 1 + hot * 3;
            if (a > 0) q.line(x0, 0, z0, x1, 0, z1, SOOT, a);
            continue;
          }
          const col = hot > 0.85 ? H[1] : hot > 0.65 ? H[2] : hot > 0.45 ? H[4] : hot > 0.25 ? H[5] : hot > 0.1 ? H[6] : H[7];
          // a hot seam with a darker glowing lip, wider near the middle
          if (c.w && i < c.pts.length * 0.5 && hot > 0.2) {
            const dx = z1 - z0, dz = x0 - x1, L = Math.hypot(dx, dz) || 1, nx = (dx / L) * 0.9, nz = (dz / L) * 0.9;
            q.line(x0 + nx, 0, z0 + nz, x1 + nx, 0, z1 + nz, hot > 0.6 ? H[5] : H[6]);
            q.line(x0 - nx, 0, z0 - nz, x1 - nx, 0, z1 - nz, H[7]);
          }
          q.line(x0, 0, z0, x1, 0, z1, col);
          if (i % 3 === 0) q.glow(x1, -1, z1, 5 + 7 * hot, GLOW, 0.3 * hot);
        }
      }
    }

    // the column: a true cylinder. Every row is drawn as in 2D (levels from the axis out, pulses running up) with the
    // depth of a round surface, its radius swelling and shrinking round the axis; strands spiral over it
    function column(q) {
      const h = height(t), w0 = width(t);
      if (h < 1 || w0 < 0.3) return;
      const kk = clamp(w0 / 12), NZ = (rate, seed, off) => noise(t * rate + off, seed);
      // licks swell the column at some azimuths: smooth round the axis, so turning the camera shows different bulges
      const radius = (y, ph) => {
        const v = -y / h, foot = 1 + 0.7 * Math.max(0, 1 - -y / 12) ** 2, top = 1 - smooth(0.82, 1, v) * 0.7, s = y * 0.2 + t * 8;
        const m = 0.6 * (noise(s, S + 3) * Math.cos(ph) + noise(s, S + 4) * Math.sin(ph)) + 0.4 * (noise(s, S + 5) * Math.cos(2 * ph) + noise(s, S + 6) * Math.sin(2 * ph));
        return w0 * foot * top * (1 + 0.65 * Math.max(0, m * 1.2) ** 1.5);
      };
      const cx = (y) => (noise(-y * 0.04 + t * 1.6, S + 2) * 1.6 * -y) / h, cz = (y) => (noise(-y * 0.04 + t * 1.5, S + 22) * 1.6 * -y) / h;
      // a crown of tongues where the column breaks into the air
      if (t < FALL + 0.25) {
        for (let i = 0; i < 7; i++) {
          const n = (S + i) * 17, a = (i / 6) * TAU + t * 0.7, rr = i === 0 ? 0 : w0 * 0.55, x = cx(-h) + Math.cos(a) * rr, z = cz(-h) + Math.sin(a) * rr;
          const th = (12 + 12 * (0.5 + 0.5 * noise(t * 3.3 + i, n))) * kk * (i === 0 ? 1.25 : 0.8), sw = q.view(Math.cos(a) * rr * 0.3 + noise(t * 2.2, n + 1) * 3, 0, Math.sin(a) * rr * 0.3 + noise(t * 2.1, n + 5) * 3)[0];
          const behind = q.toward(x, -h, z) < -1.5;
          q.at(x, -h + 12, z, (pp) => flameTongue(pp, 0, 0, th, 3.4 * kk * (i === 0 ? 1 : 0.8), sw, NZ, n, H, behind ? BACK_LAYERS : LAYERS));
        }
      }
      const yaw = q.camera.yaw, cpp = q.cp;
      q.at(0, 0, 0, (pp, k) => {
        const z0 = pp.z;
        for (let j = 0; j <= h * cpp; j++) {
          const y = -j / cpp, X = cx(y), Z = cz(y), sx = q.view(X, 0, Z)[0] * k, zc = q.depth(X, y, Z), wl = radius(y, Math.PI - yaw), wr = radius(y, -yaw);
          const pulse = ((-y * 0.032 + t * 3.6) % 1) < 0.09 ? 1 : 0;
          for (let x = Math.floor(sx - wl * k * 1.15); x <= Math.ceil(sx + wr * k * 1.15); x++) {
            const dx = x + 0.5 - sx, W = dx < 0 ? wl : wr, qq = Math.abs(dx) / (W * k);
            if (qq > 1.15) continue;
            const lvl = Math.max(0, lvlOf(qq) - pulse);
            if (lvl === 7 && rand(x, j, Math.floor(t * 20)) < 0.5) continue;
            pp.z = zc - Math.sqrt(Math.max(0, 1 - Math.min(1, qq) ** 2)) * W;
            pp.px(x, -j, lvlC[lvl]);
          }
        }
        pp.z = z0;
      });
      // strands: thin hot capsules spiralling round the column, hidden behind it on the far side
      for (const s of strands) {
        let prev = null;
        for (let y = -1; y >= -h * 0.97; y -= 6) {
          const ph = s.a + s.s * (t * s.f * 1.3 - y * s.k), c = Math.cos(ph), sn = Math.sin(ph), rr = radius(y, ph) + 0.7;
          const P3 = [cx(y) + c * rr, y, cz(y) + sn * rr];
          if (prev) q.beam(...prev, ...P3, 1.3, lvlC[Math.max(1, lvlOf(Math.abs(q.view(c, 0, sn)[0])) - 1)]);
          prev = P3;
        }
      }
      // licks bulging out of the sides and running up them, at real positions round the axis
      for (let i = 0; i < licks.length; i++) {
        const L = licks[i], cyc = (t * L.f + L.ph) % 1, e = Math.sin(cyc * Math.PI) ** 0.6, y = -(0.04 + cyc * 0.88) * h, a = L.a + L.sp * cyc * 2 + t * 0.6;
        const rr = radius(y, a) * 1.0, x = cx(y) + Math.cos(a) * rr, z = cz(y) + Math.sin(a) * rr, n = (S + i) * 29;
        const th = (13 + 11 * L.s) * kk * e, sw = q.view(Math.cos(a) * 4, 0, Math.sin(a) * 4)[0] + noise(t * 2 + i, n) * 1.5, behind = q.toward(x, y, z) < -1.5;
        q.at(x, y, z, (pp) => flameTongue(pp, 0, 0, th, (2.4 + 1.2 * L.s) * kk, sw, NZ, n, H, behind ? BACK_LAYERS : LAYERS));
      }
    }

    // the light of the column: glow rings up its length and a broad wash
    function columnLight(q) {
      const h = height(t), w0 = width(t);
      if (h < 1 || w0 < 0.3) return;
      const kk = clamp(w0 / 12);
      for (let y = 0; y >= -h; y -= 16) q.glow(0, y, 0, w0 * 2.4 + 8, GLOW, 0.2 * kk);
      q.glow(0, -h * 0.45, 0, 92, GLOW, 0.3 * kk);
    }

    // halos of heat rising round the column, true rings in the air
    function halos(q) {
      const h = height(t), w0 = width(t);
      if (h < 1 || w0 < 0.3) return;
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.9 + i / 3) % 1, y = -u * h, rr = w0 * (1.35 + 0.6 * u) + 2;
        q.plane(0, y, 0, null, rr + 2, (U, V, out) => {
          const d = Math.hypot(U, V);
          if (d < rr - 2.2 || d > rr) return;
          out.c = u < 0.5 ? H[2] : H[4];
          out.a = 0.75 * Math.sin(u * Math.PI) * clamp(w0 / 12);
          out.blend = true;
        });
      }
    }

    const shockK = () => (t - ERUPT) / 0.45;

    return {
      update(dt) {
        t += dt;
        // the charge: the crust in the middle glows, little flames lick out of it, heat leaks up the cracks
        if (t < ERUPT && R.chance(0.6 * dt * 60 * smooth(0.15, ERUPT, t))) {
          const a = R.range(0, TAU), d = R.range(0, 6);
          ps.spawn3(P.FIRE, Math.cos(a) * d, -1, Math.sin(a) * d, R.range(-6, 6), -R.range(20, 45), R.range(-6, 6), R.range(0.15, 0.3), 0, R.range(1, 2.2));
        }
        if (t < ERUPT && R.chance(0.5 * dt * 60 * smooth(0, ERUPT, t))) {
          const c = R.pick(cracks), i = R.int(0, Math.floor(c.pts.length * clamp((t - c.t0) / c.grow)) - 1);
          if (i >= 0) {
            const [x, z] = c.pts[i];
            if (R.chance(0.5)) ps.spawn3(P.FIRE, x, -1, z, R.range(-5, 5), -R.range(15, 35), R.range(-5, 5), R.range(0.15, 0.3), 0, R.range(0.8, 1.6));
            else ps.spawn3(P.EMBER, x, -1, z, R.range(-15, 15), -R.range(30, 70), R.range(-15, 15), R.range(0.5, 1), H[3], 1);
          }
        }
        if (!erupted && t >= ERUPT) {
          erupted = true;
          lights.add(0, -40, 90, WARM, 0.7, 0.6, 0);
          lights.add(0, -8, 44, WHITE, 0.7, 0.1, 0);
          for (let i = 0; i < 84; i++) {
            const v = polar(R.range(0, 1.1), R.range(0, TAU), R.range(100, 260));
            ps.spawn3(P.SPARK, R.range(-3, 3), -2, R.range(-3, 3), v[0], v[1], v[2], R.range(0.25, 0.7));
          }
          for (let i = 0; i < 22; i++) {
            const a = R.range(0, TAU), sp = R.range(0, 110);
            bits.add({ kind: B.CHUNK, x: Math.cos(a) * R.range(0, 6), y: -2, z: Math.sin(a) * R.range(0, 6), vx: Math.cos(a) * sp, vy: -R.range(150, 330), vz: Math.sin(a) * sp, g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.6, 2.4), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
          }
          for (let i = 0; i < 70; i++) {
            const v = polar(R.range(0, 0.9), R.range(0, TAU), R.range(80, 260));
            ps.spawn3(P.GRIT, R.range(-4, 4), -1, R.range(-4, 4), v[0], v[1], v[2], R.range(1, 1.8), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.4) ? 2 : 1);
          }
          // a ring of dust rolling out across the floor
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * TAU + R.range(-0.15, 0.15), d = R.range(2, 10), sp = R.range(40, 110);
            ps.spawn3(P.SMOKE, Math.cos(a) * d, -R.range(1, 4), Math.sin(a) * d, Math.cos(a) * sp, -R.range(2, 10), Math.sin(a) * sp, R.range(1, 1.8), st.dust, R.range(4, 7), R.range(0, 0.06), PF.BIG);
          }
        }
        // the roar: flame shed off the sides, a billowing cap, embers spewed high
        const h = height(t), w = width(t);
        if (t > ERUPT && t < GONE && h > 4) {
          if (R.chance(0.9 * dt * 60)) {
            const a = R.range(0, TAU), y = -R.range(4, h * 0.9), d = w * R.range(0.7, 1.1), sp = R.range(15, 40);
            ps.spawn3(P.FIRE, Math.cos(a) * d, y, Math.sin(a) * d, Math.cos(a) * sp, -R.range(30, 70), Math.sin(a) * sp, R.range(0.25, 0.5), 0, R.range(1.6, 3.2), 0, R.chance(0.35) ? PF.SMOKES : 0);
          }
          if (R.chance(0.7 * dt * 60)) {
            const a = R.range(0, TAU), d = w * Math.sqrt(R.next());
            ps.spawn3(P.FIRE, Math.cos(a) * d, -h + R.range(0, 6), Math.sin(a) * d, R.range(-20, 20), -R.range(30, 80), R.range(-20, 20), R.range(0.35, 0.7), 0, R.range(3, 5.5), 0, R.chance(0.6) ? PF.SMOKES | (t < FALL - 0.3 ? PF.BIG : 0) : 0);
          }
          if (t < FALL && R.chance(0.5 * dt * 60)) {
            const a = R.range(0, TAU), d = w * 0.6 * Math.sqrt(R.next());
            ps.spawn3(P.EMBER, Math.cos(a) * d, -h + 4, Math.sin(a) * d, R.range(-60, 60), -R.range(50, 110), R.range(-60, 60), R.range(0.7, 1.3), H[3], R.chance(0.2) ? 2 : 1);
          }
        }
        // the collapse: the falling top breaks into puffs that roll off as smoke
        if (t >= FALL && !fell) {
          fell = true;
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + R.range(-0.2, 0.2), sp = R.range(25, 55);
            ps.spawn3(P.SMOKE, Math.cos(a) * w, -h * R.range(0.1, 0.5), Math.sin(a) * w, Math.cos(a) * sp, -R.range(2, 10), Math.sin(a) * sp, R.range(1.2, 2), st.dust, R.range(4, 6.5), R.range(0, 0.1), PF.BIG);
          }
        }
        if (fell && t < GONE - 0.1 && R.chance(1.6 * dt * 60)) {
          const a = R.range(0, TAU), d = (w + 2) * Math.sqrt(R.next());
          ps.spawn3(P.FIRE, Math.cos(a) * d, -h - R.range(0, 8), Math.sin(a) * d, R.range(-30, 30), -R.range(10, 50), R.range(-30, 30), R.range(0.4, 0.75), 0, R.range(3.5, 6.5), 0, PF.SMOKES);
        }
        bits.update(dt);
        for (const b of bits.list)
          if (b.rest && !b.dusted) {
            b.dusted = true;
            for (let i = 0; i < 3; i++) {
              const a = R.range(0, TAU), sp = R.range(8, 35);
              ps.spawn3(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, b.z + R.range(-1.5, 1.5), Math.cos(a) * sp, -R.range(2, 18), Math.sin(a) * sp, R.range(0.3, 0.6), st.dust, R.range(1.3, 2.6));
            }
          }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the floor: cracks, then the shock ring running out as a true circle
        cracksDraw(q);
        const k = shockK();
        if (k > 0 && k < 1) {
          const a0 = 1.15 - k, wd = 3 + 4 * (1 - k), hot = k < 0.15;
          q.ring(0, -0.5, 0, 84 * ease.outCubic(k), wd, (v) => (v > 0.85 ? (hot ? WHITE : H[1]) : v > 0.6 ? H[4] : v > 0.3 ? st.light : st.body), (v) => a0 * (v > 0.6 ? 1.2 : 1.15 - (1 - v)));
        }
        // the eruption's white flash at the foot
        const f = (t - ERUPT) / 0.08;
        if (f > 0 && f < 1) {
          q.ring(0, -0.6, 0, 16 * (1 - f * 0.3), 16, H[2]);
          q.ring(0, -0.8, 0, 11 * (1 - f * 0.3), 11, f < 0.5 ? WHITE : H[1]);
          q.ball(0, -4, 0, 7 * (1 - f * 0.3), (nx, ny, nz) => (nz < 0.5 ? H[2] : f < 0.5 ? WHITE : H[1]));
        }
        column(q);
        for (const b of bits.list) {
          const r = 1 + b.s * 0.8;
          q.ball(b.x, b.y - r * 0.8, b.z, r, ROCK, Math.min(1, b.life / 0.5));
        }
        halos(q);
        simDraw3(q, ps, H);
        // light last: the glow up the column, the floor lit from beneath while it's hot
        columnLight(q);
        const hk = heat(t);
        if (hk > 0) floorGlow(q, 0, 0, 48, GLOW, 0.35 * hk);
        lights.draw(q);
      },
    };
  },
};
