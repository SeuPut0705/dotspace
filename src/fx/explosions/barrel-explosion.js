// The blast (fire puffs that cool into smoke, sparks, embers, burning brands that land and keep burning, grit, scorch,
// rings) is adapted from Sprite Fusion's open-source explosion (https://www.spritefusion.com/pixel-art-vfx/explosion),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, fit, band, flare, clamp, smooth, ease, rand, TAU, WHITE, hex, mix, scale, rgb, space } from "../../core/index.js";
import { fireRamp, heatRamp, drawPs, cull, fadeEdges, scorch, pool, OUTLINE, drawPs3, scorch3, pool3 } from "./_lib.js";

export const meta = {
  name: "Barrel explosion",
  desc: "An explosive barrel shudders, its lid bulging and spitting flame, then blows: a fireball column, staves and the lid flying, burning fuel splashed over the floor.",
  tags: ["explosion", "barrel", "fire", "smoke", "debris", "ground", "one-shot"],
  size: [300, 240],
  origin: [150, 204],
  duration: 5.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    barrel: ["#1c0a0e", "#4a1218", "#7c1a1e", "#b02a26", "#d8483a", "#f08a70"],
    seed: 8,
  },
};

const BLOW = 0.8, BW = 8, BH = 22;

export function create(o) {
  const F = fit(o.palette, 8), FR = fireRamp(F), HR = heatRamp(FR), C = fit(o.barrel, 6), R = new Rng(o.seed), floor = () => 0;
  const [W, H] = meta.size, [OX, OY] = meta.origin, X0 = -OX + 3, X1 = W - OX - 3, Y0 = -OY + 3, Y1 = H - OY - 3;
  let blazes;
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]], onLand: (x, y) => blazes.add(x, y - 0.25, R.range(1.2, 2.2), R.range(0.6, 1)) });
  blazes = new Blazes(ps);
  const lights = new Lights(), staves = new Bits({ ground: floor });
  const OIL = hex("#221a22"), SOOT = hex("#1f1a24");
  const lid = { x: 0, y: -BH, vx: 0, vy: 0, a: 0, va: 0, on: false, rest: false };
  // the fuel splashed over the floor: a puddle and the spots that keep burning in it
  const pools = [];
  let t = 0, blown = false;

  const blow = () => {
    blown = true;
    const y = -BH * 0.5;
    lights.add(0, y - 20, 90, mix(F[3], F[6], 0.45), 0.85, 0.9);
    lights.add(0, y, 44, WHITE, 0.7, 0.09);
    // the fireball: bursting out, then a column of fire driven up out of the drum
    for (let i = 0; i < 5; i++) ps.spawn(P.FIRE, R.range(-3, 3), y + R.range(-3, 3), R.range(-20, 20), R.range(-40, -10), R.range(0.18, 0.28), 0, R.range(9, 12));
    for (let i = 0; i < 30; i++) {
      const a = R.range(-Math.PI - 0.15, 0.15), d = R.range(0, 8), sp = R.range(50, 190);
      ps.spawn(P.FIRE, Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 40, R.range(0.55, 1.05), 0, R.range(5, 10), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
    }
    for (let i = 0; i < 12; i++) ps.spawn(P.FIRE, R.range(-6, 6), y - R.range(0, 10), R.range(-14, 14), -R.range(170, 300), R.range(0.7, 1.15), 0, R.range(6, 10), R.range(0, 0.12), R.chance(0.7) ? PF.SMOKES | PF.BIG : 0);
    // oily black smoke
    for (let i = 0; i < 12; i++) {
      const a = R.range(-Math.PI, 0), d = R.range(4, 16);
      ps.spawn(P.SMOKE, Math.cos(a) * d, y + Math.sin(a) * d, Math.cos(a) * 30, -R.range(30, 90), R.range(1.6, 2.6), SOOT, R.range(8, 13), R.range(0.1, 0.4), PF.BIG);
    }
    for (let i = 0; i < 90; i++) {
      const a = R.range(0, TAU), sp = R.range(160, 400);
      ps.spawn(P.SPARK, 0, y, Math.cos(a) * sp, Math.sin(a) * sp - 70, R.range(0.2, 0.6));
    }
    for (let i = 0; i < 40; i++) {
      const a = R.range(0, TAU), sp = R.range(30, 140);
      ps.spawn(P.EMBER, Math.cos(a) * 8, y + Math.sin(a) * 8, Math.cos(a) * sp, Math.sin(a) * sp - 70, R.range(1.2, 2.6), F[3]);
    }
    // burning fuel flung out in arcs: it lands and keeps burning
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(120, 300);
      ps.spawn(P.BRAND, R.range(-4, 4), y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.4));
    }
    // the staves: the drum's plates torn off and thrown out, tumbling
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1, a = -Math.PI / 2 + side * R.range(0.25, 1.15), sp = R.range(170, 330);
      staves.add({ kind: B.CHUNK, x: side * R.range(2, 6), y: -R.range(4, BH - 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.5, bounce: 0.35, life: R.range(3, 3.8), a: R.range(0, TAU), va: R.range(-16, 16), s: R.range(9, 13), heat: R.range(0.4, 0.9) });
    }
    // the lid, flung high and spinning
    Object.assign(lid, { on: true, x: 0, y: -BH, vx: R.range(-40, 40), vy: -R.range(430, 480), a: 0, va: R.sign() * R.range(10, 14) });
    // the fuel on the floor, and the floor's own dust and grit
    for (let i = 0; i < 7; i++) {
      const x = R.range(-34, 34);
      pools.push({ x, w: R.range(5, 10) });
      blazes.add(x, -0.25, R.range(2.2, 3), R.range(0.8, 1.3));
    }
    for (let i = 0; i < 12; i++) {
      const s = R.sign();
      ps.spawn(P.SMOKE, s * R.range(0, 10), -R.range(1, 4), s * R.range(80, 220), -R.range(2, 12), R.range(1.1, 1.8), hex("#7d7280"), R.range(6, 9), R.range(0, 0.05), PF.BIG);
    }
    for (let i = 0; i < 60; i++) {
      const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.7, sp = R.range(120, 330) * (1 - 0.4 * Math.abs(u));
      ps.spawn(P.GRIT, u * 6, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.1, 1.9), R.pick([hex("#5a4f6b"), hex("#3e3650"), hex("#776c88")]), R.chance(0.4) ? 2 : 1);
    }
  };

  return {
    update(dt) {
      t += dt;
      if (!blown) {
        // the drum strains: flame and smoke spitting from the seam under the lid, quicker as it goes
        const k = t / BLOW;
        if (R.chance((6 + 30 * k * k) * dt)) {
          const s = R.sign();
          ps.spawn(P.FIRE, s * R.range(4, 7), -BH + 1, s * R.range(20, 60), -R.range(20, 60), R.range(0.15, 0.3), 0, R.range(1.5, 3));
          ps.spawn(P.SPARK, s * 6, -BH + 1, s * R.range(40, 140), -R.range(20, 120), R.range(0.1, 0.25));
        }
        if (R.chance(10 * dt)) ps.spawn(P.SMOKE, R.range(-5, 5), -BH, R.range(-8, 8), -R.range(15, 35), R.range(0.8, 1.3), 0, R.range(2.5, 4));
        if (t >= BLOW) blow();
      }
      if (lid.on && !lid.rest) {
        lid.vy += 950 * dt;
        lid.vx -= lid.vx * 0.4 * dt;
        lid.x += lid.vx * dt;
        lid.y += lid.vy * dt;
        lid.a += lid.va * dt;
        if (lid.y >= -1 && lid.vy > 0) {
          // a clank: sparks and dust where it lands, then it bounces flat and settles
          for (let i = 0; i < 6; i++) ps.spawn(P.SPARK, lid.x, -1, R.range(-90, 90), -R.range(40, 140), R.range(0.1, 0.25));
          for (let i = 0; i < 5; i++) ps.spawn(P.DUST, lid.x + R.range(-4, 4), -0.5, R.sign() * R.range(15, 60), -R.range(4, 18), R.range(0.35, 0.7), hex("#7d7280"), R.range(1.8, 3));
          lid.y = -1;
          if (lid.vy > 160) (lid.vy *= -0.3), (lid.vx *= 0.5), (lid.va *= 0.5);
          else (lid.rest = true), (lid.a = Math.PI / 2);
        }
      }
      staves.update(dt);
      for (let i = staves.list.length - 1; i >= 0; i--) {
        const b = staves.list[i];
        if (b.x < X0 + 8 || b.x > X1 - 8) staves.list.splice(i, 1);
        else if (b.heat > 0) b.heat = Math.max(0, b.heat - dt * 0.35);
      }
      blazes.update(dt);
      ps.update(dt);
      cull(ps, X0, Y0, X1, Y1);
      fadeEdges(ps, X0, X1, 24, Y1);
      lights.update(dt);
    },
    drawBack(p) {
      if (blown) {
        const u = t - BLOW, out = 1 - smooth(meta.duration - BLOW - 1, meta.duration - BLOW - 0.2, u);
        scorch(p, HR, u, 30, 2.2, out, 3);
        // the spilled fuel: a dark slick on the floor, lit by its own fire, shrinking as it burns off
        const left = 1 - smooth(1.6, 3.4, u);
        if (left > 0)
          for (const q of pools)
            for (let x = Math.floor(-q.w * left); x <= Math.ceil(q.w * left); x++) {
              const e = Math.abs(x) / (q.w * left + 0.01);
              p.dot(q.x + x, 1, rand(Math.floor(q.x + x), Math.floor(t * 12)) < 0.25 ? F[4] : OIL, out * (e < 0.8 ? 1 : 0.6));
              if (e < 0.6) p.dot(q.x + x, 2, OIL, out * 0.8);
            }
        const k = u / 0.45;
        if (k < 1) band(p, 0, 0.5, 100 * ease.outCubic(k), 0.16, Math.max(1, 4.5 * (1 - k)), 1.15 - k, [hex("#4a3f69"), hex("#6e6390"), F[3], F[6]], (g) => Math.sin(g) < 0);
      }
      drawPs(p, ps, "back", FR);
      blazes.drawBack(p);
    },
    draw(p) {
      if (!blown) {
        // the barrel, shaking harder, its lid bulging
        const k = t / BLOW, jx = Math.sin(t * 70) * k * k * 1.4, jy = Math.abs(Math.sin(t * 53)) * k * k * 0.8;
        drawBarrel(p, C, jx, -jy, k);
        p.glow(0, -BH, 10 + 8 * k, F[4], 0.25 + 0.35 * k * k * (0.6 + 0.4 * Math.sin(t * 40)));
      } else {
        const u = t - BLOW, k = u / 0.45;
        if (k < 1) band(p, 0, 0.5, 100 * ease.outCubic(k), 0.16, Math.max(1, 4.5 * (1 - k)), 1.15 - k, [hex("#4a3f69"), hex("#6e6390"), F[3], F[6]], (g) => Math.sin(g) >= 0);
      }
      drawPs(p, ps, "front", FR);
      for (const b of staves.list) stave(p, b, C, FR);
      if (lid.on) drawLid(p, C, lid, Math.min(1, (meta.duration - t) / 0.4));
      if (blown) {
        const u = t - BLOW;
        if (u < 0.08) {
          const k2 = 1 - u / 0.08, r = 18 * (0.85 + 0.15 * k2), y = -BH * 0.5;
          p.circle(0, y, r + 1.4, F[2]);
          p.circle(0, y, r, k2 > 0.45 ? F[6] : F[5]);
          p.circle(0, y, r * 0.6, k2 > 0.45 ? WHITE : F[6]);
        }
        if (u < 0.22) flare(p, 0, -BH * 0.5, 54 * Math.pow(1 - u / 0.22, 1.4), 1 - u / 0.22, F);
        // the burning fuel lights the floor
        pool(p, 0, 1, 90, 14, F[3], 0.5 * Math.max(0, 1 - u / 0.7) + 0.22 * (1 - smooth(1.6, 3.4, u)));
      }
      lights.draw(p);
    },
  };
}

