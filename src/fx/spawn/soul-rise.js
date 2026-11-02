// The pale ghost of the body and the motes it sheds follow Sprite Fusion's open-source movement and heal
// (https://www.spritefusion.com/pixel-art-vfx/movement), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, band, clamp, smooth, ease, rand, space, TAU, WHITE, hex, luma, READY } from "../../core/index.js";
import { bodyOf, rimOf, floorBand, toward } from "./_lib.js";

export const meta = {
  name: "Soul rise",
  desc: "The body's outline flares and dims, then a pale glowing copy of it lifts out, stretching as its legs melt into a rippling wisp, shedding motes until it thins into light.",
  tags: ["spawn", "death", "soul", "ghost", "spirit", "rise", "light", "one-shot"],
  size: [96, 140],
  origin: [48, 126],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#101a33", "#1f3563", "#35609e", "#5c96d4", "#94c8f0", "#d2f0ff", "#ffffff"],
    height: 50,
    seed: 27,
  },
};

const SLUMP = { crouch: 8, lean: 6, hy: 2, fx: 7, fy: -9, bx: 11, by: -9, ffx: 9, fbx: -8 };
export const act = {
  onBody: true,
  follow: 0,
  poses: [
    [-0.2, READY],
    [0.3, { turn: 1, crouch: 2, hy: -1, fx: -10, fy: -24, bx: 11, by: -24, ffx: -3, fbx: 4 }],
    [0.7, { turn: 0.7, crouch: 4, lean: 3, hy: 1, fx: 2, fy: -14, bx: 8, by: -14, ffx: 4, fbx: -3 }],
    [1.1, SLUMP],
    [2.7, SLUMP],
    [3.2, { ...SLUMP, crouch: 7 }],
  ],
  dust: [{ t: 1.1, x: 0, n: 5 }],
};

