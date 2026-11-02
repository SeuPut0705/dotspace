// The impact (rocks thrown up that tumble and bounce and kick up dust where they land, gravel, dust rolling out
// along the floor and climbing, a ring on the floor, a white flash) is adapted from Sprite Fusion's open-source
// explosion (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, space, band, sparkle, clamp, smooth, ease, TAU, WHITE, hex, mix } from "../../core/index.js";
import { stoneShape, drawRock, stone3, turn, hull, bits3, rock3 } from "./_lib.js";

export const meta = {
  name: "Boulder",
  desc: "A spinning boulder arcs right shedding dust and pebbles, smashes into the floor in a white flash and bursts into tumbling chunks, gravel and rolling dust.",
  tags: ["nature", "earth", "rock", "projectile", "impact", "directional", "one-shot"],
  size: [264, 120],
  origin: [40, 104],
  duration: 2.3,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#100e12", "#1e1a22", "#302a36", "#463e4c", "#5e5464", "#7c7080", "#a0949e", "#cec4c8"],
    sparks: ["#fff3a6", "#ffe26b", "#ff8a2a", "#f2561d"],
    size: 11,
    seed: 11,
  },
};

const X0 = 6, Y0 = -26, VX = 220, VY = -170, G = 860;
// the boulder's own surface, turning with it: a few shallow pits, a mossy rim along one side
function surface(p, x, y, r, a, S, M) {
  const c = Math.cos(a), s = Math.sin(a), at = (u, v) => [x + (u * c - v * s) * r, y + (u * s + v * c) * r];
  for (const [u, v] of [[0.42, 0.12], [-0.3, 0.38]]) {
    const [px, py] = at(u, v);
    p.px(px, py, S[3]);
  }
  for (let k = 0; k < 9; k++) {
    const g = 3.6 + (k / 8) * 1.3, rr = k % 3 === 1 ? 0.78 : 0.92, [px, py] = at(Math.cos(g) * rr, Math.sin(g) * rr);
    p.px(px, py, M[k % 3 === 1 ? 0 : py < y ? 2 : 1]);
  }
}

