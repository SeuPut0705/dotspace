// The orb's build (a see-through body with a lit rim, an inner current drawn as streaks on a tilted plane, motes
// on tilted orbits split behind and in front, a pulsing light) follows Sprite Fusion's open-source energy orb
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, clamp, smooth, space, TAU, WHITE } from "../../core/index.js";
import { WATER, bead, ring, ring3 } from "./_lib.js";

export const meta = {
  name: "Water orb",
  desc: "A sphere of water floats and wobbles: a current circles inside it, the floor shows upside down through it, it shines, light gathers on the floor under it, and drips fall and plink.",
  tags: ["water", "orb", "sphere", "magic", "float", "ambient", "loop"],
  size: [100, 108],
  origin: [50, 100],
  duration: 3,
  loop: true,
  fps: 30,
  bg: "ground",
  options: { palette: WATER, radius: 19, seed: 2 },
};

const D = meta.duration, SY = 0.3, G = 700, DRIP = 1.5, LET = 0.5;

const center = (ph) => [0, -52 + Math.sin(ph * TAU) * 2];
// the skin wobbles: radius at angle a, and the belly sags into a drip before each one falls
const skin = (a, R, ph) => {
  const sag = Math.max(0, Math.sin(a)) ** 6 * 2.2 * smooth(0.1, LET, ((ph * D) % DRIP) / DRIP) * (((ph * D) % DRIP) / DRIP < LET ? 1 : 0);
  return R + Math.sin(a * 3 + ph * TAU * 2) * 0.6 + Math.sin(a * 5 - ph * TAU * 3) * 0.35 + sag;
};

