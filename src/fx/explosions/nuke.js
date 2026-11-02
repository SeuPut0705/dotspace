// The fire puffs, sparks and embers are adapted from Sprite Fusion's open-source explosion
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, PF, Rng, fit, band, clamp, smooth, ease, lerp, space, TAU, WHITE, hex, mix } from "../../core/index.js";
import { fireRamp, drawPs, draft, cull, fadeEdges, pool, haze, glowDome, Plume, Column, drawPs3, pool3 } from "./_lib.js";

export const meta = {
  name: "Nuke",
  desc: "A blinding white frame, then a fireball lifts on a thin stem into a wide rolling cap that glows from inside; a white skirt flashes and a dust surge sweeps the floor.",
  tags: ["explosion", "nuke", "mushroom", "cloud", "big", "ground", "one-shot"],
  size: [400, 320],
  origin: [200, 284],
  duration: 9,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], dust: "#8a7466", seed: 5 },
};

const FLASH = 0.05, LIFT = 0.07, SKIRT = [0.55, 1.75];
// the cap's smoke: a lit crescent, two mid tones, a dark underside, the darkest hollow
const CAP = ["#a0918c", "#7c6f6e", "#5f5458", "#40373f", "#271f27"].map(hex);

export function create(o) {
  const F = fit(o.palette, 8), FR = fireRamp(F), R = new Rng(o.seed), floor = () => 0, dust = hex(o.dust);
  const DUST = [mix(dust, WHITE, 0.22), dust, mix(dust, hex("#3a3040"), 0.35), mix(dust, hex("#2a2330"), 0.6), mix(dust, hex("#1c1720"), 0.8)];
  const [W, H] = meta.size, [OX, OY] = meta.origin, X0 = -OX + 3, X1 = W - OX - 3, Y0 = -OY + 3, Y1 = H - OY - 3;
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]] }), lights = new Lights();
  // a wide, flat cap rolling like a torus: lobes go up the middle, out over the top and curl under at the rim
  const plume = new Plume(R, {
    x: 0, y: -26, rise: 152, tau: 1.7, drift: 3, tube: [14, 26], ring: [4, 46], grow: 1.6, n: 50, size: [9.5, 14.5], swell: 0.45,
    spin: 2.4, spinTau: 2.4, heat: 1.25, cool: 0.42, under: 0.6, tilt: 0.16, squash: 0.48, fade: [6.0, 8.3], spread: 26,
    style: 1, inner: true, hollow: true, fray: [4, 1.6, 6.4],
  });
  plume.onFray = (x, y, r, ux, uy) => ps.spawn(P.SMOKE, x, y, ux * R.range(10, 26), uy * R.range(4, 12) - R.range(2, 8), R.range(1, 1.7), CAP[R.int(0, 1)], r * R.range(0.3, 0.45));
  // a thin stem that keeps feeding the cap, then breaks up from the bottom
  const column = new Column(R, { w: 3.5, foot: 22, speed: 125, size: [5.5, 7], n: 84, sway: 1.4, style: 1 });
  const top = () => { const S = plume.shape(); return S.y + S.tube * 0.3; };
  // the condensation skirt: a veil arching over the cap and a bell flaring round the stem
  const veil = Array.from({ length: 72 }, (_, i) => ({ a: -Math.PI * ((i + R.range(0.2, 0.8)) / 72), s: R.range(6, 10), w: R.range(0.97, 1.06), e: R.range(0.6, 1.3), dx: R.range(-1, 1), dy: R.range(-1, 0.2) }));
  const skirt = Array.from({ length: 110 }, () => ({ ph: R.range(0, TAU), v: R.range(0, 1), s: R.range(5, 9), w: R.range(0.9, 1.06), e: R.range(0.6, 1.3), dx: R.range(-1, 1), dy: R.range(-1, 0.4) }));
  let t = 0, boomed = false;

  const boom = () => {
    lights.add(0, -60, 150, F[4], 0.7, 1.6);
    // the fireball's first fire, sparks and embers
    for (let i = 0; i < 26; i++) {
      const a = R.range(-Math.PI, 0), d = R.range(4, 22), sp = R.range(40, 160);
      ps.spawn(P.FIRE, Math.cos(a) * d, -26 + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 30, R.range(0.6, 1.1), 0, R.range(7, 12), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
    }
    for (let i = 0; i < 90; i++) {
      const a = R.range(-Math.PI - 0.3, 0.3), sp = R.range(200, 420);
      ps.spawn(P.SPARK, Math.cos(a) * 18, -26 + Math.sin(a) * 18, Math.cos(a) * sp, Math.sin(a) * sp - 60, R.range(0.3, 0.8));
    }
    for (let i = 0; i < 50; i++) {
      const a = R.range(-Math.PI, 0), sp = R.range(30, 140);
      ps.spawn(P.EMBER, Math.cos(a) * 20, -26 + Math.sin(a) * 20, Math.cos(a) * sp, Math.sin(a) * sp - 60, R.range(1.6, 3.4), F[3]);
    }
    // the base surge: dust thrown out along the floor in every direction, racing to the edges; a slower ring behind
    for (let i = 0; i < 120; i++) {
      const slow = i >= 92, a = R.range(0, TAU), c = Math.cos(a), s = Math.sin(a), sp = slow ? R.range(110, 200) : R.range(240, 440);
      ps.spawn(P.SMOKE, c * 14, s * 14 * 0.16 - R.range(1, 3), c * sp, s * sp * (s > 0 ? 0.06 : 0.14) - R.range(0, slow ? 6 : 3), R.range(1.8, 3), dust, slow ? R.range(8, 11) : R.range(5, 9), R.range(0.05, 0.2));
    }
    for (let i = 0; i < 40; i++) {
      const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.7, sp = R.range(150, 380) * (1 - 0.4 * Math.abs(u));
      ps.spawn(P.GRIT, u * 12, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.2, 2), R.pick(DUST.slice(0, 3)), R.chance(0.4) ? 2 : 1);
    }
  };

  return {
    update(dt) {
      t += dt;
      if (!boomed && t >= LIFT) (boomed = true), boom();
      if (t >= LIFT) plume.update(dt);
      const S = plume.shape(), hot = plume.hot();
      column.update(dt, top(), t > 0.35 && t < 4.9 ? 1 : 0);
      // afterwinds: dust drawn in along the floor and up the stem
      if (t > 0.9 && t < 4.6 && R.chance(9 * dt)) {
        const s = R.sign();
        ps.spawn(P.VAPOUR, s * R.range(50, 160), -R.range(2, 6), -s * R.range(20, 45), -R.range(0, 6), R.range(1.2, 1.8), DUST[1], R.range(5, 8));
      }
      if (t > 0.3 && t < 3.4 && R.chance(14 * hot * dt)) {
        const a = R.range(0, TAU);
        ps.spawn(P.EMBER, S.x + Math.cos(a) * (S.ring + S.tube), S.y + Math.sin(a) * S.tube * 0.5, Math.cos(a) * R.range(30, 80), -R.range(10, 50), R.range(1.4, 2.6), F[3]);
      }
      draft(ps, dt, { x: 0, top: S.y + S.tube * 0.3, w: 9, up: 160, pull: 120, low: 14, reach: 170, k: 1 - smooth(4.4, 5.4, t) });
      ps.update(dt);
      cull(ps, X0, Y0, X1, Y1);
      fadeEdges(ps, X0, X1, 34, Y1);
      lights.update(dt);
    },
    drawBack(p) {
      if (t < FLASH) return;
      const S = plume.shape();
      // the ground shock: a ring racing out along the floor ahead of the dust (far half)
      const k = (t - LIFT) / 0.8;
      if (k > 0 && k < 1) band(p, 0, 0.5, 196 * ease.outCubic(k), 0.16, Math.max(1, 5 * (1 - k)), 1.15 - k, [DUST[2], DUST[0], F[5], F[7]], (g) => Math.sin(g) < 0);
      drawPs(p, ps, "back", FR);
      skirtDraw(p, t, S, veil, skirt, true);
      plume.draw(p, FR, CAP);
      // the dark hollow under the cap where the stem goes in, its heart still warm while the inside glows
      const E = plume.ember(), gone = smooth(plume.o.fade[0], plume.o.fade[1] - 0.6, t - LIFT);
      if (gone < 1) {
        const hy = S.y + S.tube * 0.42, rx = S.ring * 0.7 + 5, ry = S.tube * 0.28 + 2;
        haze(p, 0, hy, rx, ry, (d) => (d < 0.55 * E ? mix(CAP[4], FR[d < 0.3 * E ? 5 : 6], 0.75 * E) : CAP[4]), (d) => (d < 0.6 ? 0.8 : d < 0.85 ? 0.5 : 0.22) * (1 - gone));
      }
      column.draw(p, top(), FR, DUST, clamp(1 - t / 1.8), E * 0.8);
      skirtDraw(p, t, S, veil, skirt, false);
      pool(p, 0, 1, 140, 16, F[3], 0.3 * plume.hot());
    },
    draw(p) {
      // the blinding frame: a white-hot core in a wash of white light that fades out before the canvas edges
      if (t < FLASH) {
        wash(p, OX, OY, W, H, 0, -40, WHITE, 1.6);
        return p.circle(0, -40, 64, WHITE);
      }
      const k = (t - LIFT) / 0.8;
      if (k > 0 && k < 1) band(p, 0, 0.5, 196 * ease.outCubic(k), 0.16, Math.max(1, 5 * (1 - k)), 1.15 - k, [DUST[2], DUST[0], F[5], F[7]], (g) => Math.sin(g) >= 0);
      // out of the white: a crisp white-hot sphere, cooling into the fireball
      const f = (t - FLASH) / 0.13;
      if (f < 1) {
        const r = 22 + 8 * f;
        p.circle(0, -26, r + 1.5, F[2]);
        p.circle(0, -26, r, f < 0.5 ? F[6] : F[5]);
        p.circle(0, -26, r * 0.62, f < 0.5 ? WHITE : F[6]);
      }
      drawPs(p, ps, "front", FR);
      // the shock in the air: a thin bright shell racing out from the fireball, cut off by the floor and the canvas
      const u = (t - FLASH) / 0.7;
      if (u < 1) {
        const r = 30 + 250 * ease.outCubic(u), cy = -26;
        const out = (a) => cy + Math.sin(a) * r > 0 || Math.abs(Math.cos(a) * r) > OX - 3 || cy + Math.sin(a) * r < 3 - OY;
        p.ring(0, cy, r, Math.max(1, 2.5 * (1 - u)), u < 0.3 ? WHITE : F[6], (v, a) => (out(a) ? 0 : 1.1 - u));
        glowDome(p, 0, cy, r, 7, F[5], 0.3 * (1 - u), [3 - OX, 3 - OY, W - OX - 4, 0]);
      }
      // the light of it: everything washed white, falling away fast, then the fireball's own warm light
      const w = Math.exp(-(t - FLASH) / 0.13);
      if (w > 0.02) wash(p, OX, OY, W, H, 0, -40, WHITE, 0.9 * w);
      lights.draw(p);
    },
  };
}