// a steel drum standing on the floor at x: red, two ribs, a lit left side, a dark right side, an outline, a pale
// band; the lid bulges with k
function drawBarrel(p, C, x, y, k) {
  const bulge = Math.round(k * k * 2);
  p.shade(x - BW - 1, y - BH - 3, x + BW + 1, y + 0.5, (px, py) => {
    const dx = (px - x) / BW, v = (y - py) / BH; // dx -1..1 across, v 0 at the floor .. 1 at the top
    if (Math.abs(dx) > 1.1 || v < 0 || v > 1.05) return;
    const edge = Math.abs(dx) > 0.92 || v > 0.97 || v < 0.04;
    if (edge) return OUTLINE;
    const rib = Math.abs(v - 0.33) < 0.035 || Math.abs(v - 0.67) < 0.035, ribLit = Math.abs(v - 0.31) < 0.03 || Math.abs(v - 0.65) < 0.03;
    const band = v > 0.44 && v < 0.56;
    const lit = -dx; // light from the left
    let i = lit > 0.55 ? 5 : lit > 0.15 ? 4 : lit > -0.35 ? 3 : lit > -0.75 ? 2 : 1;
    if (band) return lit > 0.3 ? hex("#e8d8b0") : lit > -0.4 ? hex("#b8a888") : hex("#6e6050");
    if (rib) i = Math.max(1, i - 2);
    else if (ribLit) i = Math.min(5, i + 1);
    return C[i];
  });
  // the lid: a dark ellipse with a lit rim, pushed up as the drum swells
  p.ellipse(x, y - BH - bulge * 0.5, BW - 0.5, 2.2 + bulge * 0.4, (d, a) => (d > 0.7 ? (Math.sin(a) < 0 ? C[4] : C[2]) : C[1]));
}

