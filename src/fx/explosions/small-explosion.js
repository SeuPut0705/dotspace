// The particle recipe (fire puffs that cool into smoke, sparks, embers, burning brands, grit, rocks, scorch) is
// adapted from Sprite Fusion's open-source explosion (https://www.spritefusion.com/pixel-art-vfx/explosion),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, fit, band, clamp, smooth, ease, rand, space, TAU, WHITE, hex, mix, scale, rgb } from "../../core/index.js";
import { fireRamp, rocks3, scorch3, shell3 } from "./_lib.js";

export const meta = {
  name: "Explosion",
  desc: "A ground blast: a white flash and shock rings, fire that cools into a rolling smoke column, sparks, burning brands that land and keep burning, tumbling rocks and a glowing scorch.",
  tags: ["explosion", "fire", "smoke", "debris", "impact", "one-shot"],
  size: [300, 240],
  origin: [150, 196],
  duration: 5.4,
  loop: false,
  fps: 30,
  bg: "ground",
  options: { palette: ["#4a1712", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"], stone: "#4a3f69", size: 1, seed: 7 },
};

const SOOT = hex("#0d0a12"), SOOT2 = hex("#17121d"), OUTLINE = hex("#1a1422"), WARM = rgb(255, 176, 96);

function stone(c) {
  c = hex(c);
  return { light: mix(scale(c, 1.35), WHITE, 0.08), body: c, shade: scale(c, 0.64), dust: mix(scale(c, 1.2), rgb(150, 140, 150), 0.3) };
}

// the floor under the blast: white-hot, cooling through the fire ramp to soot
function scorch(p, F, t, rx0, cool, fade) {
  if (fade <= 0) return;
  const rx = rx0 * Math.min(1, t / 0.08), ry = 4, heat = [...F].reverse();
  for (let y = 0; y <= 2; y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      const dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1) continue;
      const k = rand(x * 31 + y, 3), T = Math.pow(clamp(1 - t / cool), 1.4) * (1.25 - d) - k * 0.35;
      if (T > 0.06) {
        const c = heat[Math.min(heat.length - 1, Math.floor((1 - Math.min(1, T)) * (heat.length - 1)))];
        p.dot(x, y, c, fade);
        if ((x & 3) === 0) p.glow(x + 0.5, y, 6, c, 0.18 * T * fade);
      } else p.dot(x, y, d < 0.5 ? SOOT : SOOT2, (d < 0.95 - k * 0.3 ? 1 : 1 - d) * fade);
    }
}

// a rock: a lit side, a shaded side, an outline, spinning
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
  const F = fit(o.palette, 8), S = o.size, RAD = 18 * S, POWER = 0.9 * Math.pow(S, 0.8), EARTH = 1.6, st = stone(o.stone);
  const R = new Rng(o.seed), floor = () => 0;
  let blazes;
  const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]], onLand: (x, y) => blazes.add(x, y - 0.25, R.range(0.9, 1.5), R.range(0.55, 0.85)) });
  blazes = new Blazes(ps);
  const rocks = new Bits({ ground: floor }), lights = new Lights(), flashes = [], rings = [];
  const Y = -RAD * 0.3;
  let t = 0;

  // the fireball
  flashes.push({ r: RAD * 1.05, life: 0.06, max: 0.06 });
  rings.push({ r0: RAD * 0.45, r1: RAD * 2.7, life: 0.34, max: 0.34, thick: 3, c: F[5] }, { r0: RAD * 0.3, r1: RAD * 1.6, life: 0.22, max: 0.22, thick: 1.8, c: F[3] });
  lights.add(0, Y, RAD * 3.4, WARM, 0.6 * POWER, 0.7);
  lights.add(0, Y, RAD * 1.6, WHITE, 0.6, 0.08);
  for (let i = 0; i < 5; i++) ps.spawn(P.FIRE, R.range(-2.5, 2.5), Y + R.range(-2.5, 2.5), R.range(-20, 20), R.range(-40, -10), R.range(0.18, 0.3), 0, R.range(RAD * 0.4, RAD * 0.55));
  for (let i = 0; i < Math.round(28 * POWER); i++) {
    const a = R.range(0, TAU), d = R.range(0, RAD * 0.55), sp = R.range(40, 210) * POWER;
    ps.spawn(P.FIRE, Math.cos(a) * d, Y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 40, R.range(0.55, 1.15), 0, R.range(RAD * 0.22, RAD * 0.46), 0, R.chance(0.45) ? PF.SMOKES | PF.BIG : 0);
  }
  for (let i = 0; i < 5; i++) {
    const a = R.range(0, TAU), d = R.range(RAD * 0.1, RAD * 0.5);
    ps.spawn(P.SMOKE, Math.cos(a) * d, Y + Math.sin(a) * d, Math.cos(a) * 30, Math.sin(a) * 20 - 30, R.range(0.9, 1.5), rgb(34, 29, 38), R.range(RAD * 0.15, RAD * 0.26), R.range(0.06, 0.2), PF.BIG);
  }
  for (let i = 0; i < 5; i++) ps.spawn(P.FIRE, R.range(-RAD * 0.25, RAD * 0.25), Y, R.range(-12, 12), R.range(-180, -100), R.range(0.8, 1.3), 0, R.range(RAD * 0.24, RAD * 0.36), R.range(0, 0.1), R.chance(0.6) ? PF.SMOKES | PF.BIG : 0);
  for (let i = 0; i < Math.round(10 * POWER); i++) {
    const a = R.range(0, TAU), d = R.range(0, RAD * 0.7), sp = R.range(15, 100);
    ps.spawn(P.SMOKE, Math.cos(a) * d, Y + Math.sin(a) * d, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 35, R.range(1.8, 2.8), 0, R.range(RAD * 0.26, RAD * 0.44), R.range(0.12, 0.45), PF.BIG);
  }
  for (let i = 0; i < Math.round(80 * POWER); i++) {
    const a = R.range(0, TAU), sp = R.range(140, 380) * POWER;
    ps.spawn(P.SPARK, 0, Y, Math.cos(a) * sp, Math.sin(a) * sp - 70, R.range(0.18, 0.6));
  }
  for (let i = 0; i < Math.round(40 * POWER); i++) {
    const a = R.range(0, TAU), sp = R.range(30, 150);
    ps.spawn(P.EMBER, Math.cos(a) * RAD * 0.4, Y + Math.sin(a) * RAD * 0.4, Math.cos(a) * sp, Math.sin(a) * sp - 75, R.range(1.2, 2.6), F[3]);
  }
  for (let i = 0; i < Math.round(R.range(9, 14) * Math.max(0, POWER - 0.55)); i++) {
    const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(170, 330);
    ps.spawn(P.BRAND, 0, Y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.7, 1.3));
  }
  // the ground's part: dust rolling out along the floor, rocks and grit thrown up, a dust column
  for (let i = 0; i < Math.round(RAD * 0.5); i++) {
    const s = R.sign();
    ps.spawn(P.SMOKE, s * R.range(0, RAD * 0.6), -R.range(1, 5 + RAD * 0.04), s * R.range(3, 9.5) * RAD, -R.range(2, 15), R.range(1.1, 2.0), st.dust, R.range(4, 7) + RAD / 6, R.range(0, 0.06), PF.BIG);
  }
  for (let i = 0; i < 26 * Math.min(1.5, S); i++)
    rocks.add({ kind: B.CHUNK, x: R.range(-0.4, 0.4) * RAD, y: -3, vx: R.range(-9, 9) * RAD * 0.25, vy: -R.range(7, 16) * RAD * 0.9, g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.8, 2.6), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
  for (let i = 0; i < Math.round(EARTH * RAD * 4); i++) {
    const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.5, sp = R.range(5, 15) * RAD * (1 - 0.45 * Math.abs(u));
    ps.spawn(P.GRIT, u * 0.25 * RAD, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(1.2, 2.2), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
  }
  for (let i = 0; i < Math.round(EARTH * 12); i++)
    ps.spawn(P.SMOKE, R.range(-0.3, 0.3) * RAD, -R.range(2, RAD * 0.6), R.range(-15, 15), -R.range(60, 190) * EARTH * 0.6, R.range(1.6, 2.6), st.dust, R.range(5, 9) * Math.sqrt(S) + RAD / 7, R.range(0, 0.15), PF.BIG);

  return {
    update(dt) {
      t += dt;
      for (const a of [flashes, rings]) for (let i = a.length - 1; i >= 0; i--) if ((a[i].life -= dt) <= 0) a.splice(i, 1);
      rocks.update(dt);
      // rocks that hit hard kick up dust
      for (const b of rocks.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 3; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(10, 55) * 0.6, -R.range(2, 22), R.range(0.3, 0.65), st.dust, R.range(1.3, 2.8));
        }
      blazes.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      scorch(p, F, t, 22 * S, 1.2 + RAD / 14, 1 - smooth(meta.duration - 1.2, meta.duration - 0.2, t));
      ps.draw(p, "back");
      blazes.drawBack(p);
      const k = t / 0.5;
      if (k < 1) band(p, 0, 0.5, 80 * S * ease.outCubic(k), 0.16, Math.max(1, (2 + RAD / 9) * (1 - k)), 1.15 - k, [st.body, st.light, F[3], F[6]], (g) => Math.sin(g) < 0);
    },
    draw(p) {
      const k = t / 0.5;
      if (k < 1) band(p, 0, 0.5, 80 * S * ease.outCubic(k), 0.16, Math.max(1, (2 + RAD / 9) * (1 - k)), 1.15 - k, [st.body, st.light, F[3], F[6]], (g) => Math.sin(g) >= 0);
      for (const b of rocks.list) rock(p, b, st);
      ps.draw(p, "front");
      for (const f of flashes) {
        const k2 = f.life / f.max, r = f.r * (0.8 + 0.2 * k2);
        p.circle(0, Y, r + 1.2, F[2]);
        p.circle(0, Y, r, k2 > 0.45 ? F[6] : F[5]);
        p.circle(0, Y, r * 0.6, k2 > 0.45 ? WHITE : F[6]);
      }
      for (const r of rings) {
        const k2 = r.life / r.max, e = 1 - Math.pow(k2, 3);
        p.ring(0, Y, r.r0 + (r.r1 - r.r0) * e, Math.max(1, r.thick * k2 + 0.4), r.c, Math.min(1, k2 * 1.6));
      }
      lights.draw(p);
    },
  };
}

