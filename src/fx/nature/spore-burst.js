// The lumpy cloud (puffs that drift off their push, rise, swell from small to large and thin out, lit caps,
// motes with light) is adapted from Sprite Fusion's open-source poison cloud (https://www.spritefusion.com/pixel-art-vfx/poison),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, space, sparkle, clamp, smooth, ease, lerp, TAU, WHITE } from "../../core/index.js";
import { Gas, Gas3, ellipsoid, tube, shade3 } from "./_lib.js";

export const meta = {
  name: "Spore burst",
  desc: "A toadstool pushes up, swells and trembles as its gills glow, then squashes and puffs a lumpy cloud of glowing spores that billows up and drifts down twinkling.",
  tags: ["nature", "mushroom", "spores", "poison", "cloud", "ground", "one-shot"],
  size: [212, 132],
  origin: [106, 118],
  duration: 3.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#06141c", "#0c2a34", "#11484e", "#17706a", "#22a08a", "#4cd0a8", "#a8f4d0", "#f0fff6"],
    cap: ["#1a0c1e", "#3a1438", "#62204e", "#8e3462", "#bc5276", "#e88a96"],
    stem: ["#2a2230", "#5a4e5e", "#9a8e98", "#d8ccd0", "#f6eeee"],
    seed: 9,
  },
};

const GROW = 0.32, PUFF = 0.8, SINK = 2.15, SPOTS = [[-0.45, 0.45, 1.4], [0.1, 0.72, 1.8], [0.55, 0.38, 1.2], [-0.12, 0.25, 1], [0.3, 0.12, 0.9], [-0.7, 0.16, 0.8]];

// the toadstool at its current squash: a stem with a frilled ring, a domed cap lit from the upper left with
// pale spots, glowing gills beneath it
function toadstool(p, K, Sm, Cs, g, sx, sy, glow, sink) {
  const H = 17 * g, cw = 17 * sx * g, ch = 13 * sy * g, base = sink, top = base - H;
  if (g < 0.05) return;
  // stem
  for (let y = Math.floor(top); y <= Math.min(0, base); y++)
    for (let x = -4; x <= 4; x++) {
      const w = 3 + ((y - top) / H) * 1;
      if (Math.abs(x + 0.5) > w) continue;
      const q = (x + 0.5 + w) / (2 * w);
      p.px(x, y, Math.abs(x + 0.5) > w - 0.8 ? Sm[1] : q < 0.4 ? Sm[4] : q < 0.7 ? Sm[3] : Sm[2]);
    }
  const ring = top + H * 0.3;
  if (ring <= 0) for (let x = -5; x <= 5; x++) p.px(x, ring + (Math.abs(x) > 3 ? 1 : 0), Math.abs(x) > 4 ? Sm[1] : Sm[3]);
  // gills: a glowing underside
  const gy = top + 1;
  if (gy <= 0)
    for (let x = Math.floor(-cw); x <= Math.ceil(cw); x++) {
      const d = Math.abs(x + 0.5) / cw;
      if (d > 0.95) continue;
      p.px(x, gy, d < 0.3 ? Cs[0] : (x & 1) ? Sm[2] : Sm[3]);
      if (glow > 0.05) p.px(x, gy, glow > 0.6 && (x & 1) ? K[7] : K[5]);
    }
  if (glow > 0.05) p.glow(0, gy + 2, cw * 1.5 + 6, K[5], 0.5 * glow);
  // the cap: a dome with a curled lip
  p.shade(-cw - 1, top - ch - 1, cw + 1, top + 1, (x, y, out) => {
    const dx = x / cw, dy = (top - y) / ch, d = dx * dx + dy * dy;
    if (dy < -0.12 || d > 1.12 || y > 0) return;
    if (d > 1) return (out.c = Cs[0]);
    let i = dx < -0.35 && dy > 0.45 ? 5 : dx < 0.05 && dy > 0.3 ? 4 : dy < 0.18 ? 2 : dx > 0.55 ? 2 : 3;
    for (const [sx0, sy0, r] of SPOTS) {
      const ex = (dx - sx0) * cw, ey = (dy - sy0) * ch;
      if (ex * ex + ey * ey * 1.6 < r * r * g * g) i = ex < 0 && ey > 0 ? 9 : 8;
    }
    out.c = i === 9 ? Sm[4] : i === 8 ? Sm[3] : Cs[i];
  });
  p.px(-cw * 0.45, top - ch * 0.8, Cs[5]);
}