// a stave: a curved plate torn from the drum, its painted face and its dark inside showing as it turns; hot edges glow
function stave(p, b, C, FR) {
  const fade = Math.min(1, b.life / 0.5), ca = Math.cos(b.a), sa = Math.sin(b.a), L = b.s, face = Math.cos(b.a * 1.7) > 0;
  for (let d = -L / 2; d <= L / 2; d += 0.5) {
    const bow = (1 - (2 * d / L) ** 2) * 1.2, x = b.x + ca * d - sa * bow, y = b.y + sa * d + ca * bow;
    const hot = b.heat > 0.3 && Math.abs(d) > L / 2 - 1;
    p.dot(x + sa, y - ca, OUTLINE, fade);
    p.dot(x, y, hot ? FR[b.heat > 0.6 ? 3 : 5] : face ? C[4] : C[1], fade);
    p.dot(x - sa, y + ca, face ? C[2] : OUTLINE, fade);
  }
  if (b.heat > 0.3) p.glow(b.x, b.y, 6, FR[4], 0.25 * b.heat * fade);
}

// the lid: a disc turning as it flies (an ellipse whose width follows its spin), lying flat once it lands
function drawLid(p, C, lid, a) {
  const w = Math.max(0.8, Math.abs(Math.cos(lid.a)) * 7.5), h = Math.max(1.2, Math.abs(Math.sin(lid.a)) * 7.5);
  const rx = lid.rest ? 7.5 : w, ry = lid.rest ? 1.6 : h;
  p.ellipse(lid.x, lid.y - (lid.rest ? 0.5 : 0), rx + 0.8, ry + 0.8, OUTLINE, a);
  p.ellipse(lid.x, lid.y - (lid.rest ? 0.5 : 0), rx, ry, (d, an) => (d > 0.65 ? (Math.sin(an) < 0 ? C[4] : C[2]) : C[3]), a);
}