// motes of spray on tilted orbits round it: position, and whether it's in front
function motes(ph, R) {
  return Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * TAU + ph * TAU * (i % 2 ? 1 : -1), r = R + 5 + (i % 3) * 3, tilt = (i - 3) * 0.22, x = Math.cos(a) * r, z = Math.sin(a);
    return { x: x * Math.cos(tilt), y: x * Math.sin(tilt) + z * r * 0.28, z, i };
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, R = o.radius, [cx, cy] = center(ph);
  // light gathers on the floor under it, the orb's caustic
  p.glow(cx, 0, 22, C[5], 0.32);
  p.shade(cx - 9, -2, cx + 9, 2, (x, y, out) => {
    const d = (x - cx) ** 2 / 64 + (y * 2.5) ** 2 / 9;
    if (d > 1) return;
    out.c = d < 0.25 ? WHITE : d < 0.6 ? C[6] : C[5];
    out.a = 1.2 - d;
  });
  for (const m of motes(ph, R)) if (m.z < 0) p.px(cx + m.x, cy + m.y, C[4]);
  p.glow(cx, cy, R * 3.2, C[4], 0.3 + 0.05 * Math.sin(ph * TAU * 2));
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, R = o.radius, [cx, cy] = center(ph), T = ph * TAU;
  // the body: see-through water, deeper toward the bottom; the floor seen upside down through its lower half
  p.shade(cx - R - 4, cy - R - 4, cx + R + 4, cy + R + 6, (x, y, out) => {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx), r = skin(a, R, ph);
    if (d > r) return;
    const q = d / r, lit = (-dx - dy) / Math.SQRT2 / Math.max(0.5, d);
    if (q > 0.9) {
      out.c = lit > 0.35 ? WHITE : lit > -0.2 ? C[5] : C[3];
      return;
    }
    // a lens of water: dark on the side the light comes from, the light gathering low on the far side inside
    const gather = Math.max(0, (dx + dy) / Math.SQRT2 / r) * q;
    p.blend(x, y, gather > 0.45 ? C[4] : gather > 0.25 ? C[3] : q > 0.7 ? C[2] : C[1], gather > 0.25 ? 0.7 : 0.35 + 0.3 * q);
  });
  // the current inside: streaks circling on a tilted plane, bright where they pass in front
  for (let k = 0; k < 3; k++) {
    const rr = R * (0.38 + 0.2 * k), tilt = -0.5 + k * 0.35, spin = T * (k % 2 ? -2 : 3) + k * 2;
    for (let s = 0; s < 1; s += 0.012) {
      const a = spin + s * TAU, x = Math.cos(a) * rr, z = Math.sin(a), y = x * Math.sin(tilt) * 0.6 + z * rr * 0.62, dash = (s * 3 + k * 0.3) % 1;
      if (dash > 0.62) continue;
      p.px(cx + x * Math.cos(tilt), cy + y, z > 0 ? (dash < 0.1 ? WHITE : dash < 0.4 ? C[6] : C[5]) : C[3]);
    }
  }
  // bubbles drift up inside it
  cycle(t, D, 8, o.seed, (g) => g.range(1, 1.8), (age, life, r) => {
    const k = age / life, x = r.range(-0.5, 0.5) * R + Math.sin(age * 4 + r.range(0, TAU)) * 1.5, y = R * 0.6 - k * R * 1.2;
    if (Math.hypot(x, y) > R * 0.8) return;
    p.px(cx + x, cy + y, k < 0.8 ? C[6] : WHITE);
    if (r.next() < 0.35) p.px(cx + x + 1, cy + y, C[5]);
  });
  // the shine: a bright crescent up on the left, a small refracted glint low on the right
  p.arc(cx, cy, R * 0.74, 1.8, Math.PI * 1.12, Math.PI * 1.4, (u, v) => (u > 0.25 && u < 0.75 && v > 0.4 ? WHITE : C[6]));
  p.px(cx - R * 0.45, cy - R * 0.62, WHITE);
  p.px(cx + R * 0.48, cy + R * 0.5, C[6]);
  p.px(cx + R * 0.48 + 1, cy + R * 0.5, C[5]);
  // motes in front
  for (const m of motes(ph, R))
    if (m.z >= 0) {
      p.px(cx + m.x, cy + m.y, WHITE);
      p.px(cx + m.x - (m.i % 2 ? -1 : 1), cy + m.y, C[5]);
      p.glow(cx + m.x, cy + m.y, 4, C[5], 0.35);
    }
  // drips: one swells on its belly and lets go every DRIP seconds, landing with a plink and a ring
  const dt = (t % DRIP) / DRIP, fall = (t % DRIP) - DRIP * LET, y0 = cy + R + 3, land = Math.sqrt((2 * -y0) / G);
  if (fall < 0 && dt > 0.2) {
    const s = smooth(0.2, LET, dt);
    p.circle(cx, cy + R + 1 + s * 1.5, 0.8 + s * 1.2, C[5]);
    p.px(cx - 0.5, cy + R + s * 1.5, C[6]);
  } else if (fall >= 0 && fall < land) bead(p, cx, y0 + 0.5 * G * fall * fall, 0, G * fall, 2, C);
  else if (fall >= land) {
    const since = fall - land;
    if (since < 0.08) p.px(cx, 0, WHITE);
    ring(p, cx, 0, 1.5 + since * 18, SY, 1.1 * (1 - since / 0.4), C, { n: 1, half: 1, seed: 3, hot: since < 0.05 });
  }
  // where the lens brings the light to a point, low on the far side: a bright fleck, pulsing
  const fx = cx + R * 0.36, fy = cy + R * 0.4, pulse = 0.8 + 0.2 * Math.sin(T * 4);
  p.circle(fx, fy, 1.6, C[6]);
  p.px(fx, fy, WHITE);
  p.glow(fx, fy, 9, C[5], 0.45 * pulse);
  p.glow(cx, cy, R * 1.4, C[5], 0.22);
  p.glow(cx - R * 0.4, cy - R * 0.5, 6, WHITE, 0.25);
}