// light over most of the canvas, brightest near (cx, cy), falling to nothing just inside the canvas edges so it
// never shows the canvas as a box
function wash(p, OX, OY, W, H, cx, cy, c, k) {
  const rx = Math.min(OX + cx, W - OX - cx) - 4, up = OY + cy - 4, down = H - OY - cy - 4;
  p.shade(-OX, -OY, W - OX - 1, H - OY - 1, (x, y, out) => {
    const d = Math.hypot((x - cx) / rx, (y - cy) / (y < cy ? up : down));
    out.l = c;
    out.k = k * (1 - smooth(0, 1, d));
  });
}

// the condensation skirt: a white veil that flashes over the cap and a bell that flares round the stem, edged with a
// crisp white rim, then evaporates into wisps that drift apart and thin; far half behind the cloud, near in front
function skirtDraw(p, t, S, veil, skirt, back) {
  const u = (t - SKIRT[0]) / (SKIRT[1] - SKIRT[0]);
  if (u <= 0 || u >= 1) return;
  const a = Math.min(1, u / 0.06) * Math.pow(1 - u, 1.5) * 0.6, capR = (S.ring + S.tube) * 1.1, y0 = S.y + S.tube * 0.3, y1 = S.y * 0.55;
  if (!back) {
    for (const q of veil) {
      const ev = u * u * q.e, R = capR * q.w * (1 + ev * 0.2);
      p.disc(Math.cos(q.a) * R + q.dx * ev * 10, S.y + Math.sin(q.a) * (S.tube * 1.15 + 6) * q.w + q.dy * ev * 8, q.s * (1 - 0.5 * u), WHITE, a * 0.38);
    }
  }
  for (const q of skirt) {
    const z = Math.sin(q.ph);
    if (z < 0 !== back) continue;
    const R = lerp(capR * 0.82, 13, Math.pow(q.v, 0.6)) * q.w, ev = u * u * q.e;
    const x = Math.cos(q.ph) * R * (1 + ev * 0.25) + q.dx * ev * 10, y = lerp(y0, y1, q.v) + z * R * 0.18 + q.dy * ev * 8;
    p.disc(x, y, q.s * (1 - 0.55 * u), WHITE, a * (back ? 0.3 : 0.55) * (1 - q.v * 0.3));
  }
  // the bell's crisp lower edge, dithering away as it evaporates
  if (u < 0.7) {
    const R = 13 * 1.25, k = 1 - u / 0.7;
    for (let i = 0; i < 64; i++) {
      const g = (i / 64) * TAU, z = Math.sin(g);
      if (z < 0 !== back) continue;
      p.dot(Math.cos(g) * R * (1 + u * 0.6), y1 + 2 + z * R * 0.22, WHITE, k * (back ? 0.6 : 1));
    }
  }
}