export function create(o) {
  const S = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0, RAD = o.size;
  const DUST = mix(S[6], hex("#9a8f86"), 0.4), DUST2 = mix(S[5], hex("#7a7068"), 0.35);
  const ps = new Particles({ rng: R, ground: floor, sparks: o.sparks }), MOSSC = [hex("#1f3a1e"), hex("#3f7a2c"), hex("#7cb83a")];
  const bits = new Bits({ ground: floor }), lights = new Lights(), shape = stoneShape(R, 8);
  const tHit = (-VY + Math.sqrt(VY * VY - 2 * G * (Y0 + RAD * 0.8))) / G, xHit = X0 + VX * tHit;
  let t = 0, hit = false, thrown = false;
  const at = (tt) => [X0 + VX * tt, Y0 + VY * tt + 0.5 * G * tt * tt];
  const rock = (b) => bits.add({ ...b, pts: stoneShape(R) });
  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);
      if (!thrown) {
        thrown = true;
        for (let i = 0; i < 6; i++) ps.spawn(P.DUST, X0 - R.range(0, 6), Y0 + R.range(-4, 4), -R.range(20, 70), R.range(-20, 20), R.range(0.4, 0.7), DUST, R.range(2.5, 4.5));
        lights.add(X0, Y0, 30, WHITE, 0.3, 0.1);
      }
      if (t < tHit) {
        // it sheds dust and the odd pebble as it flies
        const [x, y] = at(t);
        if (R.chance(0.5 * f)) ps.spawn(P.DUST, x - R.range(2, 6), y + R.range(-4, 4), -R.range(10, 40), R.range(-10, 10), R.range(0.3, 0.6), DUST, R.range(2, 3.5));
        if (R.chance(0.12 * f)) ps.spawn(P.GRIT, x + R.range(-4, 4), y + R.range(-2, 4), VX * 0.3, R.range(-40, 20), R.range(0.6, 0.9), R.pick([S[5], S[4]]), R.chance(0.3) ? 2 : 1);
      }
      if (!hit && t >= tHit) {
        hit = true;
        const x = xHit, y = -RAD * 0.6;
        lights.add(x, y, 36, WHITE, 0.75, 0.1);
        lights.add(x, y, 60, hex("#ffb060"), 0.45, 0.5);
        // big chunks of the boulder, thrown up and on, spinning
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.1), sp = R.range(100, 240);
          rock({ kind: B.CHUNK, x: x + R.range(-5, 5), y: y + R.range(-5, 5), vx: Math.cos(a) * sp + 30, vy: Math.sin(a) * sp, g: 1, drag: 0.7, bounce: 0.35, life: R.range(1.3, 1.7), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(2.8, 5.2) });
        }
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + R.range(-1.4, 1.4), sp = R.range(120, 280);
          rock({ kind: B.CHUNK, x: x + R.range(-4, 4), y, vx: Math.cos(a) * sp + 25, vy: Math.sin(a) * sp, g: 1, drag: 0.8, bounce: 0.3, life: R.range(1.1, 1.5), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.4, 2.6) });
        }
        for (let i = 0; i < 60; i++) {
          const u = R.range(-1, 1), a = -Math.PI / 2 + u * 1.1, sp = R.range(80, 300) * (1 - 0.3 * Math.abs(u));
          ps.spawn(P.GRIT, x + u * 6, -1, Math.cos(a) * sp + 30, Math.sin(a) * sp, R.range(1, 1.8), R.pick([S[6], S[5], S[4], S[4], S[3]]), R.chance(0.4) ? 2 : 1);
        }
        for (let i = 0; i < 12; i++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(150, 380);
          ps.spawn(P.SPARK, x, y, Math.cos(a) * sp + 40, Math.sin(a) * sp, R.range(0.15, 0.4));
        }
        // dust rolling out both ways along the floor, and a cloud climbing off the hit
        for (let i = 0; i < 14; i++) {
          const sd = R.sign();
          ps.spawn(P.SMOKE, x + sd * R.range(2, 10), -R.range(1, 5), sd * R.range(40, 140) + 10, -R.range(4, 20), R.range(1.1, 1.8), R.chance(0.5) ? DUST : DUST2, R.range(4.5, 8), R.range(0, 0.05), PF.BIG);
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, x + R.range(-6, 6), -R.range(4, 14), R.range(-15, 25), -R.range(30, 80), R.range(1.2, 1.8), DUST, R.range(6, 9), R.range(0, 0.1), PF.BIG);
        for (let i = 0; i < 3; i++) ps.spawn(P.STAR, x + R.range(-8, 8), y + R.range(-10, 4), 0, -4, R.range(0.2, 0.4), S[7], R.range(1, 2));
      }
      bits.update(dt);
      for (const b of bits.list)
        if (b.rest && !b.dusted) {
          b.dusted = true;
          for (let i = 0; i < 2; i++) ps.spawn(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, R.sign() * R.range(8, 35), -R.range(2, 12), Math.min(R.range(0.3, 0.6), meta.duration - 0.05 - t), DUST2, R.range(1.3, 2.6));
        }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const e = t - tHit;
      // the scar it leaves: a dark dent with cracks running from it, fading at the end
      if (e > 0) {
        const fade = 1 - smooth(meta.duration - 0.6, meta.duration - 0.15, t), w = 10 * Math.min(1, e / 0.05);
        for (let x = Math.floor(-w); x <= w; x++) {
          const d = Math.abs(x) / w;
          p.dot(xHit + x, 0, d < 0.6 ? S[0] : S[1], fade);
          if (d < 0.5) p.dot(xHit + x, 1, S[1], fade * 0.8);
        }
        for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) p.dot(xHit + sd * (w + 2 + k * 3), (k & 1) ? 1 : 0, S[1], fade * (1 - k / 4));
        const k = e / 0.45;
        if (k < 1) band(p, xHit, 0.5, 46 * ease.outCubic(k), 0.18, Math.max(1, 3 * (1 - k)), 1.15 - k, [S[4], S[6], hex("#ffd27a"), WHITE], (g) => Math.sin(g) < 0);
      }
      ps.draw(p, "back");
    },
    draw(p) {
      if (t < tHit) {
        const [x, y] = at(t), sp = Math.hypot(VX, VY + G * t), ux = VX / sp, uy = (VY + G * t) / sp;
        // speed lines trailing it
        for (let i = 0; i < 4; i++) {
          const off = (i - 1.5) * RAD * 0.55, nx = -uy * off, ny = ux * off, L = 10 + (i % 2) * 6;
          p.line(x - ux * (RAD + 2) + nx, y - uy * (RAD + 2) + ny, x - ux * (RAD + 2 + L) + nx, y - uy * (RAD + 2 + L) + ny, i % 2 ? S[5] : S[6], 0.8);
        }
        drawRock(p, x, y, RAD, t * 13, shape, S);
        surface(p, x, y, RAD * 0.8, t * 13, S, MOSSC);
        p.glow(x, y, RAD * 2, S[6], 0.12);
      }
      const e = t - tHit;
      if (e >= 0 && e < 0.07) {
        // the hero frame: the boulder flashes white as it breaks, lines of force burst out
        drawRock(p, xHit, -RAD * 0.8, RAD, tHit * 13, shape, S, 1, true);
        sparkle(p, xHit, -RAD * 0.6, 12 * (1 - e / 0.07), WHITE, hex("#ffd27a"), 0.6);
      }
      if (e >= 0 && e < 0.14) {
        const k = e / 0.14;
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI + (i / 8) * Math.PI, r0 = RAD + 4 + 16 * k, r1 = r0 + 8 * (1 - k);
          p.line(xHit + Math.cos(a) * r0, -RAD * 0.6 + Math.sin(a) * r0, xHit + Math.cos(a) * r1, -RAD * 0.6 + Math.sin(a) * r1, k < 0.5 ? WHITE : S[6]);
        }
      }
      if (e > 0) {
        const k = e / 0.45;
        if (k < 1) band(p, xHit, 0.5, 46 * ease.outCubic(k), 0.18, Math.max(1, 3 * (1 - k)), 1.15 - k, [S[4], S[6], hex("#ffd27a"), WHITE], (g) => Math.sin(g) >= 0);
      }
      for (const b of bits.list) drawRock(p, b.x, b.y, b.s, b.a, b.pts, S, Math.min(1, b.life / 0.4));
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// ---- 3D: the boulder really turns, its flight has a shadow running under it, and the break throws stone, gravel and
// dust out over a full circle round the point of impact, with a true circle of shock on the floor.
const X3 = -66, VX3 = 200;