// ---- 3D: the same blast standing in space. The drum is a body of revolution (the same from every side: a billboard
// with a true lid), its staves, hoops and lid are flung as real pieces round the full circle and tumble in depth, the
// fire and smoke have a real x, y and z, and the scorch, the shock ring, the oil and the light are flat on the floor.

const PITCH = 0.3, CP = Math.cos(PITCH), SP = Math.sin(PITCH);

export const three = {
  meta: { size: [280, 240], origin: [140, 200], camera: { pitch: PITCH } },
  create(o) {
    const F = fit(o.palette, 8), FR = fireRamp(F), HR = heatRamp(FR), C = fit(o.barrel, 6), R = new Rng(o.seed), floor = () => 0;
    const [W, H] = three.meta.size, [OX, OY] = three.meta.origin, RM = OX - 20, TOP = -OY + 3, BOT = H - OY - 3;
    let blazes;
    const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]], onLand: (x, y, z) => blazes.add(x, y - 0.25, R.range(1.2, 2.2), R.range(0.6, 1), z) });
    blazes = new Blazes(ps);
    const lights = new Lights(), staves = new Bits({ ground: floor }), hoops = new Bits({ ground: floor });
    const OIL = hex("#221a22"), SOOT = hex("#1f1a24"), GREY = hex("#7d7280"), SHOCK = [hex("#4a3f69"), hex("#6e6390"), F[3], F[6]];
    const lid = { x: 0, y: -BH, z: 0, vx: 0, vy: 0, vz: 0, a: 0, va: 0, h: 0, on: false, rest: false };
    // the fuel splashed over the floor: puddles and the spots that keep burning in them
    const pools = [];
    // sparks of the flare: rays in every direction (a golden spiral over the sphere)
    const rays = Array.from({ length: 14 }, (_, i) => {
      const y = 1 - (i + 0.5) / 7, r = Math.sqrt(Math.max(0, 1 - y * y)), g = i * 2.39996;
      return [Math.cos(g) * r, y, Math.sin(g) * r, i % 2 ? 0.6 : 1];
    });
    let t = 0, blown = false;

    const blow = () => {
      blown = true;
      const y = -BH * 0.5;
      lights.add(0, y - 20, 90, mix(F[3], F[6], 0.45), 0.85, 0.9);
      lights.add(0, y, 44, WHITE, 0.7, 0.09);
      // the fireball: bursting out, then a column of fire driven up out of the drum
      for (let i = 0; i < 5; i++) ps.spawn3(P.FIRE, R.range(-3, 3), y + R.range(-3, 3), R.range(-3, 3), R.range(-20, 20), R.range(-40, -10), R.range(-20, 20), R.range(0.18, 0.28), 0, R.range(9, 12));
      for (let i = 0; i < 40; i++) {
        const az = R.range(0, TAU), el = R.range(-0.15, Math.PI / 2), d = R.range(0, 8), sp = R.range(50, 190), h = Math.cos(el), ca = Math.cos(az), sa = Math.sin(az);
        ps.spawn3(P.FIRE, ca * h * d, y - Math.sin(el) * d, sa * h * d, ca * h * sp, -Math.sin(el) * sp * 0.8 - 40, sa * h * sp, R.range(0.55, 1.05), 0, R.range(5, 10), 0, R.chance(0.5) ? PF.SMOKES | PF.BIG : 0);
      }
      for (let i = 0; i < 14; i++) ps.spawn3(P.FIRE, R.range(-6, 6), y - R.range(0, 10), R.range(-6, 6), R.range(-14, 14), -R.range(170, 300), R.range(-14, 14), R.range(0.7, 1.15), 0, R.range(6, 10), R.range(0, 0.12), R.chance(0.7) ? PF.SMOKES | PF.BIG : 0);
      // oily black smoke, up and out all round
      for (let i = 0; i < 18; i++) {
        const az = R.range(0, TAU), el = R.range(0.2, Math.PI / 2), d = R.range(4, 16), ca = Math.cos(az), sa = Math.sin(az), h = Math.cos(el);
        ps.spawn3(P.SMOKE, ca * h * d, y - Math.sin(el) * d, sa * h * d, ca * 30, -R.range(30, 90), sa * 30, R.range(1.6, 2.6), SOOT, R.range(8, 13), R.range(0.1, 0.4), PF.BIG);
      }
      // sparks every way
      for (let i = 0; i < 100; i++) {
        const az = R.range(0, TAU), el = Math.asin(R.range(-1, 1)), sp = R.range(160, 400), h = Math.cos(el);
        ps.spawn3(P.SPARK, 0, y, 0, Math.cos(az) * h * sp, -Math.sin(el) * sp - 70, Math.sin(az) * h * sp, R.range(0.2, 0.6));
      }
      for (let i = 0; i < 46; i++) {
        const az = R.range(0, TAU), el = Math.asin(R.range(-1, 1)), sp = R.range(30, 140), h = Math.cos(el), ca = Math.cos(az), sa = Math.sin(az);
        ps.spawn3(P.EMBER, ca * 8, y - Math.sin(el) * 8, sa * 8, ca * h * sp, -Math.sin(el) * sp - 70, sa * h * sp, R.range(1.2, 2.6), F[3]);
      }
      // burning fuel flung out in arcs: it lands and keeps burning
      for (let i = 0; i < 18; i++) {
        const az = R.range(0, TAU), tilt = R.range(0, 1.2), sp = R.range(120, 300);
        ps.spawn3(P.BRAND, R.range(-4, 4), y, R.range(-4, 4), Math.cos(az) * Math.sin(tilt) * sp, -Math.cos(tilt) * sp, Math.sin(az) * Math.sin(tilt) * sp, R.range(0.8, 1.4));
      }
      // the staves: the drum's plates torn off and thrown out round the full circle, tumbling end over end
      for (let i = 0; i < 10; i++) {
        const az = (i / 10) * TAU + R.range(-0.25, 0.25), tilt = R.range(0.25, 1.15), sp = R.range(170, 330), s = R.range(2, 6);
        staves.add({ kind: B.CHUNK, x: Math.cos(az) * s, y: -R.range(4, BH - 4), z: Math.sin(az) * s, vx: Math.cos(az) * Math.sin(tilt) * sp, vy: -Math.cos(tilt) * sp, vz: Math.sin(az) * Math.sin(tilt) * sp, g: 1, drag: 0.5, bounce: 0.35, life: R.range(3, 3.8), a: R.range(0, TAU), va: R.range(-16, 16), h: R.range(0, TAU), s: R.range(9, 13), heat: R.range(0.4, 0.9) });
      }
      // two hoops off the ribs: true rings, turning over in the air
      for (let i = 0; i < 2; i++) {
        const az = R.range(0, TAU), tilt = R.range(0.3, 0.9), sp = R.range(150, 250);
        hoops.add({ kind: B.CHUNK, x: 0, y: -BH * (i ? 0.33 : 0.67), z: 0, vx: Math.cos(az) * Math.sin(tilt) * sp, vy: -Math.cos(tilt) * sp, vz: Math.sin(az) * Math.sin(tilt) * sp, g: 1, drag: 0.5, bounce: 0.4, life: R.range(3.2, 3.8), a: R.range(0, TAU), va: R.range(-10, 10), h: R.range(0, TAU), s: 7.5, heat: R.range(0.3, 0.6) });
      }
      // the lid, flung high and spinning
      const la = R.range(0, TAU);
      Object.assign(lid, { on: true, x: 0, y: -BH, z: 0, vx: Math.cos(la) * R.range(10, 40), vz: Math.sin(la) * R.range(10, 40), vy: -R.range(430, 480), a: 0, va: R.sign() * R.range(10, 14), h: R.range(0, TAU) });
      // the fuel on the floor, and the floor's own dust and grit
      for (let i = 0; i < 7; i++) {
        const az = R.range(0, TAU), d = 34 * Math.sqrt(R.next()), x = Math.cos(az) * d, z = Math.sin(az) * d;
        pools.push({ x, z, w: R.range(5, 10) });
        blazes.add(x, -0.25, R.range(2.2, 3), R.range(0.8, 1.3), z);
      }
      for (let i = 0; i < 34; i++) {
        const az = R.range(0, TAU), ca = Math.cos(az), sa = Math.sin(az), d = R.range(0, 10), sp = R.range(80, 220);
        ps.spawn3(P.SMOKE, ca * d, -R.range(1, 4), sa * d, ca * sp, -R.range(2, 12), sa * sp, R.range(1.1, 1.8), GREY, R.range(6, 9), R.range(0, 0.05), PF.BIG);
      }
      for (let i = 0; i < 70; i++) {
        const u = R.range(0, 1), az = R.range(0, TAU), tilt = u * 0.7, sp = R.range(120, 330) * (1 - 0.4 * u);
        ps.spawn3(P.GRIT, Math.cos(az) * u * 6, -1, Math.sin(az) * u * 6, Math.cos(az) * Math.sin(tilt) * sp, -Math.cos(tilt) * sp, Math.sin(az) * Math.sin(tilt) * sp, R.range(1.1, 1.9), R.pick([hex("#5a4f6b"), hex("#3e3650"), hex("#776c88")]), R.chance(0.4) ? 2 : 1);
      }
    };

    return {
      update(dt) {
        t += dt;
        if (!blown) {
          // the drum strains: flame and smoke spitting from the seam under the lid all round, quicker as it goes
          const k = t / BLOW;
          if (R.chance((6 + 30 * k * k) * dt)) {
            const az = R.range(0, TAU), ca = Math.cos(az), sa = Math.sin(az), r = R.range(4, 7), sp = R.range(20, 60);
            ps.spawn3(P.FIRE, ca * r, -BH + 1, sa * r, ca * sp, -R.range(20, 60), sa * sp, R.range(0.15, 0.3), 0, R.range(1.5, 3));
            ps.spawn3(P.SPARK, ca * 6, -BH + 1, sa * 6, ca * R.range(40, 140), -R.range(20, 120), sa * R.range(40, 140), R.range(0.1, 0.25));
          }
          if (R.chance(10 * dt)) ps.spawn3(P.SMOKE, R.range(-4, 4), -BH, R.range(-4, 4), R.range(-8, 8), -R.range(15, 35), R.range(-8, 8), R.range(0.8, 1.3), 0, R.range(2.5, 4));
          if (t >= BLOW) blow();
        }
        if (lid.on && !lid.rest) {
          lid.vy += 950 * dt;
          lid.vx -= lid.vx * 0.4 * dt;
          lid.vz -= lid.vz * 0.4 * dt;
          lid.x += lid.vx * dt;
          lid.y += lid.vy * dt;
          lid.z += lid.vz * dt;
          lid.a += lid.va * dt;
          if (lid.y >= -1 && lid.vy > 0) {
            // a clank: sparks and dust where it lands, then it bounces and settles flat
            for (let i = 0; i < 6; i++) ps.spawn3(P.SPARK, lid.x, -1, lid.z, R.range(-90, 90), -R.range(40, 140), R.range(-90, 90), R.range(0.1, 0.25));
            for (let i = 0; i < 5; i++) {
              const az = R.range(0, TAU), sp = R.range(15, 60);
              ps.spawn3(P.DUST, lid.x + R.range(-4, 4), -0.5, lid.z + R.range(-4, 4), Math.cos(az) * sp, -R.range(4, 18), Math.sin(az) * sp, R.range(0.35, 0.7), GREY, R.range(1.8, 3));
            }
            lid.y = -1;
            if (lid.vy > 160) (lid.vy *= -0.3), (lid.vx *= 0.5), (lid.vz *= 0.5), (lid.va *= 0.5);
            else (lid.rest = true), (lid.a = Math.round(lid.a / Math.PI) * Math.PI);
          }
        }
        for (const bits of [staves, hoops]) {
          bits.update(dt);
          for (let i = bits.list.length - 1; i >= 0; i--) {
            const b = bits.list[i];
            if (Math.hypot(b.x, b.z) > RM - 8) bits.list.splice(i, 1);
            else {
              // once it lies still it lies flat
              if (b.rest && !b.snap) (b.snap = true), (b.a = Math.round(b.a / Math.PI) * Math.PI);
              if (b.heat > 0) b.heat = Math.max(0, b.heat - dt * 0.35);
            }
          }
        }
        blazes.update(dt);
        ps.update(dt);
        cull3(ps, RM, TOP, BOT);
        fade3(ps, RM, BOT);
        // whatever is still burning goes out with the effect
        if (t > meta.duration - 0.4)
          for (let i = ps.list.length - 1; i >= 0; i--) {
            const q = ps.list[i];
            if ((q.life = Math.min(q.life, meta.duration - t - 0.001)) <= 0) ps.list.splice(i, 1);
          }
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), u = t - BLOW;
        if (blown) {
          const out = 1 - smooth(meta.duration - BLOW - 1, meta.duration - BLOW - 0.2, u), left = 1 - smooth(1.6, 3.4, u);
          scorch3(q, HR, u, 30, 2.2, out);
          // the spilled fuel: dark slicks on the floor, lit by their own fire, shrinking as they burn off
          if (left > 0)
            for (const s of pools) {
              const rad = s.w * left;
              q.plane(s.x, 0, s.z, null, rad + 0.5, (pu, pv, o2) => {
                const e = Math.hypot(pu, pv) / (rad + 0.01);
                if (e > 1) return;
                o2.c = rand(Math.floor(s.x + pu) * 7 + Math.floor(s.z + pv), Math.floor(t * 12)) < 0.25 ? F[4] : OIL;
                o2.a = out * (e < 0.8 ? 1 : 0.6);
              }, -0.6);
            }
          // the burning fuel lights the floor
          pool3(q, 90, F[3], 0.5 * Math.max(0, 1 - u / 0.7) + 0.22 * (1 - smooth(1.6, 3.4, u)));
          // the shock ring, a true circle on the floor
          const k = u / 0.45;
          if (k < 1) {
            const r = 100 * ease.outCubic(k), w = Math.max(2, 10 * (1 - k)), a = clamp(1.5 - k);
            q.ring(0, 0, 0, r, w, (v) => SHOCK[Math.min(3, Math.floor(v * 4))], a);
          }
          blazes.drawBack(q);
        }
        if (!blown) {
          // the barrel, shaking harder, its lid bulging
          const k = t / BLOW, jx = Math.sin(t * 70) * k * k * 1.4, jz = Math.cos(t * 61) * k * k * 1.4, jy = Math.abs(Math.sin(t * 53)) * k * k * 0.8;
          q.at(jx, -jy, jz, (pp) => {
            pp.z -= BW * 0.6;
            drawDrum(pp, C);
          });
          lidDisc(q, C, jx, -BH - jy - Math.round(k * k * 2) * 0.5, jz, [0, -1, 0], BW - 0.5, 1);
          q.glow(jx, -BH, jz, 10 + 8 * k, F[4], 0.25 + 0.35 * k * k * (0.6 + 0.4 * Math.sin(t * 40)));
        } else {
          for (const b of staves.list) stave3(q, b, C, FR);
          for (const b of hoops.list) hoop3(q, b, C, FR);
          if (lid.on) {
            const lift = lid.rest ? 0.6 : 7.5 * Math.abs(Math.sin(lid.a)) + 0.4, nrm = [Math.sin(lid.a) * Math.cos(lid.h), -Math.cos(lid.a), Math.sin(lid.a) * Math.sin(lid.h)];
            lidDisc(q, C, lid.x, Math.min(lid.y, -lift), lid.z, nrm, 7.5, Math.min(1, (meta.duration - t) / 0.4));
          }
          // the flash: a white-hot ball, then rays of light every way
          if (u < 0.08) {
            const k2 = 1 - u / 0.08, r = 18 * (0.85 + 0.15 * k2), R1 = r + 1.4;
            q.ball(0, -BH * 0.5, 0, R1, (nx, ny) => {
              const d = Math.hypot(nx, ny) * R1;
              return d > r ? F[2] : d > r * 0.6 ? (k2 > 0.45 ? F[6] : F[5]) : k2 > 0.45 ? WHITE : F[6];
            });
          }
        }
        drawPs3(q, ps, FR);
        if (blown && u < 0.22) {
          const k = 1 - u / 0.22, L = 54 * Math.pow(k, 1.4), y = -BH * 0.5;
          for (const [dx, dy, dz, len] of rays) {
            const l = L * len;
            q.line(dx * 4, y + dy * 4, dz * 4, dx * l, y + dy * l, dz * l, (v) => (v < 0.3 ? F[7] : v < 0.6 ? F[5] : F[3]), (v) => k * (1 - v * 0.7));
          }
          q.glow(0, y, 0, 60 * (0.6 + 0.4 * k), F[5], 0.5 * k);
        }
        lights.draw(q);
      },
    };
  },
};