// ---- 3D: the same blast standing in the world, seen from any side.
// The cap is a real rolling vortex ring of shaded lobes (Plume.draw3) on a stem of lobes (Column.draw3); the skirt is a
// dome of translucent discs over the cap and a bell of discs round the stem; the dust surge and the shock ring spread
// round the whole floor circle; the air shock is a sphere's silhouette; the blinding frame is a white ball in the air
// with a big light round it. The floor circle (REACH) and the canvas are sized together so all 8 views fit.
const PITCH = 0.3, REACH = 190;

export const three = {
  meta: { size: [420, 375], origin: [210, 290], camera: { pitch: PITCH } },
  create(o) {
    const F = fit(o.palette, 8), FR = fireRamp(F), R = new Rng(o.seed), floor = () => 0, dust = hex(o.dust);
    const DUST = [mix(dust, WHITE, 0.22), dust, mix(dust, hex("#3a3040"), 0.35), mix(dust, hex("#2a2330"), 0.6), mix(dust, hex("#1c1720"), 0.8)];
    const [W, H] = three.meta.size, [OX, OY] = three.meta.origin;
    const pitch = Math.abs(o.camera?.pitch ?? PITCH), CP = Math.cos(pitch), SP = Math.sin(pitch);
    const box = [3 - OX, 3 - OY, W - OX - 3, H - OY - 3];
    const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]] }), lights = new Lights();
    const plume = new Plume(R, {
      x: 0, y: -26, rise: 152, tau: 1.7, drift: 3, tube: [14, 26], ring: [4, 46], grow: 1.6, n: 52, size: [9.5, 14.5], swell: 0.45,
      spin: 2.4, spinTau: 2.4, heat: 1.25, cool: 0.42, under: 0.6, tilt: 0.16, squash: 0.48, fade: [6.0, 8.3], spread: 26,
      style: 1, inner: true, hollow: true, fray: [4, 1.6, 6.4],
    });
    plume.onFray3 = (x, y, z, r, ux, uy, uz) => ps.spawn3(P.SMOKE, x, y, z, ux * R.range(10, 26), uy * R.range(4, 12) - R.range(2, 8), uz * R.range(10, 26), R.range(1, 1.7), CAP[R.int(0, 1)], r * R.range(0.3, 0.45));
    const column = new Column(R, { w: 3.5, foot: 22, speed: 125, size: [5.5, 7], n: 62, sway: 1.4, style: 1 });
    const top = () => { const S = plume.shape(); return S.y + S.tube * 0.3; };
    // the skirt: a dome of discs over the cap (spread evenly over its surface) and a bell of discs flaring round the stem
    const veil = Array.from({ length: 110 }, (_, i) => ({ u: (i + R.range(0.2, 0.8)) / 110, ph: i * 2.399963 + R.range(-0.3, 0.3), s: R.range(7.5, 11.5), w: R.range(0.97, 1.06), e: R.range(0.6, 1.3), dx: R.range(-1, 1), dy: R.range(-1, 0.2), dz: R.range(-1, 1) }));
    const bell = Array.from({ length: 110 }, () => ({ ph: R.range(0, TAU), v: R.range(0, 1), s: R.range(6, 10), w: R.range(0.9, 1.06), e: R.range(0.6, 1.3), dx: R.range(-1, 1), dy: R.range(-1, 0.4), dz: R.range(-1, 1) }));
    let t = 0, boomed = false;

    // a point on the upper hemisphere: azimuth az, sin(elevation) s, as a unit vector (x, up, z)
    const dir = (az, s) => { const c = Math.sqrt(1 - s * s); return [Math.cos(az) * c, s, Math.sin(az) * c]; };

    const boom = () => {
      lights.add(0, -60, 125, F[4], 0.7, 1.6, 0);
      // the fireball's first fire, sparks and embers, thrown out over the whole upper sphere
      for (let i = 0; i < 40; i++) {
        const [x, s, z] = dir(R.range(0, TAU), R.range(0, 1)), d = R.range(4, 22), sp = R.range(40, 160);
        ps.spawn3(P.FIRE, x * d, -26 - s * d, z * d, x * sp, -s * sp * 0.7 - 30, z * sp, R.range(0.6, 1.1), 0, R.range(7, 12), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
      }
      for (let i = 0; i < 130; i++) {
        const [x, s, z] = dir(R.range(0, TAU), R.range(-0.3, 1)), sp = R.range(200, 420);
        ps.spawn3(P.SPARK, x * 18, -26 - s * 18, z * 18, x * sp, -s * sp - 60, z * sp, R.range(0.3, 0.8));
      }
      for (let i = 0; i < 70; i++) {
        const [x, s, z] = dir(R.range(0, TAU), R.range(0, 1)), sp = R.range(30, 140);
        ps.spawn3(P.EMBER, x * 20, -26 - s * 20, z * 20, x * sp, -s * sp - 60, z * sp, R.range(1.6, 3.4), F[3]);
      }
      // the base surge: dust thrown out along the floor all the way round, racing out; a slower ring behind
      for (let i = 0; i < 200; i++) {
        const slow = i >= 150, a = R.range(0, TAU), c = Math.cos(a), s = Math.sin(a), sp = slow ? R.range(110, 200) : R.range(240, 440);
        ps.spawn3(P.SMOKE, c * 14, -R.range(1, 3), s * 14, c * sp, -R.range(0, slow ? 10 : 6), s * sp, R.range(1.8, 3), dust, slow ? R.range(9, 12) : R.range(6, 10), R.range(0.05, 0.2));
      }
      for (let i = 0; i < 55; i++) {
        const a = R.range(0, TAU), u = R.range(0, 1), tilt = u * 0.7, sp = R.range(150, 380) * (1 - 0.4 * u), h = Math.sin(tilt) * sp;
        ps.spawn3(P.GRIT, Math.cos(a) * 12 * u, -1, Math.sin(a) * 12 * u, Math.cos(a) * h, -Math.cos(tilt) * sp, Math.sin(a) * h, R.range(1.2, 2), R.pick(DUST.slice(0, 3)), R.chance(0.4) ? 2 : 1);
      }
    };

    return {
      update(dt) {
        t += dt;
        if (!boomed && t >= LIFT) (boomed = true), boom();
        if (t >= LIFT) plume.update(dt);
        const S = plume.shape(), hot = plume.hot();
        column.update(dt, top(), t > 0.35 && t < 4.9 ? 1 : 0);
        // afterwinds: dust drawn in along the floor, from every side, and up the stem
        if (t > 0.9 && t < 4.6 && R.chance(14 * dt)) {
          const a = R.range(0, TAU), d = R.range(50, 160), v = R.range(20, 45);
          ps.spawn3(P.VAPOUR, Math.cos(a) * d, -R.range(2, 6), Math.sin(a) * d, -Math.cos(a) * v, -R.range(0, 6), -Math.sin(a) * v, R.range(1.2, 1.8), DUST[1], R.range(5, 8));
        }
        if (t > 0.3 && t < 3.4 && R.chance(14 * hot * dt)) {
          const a = R.range(0, TAU), th = R.range(0, TAU), rr = S.ring + S.tube * Math.cos(th), ca = Math.cos(a), sa = Math.sin(a);
          ps.spawn3(P.EMBER, S.x + ca * rr, S.y + Math.sin(th) * S.tube * 0.5, sa * rr, ca * R.range(30, 80), -R.range(10, 50), sa * R.range(30, 80), R.range(1.4, 2.6), F[3]);
        }
        draft3(ps, dt, { top: S.y + S.tube * 0.3, w: 9, up: 160, pull: 120, low: 14, reach: 170, k: 1 - smooth(4.4, 5.4, t) });
        ps.update(dt);
        keep3(ps, REACH, OX, H - OY, OY - 3, CP, SP);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        // the blinding frame: a white ball in the air with its light, washing out the floor all round it
        if (t < FLASH) {
          q.ball(0, -56, 0, 56, WHITE);
          flash3(q, 1.6);
          return;
        }
        const S = plume.shape(), hot = plume.hot(), E = plume.ember(), k = (t - LIFT) / 0.8;
        // the ground shock: a true circle racing out along the floor ahead of the dust
        if (k > 0 && k < 1) {
          const r = REACH * ease.outCubic(k), w = 2 + 6 * (1 - k), fa = 1.15 - k;
          q.plane(0, 0, 0, null, r, (u, v, out) => {
            const b = (Math.hypot(u, v) - (r - w)) / w;
            if (b < 0 || b > 1) return;
            out.c = b > 0.85 ? F[7] : b > 0.6 ? F[5] : b > 0.3 ? DUST[0] : DUST[2];
            out.a = fa * (b > 0.6 ? 1.2 : 0.15 + b);
            out.l = F[4];
            out.k = 0.25 * fa * b;
          });
        }
        // out of the white: a crisp white-hot ball, cooling into the fireball
        const f = (t - FLASH) / 0.13;
        if (f < 1) {
          const r = 22 + 8 * f;
          q.ball(0, -26, 0, r + 1.5, (nx, ny) => {
            const d = Math.hypot(nx, ny) * (r + 1.5) / r;
            return d > 1 ? F[2] : d > 0.62 ? (f < 0.5 ? F[6] : F[5]) : f < 0.5 ? WHITE : F[6];
          });
        }
        // the far half of everything round the axis, then the cloud with its stem, then the near half
        parts3(q, ps, FR, false);
        const sk = skirt3(q, t, S, veil, bell);
        if (sk) discs3(q, sk.far);
        plume.draw3(q, FR, CAP, {
          mid: () => {
            // the dark hollow under the cap where the stem goes in, its heart still warm while the inside glows
            const gone = smooth(plume.o.fade[0], plume.o.fade[1] - 0.6, t - LIFT);
            if (gone < 1) {
              const hy = S.y + S.tube * 0.42, rx = S.ring * 0.7 + 5;
              q.plane(0, hy, 0, null, rx, (u, v, out) => {
                const d = Math.hypot(u, v) / rx;
                out.blend = true;
                out.c = d < 0.55 * E ? mix(CAP[4], FR[d < 0.3 * E ? 5 : 6], 0.75 * E) : CAP[4];
                out.a = (d < 0.6 ? 0.8 : d < 0.85 ? 0.5 : 0.22) * (1 - gone);
              });
            }
            column.draw3(q, top(), FR, DUST, clamp(1 - t / 1.8), E * 0.8);
          },
        });
        parts3(q, ps, FR, true);
        if (sk) {
          discs3(q, sk.near);
          if (sk.rim) q.ring(0, sk.rim.y, 0, sk.rim.r, 1.6, WHITE, sk.rim.a);
        }
        // the shock in the air: a thin bright shell racing out from the fireball, cut off by the floor and the canvas
        const u = (t - FLASH) / 0.7;
        if (u < 1) {
          const r = 30 + 250 * ease.outCubic(u), w = Math.max(1, 2.5 * (1 - u)), c = u < 0.3 ? WHITE : F[6];
          q.at(0, -26, 0, (pp, kk) => {
            const cx = q.x, cy = q.y;
            pp.ring(0, 0, r * kk, w, c, (v, g) => {
              if (-26 + r * Math.sin(g) * CP > 0.5) return 0;
              const sx = cx + Math.cos(g) * r * kk, sy = cy + Math.sin(g) * r * kk;
              return sx < box[0] || sx > box[2] || sy < box[1] || sy > box[3] ? 0 : 1.1 - u;
            });
          });
          // and its light where it meets the floor
          const rg = Math.sqrt(Math.max(0, r * r - 26 * 26)), edge = 1 - smooth(140, REACH, rg);
          if (rg > 4 && edge > 0.01)
            q.plane(0, 0, 0, null, rg, (a, b, out) => {
              const d = (rg - Math.hypot(a, b)) / 7;
              if (d < 0 || d > 1) return;
              out.l = F[5];
              out.k = 0.3 * (1 - u) * (1 - d) * edge;
            });
        }
        // the light of it: the blinding white falling away fast, then the fireball's own warm light on the floor
        const wv = Math.exp(-(t - FLASH) / 0.13);
        if (wv > 0.02) flash3(q, 0.9 * wv * 0.62);
        pool3(q, 140, F[3], 0.3 * hot);
        lights.draw(q);
      },
    };
  },
};

