// A bouquet of white roses as a point cloud with two states per point:
// `from` (closed buds on long, loose stems, paper folded upright) and `to`
// (the gathered, blooming, wrapped bouquet). The GPU blends between them.

export type V3 = [number, number, number];

// Per vertex: pos(3) colour(3) strand(3) from(3) meta(3: seed, tip, delay).
export const STRIDE = 15;

export interface BouquetV2Data {
  points: Float32Array;
  strands: Float32Array; // line pairs
}

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const NONE: V3 = [0, 0, 0];

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const mix3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const cubic = (p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 => {
  const m = 1 - t;
  return add(
    add(scale(p0, m * m * m), scale(p1, 3 * m * m * t)),
    add(scale(p2, 3 * m * t * t), scale(p3, t * t * t)),
  );
};

function makeRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Cloud {
  private data = new Float32Array(STRIDE * 65536);
  private n = 0;
  push(
    to: V3,
    col: V3,
    strand: V3,
    from: V3,
    seed: number,
    tip: number,
    delay: number,
  ) {
    if (this.n + STRIDE > this.data.length) {
      const next = new Float32Array(this.data.length * 2);
      next.set(this.data);
      this.data = next;
    }
    const d = this.data;
    const i = this.n;
    d.set(to, i);
    d.set(col, i + 3);
    d.set(strand, i + 6);
    d.set(from, i + 9);
    d[i + 12] = seed;
    d[i + 13] = tip;
    d[i + 14] = delay;
    this.n += STRIDE;
  }
  done() {
    return this.data.slice(0, this.n);
  }
}

function frame(origin: V3, axis: V3) {
  const Z = norm(axis);
  let X = cross([0, 1, 0], Z);
  if (Math.hypot(...X) < 1e-3) X = [1, 0, 0];
  X = norm(X);
  const Y = cross(Z, X);
  const dir = (p: V3): V3 => [
    X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2],
    X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2],
    X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2],
  ];
  return { pt: (p: V3) => add(origin, dir(p)), dir };
}

// ---- Rose petals -----------------------------------------------------------

interface Petal {
  az: number;
  span: number;
  L: number;
  r0: number;
  phi0: number;
  a1: number;
  a2: number;
  roll: number;
  wave: number;
  wavePh: number;
}

interface Jitter {
  az: number;
  span: number;
  L: number;
  ph: number;
}

// Petal i of n: inner petals stay furled around the spiral, outer petals
// open first and curl back at the rim. `open` runs 0 (bud) → 1 (full).
function petalFor(
  i: number,
  n: number,
  open: number,
  size: number,
  azBase: number,
  j: Jitter,
): Petal {
  const t = i / (n - 1);
  const o = clamp(open * 1.35 - (1 - t) * 0.35);
  return {
    az: azBase + i * GOLDEN + j.az,
    span: lerp(2.7, 1.95, t) * j.span,
    L: size * lerp(0.42, 1, t) * j.L,
    r0: size * lerp(0.015, 0.05 + 0.07 * o, t),
    phi0: lerp(0.02, 0.06 + 0.72 * o, t ** 1.3),
    a1: lerp(-0.4 + 0.25 * o, 0.08 * o, t),
    a2: lerp(0.05, 0.12 + 0.95 * o, t ** 1.5),
    roll: lerp(0.01, 0.1, t) * o,
    wave: lerp(0.002, 0.012, t),
    wavePh: j.ph,
  };
}

function surface(o: Petal) {
  const N = 40;
  const R = new Float32Array(N + 1);
  const Z = new Float32Array(N + 1);
  const PH = new Float32Array(N + 1);
  let r = o.r0;
  let z = 0;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const ph = o.phi0 + o.a1 * u + o.a2 * u * u * u;
    R[i] = r;
    Z[i] = z;
    PH[i] = ph;
    r = Math.max(o.L * 0.01, r + (Math.sin(ph) * o.L) / N);
    z += (Math.cos(ph) * o.L) / N;
  }
  const widthAt = (u: number) =>
    0.35 + 0.65 * Math.sin((Math.PI / 2) * Math.min(1, u / 0.45));
  const top = (v: number) => 1 - 0.18 * v * v;
  const at = (u: number, v: number): V3 => {
    const f = clamp(u) * N;
    const i = Math.min(N - 1, f | 0);
    const t = f - i;
    const rr = R[i] + (R[i + 1] - R[i]) * t;
    const zz = Z[i] + (Z[i + 1] - Z[i]) * t;
    const ph = PH[i] + (PH[i + 1] - PH[i]) * t;
    const off =
      o.L *
      (o.roll * smooth(0.5, 1, Math.abs(v)) ** 2 * u +
        o.wave * Math.sin(5 * v + o.wavePh) * smooth(0.6, 1, u));
    const rad = rr + Math.cos(ph) * off;
    const zl = zz - Math.sin(ph) * off;
    const th = o.az + v * o.span * 0.5 * widthAt(u);
    return [rad * Math.cos(th), rad * Math.sin(th), zl];
  };
  return { at, top };
}