export const three = {
  meta: { size: [256, 142], origin: [126, 96], camera: { pitch: 0.34 } },
  create(o) {
    const S = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0, RAD = o.size, ST = S.slice(0, 7);
    const DUST = mix(S[6], hex("#9a8f86"), 0.4), DUST2 = mix(S[5], hex("#7a7068"), 0.35), GOLD = hex("#ffd27a");
    const ps = new Particles({ rng: R, ground: floor, sparks: o.sparks }), MOSS = [hex("#101c14"), hex("#1b3320"), hex("#2f5a28"), hex("#4f8a30")];
    const bits = new Bits({ ground: floor }), lights = new Lights();
    // the boulder's own facets; the ones facing up wear moss
    const body = stone3(R, 16, 0.92).map((pl) => (pl[1] < -0.6 ? [pl[0], pl[1], pl[2], pl[3] * 1.02, 1] : pl)), tilt = (() => { const a = [0.18, 0.12, 1], l = Math.hypot(...a); return a.map((v) => v / l); })();
    const tHit = (-VY + Math.sqrt(VY * VY - 2 * G * (Y0 + RAD * 0.8))) / G, xHit = X3 + VX3 * tHit, scar = Array.from({ length: 8 }, (_, i) => {
      let a = (i / 8) * TAU + R.range(-0.2, 0.2), r = R.range(4, 7);
      const len = R.range(10, 20), pts = [[Math.cos(a) * r, Math.sin(a) * r]];
      while (r < len) (r += R.range(2.5, 4.5)), (a += R.range(-0.35, 0.35)), pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      return pts;
    });
    let t = 0, hit = false, thrown = false;
    const at = (tt) => [X3 + VX3 * tt, Y0 + VY * tt + 0.5 * G * tt * tt];
    const rock = (b) => bits.add({ ...b, ...rock3(R) });
    // a fan of directions out of a point of impact: elevation e off the vertical, azimuth h all the way round
    const spray = (cone, speed) => {
      const e = R.range(0, cone), h = R.range(0, TAU), sp = R.range(...speed);
      return [Math.sin(e) * Math.cos(h) * sp, -Math.cos(e) * sp, Math.sin(e) * Math.sin(h) * sp];
    };
    return {
      update(dt) {
        t += dt;
        const f = Math.min(1, dt * 120);
        if (!thrown) {
          thrown = true;
          for (let i = 0; i < 6; i++) ps.spawn3(P.DUST, X3 - R.range(0, 6), Y0 + R.range(-4, 4), R.range(-5, 5), -R.range(20, 70), R.range(-20, 20), R.range(-20, 20), R.range(0.4, 0.7), DUST, R.range(2.5, 4.5));
          lights.add(X3, Y0, 30, WHITE, 0.3, 0.1, 0);
        }
        if (t < tHit) {
          // it sheds dust and the odd pebble as it flies
          const [x, y] = at(t);
          if (R.chance(0.5 * f)) ps.spawn3(P.DUST, x - R.range(2, 6), y + R.range(-4, 4), R.range(-5, 5), -R.range(10, 40), R.range(-10, 10), R.range(-14, 14), R.range(0.3, 0.6), DUST, R.range(2, 3.5));
          if (R.chance(0.12 * f)) ps.spawn3(P.GRIT, x + R.range(-4, 4), y + R.range(-2, 4), R.range(-4, 4), VX3 * 0.3, R.range(-40, 20), R.range(-30, 30), R.range(0.6, 0.9), R.pick([S[5], S[4]]), R.chance(0.3) ? 2 : 1);
        }
        if (!hit && t >= tHit) {
          hit = true;
          const x = xHit, y = -RAD * 0.6;
          lights.add(x, y, 36, WHITE, 0.75, 0.1, 0);
          lights.add(x, y, 60, hex("#ffb060"), 0.45, 0.5, 0);
          // big chunks of the boulder, thrown up and out every way, spinning
          for (let i = 0; i < 9; i++) {
            const [vx, vy, vz] = spray(1.15, [100, 240]);
            rock({ kind: B.CHUNK, x: x + R.range(-5, 5), y: y + R.range(-5, 5), z: R.range(-5, 5), vx: vx + 30, vy, vz, g: 1, drag: 0.7, bounce: 0.35, life: R.range(1.3, 1.7), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(2.8, 5.2) });
          }
          for (let i = 0; i < 14; i++) {
            const [vx, vy, vz] = spray(1.3, [120, 280]);
            rock({ kind: B.CHUNK, x: x + R.range(-4, 4), y, z: R.range(-4, 4), vx: vx + 25, vy, vz, g: 1, drag: 0.8, bounce: 0.3, life: R.range(1.1, 1.5), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.4, 2.6) });
          }
          for (let i = 0; i < 70; i++) {
            const [vx, vy, vz] = spray(1.2, [80, 300]), u = R.range(-1, 1);
            ps.spawn3(P.GRIT, x + u * 6, -1, R.range(-6, 6), vx + 30, vy, vz, R.range(1, 1.8), R.pick([S[6], S[5], S[4], S[4], S[3]]), R.chance(0.4) ? 2 : 1);
          }
          for (let i = 0; i < 12; i++) {
            const [vx, vy, vz] = spray(1.35, [150, 380]);
            ps.spawn3(P.SPARK, x, y, 0, vx + 40, vy, vz, R.range(0.15, 0.4));
          }
          // dust rolling out all the way round along the floor, and a cloud climbing off the hit
          for (let i = 0; i < 20; i++) {
            const h = R.range(0, TAU), v = R.range(40, 140);
            ps.spawn3(P.SMOKE, x + Math.cos(h) * R.range(2, 10), -R.range(1, 5), Math.sin(h) * R.range(2, 10), Math.cos(h) * v + 10, -R.range(4, 20), Math.sin(h) * v, Math.min(R.range(1.1, 1.8), meta.duration - 0.16 - t), R.chance(0.5) ? DUST : DUST2, R.range(4.5, 8), R.range(0, 0.05), PF.BIG);
          }
          for (let i = 0; i < 6; i++) ps.spawn3(P.SMOKE, x + R.range(-6, 6), -R.range(4, 14), R.range(-6, 6), R.range(-15, 25), -R.range(30, 80), R.range(-20, 20), Math.min(R.range(1.2, 1.8), meta.duration - 0.16 - t), DUST, R.range(6, 9), R.range(0, 0.1), PF.BIG);
          for (let i = 0; i < 3; i++) ps.spawn3(P.STAR, x + R.range(-8, 8), y + R.range(-10, 4), R.range(-8, 8), 0, -4, 0, R.range(0.2, 0.4), S[7], R.range(1, 2));
        }
        bits.update(dt);
        for (const b of bits.list)
          if (b.rest && !b.dusted) {
            b.dusted = true;
            for (let i = 0; i < 2; i++) ps.spawn3(P.DUST, b.x + R.range(-1.5, 1.5), -0.5, b.z + R.range(-1.5, 1.5), R.sign() * R.range(8, 35), -R.range(2, 12), R.sign() * R.range(8, 35), Math.min(R.range(0.3, 0.6), meta.duration - 0.05 - t), DUST2, R.range(1.3, 2.6));
          }
        ps.update(dt);
        lights.update(dt);
      },
      draw(p) {
        const q = space(p, o), e = t - tHit, fade = 1 - smooth(meta.duration - 0.6, meta.duration - 0.15, t);
        // the scar it leaves: a dark dent with cracks running from it, fading at the end
        if (e > 0) {
          const w = 9 * Math.min(1, e / 0.05), cr = Math.min(1, e / 0.12);
          q.plane(xHit, 0, 0, null, w + 1, (u, v, out) => {
            const d = Math.hypot(u, v) / w;
            if (d > 1) return;
            out.c = d < 0.6 ? S[0] : S[1];
            out.a = fade;
          });
          for (const c of scar) {
            const m = Math.max(2, Math.ceil(c.length * cr));
            for (let k = 1; k < m; k++) q.line(xHit + c[k - 1][0], 0, c[k - 1][1], xHit + c[k][0], 0, c[k][1], S[1], fade * (1 - k / c.length));
          }
        }
        // the shadow it throws on the floor in flight
        if (t < tHit) {
          const [x, y] = at(t), r = RAD * (0.55 + 0.45 * clamp(1 + y / 90));
          q.plane(x, 0, 0, null, r + 1, (u, v, out) => {
            if (Math.hypot(u, v) > r) return;
            out.c = S[0];
            out.a = 0.42 * (1 - Math.min(0.8, -y / 120));
          });
          const sp = Math.hypot(VX3, VY + G * t), ux = VX3 / sp, uy = (VY + G * t) / sp;
          // speed lines trailing it, a ring of them round its path
          for (let i = 0; i < 6; i++) {
            const ph = (i / 6) * TAU + 0.4, off = RAD * 0.6, ox = -uy * Math.cos(ph) * off, oy = ux * Math.cos(ph) * off, oz = Math.sin(ph) * off, L = 12 + (i % 2) * 7;
            q.line(x - ux * (RAD + 2) + ox, y - uy * (RAD + 2) + oy, oz, x - ux * (RAD + 2 + L) + ox, y - uy * (RAD + 2 + L) + oy, oz, i % 2 ? S[5] : S[6], 0.8);
          }
          hull(q, x, y, 0, turn(body, tilt, t * 13, RAD), [ST, MOSS], { R: RAD * 1.1, gain: 0.85, bias: 0 });
          q.glow(x, y, 0, RAD * 2, S[6], 0.12);
        }
        // the hero frame: the boulder flashes white as it breaks, lines of force burst out every way
        if (e >= 0 && e < 0.07) {
          hull(q, xHit, -RAD * 0.8, 0, turn(body, tilt, tHit * 13, RAD), ST, { R: RAD * 1.1, white: true });
          q.at(xHit, -RAD * 0.6, 0, (pp) => sparkle(pp, 0, 0, 12 * (1 - e / 0.07), WHITE, GOLD, 0.6));
        }
        if (e >= 0 && e < 0.14) {
          const k = e / 0.14;
          for (let i = 0; i < 14; i++) {
            const a = i * 2.399963, y = 0.15 + 0.85 * ((i + 0.5) / 14), r = Math.sqrt(1 - y * y), r0 = RAD + 4 + 16 * k, r1 = r0 + 8 * (1 - k), dx = Math.cos(a) * r, dy = -y, dz = Math.sin(a) * r;
            q.line(xHit + dx * r0, -RAD * 0.6 + dy * r0, dz * r0, xHit + dx * r1, -RAD * 0.6 + dy * r1, dz * r1, k < 0.5 ? WHITE : S[6]);
          }
        }
        // the shock: a true circle racing out across the floor, with light under it
        if (e > 0) {
          const k = e / 0.45;
          if (k < 1) {
            const r = 46 * ease.outCubic(k), w = Math.max(1.5, 4 * (1 - k)), a = Math.min(1, 1.15 - k);
            q.plane(xHit, 0.5, 0, null, r + 1, (u, v, out) => {
              const d = Math.hypot(u, v), b = (d - (r - w)) / w;
              if (b < 0 || b > 1) return;
              out.c = b > 0.78 ? WHITE : b > 0.5 ? GOLD : b > 0.25 ? S[6] : S[4];
              out.a = a;
              out.l = GOLD;
              out.k = 0.3 * a * b;
            });
          }
        }
        bits3(q, bits, ST);
        ps.draw(q);
        lights.draw(q);
      },
    };
  },
};