// the blinding light: round the white ball, up the axis above it and across the floor under it, fading before the canvas edges
function flash3(q, k) {
  q.glow(0, -80, 0, 150, WHITE, 1.3 * k);
  q.glow(0, -56, 0, 100, WHITE, 1.2 * k);
  q.glow(0, -40, 0, 60, WHITE, 1 * k);
  pool3(q, 188, WHITE, 1.2 * k);
}

const LIFTS = new Set([P.SMOKE, P.DUST, P.FIRE, P.EMBER, P.VAPOUR]), SOFT = new Set([P.SMOKE, P.DUST, P.VAPOUR]);

// draft() round the vertical axis: dust, smoke, fire and embers near it are carried up and squeezed in; near the floor
// they're drawn in from every side
function draft3(ps, dt, { top, w, up, squeeze = 4, pull, low, reach, k }) {
  if (k <= 0) return;
  for (const q of ps.list) {
    if (q.delay > 0 || !LIFTS.has(q.k) || q.y < top) continue;
    const rh = Math.hypot(q.x, q.z), u = rh / w;
    if (u < 1) {
      const f = (1 - u * u) * k;
      q.vy -= up * f * dt;
      q.vx -= q.x * squeeze * f * dt;
      q.vz -= q.z * squeeze * f * dt;
    }
    if (pull && q.y > -low && rh > w * 0.4 && rh < reach) {
      const f = (pull * k * (1 - rh / reach) * dt) / rh;
      q.vx -= q.x * f;
      q.vz -= q.z * f;
    }
  }
}