const LEAVE = 0.35, TOP = 2.05, GONE = 2.55, SHADOW = hex("#0c0f1e");

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), floor = () => 0;
  const body = bodyOf(o.actor, C), rim = rimOf(body), W = body.w, Hh = body.h, waist = Math.round(Hh * 0.6);
  // the soul is the body's own picture in pale light: each pixel's brightness picks a step of the ramp
  const tone = body.list.map((b) => (b.edge ? 6 : 3 + Math.min(2, Math.floor(luma(b.c) * 3.6))));
  const toneAt = new Int8Array(W * Hh).fill(-1);
  body.list.forEach((b, i) => (toneAt[b.my * W + b.mx] = tone[i]));
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[5], C[4], C[3]] }), lights = new Lights();
  let t = 0, left = false;

  // where the soul is: lifted, stretched taller and thinner, swaying; legs melt into a wisp below the waist
  const lift = () => o.height * ease.inOutSine(clamp((t - LEAVE) / (TOP - LEAVE)));
  const stretch = () => 1 + 0.22 * ease.inOutSine(clamp((t - LEAVE) / (TOP - LEAVE)));
  const sway = (row) => Math.sin(t * 3 - row * 0.12) * 2.2 * smooth(LEAVE, LEAVE + 0.5, t);
  const melt = () => smooth(LEAVE + 0.1, LEAVE + 0.9, t);
  // it thins from the bottom up once it's high
  const thin = () => smooth(TOP - 0.25, GONE, t);

  // a ring of light across the floor as it tears loose: far half behind the body, near half in front
  const ring = (p, near) => {
    const k = (t - LEAVE) / 0.5;
    if (k > 0 && k < 1) band(p, 0, 0, 6 + 26 * ease.outCubic(k), 0.18, Math.max(1, 3 * (1 - k)), 1.15 - k, C, (g) => (Math.sin(g) >= 0) === near, k < 0.12);
  };

  return {
    update(dt) {
      t += dt;
      if (!left && t >= LEAVE) {
        left = true;
        lights.add(0, -20, 50, C[4], 0.85, 0.55);
        lights.add(0, -20, 24, WHITE, 0.8, 0.12);
        for (let i = 0; i < 10; i++) {
          const c = R.pick(rim);
          ps.spawn(P.STAR, c.x, c.y, R.range(-20, 20), -R.range(20, 60), R.range(0.4, 0.8), R.pick([WHITE, C[5]]), R.range(0.8, 1.8));
        }
      }
      // motes come off its edges as it rises, and pour off it as it thins
      if (t > LEAVE && t < GONE) {
        const s = stretch(), y0 = body.y * s - lift(), th = thin();
        for (let n = 0; n < (th > 0 ? 3 : 1); n++) {
          if (!R.chance(th > 0 ? 0.9 : 0.5)) continue;
          const c = R.pick(rim), row = c.my;
          if (row / Hh < 1 - th * 1.1 - 0.05 && th > 0) continue;
          const x = c.x * (1 - 0.12 * (s - 1) * 4) + sway(row), y = y0 + c.my * s;
          // nothing outlives the effect, and nothing climbs off the top
          const life = Math.min(R.range(0.5, 1.1), meta.duration - 0.1 - t, (y + 120) / 60);
          if (life > 0.1) ps.spawn(R.chance(0.7) ? P.MOTE : P.STAR, x, y, R.range(-12, 12), -R.range(25, 60), life, R.pick([WHITE, C[5], C[5], C[4]]), R.range(0.5, 1));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a pale pool on the floor while it leaves, and a ring from the moment it tears loose
      const k = smooth(0, LEAVE, t) * (1 - smooth(LEAVE + 0.4, TOP, t));
      if (k > 0) p.glow(0, -1, 26, C[4], 0.3 * k);
      ring(p, false);
    },
    draw(p) {
      // the body: its outline flares as the soul tears loose, then the body is left dimmed
      if (t < LEAVE + 0.3) {
        const k = t < LEAVE ? t / LEAVE : 1 - (t - LEAVE) / 0.3;
        for (const c of rim) if (rand(c.mx, c.my, Math.floor(t * 30)) < 0.25 + 0.7 * k) p.px(c.x, c.y, k > 0.7 ? WHITE : C[5]);
        p.glow(0, -19, 26, C[4], 0.45 * k);
      }
      const dim = smooth(LEAVE, LEAVE + 0.6, t) * (1 - smooth(GONE, meta.duration - 0.1, t));
      if (dim > 0) for (const b of body.list) p.blend(b.x, b.y, SHADOW, 0.45 * dim);
      ring(p, true);
      if (t < LEAVE || t > GONE + 0.1) {
        ps.draw(p);
        lights.draw(p);
        return;
      }
      // the soul, drawn backward from the screen so stretching leaves no holes; see-through, its rim solid
      const s = stretch(), L = lift(), m = melt(), th = thin(), top = body.y * s - L, sx = 1 - 0.12 * (s - 1) * 4;
      const tail = Math.round(10 * m), y1 = top + (Hh + tail) * s, fadeIn = clamp((t - LEAVE) / 0.15);
      for (let y = Math.floor(top); y <= Math.ceil(y1); y++) {
        const my = Math.floor((y + 0.5 - top) / s);
        if (my < 0) continue;
        // rows below the waist pull in toward a wavy spine: legs melting into a wisp
        const k = my >= waist ? (my - waist + 1) / (Hh - waist + tail) : 0, narrow = 1 - k * m * 0.95;
        if (narrow <= 0.05) continue;
        const cx = sway(my) + Math.sin(my * 0.7 - t * 8) * 2 * k * m, a = (my >= waist ? 1 - k * 0.45 : 1) * fadeIn;
        for (let x = Math.floor(cx - W / 2 - 4); x <= Math.ceil(cx + W / 2 + 4); x++) {
          const mx = Math.floor((x + 0.5 - cx) / (sx * narrow) - body.x);
          // as it thins the lower rows go first, with a ragged edge
          if (th > 0 && my / (Hh + tail) > 1 - th * 1.25 + 0.25 * rand(mx, my, 5) - 0.1) continue;
          let ti;
          if (my < Hh) {
            if (mx < 0 || mx >= W) continue;
            ti = toneAt[my * W + mx];
            if (ti < 0) continue;
          } else {
            // the wisp below the feet: a thin trail that tapers to nothing
            const w = (1 - (my - Hh) / Math.max(1, tail)) * 3.2 * m, d = Math.abs(x + 0.5 - cx);
            if (d > w) continue;
            ti = d > w - 1 ? 5 : 4;
          }
          // the first frames it tears loose it is all white
          if (t < LEAVE + 0.07) p.px(x, y, ti >= 6 ? C[5] : WHITE);
          else if (ti >= 5) p.dot(x, y, ti >= 6 ? WHITE : C[5], Math.min(1, a * 1.3));
          else p.blend(x, y, C[ti], a * 0.7);
        }
      }
      // its light
      const cy = top + Hh * s * 0.45;
      p.glow(sway(10), cy, 30, C[4], 0.42 * fadeIn * (1 - th));
      p.glow(sway(10), cy - 6, 14, C[5], 0.3 * fadeIn * (1 - th));
      ps.draw(p);
      lights.draw(p);
    },
  };
}

export const actorAlpha = () => 1;

// 3D: the body is left slumped and dimmed, the soul lifts out in front of it as the same pale ghost of its picture
// (a billboard, it looks the same from every side), its legs melting into a wisp that twists round the vertical in
// space. Motes pour off it into the volume round it, a few spiral up round it, the ring of light it tears loose
// with is a true circle on the floor, the far half behind the body, the near half in front.
export const three = {
  meta: { size: [100, 142], origin: [50, 124], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 7), R = new Rng(o.seed), floor = () => 0;
    const body = bodyOf(o.actor, C), rim = rimOf(body), W = body.w, Hh = body.h, waist = Math.round(Hh * 0.6);
    const tone = body.list.map((b) => (b.edge ? 6 : 3 + Math.min(2, Math.floor(luma(b.c) * 3.6))));
    const toneAt = new Int8Array(W * Hh).fill(-1);
    body.list.forEach((b, i) => (toneAt[b.my * W + b.mx] = tone[i]));
    const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[5], C[4], C[3]] }), lights = new Lights();
    let t = 0, left = false;
    const lift = () => o.height * ease.inOutSine(clamp((t - LEAVE) / (TOP - LEAVE)));
    const stretch = () => 1 + 0.22 * ease.inOutSine(clamp((t - LEAVE) / (TOP - LEAVE)));
    const sway = (row) => Math.sin(t * 3 - row * 0.12) * 2.2 * smooth(LEAVE, LEAVE + 0.5, t);
    const melt = () => smooth(LEAVE + 0.1, LEAVE + 0.9, t);
    const thin = () => smooth(TOP - 0.25, GONE, t);
    // a few motes that spiral up round the soul, each at its own radius, rate and height
    const orbit = Array.from({ length: 7 }, (_, i) => ({ ph: R.range(0, TAU), r: R.range(10, 16), w: R.range(2.4, 4) * (i % 2 ? 1 : -1), h: R.range(0, 1), v: R.range(0.22, 0.4) }));

    return {
      update(dt) {
        t += dt;
        if (!left && t >= LEAVE) {
          left = true;
          lights.add(0, -20, 50, C[4], 0.85, 0.55, 0);
          lights.add(0, -20, 24, WHITE, 0.8, 0.12, 0);
          for (let i = 0; i < 10; i++) {
            const c = R.pick(rim);
            ps.spawn3(P.STAR, c.x, c.y, R.range(-4, 4), R.range(-20, 20), -R.range(20, 60), R.range(-20, 20), R.range(0.4, 0.8), R.pick([WHITE, C[5]]), R.range(0.8, 1.8));
          }
        }
        // motes come off its edges as it rises, and pour off it as it thins, into the air all round it
        if (t > LEAVE && t < GONE) {
          const s = stretch(), y0 = body.y * s - lift(), th = thin();
          for (let n = 0; n < (th > 0 ? 3 : 1); n++) {
            if (!R.chance(th > 0 ? 0.9 : 0.5)) continue;
            const c = R.pick(rim), row = c.my;
            if (row / Hh < 1 - th * 1.1 - 0.05 && th > 0) continue;
            const x = c.x * (1 - 0.12 * (s - 1) * 4) + sway(row), y = y0 + c.my * s;
            const life = Math.min(R.range(0.5, 1.1), meta.duration - 0.1 - t, (y + 120) / 60);
            if (life > 0.1) {
              const a = R.range(0, TAU), sp = R.range(0, 14), z = R.range(-5, 5);
              ps.spawn3(R.chance(0.7) ? P.MOTE : P.STAR, x, y, z, R.range(-12, 12) + Math.cos(a) * sp, -R.range(25, 60), Math.sin(a) * sp + z * 1.5, life, R.pick([WHITE, C[5], C[5], C[4]]), R.range(0.5, 1));
            }
          }
        }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the body: its outline flares as the soul tears loose, then the body is left dimmed
        if (t < LEAVE + 0.3) {
          const k = t < LEAVE ? t / LEAVE : 1 - (t - LEAVE) / 0.3;
          for (const c of rim) if (rand(c.mx, c.my, Math.floor(t * 30)) < 0.25 + 0.7 * k) p.px(c.x, c.y, k > 0.7 ? WHITE : C[5]);
          q.glow(0, -19, 0, 26, C[4], 0.45 * k);
        }
        const dim = smooth(LEAVE, LEAVE + 0.6, t) * (1 - smooth(GONE, meta.duration - 0.1, t));
        if (dim > 0) for (const b of body.list) p.blend(b.x, b.y, SHADOW, 0.45 * dim);
        // a pale pool on the floor while it leaves, and a ring from the moment it tears loose
        const pool = smooth(0, LEAVE, t) * (1 - smooth(LEAVE + 0.4, TOP, t));
        if (pool > 0) q.glow(0, -1, 0, 26, C[4], 0.3 * pool);
        const rk = (t - LEAVE) / 0.5;
        if (rk > 0 && rk < 1) floorBand(q, 6 + 26 * ease.outCubic(rk), Math.max(1, 3 * (1 - rk)), 1.15 - rk, C, rk < 0.12);
        if (t >= LEAVE && t <= GONE + 0.1) {
          const s = stretch(), L = lift(), m = melt(), th = thin(), top = body.y * s - L, sx = 1 - 0.12 * (s - 1) * 4;
          const tail = Math.round(10 * m), fadeIn = clamp((t - LEAVE) / 0.15), feet = top + Hh * s;
          // the soul, drawn backward from the screen so stretching leaves no holes; see-through, its rim solid. It stands in front of the body
          q.at(...toward(q, 3), (pp) => {
            for (let y = Math.floor(top); y <= Math.ceil(feet); y++) {
              const my = Math.floor((y + 0.5 - top) / s);
              if (my < 0 || my >= Hh) continue;
              // rows below the waist pull in toward a wavy spine: legs melting into a wisp
              const k = my >= waist ? (my - waist + 1) / (Hh - waist + tail) : 0, narrow = 1 - k * m * 0.95;
              if (narrow <= 0.05) continue;
              const cx = sway(my) + Math.sin(my * 0.7 - t * 8) * 2 * k * m, a = (my >= waist ? 1 - k * 0.45 : 1) * fadeIn;
              for (let x = Math.floor(cx - W / 2 - 4); x <= Math.ceil(cx + W / 2 + 4); x++) {
                const mx = Math.floor((x + 0.5 - cx) / (sx * narrow) - body.x);
                if (th > 0 && my / (Hh + tail) > 1 - th * 1.25 + 0.25 * rand(mx, my, 5) - 0.1) continue;
                if (mx < 0 || mx >= W) continue;
                const ti = toneAt[my * W + mx];
                if (ti < 0) continue;
                if (t < LEAVE + 0.07) pp.px(x, y, ti >= 6 ? C[5] : WHITE);
                else if (ti >= 5) pp.dot(x, y, ti >= 6 ? WHITE : C[5], Math.min(1, a * 1.3));
                else pp.blend(x, y, C[ti], a * 0.7);
              }
            }
          });
          // below the feet the wisp is a twist of light in space: two strands winding round the axis, thinning to nothing
          if (m > 0.02) {
            const cx = sway(Hh), len = 20 * m * s, n = 18;
            for (let strand = 0; strand < 2; strand++)
              for (let j = 0; j <= n; j++) {
                const u = j / n, ang = t * 7 - u * 5 + strand * Math.PI, r = 3.4 * m * (1 - u) + 0.4;
                q.dot(cx + Math.cos(ang) * r, feet - 2 + u * len, Math.sin(ang) * r, u < 0.35 ? C[5] : C[4], (1 - u) * fadeIn * (1 - th) * 0.95);
              }
          }
          // motes spiralling up round it
          for (const m2 of orbit) {
            const f = (m2.h + (t - LEAVE) * m2.v) % 1, ang = m2.ph + (t - LEAVE) * m2.w, a = Math.sin(f * Math.PI) * fadeIn * (1 - th) * (1 - smooth(GONE - 0.3, GONE, t));
            if (a <= 0.05) continue;
            const r = m2.r * (0.7 + 0.3 * Math.sin(f * Math.PI)), y = feet + 6 - f * (feet + 6 - top + 10), x = sway(10) + Math.cos(ang) * r, z = Math.sin(ang) * r;
            q.dot(x, y, z, WHITE, a);
            q.dot(x - Math.sin(ang) * m2.w * 0.2 * Math.sign(m2.w), y + 1.5, z + Math.cos(ang) * 0.4, C[5], a * 0.7);
            q.glow(x, y, z, 4, C[5], 0.3 * a);
          }
          // its light
          const cy = top + Hh * s * 0.45;
          q.glow(sway(10), cy, 0, 30, C[4], 0.42 * fadeIn * (1 - th));
          q.glow(sway(10), cy - 6, 0, 14, C[5], 0.3 * fadeIn * (1 - th));
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