const LIGHT = norm([-0.45, 0.6, 0.66]);
const IVORY: V3 = [0.975, 0.962, 0.935];
const CREAM: V3 = [0.86, 0.865, 0.72];
const LEAF_DARK: V3 = [0.07, 0.22, 0.09];
const LEAF_LIGHT: V3 = [0.25, 0.46, 0.2];
const STEM: V3 = [0.2, 0.38, 0.15];
const NET: V3 = [0.88, 0.85, 0.94];
const BLUSH: V3 = [0.9, 0.66, 0.74];
const KRAFT: V3 = [0.84, 0.71, 0.55];
const PAPER_WHITE: V3 = [0.93, 0.91, 0.93];
const RIBBON: V3 = [0.78, 0.36, 0.47];

export function buildBouquetV2(quality = 1): BouquetV2Data {
  const rand = makeRandom(20261128);
  const rnd = (a: number, b: number) => a + rand() * (b - a);
  const points = new Cloud();
  const strands = new Cloud();

  function lit(base: V3, n: V3, ambient: number, light: number, ao = 1): V3 {
    let nn = n;
    if (nn[2] < 0) nn = scale(nn, -1);
    const diff = Math.max(0, dot(nn, LIGHT));
    let s = (ambient + light * diff) * ao * rnd(0.94, 1.06);
    if (rand() < 0.02) s *= 1.15;
    const cool = clamp(1 - s) * 0.09;
    return [
      Math.min(1, base[0] * s),
      Math.min(1, base[1] * s + cool * 0.02),
      Math.min(1, base[2] * s + cool * 0.1),
    ];
  }

  const neck: V3 = [0.02, -1.0, 0];
  const bottomOf = (i: number, n: number): V3 => [
    lerp(-0.2, 0.22, i / (n - 1)),
    -1.72,
    0,
  ];

  // ---- Arrangement ---------------------------------------------------------
  interface RoseSpec {
    head: V3;
    axis: V3;
    size: number;
    open: number;
  }
  const roses: RoseSpec[] = [
    { head: [0, 0.22, 0.42], axis: [0, 0.35, 1], size: 0.42, open: 0.9 },
    {
      head: [-0.55, 0.55, 0.2],
      axis: [-0.5, 0.55, 0.7],
      size: 0.36,
      open: 0.8,
    },
    { head: [0.55, 0.52, 0.2], axis: [0.55, 0.5, 0.7], size: 0.37, open: 0.85 },
    { head: [-0.02, 0.86, 0.04], axis: [0, 0.8, 0.55], size: 0.36, open: 0.75 },
    {
      head: [-0.76, 0.05, 0.12],
      axis: [-0.75, 0, 0.65],
      size: 0.33,
      open: 0.85,
    },
    {
      head: [0.76, 0.02, 0.12],
      axis: [0.75, -0.05, 0.65],
      size: 0.34,
      open: 0.8,
    },
    {
      head: [-0.36, -0.3, 0.36],
      axis: [-0.3, -0.4, 0.9],
      size: 0.33,
      open: 0.9,
    },
    {
      head: [0.39, -0.28, 0.36],
      axis: [0.35, -0.4, 0.9],
      size: 0.34,
      open: 0.85,
    },
    {
      head: [-0.52, 1.03, -0.15],
      axis: [-0.35, 0.9, 0.25],
      size: 0.22,
      open: 0.12,
    },
    { head: [0.52, 1.0, -0.15], axis: [0.4, 0.9, 0.2], size: 0.22, open: 0.25 },
    { head: [0.0, 1.24, -0.25], axis: [0.05, 1, 0.15], size: 0.2, open: 0.04 },
    // Generous heads so the finished bouquet is a full, overlapping dome.
  ].map((r) => ({
    ...r,
    size: r.size * 1.3,
    head: r.head as V3,
    axis: norm(r.axis as V3),
  }));

  // Bud state: smaller closed buds held up high on long, loose stems.
  const budOf = (r: RoseSpec) => {
    const head: V3 = [r.head[0] * 1.15, 0.5 + r.head[1] * 0.9, r.head[2] * 0.3];
    const out = norm(sub(head, neck));
    return {
      head,
      axis: norm(add(scale(out, 0.6), [0, 0.4, 0.25])),
      size: r.size * 0.45,
    };
  };

  // Each rose's turn to open, staggered from the front centre outward.
  const roseDelay = (i: number) =>
    0.15 +
    Math.hypot(roses[i].head[0], roses[i].head[1] - 0.3) * 0.55 +
    rand() * 0.15;

  // ---- Roses ---------------------------------------------------------------
  roses.forEach((spec, ri) => {
    const bud = budOf(spec);
    const frTo = frame(spec.head, spec.axis);
    const frFrom = frame(bud.head, bud.axis);
    const n = spec.size < 0.25 ? 10 : 16;
    const azBase = rand() * TAU;
    const base = roseDelay(ri);
    const area = (spec.size / 0.4) ** 2;

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const j: Jitter = {
        az: rnd(-0.15, 0.15),
        span: rnd(0.92, 1.08),
        L: rnd(0.95, 1.05),
        ph: rnd(0, TAU),
      };
      const sTo = surface(petalFor(i, n, spec.open, spec.size, azBase, j));
      const sFrom = surface(petalFor(i, n, 0.02, bud.size, azBase, j));
      const count = Math.round(
        quality * 1050 * lerp(0.5, 2.8, t ** 1.2) * area,
      );
      for (let k = 0; k < count; k++) {
        const v = rnd(-1, 1);
        const um = sTo.top(v);
        // Some extra dots right on the rim keep each petal edge crisp.
        const ue = rand() < 0.13 ? rnd(0.95, 1) : Math.pow(rand(), 0.75);
        const u = um * ue;
        const P = sTo.at(u, v);
        const n0 = norm(
          cross(sub(sTo.at(u + 0.004, v), P), sub(sTo.at(u, v + 0.004), P)),
        );
        const nW = frTo.dir(n0);
        let c = mix3(CREAM, IVORY, smooth(0, 0.42, ue));
        c = mix3(c, [0.88, 0.9, 0.76], (1 - t) * 0.28 * (1 - ue));
        const rim = smooth(0.9, 1, ue);
        c = mix3(c, [1, 1, 1], rim * 0.7);
        // Petal bases and the furled centre sit in shadow; rims catch light.
        const ao =
          (0.6 + 0.4 * t ** 0.7) *
          (0.55 + 0.45 * smooth(0, 0.6, ue)) *
          (1 + rim * 0.25);
        points.push(
          frTo.pt(P),
          lit(c, nW, 0.42, 0.7, ao),
          NONE,
          frFrom.pt(sFrom.at(u, v)),
          rand(),
          0,
          base + (1 - t) * 0.12 + rand() * 0.08,
        );
      }
      // A soft fringe of strands along the rim.
      const ns = Math.round(quality * lerp(6, 26, t) * (spec.size / 0.4));
      for (let k = 0; k < ns; k++) {
        const v = rnd(-1, 1);
        const u = sTo.top(v);
        const P = sTo.at(u, v);
        let d = norm(sub(sTo.at(u + 0.03, v * 1.03), P));
        d = norm([
          d[0] + rnd(-0.3, 0.3),
          d[1] + rnd(-0.3, 0.3),
          d[2] + rnd(-0.3, 0.3),
        ]);
        const V = scale(frTo.dir(d), spec.size * rnd(0.02, 0.045));
        const W = frTo.pt(P);
        const F = frFrom.pt(sFrom.at(u, v));
        const seed = rand();
        const delay = base + 0.1;
        strands.push(W, [0.92, 0.92, 0.94], V, F, seed, 0, delay);
        strands.push(W, [1, 1, 1], V, F, seed, 1, delay);
      }
    }

    // Sepals cup the flower from below; in the bud they hug it.
    for (let s = 0; s < 5; s++) {
      const az = azBase + (s * TAU) / 5;
      const sepal = (open: number, size: number) =>
        surface({
          az,
          span: 0.3,
          L: size * 0.45,
          r0: size * 0.05,
          phi0: lerp(0.35, 1.25, clamp(open * 1.6)),
          a1: 0.45,
          a2: 0.2,
          roll: 0,
          wave: 0.01,
          wavePh: s,
        });
      const sTo = sepal(spec.open, spec.size);
      const sFrom = sepal(0, bud.size);
      const fTo = frame(
        sub(spec.head, scale(spec.axis, 0.02 * spec.size)),
        spec.axis,
      );
      const fFrom = frame(
        sub(bud.head, scale(bud.axis, 0.02 * bud.size)),
        bud.axis,
      );
      for (let k = 0; k < quality * 260 * (spec.size / 0.4); k++) {
        const v = rnd(-1, 1);
        const u = Math.pow(rand(), 0.9) * (1 - 0.6 * v * v);
        const P = sTo.at(u, v);
        const n0 = norm(
          cross(sub(sTo.at(u + 0.004, v), P), sub(sTo.at(u, v + 0.004), P)),
        );
        points.push(
          fTo.pt(P),
          lit(
            mix3(LEAF_DARK, LEAF_LIGHT, 0.35 + 0.4 * u),
            fTo.dir(n0),
            0.32,
            0.72,
          ),
          NONE,
          fFrom.pt(sFrom.at(u, v)),
          rand(),
          0,
          base,
        );
      }
    }

    // Stem: from under the flower, through the tie, down to its cut end.
    const footTo = frTo.pt([0, 0, -0.12 * spec.size]);
    const footFrom = frFrom.pt([0, 0, -0.12 * bud.size]);
    const end = bottomOf(ri, roses.length);
    const knot = add(neck, [lerp(-0.04, 0.04, ri / (roses.length - 1)), 0, 0]);
    const stemAt = (foot: V3, ax: V3, lift: number, t: number): V3 =>
      t <= 1
        ? cubic(
            foot,
            sub(foot, scale(ax, 0.35)),
            add(knot, [(foot[0] - knot[0]) * 0.25, lift, 0]),
            knot,
            t,
          )
        : cubic(
            knot,
            add(knot, [0, -0.25, 0]),
            add(end, [0, 0.25, 0]),
            end,
            t - 1,
          );
    for (let k = 0; k < quality * 2600; k++) {
      const t = rand() * 2;
      // Below the tie the stems are thinner and sparser, so the bundle reads
      // as separate stems instead of one green block.
      if (t > 1 && rand() < 0.5) continue;
      const cTo = stemAt(footTo, spec.axis, 0.45, t);
      const cFrom = stemAt(footFrom, bud.axis, 0.8, t);
      const th = rnd(0, TAU);
      const d: V3 = [Math.cos(th), 0, Math.sin(th)];
      const r = t > 1 ? 0.013 : 0.02;
      points.push(
        add(cTo, scale(d, r)),
        lit(STEM, d, 0.3, 0.75),
        NONE,
        add(cFrom, scale(d, r)),
        rand(),
        0,
        base * 0.6,
      );
    }
  });

  // ---- Leaves: groups of three serrated leaflets ----------------------------
  const leafPlaces = [205, 165, 128, 96, 52, 15, 335];
  const domeC: V3 = [0, 0.38, 0];
  leafPlaces.forEach((deg, li) => {
    const a = (deg * Math.PI) / 180;
    const out: V3 = [Math.cos(a), Math.sin(a) * 0.85, 0];
    const baseTo = add(domeC, add(scale(out, 0.86), [0, 0, -0.05]));
    const dirTo = norm(out);
    // In the bud state the leaves sit on the long stems.
    const spec = roses[li % 8];
    const bud = budOf(spec);
    const along = 0.5 + 0.1 * (li % 3);
    const baseFrom = add(neck, scale(sub(bud.head, neck), along));
    const side = baseFrom[0] >= 0 ? 1 : -1;
    const dirFrom = norm([side * 0.85, 0.5, 0]);
    const delay = 0.5 + li * 0.05;
    for (const [rot, L] of [
      [0, 0.24],
      [0.75, 0.18],
      [-0.75, 0.18],
    ] as [number, number][]) {
      const W = L * 0.36;
      const place = (b: V3, d: V3, x: number, y: number, z: number): V3 => {
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const dx = d[0] * c - d[1] * s;
        const dy = d[0] * s + d[1] * c;
        const off = rot === 0 ? 0.03 : 0;
        return [
          b[0] + (dx * (x + off) - dy * y),
          b[1] + (dy * (x + off) + dx * y),
          b[2] + z,
        ];
      };
      for (let k = 0; k < quality * 1500 * (L / 0.24) ** 2; k++) {
        const s = rand();
        const v = rnd(-1, 1);
        const saw = 1 + 0.07 * ((s * 13) % 1) * smooth(0.1, 0.3, s);
        const w = W * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.8) * saw;
        const x = s * L;
        const y = v * w;
        const z = -0.3 * v * v * w;
        const av = Math.abs(v);
        let c = mix3(LEAF_DARK, LEAF_LIGHT, 0.25 + 0.45 * rand() * (1 - av));
        if (av < 0.05) c = mix3(c, [0.45, 0.62, 0.32], 0.6);
        if ((s * 7 - av * 1.6) % 1 < 0.06) c = mix3(c, LEAF_LIGHT, 0.4);
        const n: V3 = norm([0, -v * 0.6, 1]);
        points.push(
          place(baseTo, dirTo, x, y, z),
          lit(c, n, 0.3, 0.8),
          NONE,
          place(baseFrom, dirFrom, x * 0.8, y * 0.8, z),
          rand(),
          0,
          delay,
        );
      }
    }
  });

  // ---- Baby's breath sprays around the dome ---------------------------------
  [180, 146, 113, 68, 33, 0].forEach((deg, gi) => {
    const a = (deg * Math.PI) / 180;
    const tip = add(domeC, [Math.cos(a) * 1.12, Math.sin(a) * 0.95, -0.1]);
    const from = (p: V3) => add(neck, scale(sub(p, neck), 0.42));
    const delay = 0.9 + gi * 0.08;
    const dotAt = (p: V3, col: V3) =>
      points.push(p, col, NONE, from(p), rand(), 0, delay + rand() * 0.2);
    const twig = (a: V3, b: V3, n: number) => {
      for (let k = 0; k < n; k++)
        dotAt(add(a, scale(sub(b, a), rand())), [0.5, 0.62, 0.38]);
    };
    // Only the last bit of stalk shows; the rest is lost among the roses.
    const start = add(neck, scale(sub(tip, neck), 0.84));
    twig(start, tip, quality * 60);
    const forkAt = (p: V3, dir: number, len: number, depth: number) => {
      const end: V3 = [
        p[0] + Math.cos(dir) * len,
        p[1] + Math.sin(dir) * len,
        p[2],
      ];
      twig(p, end, quality * 30);
      if (depth === 0) {
        const r = rnd(0.012, 0.018);
        for (let k = 0; k < quality * 26; k++) {
          const th = rnd(0, TAU);
          const ph = Math.acos(rnd(-1, 1));
          const d: V3 = [
            Math.sin(ph) * Math.cos(th),
            Math.cos(ph),
            Math.sin(ph) * Math.sin(th),
          ];
          dotAt(
            add(end, scale(d, r * Math.cbrt(rand()))),
            lit(mix3([0.94, 0.94, 0.88], [1, 1, 1], rand()), d, 0.6, 0.45),
          );
        }
        return;
      }
      const kids = rand() < 0.4 ? 3 : 2;
      for (let i = 0; i < kids; i++) {
        const side = kids === 2 ? (i ? 0.5 : -0.5) : i - 1;
        forkAt(
          end,
          dir + side * rnd(0.5, 0.9),
          len * rnd(0.6, 0.78),
          depth - 1,
        );
      }
    };
    const heading = Math.atan2(tip[1] - neck[1], tip[0] - neck[0]);
    forkAt(
      add(neck, scale(sub(tip, neck), 0.85)),
      heading + rnd(-0.3, 0.3),
      0.07,
      3,
    );
    forkAt(tip, heading + rnd(-0.3, 0.3), 0.07, 3);
  });

  // ---- Wrapping ------------------------------------------------------------
  // Netted wings fanning out behind the flowers to either side.
  const foldUp = (p: V3): V3 => [
    neck[0] + (p[0] - neck[0]) * 0.14,
    neck[1] + (p[1] - neck[1]) * 0.78,
    p[2] * 0.3,
  ];
  for (const [a0, a1] of [
    [118, 172],
    [8, 62],
  ]) {
    const edge = (th: number) => 1.58 + 0.07 * Math.sin(th * 15);
    const netDot = (th: number, r: number, bright: number) => {
      const p: V3 = [
        neck[0] + Math.cos(th) * r,
        neck[1] + Math.sin(th) * r,
        -0.35 - 0.12 * (r / 1.6),
      ];
      const c = scale(NET, bright * rnd(0.85, 1.05));
      points.push(p, c, NONE, foldUp(p), rand(), 0, 0.35 + rand() * 0.2);
    };
    const thA = (a0 * Math.PI) / 180;
    const thB = (a1 * Math.PI) / 180;
    for (let th = thA; th <= thB; th += 0.055)
      for (let k = 0; k < quality * 130; k++)
        netDot(th + rnd(-0.004, 0.004), lerp(0.45, edge(th), rand()), 0.55);
    for (let r = 0.5; r < 1.65; r += 0.085)
      for (let k = 0; k < quality * 110; k++) {
        const th = lerp(thA, thB, rand());
        if (r < edge(th)) netDot(th, r + rnd(-0.004, 0.004), 0.5);
      }
    for (let k = 0; k < quality * 1400; k++) {
      const th = lerp(thA, thB, rand());
      netDot(th, edge(th) - rnd(0, 0.012), 0.95);
    }
  }

  // Striped paper cone in front: blush, kraft and white bands.
  const coneW = (y: number) => 0.06 + (y - neck[1]) * 0.66;
  const coneTop = -0.3;
  const bands = 26;
  for (let b = 0; b < bands; b++) {
    const col = [BLUSH, KRAFT, PAPER_WHITE][b % 3];
    const s0 = lerp(-1, 1, b / bands);
    const s1 = lerp(-1, 1, (b + 1) / bands);
    for (let k = 0; k < quality * 720; k++) {
      const y = lerp(
        neck[1],
        coneTop - 0.04 * Math.cos(((s0 + s1) / 2) * 3),
        Math.pow(rand(), 0.8),
      );
      const s = lerp(s0, s1, Math.pow(rand(), 1.6));
      const w = coneW(y);
      const p: V3 = [
        neck[0] + s * w,
        y,
        0.12 + 0.2 * (1 - s * s) * ((y - neck[1]) / (coneTop - neck[1])),
      ];
      const n: V3 = norm([s * 0.8, 0.1, 1]);
      const shade = lit(col, n, 0.45, 0.6, s1 - s < 0.012 ? 1.15 : 1);
      points.push(
        p,
        shade,
        NONE,
        [neck[0] + s * w * 0.22, y, p[2] * 0.5],
        rand(),
        0,
        0.3 + rand() * 0.2,
      );
    }
  }

  // Ribbon bow at the tie, with two trailing tails.
  const knot: V3 = add(neck, [0, 0.02, 0.36]);
  const tube = (path: (t: number) => V3, radius: number, n: number) => {
    for (let k = 0; k < n; k++) {
      const t = rand();
      const c = path(t);
      const T = norm(
        sub(path(Math.min(1, t + 0.01)), path(Math.max(0, t - 0.01))),
      );
      let N = cross(T, [0, 0, 1]);
      if (Math.hypot(...N) < 1e-3) N = [1, 0, 0];
      N = norm(N);
      const B = cross(T, N);
      const th = rnd(0, TAU);
      const d = add(scale(N, Math.cos(th)), scale(B, Math.sin(th)));
      const p = add(c, scale(d, radius));
      points.push(p, lit(RIBBON, d, 0.4, 0.75), NONE, p, rand(), 0, 0);
    }
  };
  for (const side of [-1, 1]) {
    tube(
      (t) => {
        const s = t * TAU;
        const lx = 0.15 * (1 - Math.cos(s)) * side;
        const ly = 0.075 * Math.sin(s) * side;
        const rot = 0.3 * side;
        return add(knot, [
          lx * Math.cos(rot) - ly * Math.sin(rot),
          lx * Math.sin(rot) + ly * Math.cos(rot),
          0.02 * (1 - Math.cos(s)),
        ]);
      },
      0.02,
      quality * 2200,
    );
    tube(
      (t) =>
        add(knot, [
          side * (0.03 + 0.12 * t),
          -0.42 * t,
          0.02 * Math.sin(t * 6),
        ]),
      0.016,
      quality * 1400,
    );
  }
  tube(
    (t) => add(knot, [0.03 * Math.cos(t * TAU), 0.035 * Math.sin(t * TAU), 0]),
    0.018,
    quality * 500,
  );

  return { points: points.done(), strands: strands.done() };
}