export function create(o) {
  const K = fit(o.palette, 8), Cs = fit(o.cap, 6), Sm = fit(o.stem, 5), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [K[7], K[6], K[5], K[4]], haze: K[5] });
  const gas = new Gas(), lights = new Lights();
  let t = 0, puffed = false, grown = false;
  const g = () => ease.outBack(clamp(t / GROW), 1.6) * (1 - ease.inCubic(clamp((t - SINK) / 0.45)));
  const charge = () => smooth(GROW, PUFF, t);
  // squash and stretch: it swells as it charges, squashes flat as it puffs, springs back
  const shape = () => {
    if (t < PUFF) {
      const k = charge(), j = Math.sin(t * 70) * 0.04 * k;
      return [1 + 0.28 * k + j, 1 + 0.22 * k - j];
    }
    const e = t - PUFF, sp = Math.exp(-e * 7) * Math.cos(e * 26);
    return [1 + 0.25 * sp, 1 - 0.35 * sp];
  };
  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);
      if (!grown) {
        grown = true;
        for (let i = 0; i < 10; i++) ps.spawn(P.GRIT, R.range(-4, 4), -1, R.range(-50, 50), -R.range(40, 120), R.range(0.5, 0.8), R.pick([Sm[1], Sm[2]]), 1);
        for (let i = 0; i < 4; i++) ps.spawn(P.DUST, R.range(-4, 4), -1, R.sign() * R.range(10, 40), -R.range(4, 12), R.range(0.4, 0.7), Sm[1], R.range(2, 3));
      }
      // charging: spores gather toward the gills
      if (t > GROW && t < PUFF - 0.05 && R.chance(0.25 * f)) {
        const a = R.range(Math.PI * 1.05, Math.PI * 1.95), d = R.range(20, 38), x = Math.cos(a) * d, y = -18 + Math.sin(a) * d * 0.7;
        ps.spawn(P.STREAK, x, y, -x * 3, (-18 - y) * 3, R.range(0.2, 0.3), K[6]);
      }
      if (!puffed && t >= PUFF) {
        puffed = true;
        lights.add(0, -22, 30, WHITE, 0.6, 0.1);
        lights.add(0, -28, 70, K[5], 0.55, 0.9);
        // the cloud: lumps shoved up and out from under the cap, swelling as they go
        for (let i = 0; i < 30; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(15, 95);
          gas.add(t, R.range(-8, 8), -20 + R.range(-3, 3), Math.cos(a) * sp * 1.3, Math.sin(a) * sp - 10, R.range(3, 5), R.range(8, 14), t + R.range(1.6, 2.2), R.range(5, 10));
        }
        for (let i = 0; i < 6; i++) {
          const sd = R.sign();
          gas.add(t, sd * R.range(6, 12), -5, sd * R.range(30, 70), -R.range(2, 14), R.range(2, 3), R.range(4, 6), t + R.range(0.8, 1.1), R.range(4, 8));
        }
        for (let i = 0; i < 40; i++) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), sp = R.range(40, 160);
          const mote = R.chance(0.5), k = mote ? 0.35 : 0.7;
          ps.spawn(mote ? P.MOTE : P.FLAKE, R.range(-5, 5), -20, Math.cos(a) * sp * k, Math.sin(a) * sp * k, R.range(1, 2), R.pick([K[7], K[6], K[6], K[5]]), R.range(0.6, 1.6));
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.STAR, R.range(-20, 20), -R.range(12, 40), 0, -6, R.range(0.3, 0.6), K[7], R.range(1, 2.4), R.range(0.05, 0.4));
        for (let i = 0; i < 8; i++) ps.spawn(P.DUST, R.sign() * R.range(4, 10), -1, R.sign() * R.range(30, 90), -R.range(2, 10), R.range(0.5, 0.9), K[3], R.range(2, 3.5));
      }
      // after it: spores keep drifting down out of the cloud, twinkling
      if (puffed && t < 2.6 && R.chance(0.12 * f)) ps.spawn(P.FLAKE, R.range(-40, 40), -R.range(30, 70), R.range(-8, 8), R.range(4, 14), Math.min(R.range(0.9, 1.5), meta.duration - 0.05 - t), R.chance(0.5) ? K[7] : K[6], R.range(0.6, 1.5));
      if (t > SINK && t < SINK + 0.4 && R.chance(0.15 * f)) ps.spawn(P.DUST, R.range(-5, 5), -1, R.sign() * R.range(10, 30), -R.range(2, 8), R.range(0.3, 0.5), Sm[1], R.range(1.5, 2.5));
      gas.prune(t);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      // a ring of glow on the floor round it while it charges and puffs
      const k = charge() * (1 - smooth(PUFF + 0.2, PUFF + 1.2, t));
      if (k > 0) for (let x = -20; x <= 20; x++) p.dot(x, 0, Math.abs(x) < 10 ? K[5] : K[4], k * (1 - Math.abs(x) / 21));
      p.glow(0, -2, 30, K[4], 0.25 * k);
      ps.draw(p, "back");
    },
    draw(p) {
      const [sx, sy] = shape(), gl = t < PUFF ? charge() * (0.75 + 0.25 * Math.sin(t * (20 + 30 * charge()))) : Math.max(0, 1 - (t - PUFF) * 1.5);
      toadstool(p, K, Sm, Cs, g(), sx, sy, gl, ease.inCubic(clamp((t - SINK) / 0.45)) * 20);
      // the cloud: teal lumps lit along their tops, a cool light through them
      gas.draw(p, t, K[2], K[4], K[6], K[7], 0.62, K[6]);
      // the cloud glows from within: a soft light riding its middle
      if (gas.list.length) {
        let cx = 0, cy = 0, n = 0;
        for (const q of gas.list) {
          const g2 = gas.at(q, t);
          (cx += g2.x * g2.a), (cy += g2.y * g2.a), (n += g2.a);
        }
        if (n > 0.2) p.glow(cx / n, cy / n, 46, K[5], Math.min(0.32, 0.03 * n));
      }
      const e = t - PUFF;
      if (e > 0 && e < 0.1) sparkle(p, 0, -20, 10 * (1 - e / 0.1), K[7], K[6], 0.6);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: a toadstool you can walk round: a round stem, a frilled ring, a domed cap spotted all over with its glowing
// gills under the rim; it puffs a cloud of lumps out in every direction, spores drifting down on all sides.
const SPOT3 = Array.from({ length: 9 }, (_, i) => {
  const az = i * 2.399963, el = 0.3 + ((i * 0.37) % 0.95), r = 0.17 + 0.07 * (i % 3), c = Math.cos(el);
  return [c * Math.cos(az), Math.sin(el), c * Math.sin(az), Math.cos(r)];
});

export const three = {
  meta: { size: [224, 148], origin: [112, 124], camera: { pitch: 0.3 } },
  create(o) {
    const K = fit(o.palette, 8), Cs = fit(o.cap, 6), Sm = fit(o.stem, 5), R = new Rng(o.seed), floor = () => 0;
    const ps = new Particles({ rng: R, ground: floor, sparks: [K[7], K[6], K[5], K[4]], haze: K[5] });
    const gas = new Gas3(), lights = new Lights();
    let t = 0, puffed = false, grown = false;
    const g = () => ease.outBack(clamp(t / GROW), 1.6) * (1 - ease.inCubic(clamp((t - SINK) / 0.45)));
    const charge = () => smooth(GROW, PUFF, t);
    const shape = () => {
      if (t < PUFF) {
        const k = charge(), j = Math.sin(t * 70) * 0.04 * k;
        return [1 + 0.28 * k + j, 1 + 0.22 * k - j];
      }
      const e = t - PUFF, sp = Math.exp(-e * 7) * Math.cos(e * 26);
      return [1 + 0.25 * sp, 1 - 0.35 * sp];
    };
    // a fan round the vertical: elevation e off straight up (cone), azimuth all the way round
    const dir = (cone) => {
      const e = R.range(0, cone), h = R.range(0, TAU);
      return [Math.sin(e) * Math.cos(h), -Math.cos(e), Math.sin(e) * Math.sin(h)];
    };
    return {
      update(dt) {
        t += dt;
        const f = Math.min(1, dt * 120);
        if (!grown) {
          grown = true;
          for (let i = 0; i < 10; i++) ps.spawn3(P.GRIT, R.range(-4, 4), -1, R.range(-4, 4), R.range(-50, 50), -R.range(40, 120), R.range(-50, 50), R.range(0.5, 0.8), R.pick([Sm[1], Sm[2]]), 1);
          for (let i = 0; i < 4; i++) {
            const a = R.range(0, TAU), v = R.range(10, 40);
            ps.spawn3(P.DUST, R.range(-4, 4), -1, R.range(-4, 4), Math.cos(a) * v, -R.range(4, 12), Math.sin(a) * v, R.range(0.4, 0.7), Sm[1], R.range(2, 3));
          }
        }
        // charging: spores gather toward the gills from every side
        if (t > GROW && t < PUFF - 0.05 && R.chance(0.3 * f)) {
          const a = R.range(0, TAU), el = R.range(0.05, 0.9), d = R.range(20, 38), x = Math.cos(a) * Math.cos(el) * d, z = Math.sin(a) * Math.cos(el) * d, y = -18 - Math.sin(el) * d * 0.8;
          ps.spawn3(P.STREAK, x, y, z, -x * 3, (-18 - y) * 3, -z * 3, R.range(0.2, 0.3), K[6]);
        }
        if (!puffed && t >= PUFF) {
          puffed = true;
          lights.add(0, -22, 30, WHITE, 0.6, 0.1, 0);
          lights.add(0, -28, 70, K[5], 0.55, 0.9, 0);
          // the cloud: lumps shoved up and out from under the cap, swelling as they go
          for (let i = 0; i < 34; i++) {
            const d = dir(1.1), sp = R.range(15, 95);
            gas.add(t, R.range(-8, 8), -20 + R.range(-3, 3), R.range(-8, 8), d[0] * sp * 1.3, d[1] * sp - 10, d[2] * sp * 1.3, R.range(3, 5), R.range(8, 14), t + R.range(1.6, 2.2), R.range(5, 10));
          }
          for (let i = 0; i < 8; i++) {
            const a = R.range(0, TAU), v = R.range(30, 70);
            gas.add(t, Math.cos(a) * R.range(6, 12), -5, Math.sin(a) * R.range(6, 12), Math.cos(a) * v, -R.range(2, 14), Math.sin(a) * v, R.range(2, 3), R.range(4, 6), t + R.range(0.8, 1.1), R.range(4, 8));
          }
          for (let i = 0; i < 44; i++) {
            const d = dir(1.4), sp = R.range(40, 160), mote = R.chance(0.5), k = mote ? 0.35 : 0.7;
            ps.spawn3(mote ? P.MOTE : P.FLAKE, R.range(-5, 5), -20, R.range(-5, 5), d[0] * sp * k, d[1] * sp * k, d[2] * sp * k, R.range(1, 2), R.pick([K[7], K[6], K[6], K[5]]), R.range(0.6, 1.6));
          }
          for (let i = 0; i < 6; i++) ps.spawn3(P.STAR, R.range(-20, 20), -R.range(12, 40), R.range(-20, 20), 0, -6, 0, R.range(0.3, 0.6), K[7], R.range(1, 2.4), R.range(0.05, 0.4));
          for (let i = 0; i < 10; i++) {
            const a = R.range(0, TAU), v = R.range(30, 90);
            ps.spawn3(P.DUST, Math.cos(a) * R.range(4, 10), -1, Math.sin(a) * R.range(4, 10), Math.cos(a) * v, -R.range(2, 10), Math.sin(a) * v, R.range(0.5, 0.9), K[3], R.range(2, 3.5));
          }
        }
        // after it: spores keep drifting down out of the cloud, twinkling
        if (puffed && t < 2.6 && R.chance(0.15 * f)) ps.spawn3(P.FLAKE, R.range(-48, 48), -R.range(30, 70), R.range(-48, 48), R.range(-8, 8), R.range(4, 14), R.range(-8, 8), Math.min(R.range(0.9, 1.5), meta.duration - 0.05 - t), R.chance(0.5) ? K[7] : K[6], R.range(0.6, 1.5));
        if (t > SINK && t < SINK + 0.4 && R.chance(0.15 * f)) ps.spawn3(P.DUST, R.range(-5, 5), -1, R.range(-5, 5), R.sign() * R.range(10, 30), -R.range(2, 8), R.sign() * R.range(10, 30), R.range(0.3, 0.5), Sm[1], R.range(1.5, 2.5));
        gas.prune(t);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), [sx, sy] = shape(), gl = t < PUFF ? charge() * (0.75 + 0.25 * Math.sin(t * (20 + 30 * charge()))) : Math.max(0, 1 - (t - PUFF) * 1.5), gg = g();
        const sink = ease.inCubic(clamp((t - SINK) / 0.45)) * 20, H = 17 * gg, cw = 17 * sx * gg, ch = 13 * sy * gg, top = sink - H;
        // a ring of glow on the floor round it while it charges and puffs
        const kk = charge() * (1 - smooth(PUFF + 0.2, PUFF + 1.2, t));
        if (kk > 0)
          q.plane(0, 0, 0, null, 22, (u, v, out) => {
            const d = Math.hypot(u, v);
            if (d > 21) return;
            out.c = d < 10 ? K[5] : K[4];
            out.a = kk * (1 - d / 21);
            out.l = K[5];
            out.k = 0.2 * kk * (1 - d / 21);
          });
        if (gg > 0.05) {
          // the stem: a round shaft, thicker at the foot, lit on its left
          tube(q, [[0, sink, 0], [0, top, 0]], (u) => 4 - u, (nx, ny, nz) => (nz < 0.2 ? Sm[1] : shade3(Sm, nx, ny, nz)), 0);
          const ring = top + H * 0.3;
          if (ring <= 0) q.ring(0, ring, 0, 5.6, 2, (v) => (v > 0.7 ? Sm[1] : Sm[3]));
          // the cap: a dome spotted with pale spots, the gills glowing under its rim
          const gy = top + 1;
          if (gy <= 0 && gl > 0.05)
            q.ring(0, gy, 0, cw * 0.97, 2.4, (v, a) => ((Math.floor((a * cw) / 4) & 1) ? K[7] : K[5]), 1);
          ellipsoid(q, 0, top, 0, cw, ch, cw, (nx, ny, nz, X, Y, Z) => {
            if (nz < 0.14) return Cs[0];
            const l = Math.hypot(X / cw, Y / ch, Z / cw) || 1, ox = X / cw / l, oy = -Y / ch / l, oz = Z / cw / l;
            for (const [sx0, sy0, sz0, cr] of SPOT3) if (ox * sx0 + oy * sy0 + oz * sz0 > 1 - (1 - cr) * gg) return shade3(Sm, nx, ny, nz);
            return shade3(Cs, nx, ny, nz, 0.9, 0.02);
          }, { clipY: 0.01, floor: 0 });
        }
        if (gl > 0.05) q.glow(0, top + 2, 0, cw * 1.5 + 6, K[5], 0.5 * gl);
        // the cloud: teal lumps lit along their tops, a cool light through them
        gas.draw(q, t, K[2], K[4], K[6], K[7], 0.62, K[6]);
        // the cloud glows from within: a soft light riding its middle
        if (gas.list.length) {
          let cx = 0, cy = 0, cz = 0, n = 0;
          for (const g0 of gas.list) {
            const g2 = gas.at(g0, t);
            (cx += g2.x * g2.a), (cy += g2.y * g2.a), (cz += g2.z * g2.a), (n += g2.a);
          }
          if (n > 0.2) q.glow(cx / n, cy / n, cz / n, 46, K[5], Math.min(0.32, 0.03 * n));
        }
        const e = t - PUFF;
        if (e > 0 && e < 0.1) q.at(0, -20, 0, (pp) => sparkle(pp, 0, 0, 10 * (1 - e / 0.1), K[7], K[6], 0.6));
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