// keep everything inside the canvas from every side: the floor circle (reach), the canvas width (half-width OX) and the
// room above (top) and below (below) the origin at the camera's pitch; soft things thin out before the edge, the rest go
function keep3(ps, reach, OX, below, top, CP, SP) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i], rh = Math.hypot(q.x, q.z), up = -q.y * CP + rh * SP;
    if (!SOFT.has(q.k)) {
      if (rh > reach + 6 || up > top) L.splice(i, 1);
      continue;
    }
    const r = q.size * 1.65, lim = Math.min(reach, OX - 5 - r, (below - 4 - r) / SP);
    const e = Math.min((lim - rh) / 34, (top - up - r) / 30);
    if (e <= 0) L.splice(i, 1);
    else if (e < 1) q.life = Math.min(q.life, q.max * 0.42 * e);
  }
}

// the particles on one side of the axis (near = towards the camera), drawn together: the far half goes behind the cloud, the near half in front
function parts3(q, ps, FR, near) {
  const all = ps.list, side = [];
  for (const b of all) if (b.x * q.sy + b.z * q.cy > 0 === near) side.push(b);
  ps.list = side;
  drawPs3(q, ps, FR);
  ps.list = all;
}

// the condensation skirt in space: discs over the cap's dome and round the stem's bell, split into the half behind the
// axis and the half in front; the bell's crisp lower edge is a ring
function skirt3(q, t, S, veil, bell) {
  const u = (t - SKIRT[0]) / (SKIRT[1] - SKIRT[0]);
  if (u <= 0 || u >= 1) return null;
  const a = Math.min(1, u / 0.06) * Math.pow(1 - u, 1.5) * 0.6, capR = (S.ring + S.tube) * 1.1, y0 = S.y + S.tube * 0.3, y1 = S.y * 0.55;
  const far = [], near = [], add = (x, y, z, r, af, an) => (x * q.sy + z * q.cy > 0 ? near.push({ x, y, z, r, a: an }) : far.push({ x, y, z, r, a: af }));
  for (const d of veil) {
    const ev = u * u * d.e, c = Math.sqrt(1 - d.u * d.u), R = capR * d.w * (1 + ev * 0.2);
    add(Math.cos(d.ph) * c * R + d.dx * ev * 10, S.y - d.u * (S.tube * 1.15 + 6) * d.w + d.dy * ev * 8, Math.sin(d.ph) * c * R + d.dz * ev * 10, d.s * (1 - 0.5 * u), a * 0.3, a * 0.3);
  }
  for (const d of bell) {
    const R = lerp(capR * 0.82, 13, Math.pow(d.v, 0.6)) * d.w * (1 + u * u * d.e * 0.25), ev = u * u * d.e, f = 1 - d.v * 0.3;
    add(Math.cos(d.ph) * R + d.dx * ev * 10, lerp(y0, y1, d.v) + d.dy * ev * 8, Math.sin(d.ph) * R + d.dz * ev * 10, d.s * (1 - 0.55 * u), a * 0.3 * f, a * 0.55 * f);
  }
  return { far, near, rim: u < 0.7 ? { y: y1 + 2, r: 13 * 1.25 * (1 + u * 0.6), a: 1 - u / 0.7 } : null };
}

function discs3(q, list) {
  for (const d of q.sort(list, (e) => [e.x, e.y, e.z])) q.disc(d.x, d.y, d.z, d.r, WHITE, d.a);
}