// 3D: a real sphere of water. The skin is a translucent shell lit from the top left of the screen, the current inside is
// three rings on tilted planes spinning in true 3D (bright where they pass in front), spray motes circle it on three
// tilted orbits, bubbles rise through its volume, light gathers on the floor under it as a true circle and the drips
// that fall from its belly land with a ring flat on the water.
export const three = {
  meta: { size: [104, 112], origin: [52, 98], camera: { pitch: 0.34 } },
  draw(p, t, o) {
    const q = space(p, o), C = fit(o.palette, 8), ph = t / D, R = o.radius, [cx, cy] = center(ph), T = ph * TAU, RD = R + 3.5;
    // an orbit of radius r in the plane with normal n: the point at angle a
    const spin = (n, r, a, ox, oy) => {
      const l = Math.hypot(...n), N = n.map((v) => v / l);
      let e1 = [N[2], 0, -N[0]];
      const m = Math.hypot(...e1) || 1;
      e1 = e1.map((v) => v / m);
      const e2 = [N[1] * e1[2] - N[2] * e1[1], N[2] * e1[0] - N[0] * e1[2], N[0] * e1[1] - N[1] * e1[0]], c = Math.cos(a) * r, s = Math.sin(a) * r;
      return [ox + e1[0] * c + e2[0] * s, oy + e1[1] * c + e2[1] * s, e1[2] * c + e2[2] * s];
    };
    // the floor under it: light gathers in a bright disc that wavers at its edge
    q.plane(cx, 0, 0, null, 13, (x, z, out) => {
      const dx = x - cx, rho = Math.hypot(dx, z), web = Math.max(0, 1 - Math.abs(Math.sin(dx * 0.5 + Math.sin(z * 0.45 + T * 2) * 1.6 + T)) * 3.2);
      const d = rho / 11 + 0.1 * Math.sin(Math.atan2(z, dx) * 5 + T * 2) * Math.min(1, rho / 6) - 0.2 * web * (1 - rho / 11);
      if (d > 1) return;
      out.c = d < 0.25 ? WHITE : d < 0.6 ? C[6] : C[5];
      out.a = Math.min(1, 1.2 - d);
      out.blend = true;
    });
    // spray motes: three orbits, each tilted its own way; the ones behind the orb go in first so the shell tints them
    const mote = (i) => {
      const j = i % 3, dir = j === 1 ? -1 : 1, a = (i / 7) * TAU + dir * T, r = R + 5 + j * 3, tz = [-0.5, 0.1, 0.55][j], tx = [0.28, -0.4, 0.2][j];
      const at = (aa) => {
        const x0 = Math.cos(aa) * r, z0 = Math.sin(aa) * r, x1 = x0 * Math.cos(tz), y1 = x0 * Math.sin(tz);
        return [cx + x1, cy + y1 * Math.cos(tx) - z0 * Math.sin(tx), y1 * Math.sin(tx) + z0 * Math.cos(tx)];
      };
      const pos = at(a), back = q.view(pos[0] - cx, pos[1] - cy, pos[2])[2] < 0;
      return { pos, back, dir, trail: [at(a - dir * 0.13), at(a - dir * 0.26)] };
    };
    const ms = Array.from({ length: 7 }, (_, i) => mote(i));
    for (const m of ms) if (m.back) q.px(...m.pos, C[4]);
    // the body: see-through water, deeper toward the bottom, a lit rim, the light gathering low on the far side inside
    let sa = 0;
    q.disc(cx, cy, 0, RD, (d, ang) => {
      const rr = d * RD, r = skin(ang, R, ph);
      if (rr > r) return (sa = 0);
      const qq = rr / r, lit = -(Math.cos(ang) + Math.sin(ang)) / Math.SQRT2, gather = Math.max(0, (Math.cos(ang) + Math.sin(ang)) / Math.SQRT2 * qq) * qq;
      if (qq > 0.9) {
        sa = 0.94;
        return lit > 0.35 ? WHITE : lit > -0.2 ? C[5] : C[3];
      }
      sa = gather > 0.25 ? 0.7 : 0.35 + 0.3 * qq;
      return gather > 0.45 ? C[4] : gather > 0.25 ? C[3] : qq > 0.7 ? C[2] : C[1];
    }, () => sa);
    // the current: three rings on tilted planes, dashed, spinning; white where they pass in front
    for (let k = 0; k < 3; k++) {
      const rr = R * (0.45 + 0.2 * k), tl = 0.3 + 0.28 * k, az = 0.6 + k * 2.1, n = [Math.sin(tl) * Math.cos(az), -Math.cos(tl), Math.sin(tl) * Math.sin(az)], sp = T * (k % 2 ? -2 : 3) + k * 2;
      for (let s = 0; s < 1; s += 0.009) {
        const dash = (s * 3 + k * 0.3) % 1;
        if (dash > 0.62) continue;
        const [x, y, z] = spin(n, rr, sp + s * TAU, cx, cy), front = q.view(x - cx, y - cy, z)[2] > 0;
        q.px(x, y, z, front ? (dash < 0.1 ? WHITE : dash < 0.4 ? C[6] : C[5]) : C[3]);
      }
    }
    // bubbles drift up through it
    cycle(t, D, 8, o.seed, (g) => g.range(1, 1.8), (age, life, r) => {
      const k = age / life, x = r.range(-0.5, 0.5) * R + Math.sin(age * 4 + r.range(0, TAU)) * 1.5, y = R * 0.6 - k * R * 1.2, z = r.range(-0.5, 0.5) * R;
      if (Math.hypot(x, y, z) > R * 0.8) return;
      const two = r.next() < 0.35;
      q.at(cx + x, cy + y, z, (pp) => {
        pp.px(0, 0, k < 0.8 ? C[6] : WHITE);
        if (two) pp.px(1, 0, C[5]);
      });
    });
    // the shine on the near skin: a bright crescent up on the left, a glint low on the right and a fleck the lens brings to a point
    q.at(cx, cy, 0, (pp, k) => {
      const z0 = pp.z;
      pp.z = z0 - R * 0.6;
      pp.arc(0, 0, R * 0.74 * k, 1.8, Math.PI * 1.12, Math.PI * 1.4, (u, v) => (u > 0.25 && u < 0.75 && v > 0.4 ? WHITE : C[6]));
      pp.px(-R * 0.45 * k, -R * 0.62 * k, WHITE);
      pp.px(R * 0.48 * k, R * 0.5 * k, C[6]);
      pp.px(R * 0.48 * k + 1, R * 0.5 * k, C[5]);
      pp.z = z0;
      const fx = R * 0.36 * k, fy = R * 0.4 * k, pulse = 0.8 + 0.2 * Math.sin(T * 4);
      pp.circle(fx, fy, 1.6, C[6]);
      pp.px(fx, fy, WHITE);
      pp.glow(fx, fy, 9, C[5], 0.45 * pulse);
      pp.glow(-R * 0.4 * k, -R * 0.5 * k, 6, WHITE, 0.25);
    });
    // motes in front
    for (const m of ms)
      if (!m.back) {
        q.at(...m.pos, (pp) => {
          pp.px(0, 0, WHITE);
          pp.px(1, 0, C[6]);
          pp.px(0, 1, C[5]);
        });
        q.px(...m.trail[0], C[5]);
        q.px(...m.trail[1], C[4]);
        q.glow(...m.pos, 4, C[5], 0.35);
      }
    // a drip swells on the belly, lets go every DRIP seconds, lands with a plink, a crown of beads and a ring on the water
    const dt = (t % DRIP) / DRIP, fall = (t % DRIP) - DRIP * LET, y0 = cy + R + 3, land = Math.sqrt((2 * -y0) / G);
    if (fall < 0 && dt > 0.2) {
      const s = smooth(0.2, LET, dt);
      q.at(cx, cy + R + 1 + s * 1.5, 0, (pp) => {
        pp.circle(0, 0, 0.8 + s * 1.2, C[5]);
        pp.px(-0.5, -1, C[6]);
      });
    } else if (fall >= 0 && fall < land) {
      const [vx, vy] = q.view(0, G * fall, 0);
      q.at(cx, y0 + 0.5 * G * fall * fall, 0, (pp) => bead(pp, 0, 0, vx, vy, 2, C));
    } else if (fall >= land) {
      const since = fall - land;
      if (since < 0.08) q.px(cx, 0, 0, WHITE);
      if (since < 0.22)
        for (let f = 0; f < 6; f++) {
          const a = (f / 6) * TAU + 0.5, h = 34 * since - 0.5 * 560 * since * since, rr = 1.5 + since * 42;
          if (h > 0) q.px(cx + Math.cos(a) * rr, -h, Math.sin(a) * rr, since < 0.07 ? WHITE : C[6]);
        }
      ring3(q, cx, 0, 1.5 + since * 18, 1.1 * (1 - since / 0.4), C, { n: 1, seed: 3, hot: since < 0.05 });
    }
    // light: the orb's blue haze, the glow it gathers on the floor, the shine
    q.glow(cx, cy, 0, R * 3.2, C[4], 0.3 + 0.05 * Math.sin(T * 2));
    q.glow(cx, 0, 0, 22, C[5], 0.32);
    q.glow(cx, cy, 0, R * 1.4, C[5], 0.22);
  },
};
