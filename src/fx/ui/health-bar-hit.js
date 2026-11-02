import { Particles, Bits, Lights, P, B, Rng, fit, space, createFrame, Painter, sparkle, clamp, seg, ease, TAU, WHITE, hex, mix } from "../../core/index.js";
import { panel, shake, HEART, heartPal } from "./_lib.js";

export const meta = {
  name: "Health bar hit",
  desc: "A segmented health bar takes a hit: it jolts and dips, the lost chunk flashes white and sheds chips, holds, then drains away behind a sparking edge.",
  tags: ["ui", "health", "hud", "damage", "bar", "one-shot"],
  size: [160, 64],
  origin: [80, 30],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { palette: ["#1a0508", "#4a0b12", "#8c1420", "#d42a2e", "#ff5a4a", "#ff9a86", "#ffd8cc", "#ffffff"], from: 0.8, to: 0.45, seed: 3 },
};

const HIT = 0.2, DRAIN = 0.62, DRAINED = 1.05, FOLD = 1.62;
const BX = -48, BW = 104, BY = -4, BH = 8, CELLS = 10;
const INK = { outline: hex("#0d0a14"), rim: hex("#4a4060"), top: hex("#2a2338"), body: hex("#1e1929"), low: hex("#141019") };

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), from = clamp(o.from), to = clamp(Math.min(o.to, from));
  const ps = new Particles({ rng: R, sparks: [C[7], C[6], C[5], C[3]] }), bits = new Bits(), lights = new Lights();
  const PALE = mix(C[6], hex("#ffe9a8"), 0.5), pal = heartPal(C);
  let t = 0, hit = false;
  const end = meta.duration - 0.05;
  // the white chunk's right end: holds, then drains down to the new value
  const ghostAt = (t) => (t < DRAIN ? from : from - (from - to) * ease.inOutQuad(seg(t, DRAIN, DRAINED)));
  return {
    update(dt) {
      t += dt;
      if (!hit && t >= HIT) {
        hit = true;
        lights.add(BX + BW * (to + from) / 2, BY + 4, 50, C[5], 0.7, 0.3);
        lights.add(BX + BW * (to + from) / 2, BY + 4, 24, WHITE, 0.6, 0.08);
        // chips break off the lost chunk
        for (let i = 0; i < 12; i++) {
          const x = BX + BW * R.range(to, from), an = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(50, 130);
          bits.add({ kind: B.SHARD, x, y: BY + R.range(1, 7), vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 0.45, drag: 1.2, life: R.range(0.35, 0.6), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.5, 3), c: R.pick([C[7], C[6], C[5], C[4]]) });
        }
        for (let i = 0; i < 10; i++) {
          const an = R.range(0, TAU), sp = R.range(60, 160);
          ps.spawn(P.SPARK, BX + BW * R.range(to, from), BY + 4, Math.cos(an) * sp, Math.sin(an) * sp * 0.6 - 30, R.range(0.12, 0.26));
        }
      }
      // the draining edge sparks as it runs back
      if (t > DRAIN && t < DRAINED && R.chance(0.5)) {
        const x = BX + BW * ghostAt(t);
        ps.spawn(P.SPARK, x, BY + R.range(1, 7), R.range(-20, 60), -R.range(20, 70), R.range(0.1, 0.22));
      }
      bits.update(dt);
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      const [jx, jy] = shake(t, 3, HIT, 0.28, o.seed), dip = t > HIT ? Math.round(3 * Math.exp(-(t - HIT) * 10) * Math.cos((t - HIT) * 24)) : 0;
      const open = ease.outBack(seg(t, 0, 0.14), 2) * (1 - ease.inBack(seg(t, FOLD, FOLD + 0.18), 2));
      if (open > 0.04) {
        const ox = jx, oy = jy + dip, h = 18 * open, y0 = -9 + (18 - h) / 2;
        // the frame flashes red on the hit
        const red = t >= HIT && t < HIT + 0.07;
        panel(p, BX - 22 + ox, y0 + oy, BW + 26, h, red ? { ...INK, outline: C[4], rim: C[6] } : INK, { r: Math.min(5, h / 2) });
        if (open > 0.75) {
          // the track, then the fill (red, lit on top, dark below), the white chunk, and the cell dividers
          const val = t < HIT ? from : to, ghost = t < HIT ? from : ghostAt(t), white = t >= HIT && t < HIT + 0.07;
          p.rect(BX + ox, BY + oy, BW, BH, hex("#0d0a14"));
          p.shade(BX + ox, BY + oy, BX + BW + ox, BY + BH + oy, (x, y) => {
            const u = (x - BX - ox) / BW, v = y - BY - oy;
            if (u < val) return v < 1 ? C[6] : v < 2 ? C[5] : v < 5 ? C[4] : v < 7 ? C[3] : C[2];
            if (u < ghost) return white ? WHITE : v < 1 ? WHITE : v < 6 ? PALE : C[5];
            return v < 1 ? hex("#2a2338") : hex("#191424");
          });
          for (let i = 1; i < CELLS; i++) p.rect(BX + ox + Math.round((BW * i) / CELLS), BY + oy, 1, BH, hex("#0d0a14"));
          // the new edge of the health glints, and a hot spark rides the draining edge
          if (t > HIT) p.rect(BX + ox + Math.round(BW * val) - 1, BY + oy, 1, BH, C[7]);
          if (t > DRAIN && t < DRAINED) {
            const gx = BX + ox + BW * ghost;
            p.rect(gx - 1, BY + oy - 1, 2, BH + 2, WHITE);
            p.glow(gx, BY + oy + 4, 10, C[5], 0.6);
          }
          p.glow(BX + ox + BW * val * 0.5, BY + oy + 4, BW * 0.4, C[3], 0.12);
          // the heart: jumps and flashes white on the hit, glints before it
          const hk = t - HIT, hop = hk > 0 ? Math.round(-3 * Math.exp(-hk * 12) * Math.abs(Math.cos(hk * 22))) : 0;
          p.sprite(HEART, pal, BX - 17 + ox, oy - 6 + hop);
          if (hk > 0 && hk < 0.07) p.sprite(HEART, { ...pal, k: 0, w: WHITE, h: WHITE, o: WHITE, m: WHITE, d: C[6] }, BX - 17 + ox, oy - 6 + hop);
          p.glow(BX - 11 + ox, oy, 10, C[4], 0.25 + (hk > 0 && hk < 0.2 ? 0.4 : 0));
          if (t < HIT && (t * 2.5) % 1 < 0.3) sparkle(p, BX - 14 + ox, oy - 3, 2, C[7], C[6], 0.3);
        }
      }
      bits.draw(p);
      ps.draw(p);
      lights.draw(p);
    },
  };
}