// the drum's body without its lid, as the 2D one (a body of revolution looks the same from every side)
function drawDrum(p, C) {
  p.shade(-BW - 1, -BH - 3, BW + 1, 0.5, (px, py) => {
    const dx = px / BW, v = -py / BH;
    if (Math.abs(dx) > 1.1 || v < 0 || v > 1.05) return;
    if (Math.abs(dx) > 0.92 || v > 0.97 || v < 0.04) return OUTLINE;
    const rib = Math.abs(v - 0.33) < 0.035 || Math.abs(v - 0.67) < 0.035, ribLit = Math.abs(v - 0.31) < 0.03 || Math.abs(v - 0.65) < 0.03;
    const lit = -dx;
    let i = lit > 0.55 ? 5 : lit > 0.15 ? 4 : lit > -0.35 ? 3 : lit > -0.75 ? 2 : 1;
    if (v > 0.44 && v < 0.56) return lit > 0.3 ? hex("#e8d8b0") : lit > -0.4 ? hex("#b8a888") : hex("#6e6050");
    if (rib) i = Math.max(1, i - 2);
    else if (ribLit) i = Math.min(5, i + 1);
    return C[i];
  });
}

// a round lid lying in the plane with normal n at (x, y, z): dark inside, a lit rim, an outline
function lidDisc(q, C, x, y, z, n, r, a) {
  if (a <= 0.01) return;
  q.plane(x, y, z, n, r + 0.9, (u, v, out) => {
    const d = Math.hypot(u, v) / r;
    if (d > 1.12) return;
    out.a = a;
    return d > 1 ? OUTLINE : d > 0.7 ? (u - v < 0 ? C[4] : C[2]) : d > 0.62 ? C[2] : C[1];
  });
}