// 3D: the same blast standing in space. Fire, sparks, brands, grit and rocks fly out over a full sphere instead of
// left and right, the dust rolls out as a ring across the floor, the shock is a true circle on the floor plus a shell
// of light round the fireball, the scorch is a disc, and the white flash is a ball. The balls of fire and the puffs are
// the same from every side, so they stay the particle toolkit's own billboards.
export const three = {
  meta: { size: [264, 248], origin: [132, 206], bg: "ground", camera: { pitch: 0.3 } },
  create(o) {
    const F = fit(o.palette, 8), S = o.size, RAD = 18 * S, POWER = 0.9 * Math.pow(S, 0.8), EARTH = 1.6, st = stone(o.stone), FR = fireRamp(F), HEAT = [...F].reverse();
    const R = new Rng(o.seed), floor = () => 0;
    let blazes;
    const ps = new Particles({ rng: R, ground: floor, sparks: [F[6], F[5], F[3], F[2]], onLand: (x, y, z) => blazes.add(x, y - 0.25, R.range(0.9, 1.5), R.range(0.55, 0.85), z) });
    blazes = new Blazes(ps);
    const rocks = new Bits({ ground: floor }), lights = new Lights(), flashes = [], rings = [];
    const Y = -RAD * 0.3;
    let t = 0;
    // a direction over a whole sphere: a is the elevation (the 2D angle), the turn about the vertical is free
    const sph = (a) => {
      const f = R.range(0, TAU), h = Math.cos(a);
      return [h * Math.cos(f), Math.sin(a), h * Math.sin(f)];
    };
    const spread = (a, sp, up = 0) => {
      const [cx, cy, cz] = sph(a);
      return [cx * sp, cy * sp * (up || 1), cz * sp, cx, cy, cz];
    };

    // the fireball
    flashes.push({ r: RAD * 1.05, life: 0.06, max: 0.06 });
    rings.push({ r0: RAD * 0.45, r1: RAD * 2.7, life: 0.34, max: 0.34, thick: 3, c: F[5] }, { r0: RAD * 0.3, r1: RAD * 1.6, life: 0.22, max: 0.22, thick: 1.8, c: F[3] });
    lights.add(0, Y, RAD * 3.4, WARM, 0.6 * POWER, 0.7);
    lights.add(0, Y, RAD * 1.6, WHITE, 0.6, 0.08);
    for (let i = 0; i < 5; i++) ps.spawn3(P.FIRE, R.range(-2.5, 2.5), Y + R.range(-2.5, 2.5), R.range(-2.5, 2.5), R.range(-20, 20), R.range(-40, -10), R.range(-20, 20), R.range(0.18, 0.3), 0, R.range(RAD * 0.4, RAD * 0.55));
    for (let i = 0; i < Math.round(38 * POWER); i++) {
      const d = R.range(0, RAD * 0.55), [vx, vy, vz, cx, cy, cz] = spread(R.range(0, TAU), R.range(40, 210) * POWER, 0.8);
      ps.spawn3(P.FIRE, cx * d, Y + cy * d, cz * d, vx, vy - 40, vz, R.range(0.55, 1.15), 0, R.range(RAD * 0.22, RAD * 0.46), 0, R.chance(0.45) ? PF.SMOKES | PF.BIG : 0);
    }
    for (let i = 0; i < 5; i++) {
      const d = R.range(RAD * 0.1, RAD * 0.5), [, , , cx, cy, cz] = spread(R.range(0, TAU), 1);
      ps.spawn3(P.SMOKE, cx * d, Y + cy * d, cz * d, cx * 30, cy * 20 - 30, cz * 30, R.range(0.9, 1.5), rgb(34, 29, 38), R.range(RAD * 0.15, RAD * 0.26), R.range(0.06, 0.2), PF.BIG);
    }
    for (let i = 0; i < 5; i++) ps.spawn3(P.FIRE, R.range(-RAD * 0.25, RAD * 0.25), Y, R.range(-RAD * 0.25, RAD * 0.25), R.range(-12, 12), R.range(-180, -100), R.range(-12, 12), R.range(0.8, 1.3), 0, R.range(RAD * 0.24, RAD * 0.36), R.range(0, 0.1), R.chance(0.6) ? PF.SMOKES | PF.BIG : 0);
    for (let i = 0; i < Math.round(10 * POWER); i++) {
      const d = R.range(0, RAD * 0.7), [, , , cx, cy, cz] = spread(R.range(0, TAU), 1), sp = R.range(15, 100);
      ps.spawn3(P.SMOKE, cx * d, Y + cy * d, cz * d, cx * sp, cy * sp * 0.6 - 35, cz * sp, R.range(1.8, 2.8), 0, R.range(RAD * 0.26, RAD * 0.44), R.range(0.12, 0.45), PF.BIG);
    }
    for (let i = 0; i < Math.round(130 * POWER); i++) {
      const [vx, vy, vz] = spread(R.range(0, TAU), R.range(140, 380) * POWER);
      ps.spawn3(P.SPARK, 0, Y, 0, vx, vy - 70, vz, R.range(0.18, 0.6));
    }
    for (let i = 0; i < Math.round(60 * POWER); i++) {
      const [vx, vy, vz, cx, cy, cz] = spread(R.range(0, TAU), R.range(30, 150));
      ps.spawn3(P.EMBER, cx * RAD * 0.4, Y + cy * RAD * 0.4, cz * RAD * 0.4, vx, vy - 75, vz, R.range(1.2, 2.6), F[3]);
    }
    for (let i = 0; i < Math.round(R.range(9, 14) * Math.max(0, POWER - 0.55)); i++) {
      const [vx, vy, vz] = spread(-Math.PI / 2 + R.range(-1.35, 1.35), R.range(170, 330));
      ps.spawn3(P.BRAND, 0, Y, 0, vx, vy, vz, R.range(0.7, 1.3));
    }
    // the ground's part: dust rolling out across the floor in every direction, rocks and grit thrown up, a dust column
    for (let i = 0; i < Math.round(RAD * 1.1); i++) {
      const a = R.range(0, TAU), c = Math.cos(a), s = Math.sin(a), d = R.range(0, RAD * 0.6), v = R.range(3, 9.5) * RAD;
      ps.spawn3(P.SMOKE, c * d, -R.range(1, 5 + RAD * 0.04), s * d, c * v, -R.range(2, 15), s * v, R.range(1.1, 2.0), st.dust, R.range(4, 7) + RAD / 6, R.range(0, 0.06), PF.BIG);
    }
    for (let i = 0; i < 26 * Math.min(1.5, S); i++) {
      const a = R.range(0, TAU), v = R.range(0, 9) * RAD * 0.25, r0 = R.range(0, 0.4) * RAD;
      rocks.add({ kind: B.CHUNK, x: Math.cos(a) * r0, y: -3, z: Math.sin(a) * r0, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: -R.range(7, 16) * RAD * 0.9, g: 1, drag: 0.4, bounce: 0.3, life: R.range(1.8, 2.6), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3) });
    }
    for (let i = 0; i < Math.round(EARTH * RAD * 4); i++) {
      const u = R.range(-1, 1), [vx, vy, vz, cx, , cz] = spread(-Math.PI / 2 + u * 0.5, R.range(5, 15) * RAD * (1 - 0.45 * Math.abs(u)));
      ps.spawn3(P.GRIT, Math.abs(u) * 0.25 * RAD * cx, -1, Math.abs(u) * 0.25 * RAD * cz, vx, vy, vz, R.range(1.2, 2.2), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.45) ? 2 : 1);
    }
    for (let i = 0; i < Math.round(EARTH * 12); i++)
      ps.spawn3(P.SMOKE, R.range(-0.3, 0.3) * RAD, -R.range(2, RAD * 0.6), R.range(-0.3, 0.3) * RAD, R.range(-15, 15), -R.range(60, 190) * EARTH * 0.6, R.range(-15, 15), R.range(1.6, 2.6), st.dust, R.range(5, 9) * Math.sqrt(S) + RAD / 7, R.range(0, 0.15), PF.BIG);

    return {
      update(dt) {
        t += dt;
        for (const a of [flashes, rings]) for (let i = a.length - 1; i >= 0; i--) if ((a[i].life -= dt) <= 0) a.splice(i, 1);
        rocks.update(dt);
        // rocks that hit hard kick up dust
        for (const b of rocks.list)
          if (b.rest && !b.dusted) {
            b.dusted = true;
            for (let i = 0; i < 3; i++) {
              const a = R.range(0, TAU), v = R.range(10, 55) * 0.6;
              ps.spawn3(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, b.z + R.range(-1.5, 1.5), Math.cos(a) * v, -R.range(2, 22), Math.sin(a) * v, R.range(0.3, 0.65), st.dust, R.range(1.3, 2.8));
            }
          }
        blazes.update(dt);
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o);
        scorch3(q, HEAT, t, 22 * S, 1.2 + RAD / 14, 1 - smooth(meta.duration - 1.2, meta.duration - 0.2, t));
        // the shock on the floor: a true circle, a hot leading rim and a body of earth behind it
        const k = t / 0.5;
        if (k < 1) {
          const r = 80 * S * ease.outCubic(k), w = Math.max(1, (2 + RAD / 9) * (1 - k)) + 0.5, al = 1.15 - k;
          q.plane(0, 0, 0, null, r, (u, v, out) => {
            const b = (r - Math.hypot(u, v)) / w;
            if (b < 0 || b > 1) return;
            out.c = b < 0.15 ? F[6] : b < 0.4 ? F[3] : b < 0.7 ? st.light : st.body;
            out.a = al * (b < 0.4 ? 1.2 : 1.15 - b);
          });
        }
        blazes.drawBack(q);
        rocks3(q, rocks, st, FR);
        // the flash: a white-hot ball
        for (const f of flashes) {
          const k2 = f.life / f.max, r = f.r * (0.8 + 0.2 * k2);
          q.ball(0, Y, 0, r + 1.2, (nx, ny) => (Math.hypot(nx, ny) > 0.9 ? F[2] : Math.hypot(nx, ny) > 0.6 ? (k2 > 0.45 ? F[6] : F[5]) : k2 > 0.45 ? WHITE : F[6]));
        }
        ps.draw(q);
        // the shock in the air: a shell of light round the fireball, seen edge-on as a ring from every side
        for (const r of rings) {
          const k2 = r.life / r.max, e = 1 - Math.pow(k2, 3);
          shell3(q, 0, Y, 0, r.r0 + (r.r1 - r.r0) * e, Math.max(1, r.thick * k2 + 0.4), r.c, Math.min(1, k2 * 1.6));
        }
        lights.draw(q);
      },
    };
  },
};