// ---- 3D: the bar is a real HUD strip bent round a cylinder and hung in the world; chips fall to the floor ------------
// The bar is painted flat into a texture each frame; thin slices of the bent strip sample it from their own planes, so it
// keeps its pixels face on, narrows round the bend and reads again from behind.

const RAD = 80, H3 = -34, SLICE = 10, SR = 11, TW = 176, TH = 44, SHIFT = 5;
// the world point on the strip at local x lx (the bar's own 2D x), v px down of its middle, off out from its face; the strip's
// frame is turned about the vertical axis by the camera's yaw (a cylindrical billboard), so its middle always faces the camera
const rot = (x, z, yaw) => [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
const onBar = (lx, v, off = 0, yaw = 0) => {
  const th = (lx + SHIFT) / RAD, [x, z] = rot(RAD * Math.sin(th) + Math.sin(th) * off, RAD * (Math.cos(th) - 1) + Math.cos(th) * off, yaw);
  return [x, H3 + v, z];
};
const faceOf = (lx, yaw = 0) => {
  const th = (lx + SHIFT) / RAD, [x, z] = rot(Math.sin(th), Math.cos(th), yaw);
  return [x, 0, z];
};
const sphere = (R) => {
  const a = R.range(0, TAU), c = R.range(-1, 1), s = Math.sqrt(1 - c * c);
  return [Math.cos(a) * s, c, Math.sin(a) * s];
};

export const three = {
  meta: { size: [184, 108], origin: [92, 72], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const C = fit(o.palette, 8), R = new Rng(o.seed), from = clamp(o.from), to = clamp(Math.min(o.to, from)), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] }), bits = new Bits({ ground: floor }), lights = new Lights();
    const PALE = mix(C[6], hex("#ffe9a8"), 0.5), pal = heartPal(C), tex = createFrame(TW, TH), tp = new Painter(tex);
    let t = 0, hit = false;
    const mid = BX + (BW * (to + from)) / 2;
    // the white chunk's right end: holds, then drains down to the new value
    const ghostAt = (t) => (t < DRAIN ? from : from - (from - to) * ease.inOutQuad(seg(t, DRAIN, DRAINED)));
    return {
      update(dt) {
        t += dt;
        const Y = o.camera?.yaw ?? 0;
        if (!hit && t >= HIT) {
          hit = true;
          const M = onBar(mid, 4 + BY, 3, Y);
          lights.add(M[0], M[1], 60, C[5], 0.7, 0.3, M[2]);
          lights.add(M[0], M[1], 26, WHITE, 0.6, 0.08, M[2]);
          // chips break off the lost chunk, fly out every way round and fall to the floor
          for (let i = 0; i < 14; i++) {
            const c = onBar(BX + BW * R.range(to, from), BY + R.range(1, 7), 2, Y), th = R.range(-1.2, 1.2), ph = R.range(0, TAU), sp = R.range(50, 130), h = Math.abs(Math.sin(th)) * sp;
            // half of them are lit red chunks with a volume of their own, half thin bright shards
            const chunk = i % 2 === 0;
            bits.add({ kind: chunk ? B.CHUNK : B.SHARD, x: c[0], y: c[1], z: c[2], vx: Math.cos(ph) * h, vy: -Math.cos(th) * sp, vz: Math.sin(ph) * h, g: 0.6, drag: 1, bounce: 0.35, life: R.range(1.0, 1.5), a: R.range(0, TAU), va: R.range(-20, 20), s: chunk ? R.range(1.5, 2.4) : R.range(2, 3.5), ramp: [C[0], C[1], C[2], C[4], C[6]], c: R.pick([C[7], C[6], C[5], C[4]]) });
          }
          for (let i = 0; i < 14; i++) {
            const [dx, dy, dz] = sphere(R), sp = R.range(60, 160), c = onBar(BX + BW * R.range(to, from), BY + 4, 3, Y);
            ps.spawn3(P.SPARK, c[0], c[1], c[2], dx * sp, dy * sp - 30, dz * sp, R.range(0.12, 0.26));
          }
        }
        // the draining edge sparks as it runs back
        if (t > DRAIN && t < DRAINED && R.chance(0.5)) {
          const x = BX + BW * ghostAt(t), c = onBar(x, BY + R.range(1, 7), 3, Y), n = faceOf(x, Y), a = R.range(0, TAU), s = R.range(5, 25), al = R.range(-20, 60);
          // along the strip's face (its tangent), up, and a little out
          ps.spawn3(P.SPARK, c[0], c[1], c[2], n[2] * al + Math.cos(a) * s, -R.range(20, 70), -n[0] * al + Math.sin(a) * s, R.range(0.1, 0.22));
        }
        bits.update(dt);
        ps.update(dt);
        lights.update(dt);
      },

      draw(p) {
        const q = space(p, o), yaw = q.camera.yaw ?? 0, ctr = rot(0, -9, yaw);
        const [jx, jy] = shake(t, 3, HIT, 0.28, o.seed), dip = t > HIT ? Math.round(3 * Math.exp(-(t - HIT) * 10) * Math.cos((t - HIT) * 24)) : 0;
        const open = ease.outBack(seg(t, 0, 0.14), 2) * (1 - ease.inBack(seg(t, FOLD, FOLD + 0.18), 2));
        const M = onBar(mid, 4 + BY, 3, yaw), nM = faceOf(mid, yaw), rk = (t - HIT) / 0.3, val = t < HIT ? from : to;
        if (open > 0.04) {
          // the flat bar, painted as the 2D one is
          tex.color.fill(0);
          tp.reset().place(TW / 2 + SHIFT, TH / 2);
          const ox = jx, oy = jy + dip, h = 18 * open, y0 = -9 + (18 - h) / 2;
          // the frame flashes red on the hit
          const red = t >= HIT && t < HIT + 0.07;
          panel(tp, BX - 22 + ox, y0 + oy, BW + 26, h, red ? { ...INK, outline: C[4], rim: C[6] } : INK, { r: Math.min(5, h / 2) });
          if (open > 0.75) {
            // the track, then the fill (red, lit on top, dark below), the white chunk, and the cell dividers
            const ghost = t < HIT ? from : ghostAt(t), white = t >= HIT && t < HIT + 0.07;
            tp.rect(BX + ox, BY + oy, BW, BH, hex("#0d0a14"));
            tp.shade(BX + ox, BY + oy, BX + BW + ox, BY + BH + oy, (x, y) => {
              const u = (x - BX - ox) / BW, v = y - BY - oy;
              if (u < val) return v < 1 ? C[6] : v < 2 ? C[5] : v < 5 ? C[4] : v < 7 ? C[3] : C[2];
              if (u < ghost) return white ? WHITE : v < 1 ? WHITE : v < 6 ? PALE : C[5];
              return v < 1 ? hex("#2a2338") : hex("#191424");
            });
            for (let i = 1; i < CELLS; i++) tp.rect(BX + ox + Math.round((BW * i) / CELLS), BY + oy, 1, BH, hex("#0d0a14"));
            // the new edge of the health glints, and a hot spark rides the draining edge
            if (t > HIT) tp.rect(BX + ox + Math.round(BW * val) - 1, BY + oy, 1, BH, C[7]);
            if (t > DRAIN && t < DRAINED) {
              const gx = BX + ox + BW * ghost;
              tp.rect(gx - 1, BY + oy - 1, 2, BH + 2, WHITE);
            }
            // the heart: jumps and flashes white on the hit, glints before it
            const hk = t - HIT, hop = hk > 0 ? Math.round(-3 * Math.exp(-hk * 12) * Math.abs(Math.cos(hk * 22))) : 0;
            tp.sprite(HEART, pal, BX - 17 + ox, oy - 6 + hop);
            if (hk > 0 && hk < 0.07) tp.sprite(HEART, { ...pal, k: 0, w: WHITE, h: WHITE, o: WHITE, m: WHITE, d: C[6] }, BX - 17 + ox, oy - 6 + hop);
            if (t < HIT && (t * 2.5) % 1 < 0.3) sparkle(tp, BX - 14 + ox, oy - 3, 2, C[7], C[6], 0.3);
          }
          // thin slices, each in its own plane, bend it round the cylinder
          for (let s = -80; s <= 80; s += SLICE) {
            const th = s / RAD, [x, z] = rot(RAD * Math.sin(th), RAD * (Math.cos(th) - 1), yaw), nr = rot(Math.sin(th), Math.cos(th), yaw), n = [nr[0], 0, nr[1]];
            for (const cv of [-4, 4])
              q.plane(x, H3 + cv, z, n, SR, (u, v, out) => {
                const X = Math.floor(TW / 2 + s + u), Y = Math.floor(TH / 2 + cv + v);
                if (X < 0 || Y < 0 || X >= TW || Y >= TH) return;
                const c = tex.color[Y * TW + X], a = c >>> 24;
                if (!a) return;
                out.c = a === 255 ? c : (c & 0xffffff) | 0xff000000;
                out.a = a / 255;
                out.blend = a < 255;
              });
          }
        }
        bits.draw(q);
        // under the bar: a shadow, a red pool of light that flares on the hit, and rings racing out from the chunk
        if (open > 0.04)
          q.plane(ctr[0], 0, ctr[1], null, 64, (u, v, out) => {
            const d = Math.hypot(u, v) / 64;
            if (d > 1) return;
            out.c = INK.outline;
            out.a = 0.5 * Math.min(1, open) * (1 - d * d);
            out.blend = true;
            out.l = C[3];
            out.k = (0.14 * val + (rk > 0 && rk < 0.6 ? 0.3 * (1 - rk / 0.6) : 0)) * (1 - d) * (1 - d);
          });
        if (rk > 0 && rk < 1) {
          q.ring(M[0], 0, M[2], 8 + 38 * ease.outCubic(rk), 2.5 * (1 - rk) + 1, rk < 0.3 ? WHITE : C[5], 1.1 * (1 - rk));
          q.ring(M[0], M[1], M[2], 6 + 26 * ease.outCubic(rk), 2.4, rk < 0.3 ? WHITE : C[5], 1.1 * (1 - rk), nM);
        }
        // the bar's glows: along the fill, round the heart, and at the draining edge
        if (open > 0.75) {
          const hk = t - HIT, gx = BX + BW * (t < HIT ? from : ghostAt(t));
          const Fm = onBar(BX + (BW * val) * 0.5, BY + 4, 4, yaw), Hh = onBar(BX - 11, 0, 4, yaw);
          q.glow(Fm[0], Fm[1], Fm[2], BW * 0.4, C[3], 0.12);
          q.glow(Hh[0], Hh[1], Hh[2], 10, C[4], 0.25 + (hk > 0 && hk < 0.2 ? 0.4 : 0));
          if (t > DRAIN && t < DRAINED) {
            const Ge = onBar(gx, BY + 4, 4, yaw);
            q.glow(Ge[0], Ge[1], Ge[2], 10, C[5], 0.6);
          }
        }
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