// a stave: a thin curved plate tumbling end over end about a horizontal axis: its painted face and dark inside show
// as it turns, its torn ends glow
function stave3(q, b, C, FR) {
  const fade = Math.min(1, b.life / 0.5), L = b.s, ca = Math.cos(b.a), sa = Math.sin(b.a), face = Math.cos(b.a * 1.7) > 0, hot = b.heat > 0.3;
  const dx = ca * Math.cos(b.h) * L * 0.5, dy = -sa * L * 0.5, dz = ca * Math.sin(b.h) * L * 0.5;
  const y0 = Math.min(-0.9, b.y - dy), y1 = Math.min(-0.9, b.y + dy);
  q.beam(b.x - dx, y0, b.z - dz, b.x + dx, y1, b.z + dz, 3, (u, v) => (v > 0.72 ? OUTLINE : hot && (u < 0.14 || u > 0.86) ? FR[b.heat > 0.6 ? 3 : 5] : face ? (v < 0.3 ? C[4] : C[3]) : v < 0.3 ? C[2] : C[1]), fade);
  if (hot) q.glow(b.x, b.y, b.z, 6, FR[4], 0.25 * b.heat * fade);
}

// a hoop: a steel ring (a true circle in a tilted plane) turning over as it flies, lying flat once it lands
function hoop3(q, b, C, FR) {
  const fade = Math.min(1, b.life / 0.5), sa = Math.sin(b.a), ca = Math.cos(b.a), r = b.s;
  const n = [sa * Math.cos(b.h), -ca, sa * Math.sin(b.h)], y = Math.min(b.y, -r * Math.abs(sa) - 0.8);
  q.ring(b.x, y, b.z, r, 1.8, (v) => (v < 0.2 || v > 0.85 ? C[1] : b.heat > 0.3 ? FR[4] : C[4]), fade, n);
}

// particles out of the box (x and z are both radius on screen; the box's top and bottom follow the camera's pitch)
function cull3(ps, rm, top, bot) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i], h = Math.hypot(q.x, q.z);
    if (h > rm || q.y * CP - h * SP < top || q.y * CP + h * SP > bot) L.splice(i, 1);
  }
}
const SOFT3 = new Set([P.SMOKE, P.DUST, P.VAPOUR]);
// soft particles thin out and go before they reach the sides or the bottom
function fade3(ps, rm, bot, w = 24) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    if (!SOFT3.has(q.k)) continue;
    const h = Math.hypot(q.x, q.z), r = q.size * 1.65, e = Math.min((rm - h - r) / w, (bot - (q.y * CP + h * SP) - r) / 6);
    if (e <= 0) L.splice(i, 1);
    else if (e < 1) q.life = Math.min(q.life, q.max * 0.42 * e);
  }
}
