// Three white roses drawn in glowing lines on a dark canvas. The petals are
// real 3D shapes projected each frame; only their outlines are drawn, filled
// with the background colour back-to-front so nearer petals hide farther
// ones, like a hand-inked drawing. The middle rose blooms over time.

type V3 = [number, number, number];
type P2 = [number, number];

const TAU = Math.PI * 2;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

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

// ---- Petal geometry ------------------------------------------------------

interface PetalShape {
  az: number; // position around the centre
  span: number; // how far it wraps around the centre (radians)
  L: number; // length
  r0: number; // base distance from the centre
  phi0: number; // lean away from the axis at the base
  a1: number; // change in lean along the petal (negative closes inward)
  a2: number; // curl at the rim: open roses fold their outer petals back
  roll: number; // side edges rolling outward
  wave: number; // slight waviness of the rim
  wavePh: number;
}

interface PetalOutline {
  left: V3[];
  rim: V3[];
  right: V3[];
  fold: V3[] | null; // where the rim curls back, drawn as a faint line
}

// The petal is a profile curve swept around the flower's axis, so petals
// cup around the centre; only the outline is sampled.
function petalOutline(o: PetalShape): PetalOutline {
  const N = 28;
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
  const left: V3[] = [];
  const rim: V3[] = [];
  const right: V3[] = [];
  for (let k = 0; k <= 8; k++) left.push(at((top(-1) * k) / 8, -1));
  for (let k = 0; k <= 24; k++) {
    const v = -1 + (2 * k) / 24;
    rim.push(at(top(v), v));
  }
  for (let k = 8; k >= 0; k--) right.push(at((top(1) * k) / 8, 1));
  let fold: V3[] | null = null;
  if (o.a2 > 0.55) {
    fold = [];
    for (let k = 0; k <= 14; k++) {
      const v = -0.8 + (1.6 * k) / 14;
      fold.push(at(0.8 * top(v), v));
    }
  }
  return { left, rim, right, fold };
}

class Rose {
  private jitter: { az: number; span: number; L: number; ph: number }[];
  private azBase: number;
  constructor(
    public head: V3,
    public axis: V3,
    public size: number,
    rand: () => number,
    private count = 16,
  ) {
    this.azBase = rand() * TAU;
    this.jitter = Array.from({ length: count }, () => ({
      az: (rand() - 0.5) * 0.3,
      span: 0.92 + rand() * 0.16,
      L: 0.95 + rand() * 0.1,
      ph: rand() * TAU,
    }));
  }

  // Outer petals open first; inner ones stay furled around the spiral.
  petals(open: number): PetalShape[] {
    return this.jitter.map((j, i) => {
      const t = i / (this.count - 1);
      const o = clamp(open * 1.35 - (1 - t) * 0.35);
      return {
        az: this.azBase + i * GOLDEN + j.az,
        span: lerp(2.7, 1.95, t) * j.span,
        L: this.size * lerp(0.42, 1, t) * j.L,
        r0: this.size * lerp(0.015, 0.05 + 0.07 * o, t),
        phi0: lerp(0.02, 0.06 + 0.72 * o, t ** 1.3),
        a1: lerp(-0.4 + 0.25 * o, 0.08 * o, t),
        a2: lerp(0.05, 0.12 + 0.95 * o, t ** 1.5),
        roll: lerp(0.01, 0.1, t) * o,
        wave: lerp(0.002, 0.012, t),
        wavePh: j.ph,
      };
    });
  }

  sepals(open: number): PetalShape[] {
    return [0, 1, 2, 3, 4].map((k) => ({
      az: this.azBase + (k * TAU) / 5,
      span: 0.3,
      L: this.size * 0.45,
      r0: this.size * 0.05,
      phi0: lerp(0.35, 1.25, clamp(open * 1.6)),
      a1: 0.45,
      a2: 0.2,
      roll: 0,
      wave: 0.01,
      wavePh: k,
    }));
  }
}

// ---- Scene description -----------------------------------------------------

const ROSE_LINE = '246, 243, 236';
const SAGE = '163, 192, 155';
const RIBBON = '232, 199, 194';
const FILL = 'rgba(9, 10, 14, 0.97)';
const KRAFT = '214, 190, 158'; // back wrapping paper
const PEARL = '224, 221, 233'; // front wrapping paper
const BLOSSOM = '250, 246, 240'; // baby's breath
const WAXFLOWER = '246, 226, 230';

interface Stem {
  from: V3; // under the flower head
  c1: V3;
  c2: V3;
  to: V3; // the tie
  end: V3; // bottom of the stem
}

interface Leaf {
  stem: number;
  t: number;
  angle: number; // direction in the picture plane, radians
  L: number;
}

const cubic = (p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 => {
  const m = 1 - t;
  return add(
    add(scale(p0, m * m * m), scale(p1, 3 * m * m * t)),
    add(scale(p2, 3 * m * t * t), scale(p3, t * t * t)),
  );
};

const quadPts = (a: V3, c: V3, b: V3, n = 16): V3[] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const t = k / n;
    const m = 1 - t;
    return add(add(scale(a, m * m), scale(c, 2 * m * t)), scale(b, t * t));
  });

// Turn a point around `o` in the picture plane (for sprigs swaying).
const turn = (p: V3, o: V3, a: number): V3 => {
  const x = p[0] - o[0];
  const y = p[1] - o[1];
  return [
    o[0] + x * Math.cos(a) - y * Math.sin(a),
    o[1] + x * Math.sin(a) + y * Math.cos(a),
    p[2],
  ];
};

// Florist's wrap: a kraft sheet fanned out behind the flowers, two pearl
// sheets folded across the stems in front, and a short skirt below the tie.
function buildWrap() {
  const BZ = -0.18;
  const FZ = 0.06;
  const backTop: V3[] = [];
  for (let k = 0; k <= 60; k++) {
    const x = lerp(-1, 1.04, k / 60);
    const y =
      0.32 + 0.52 * (1 - ((x - 0.02) / 1.02) ** 2) + 0.03 * Math.sin(x * 11);
    backTop.push([x, y, BZ]);
  }
  const back = [
    ...quadPts([-0.13, -0.93, BZ], [-0.55, -0.45, BZ], [-1, 0.32, BZ]),
    ...backTop,
    ...quadPts([1.04, 0.32, BZ], [0.6, -0.45, BZ], [0.17, -0.93, BZ]),
  ];

  const left = [
    ...quadPts([-0.12, -0.97, FZ], [-0.6, -0.7, FZ], [-0.8, -0.34, FZ]),
    ...quadPts([-0.8, -0.34, FZ], [-0.35, -0.32, FZ], [0.1, -0.56, FZ]),
    ...quadPts([0.1, -0.56, FZ], [0.1, -0.8, FZ], [0.06, -0.97, FZ], 8),
  ];
  const leftLines = [
    quadPts([-0.77, -0.39, FZ], [-0.35, -0.38, FZ], [0.07, -0.6, FZ]),
    quadPts([-0.04, -0.95, FZ], [-0.3, -0.65, FZ], [-0.45, -0.4, FZ]),
  ];
  const right = [
    ...quadPts([-0.02, -0.97, FZ], [-0.06, -0.8, FZ], [-0.06, -0.6, FZ], 8),
    ...quadPts([-0.06, -0.6, FZ], [0.35, -0.34, FZ], [0.78, -0.24, FZ]),
    ...quadPts([0.78, -0.24, FZ], [0.6, -0.68, FZ], [0.17, -0.97, FZ]),
  ];
  const rightLines = [
    quadPts([-0.03, -0.64, FZ], [0.35, -0.4, FZ], [0.75, -0.29, FZ]),
    quadPts([0.08, -0.95, FZ], [0.3, -0.62, FZ], [0.42, -0.36, FZ]),
  ];
  // Pinked (zig-zag) bottom edge, like florist's paper.
  const skirt: V3[] = [
    [-0.11, -0.95, FZ],
    [-0.2, -1.3, FZ],
  ];
  for (let k = 1; k < 10; k++)
    skirt.push([lerp(-0.2, 0.25, k / 10), -1.3 + (k % 2) * 0.025, FZ]);
  skirt.push([0.25, -1.3, FZ], [0.16, -0.95, FZ]);
  const skirtLines = [
    quadPts([0.03, -0.97, FZ], [0.02, -1.1, FZ], [0.03, -1.28, FZ], 8),
  ];

  return {
    back,
    left,
    leftLines,
    right,
    rightLines,
    skirt,
    skirtLines,
  };
}

export function startBouquet(
  canvas: HTMLCanvasElement,
  // startAt: begin the animation this many seconds in (for previewing).
  { reducedMotion = false, startAt = 0 } = {},
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const rand = makeRandom(20261127);

  const bind: V3 = [0.02, -0.95, 0];
  const roses = [
    new Rose([0.04, 0.24, 0], norm([0, 0.82, 0.57]), 0.62, rand), // blooms
    new Rose([-0.62, -0.12, -0.1], norm([-0.5, 0.72, 0.48]), 0.46, rand),
    new Rose([0.56, 0.6, -0.15], norm([0.35, 0.9, 0.3]), 0.38, rand),
  ];
  const baseOpen = [0.06, 0.62, 0.2];

  const stems: Stem[] = roses.map((r, i) => {
    const from = add(r.head, scale(r.axis, -0.06 * r.size));
    const to = add(bind, [(i - 1) * 0.03, 0, 0]);
    return {
      from,
      c1: add(from, scale(r.axis, -0.45)),
      c2: add(to, [(from[0] - to[0]) * 0.25, 0.5, 0]),
      to,
      end: [bind[0] + [0.02, -0.12, 0.13][i], -1.75, 0],
    };
  });
  const stemPoint = (s: Stem, t: number): V3 =>
    t <= 1
      ? cubic(s.from, s.c1, s.c2, s.to, t)
      : cubic(
          s.to,
          add(s.to, [0, -0.25, 0]),
          add(s.end, [0, 0.25, 0]),
          s.end,
          t - 1,
        );
  // Bottom of the stem up to the flower, so it is drawn growing upward.
  const stemPath = (s: Stem): V3[] => {
    const pts: V3[] = [];
    for (let k = 40; k >= 0; k--) pts.push(stemPoint(s, (k / 40) * 2));
    return pts;
  };

  const leaves: Leaf[] = [
    { stem: 0, t: 0.42, angle: 0.35, L: 0.38 },
    { stem: 0, t: 0.62, angle: Math.PI - 0.45, L: 0.33 },
    { stem: 1, t: 0.42, angle: Math.PI - 0.25, L: 0.32 },
    { stem: 2, t: 0.5, angle: 0.55, L: 0.3 },
    { stem: 1, t: 0.82, angle: Math.PI + 0.15, L: 0.26 },
  ];
  const thorns = [
    [0, 0.28, 1],
    [0, 0.78, -1],
    [1, 0.3, -1],
    [1, 0.62, 1],
    [2, 0.35, -1],
    [2, 0.7, 1],
  ] as const;

  const dust = Array.from({ length: 90 }, () => ({
    x: lerp(-1.6, 1.6, rand()),
    y: lerp(-2.3, 1.5, rand()),
    r: lerp(0.5, 1.6, rand()),
    speed: lerp(0.012, 0.035, rand()),
    ph: rand() * TAU,
  }));

  interface Falling {
    x: number;
    y: number;
    born: number;
    ph: number;
    size: number;
  }
  const falling: Falling[] = [];
  let nextFall = 12;

  const wrap = buildWrap();

  // ---- Filler flowers -------------------------------------------------------
  // As in a hand-tied bouquet, every filler stem rises from the tied bundle
  // and fans outward, so their tips form a rounded dome around the roses.
  // Only the outer part of each stem shows; the rest is lost in the bouquet.
  const domeCentre: V3 = [0.02, 0.22, 0];
  const neck: V3 = [bind[0], bind[1] + 0.05, -0.12];
  type Kind = 'eucalyptus' | 'gypsophila' | 'waxflower';
  // Kind and direction (degrees) around the dome.
  const plan: [Kind, number][] = [
    ['eucalyptus', 205],
    ['gypsophila', 228],
    ['gypsophila', 178],
    ['eucalyptus', 152],
    ['waxflower', 141],
    ['gypsophila', 128],
    ['gypsophila', 104],
    ['waxflower', 90],
    ['gypsophila', 77],
    ['gypsophila', 52],
    ['waxflower', 36],
    ['eucalyptus', 22],
    ['gypsophila', 3],
    ['gypsophila', 313],
    ['eucalyptus', 336],
  ];

  interface Filler {
    kind: Kind;
    stem: V3[]; // from the bundle to the tip, 31 points
    branches: { pts: V3[]; at: number }[]; // `at`: growth progress it starts
    florets: { c: V3; r: number; at: number }[];
    leaves: { c: V3; r: number; ang: number; at: number }[];
    blooms: { c: V3; r: number; rot: number; bud: boolean; at: number }[];
  }

  const fillers: Filler[] = plan
    .map(([kind, deg]): Filler => {
      const a = (deg * Math.PI) / 180;
      const reach =
        (kind === 'eucalyptus' ? 1.04 : kind === 'waxflower' ? 0.9 : 0.96) +
        lerp(-0.04, 0.04, rand());
      const z = kind === 'eucalyptus' ? -0.22 : -0.14;
      const tip: V3 = [
        domeCentre[0] + Math.cos(a) * reach,
        domeCentre[1] + Math.sin(a) * 0.68 * reach,
        z,
      ];
      const out = norm([Math.cos(a), Math.sin(a), 0]);
      // Stems bow outward a little; eucalyptus arches under its leaves.
      const ctrl = add(
        add(scale(neck, 0.45), scale(tip, 0.55)),
        add(scale(out, 0.12), [0, kind === 'eucalyptus' ? 0.1 : 0.04, 0]),
      );
      const stem = quadPts(neck, ctrl, tip, 30);
      const f: Filler = {
        kind,
        stem,
        branches: [],
        florets: [],
        leaves: [],
        blooms: [],
      };
      const tangent = (i: number) => {
        const p = stem[Math.min(30, i)];
        const q = stem[Math.max(0, Math.min(30, i) - 1)];
        return norm([p[0] - q[0], p[1] - q[1], 0]);
      };

      if (kind === 'gypsophila') {
        // Baby's breath forks again and again into a loose, airy cloud.
        const fork = (
          p: V3,
          dir: number,
          len: number,
          depth: number,
          at: number,
        ) => {
          const end: V3 = [
            p[0] + Math.cos(dir) * len,
            p[1] + Math.sin(dir) * len,
            p[2],
          ];
          f.branches.push({ pts: [p, end], at });
          const next = at + 0.07;
          if (depth === 0) {
            f.florets.push({ c: end, r: lerp(0.01, 0.016, rand()), at: next });
            if (rand() < 0.55)
              f.florets.push({
                c: add(end, [
                  lerp(-0.022, 0.022, rand()),
                  lerp(-0.022, 0.022, rand()),
                  0,
                ]),
                r: lerp(0.007, 0.011, rand()),
                at: next + 0.05,
              });
            return;
          }
          const n = rand() < 0.4 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const side = n === 2 ? (i ? 0.5 : -0.5) : i - 1;
            fork(
              end,
              dir + side * lerp(0.5, 0.9, rand()),
              len * lerp(0.6, 0.78, rand()),
              depth - 1,
              next,
            );
          }
        };
        for (const i of [22, 25, 28, 30]) {
          const d = tangent(i);
          fork(
            stem[i],
            Math.atan2(d[1], d[0]) + lerp(-0.4, 0.4, rand()),
            lerp(0.055, 0.085, rand()),
            i >= 28 ? 3 : 2,
            i / 30,
          );
        }
      } else if (kind === 'eucalyptus') {
        // Round leaves in opposite pairs, getting smaller toward the tip.
        for (let i = 21; i <= 30; i += 2) {
          const d = tangent(i);
          const t = i / 30;
          const r = lerp(0.048, 0.026, (t - 0.7) / 0.3);
          for (const side of [-1, 1]) {
            const n: V3 = [-d[1] * side, d[0] * side, 0];
            f.leaves.push({
              c: add(stem[i], scale(n, r * 0.95)),
              r,
              ang: Math.atan2(n[1], n[0]),
              at: t,
            });
          }
        }
      } else {
        // Waxflower: a little fan of five-petalled blossoms and buds.
        const d = tangent(30);
        const base = Math.atan2(d[1], d[0]);
        const n = 5 + ((rand() * 3) | 0);
        for (let i = 0; i < n; i++) {
          const ang =
            base +
            lerp(-1.1, 1.1, n === 1 ? 0.5 : i / (n - 1)) +
            lerp(-0.12, 0.12, rand());
          const len = lerp(0.045, 0.075, rand());
          const c: V3 = [
            tip[0] + Math.cos(ang) * len,
            tip[1] + Math.sin(ang) * len,
            z,
          ];
          const bud = rand() < 0.3;
          f.branches.push({ pts: [tip, c], at: 1 + i * 0.03 });
          f.blooms.push({
            c,
            r: bud ? 0.008 : lerp(0.018, 0.026, rand()),
            rot: rand() * TAU,
            bud,
            at: 1.05 + i * 0.03,
          });
        }
      }
      return f;
    })
    // Placed one by one in a sweep from left to right.
    .sort((p, q) => p.stem[30][0] - q.stem[30][0]);

  // ---- View ----------------------------------------------------------------
  let W = 0;
  let H = 0;
  let S = 1;
  let cx = 0;
  let cy = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W / 2.45, H / 3.25);
    cx = W / 2;
    // Sits a little high, leaving room for the note underneath.
    cy = H / 2 - 0.44 * S;
  }
  resize();
  window.addEventListener('resize', resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
  };
  window.addEventListener('pointermove', onMove);
  document.addEventListener('pointerleave', onLeave);

  let yaw = 0;
  let pitch = 0;
  let sway = 0;
  // World → screen: a gentle turn around the bouquet, then a flat projection.
  const project = (p: V3): [number, number, number] => {
    // The whole bouquet sways a little around the tie.
    const px = p[0] - bind[0];
    const py = p[1] - bind[1];
    const sx0 = px * Math.cos(sway) - py * Math.sin(sway) + bind[0];
    const sy0 = px * Math.sin(sway) + py * Math.cos(sway) + bind[1];
    const x = sx0 * Math.cos(yaw) + p[2] * Math.sin(yaw);
    let z = -sx0 * Math.sin(yaw) + p[2] * Math.cos(yaw);
    const y0 = sy0 + 0.4;
    const y = y0 * Math.cos(pitch) - z * Math.sin(pitch) - 0.4;
    z = y0 * Math.sin(pitch) + z * Math.cos(pitch);
    return [cx + x * S, cy - y * S, z];
  };

  // ---- Drawing helpers ---------------------------------------------------
  function path(pts: P2[], frac = 1) {
    const n = pts.length;
    const f = clamp(frac) * (n - 1);
    const whole = Math.floor(f);
    ctx!.beginPath();
    ctx!.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= whole && i < n; i++) ctx!.lineTo(pts[i][0], pts[i][1]);
    if (whole < n - 1) {
      const t = f - whole;
      const a = pts[whole];
      const b = pts[whole + 1];
      ctx!.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    }
  }
  // A soft halo pass, then the crisp line on top.
  function glow(
    pts: P2[],
    rgb: string,
    width: number,
    alpha: number,
    frac = 1,
  ) {
    if (frac <= 0 || pts.length < 2) return;
    path(pts, frac);
    ctx!.strokeStyle = `rgba(${rgb}, ${alpha * 0.16})`;
    ctx!.lineWidth = width * 5;
    ctx!.stroke();
    ctx!.strokeStyle = `rgba(${rgb}, ${alpha})`;
    ctx!.lineWidth = width;
    ctx!.stroke();
  }
  const to2 = (pts: V3[], map: (p: V3) => V3) =>
    pts.map((p) => {
      const q = project(map(p));
      return [q[0], q[1]] as P2;
    });

  function frameOf(rose: Rose, wobble: V3) {
    const Z = norm(add(rose.axis, wobble));
    let X = cross([0, 1, 0], Z);
    if (Math.hypot(...X) < 1e-3) X = [1, 0, 0];
    X = norm(X);
    const Y = cross(Z, X);
    return (origin: V3) =>
      (p: V3): V3 => [
        origin[0] + X[0] * p[0] + Y[0] * p[1] + Z[0] * p[2],
        origin[1] + X[1] * p[0] + Y[1] * p[1] + Z[1] * p[2],
        origin[2] + X[2] * p[0] + Y[2] * p[1] + Z[2] * p[2],
      ];
  }

  function drawPetal(
    o: PetalOutline,
    map: (p: V3) => V3,
    frac: number,
    rgb: string,
    strength: number,
    tint = 0.03,
  ) {
    const all = to2([...o.left, ...o.rim, ...o.right], map);
    if (frac > 0.25) {
      path(all);
      ctx!.closePath();
      ctx!.fillStyle = FILL;
      ctx!.globalAlpha = smooth(0.25, 1, frac);
      ctx!.fill();
      // A pale sheen gives each petal body, so the flower reads as white.
      ctx!.fillStyle = `rgba(${rgb}, ${tint})`;
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }
    glow(all, rgb, 1, 0.55 * strength, frac);
    // The rim, the part a rose is recognised by, is drawn brightest.
    const rimStart = o.left.length / all.length;
    const rimFrac = (frac - rimStart) / (o.rim.length / all.length);
    if (rimFrac > 0) glow(to2(o.rim, map), rgb, 1.8, 0.97 * strength, rimFrac);
    if (o.fold && frac >= 1) glow(to2(o.fold, map), rgb, 0.8, 0.28 * strength);
  }

  function drawLeaf(leaf: Leaf, frac: number) {
    const base = stemPoint(stems[leaf.stem], leaf.t);
    const d: V3 = [Math.cos(leaf.angle), Math.sin(leaf.angle), 0];
    const n: V3 = [-d[1], d[0], 0];
    const w = leaf.L * 0.3;
    const bend = 0.12 * leaf.L * Math.sign(Math.cos(leaf.angle));
    const at = (s: number, side: number): V3 => {
      const width = w * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 0.9);
      const curve = -bend * s * s;
      return add(
        base,
        add(scale(d, s * leaf.L), scale(n, side * width + curve)),
      );
    };
    const outline: V3[] = [];
    for (let k = 0; k <= 20; k++) outline.push(at(k / 20, 1));
    for (let k = 20; k >= 0; k--) outline.push(at(k / 20, -1));
    const pts = to2(outline, (p) => p);
    if (frac > 0.3) {
      path(pts);
      ctx!.closePath();
      ctx!.fillStyle = FILL;
      ctx!.globalAlpha = smooth(0.3, 1, frac);
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }
    glow(pts, SAGE, 1, 0.75, frac);
    const rib: V3[] = [];
    for (let k = 0; k <= 12; k++) rib.push(at(k / 12, 0));
    glow(
      to2(rib, (p) => p),
      SAGE,
      0.8,
      0.5,
      (frac - 0.4) / 0.6,
    );
    if (frac >= 1) {
      for (let k = 1; k <= 4; k++) {
        const s = k / 5.5;
        for (const side of [-1, 1]) {
          const vein = [at(s, 0), at(Math.min(1, s + 0.14), side * 0.75)];
          glow(
            to2(vein, (p) => p),
            SAGE,
            0.6,
            0.3,
          );
        }
      }
    }
  }

  function drawRibbon(frac: number) {
    const knot = add(bind, [0, 0.02, 0.05]);
    for (const side of [-1, 1]) {
      const loop: V3[] = [];
      for (let k = 0; k <= 30; k++) {
        const th = (k / 30) * TAU;
        const lx = 0.13 * (1 - Math.cos(th)) * side;
        const ly = 0.065 * Math.sin(th) * side;
        const rot = 0.3 * side;
        loop.push(
          add(knot, [
            lx * Math.cos(rot) - ly * Math.sin(rot),
            lx * Math.sin(rot) + ly * Math.cos(rot),
            0,
          ]),
        );
      }
      glow(
        to2(loop, (p) => p),
        RIBBON,
        1.1,
        0.85,
        frac,
      );
      for (const edge of [-0.022, 0.022]) {
        const tail: V3[] = [];
        for (let k = 0; k <= 16; k++) {
          const t = k / 16;
          tail.push(
            add(knot, [
              side * (0.03 + 0.1 * t) + edge,
              -0.4 * t,
              0.02 * Math.sin(t * 6),
            ]),
          );
        }
        glow(
          to2(tail, (p) => p),
          RIBBON,
          0.9,
          0.7,
          (frac - 0.3) / 0.7,
        );
      }
    }
    const knotRing: V3[] = [];
    for (let k = 0; k <= 16; k++) {
      const th = (k / 16) * TAU;
      knotRing.push(add(knot, [0.028 * Math.cos(th), 0.034 * Math.sin(th), 0]));
    }
    glow(
      to2(knotRing, (p) => p),
      RIBBON,
      1.1,
      0.9,
      frac,
    );
  }

  function drawFallingPetal(f: Falling, now: number) {
    const age = now - f.born;
    const y = f.y - age * 0.07;
    const x = f.x + 0.12 * Math.sin(age * 0.7 + f.ph);
    const alpha = smooth(0, 1.5, age) * smooth(-2.25, -1.7, y);
    if (alpha <= 0.01) return;
    const rot = 0.6 * Math.sin(age * 0.5 + f.ph) + age * 0.25;
    const flip = Math.cos(age * 0.9 + f.ph); // turning over as it falls
    const pts: V3[] = [];
    for (let k = 0; k <= 26; k++) {
      const th = (k / 26) * TAU;
      const py = -f.size * Math.cos(th);
      const px =
        f.size * 0.7 * Math.sin(th) * Math.sqrt((1 - Math.cos(th)) / 2) * flip;
      pts.push([
        x + px * Math.cos(rot) - py * Math.sin(rot),
        y + px * Math.sin(rot) + py * Math.cos(rot),
        0.3,
      ]);
    }
    const p2 = to2(pts, (p) => p);
    path(p2);
    ctx!.closePath();
    ctx!.fillStyle = FILL;
    ctx!.globalAlpha = alpha;
    ctx!.fill();
    ctx!.globalAlpha = 1;
    glow(p2, ROSE_LINE, 1.1, 0.85 * alpha);
  }

  const id = (p: V3) => p;
  const ring = (c: V3, rx: number, ry: number, rot: number, n = 12): V3[] =>
    Array.from({ length: n + 1 }, (_, k) => {
      const th = (k / n) * TAU;
      const x = rx * Math.cos(th);
      const y = ry * Math.sin(th);
      return [
        c[0] + x * Math.cos(rot) - y * Math.sin(rot),
        c[1] + x * Math.sin(rot) + y * Math.cos(rot),
        c[2],
      ];
    });

  // A sheet of wrapping paper: filled so it hides what is behind it.
  function drawSheet(
    outline: V3[],
    details: V3[][],
    frac: number,
    rgb: string,
    strength = 0.48,
  ) {
    if (frac <= 0) return;
    const pts = to2(outline, id);
    if (frac > 0.2) {
      path(pts);
      ctx!.closePath();
      ctx!.globalAlpha = smooth(0.2, 1, frac);
      ctx!.fillStyle = FILL;
      ctx!.fill();
      ctx!.fillStyle = `rgba(${rgb}, 0.045)`;
      ctx!.fill();
      ctx!.globalAlpha = 1;
    }
    glow(pts, rgb, 1.1, strength, frac);
    for (const line of details)
      glow(to2(line, id), rgb, 0.8, 0.16, (frac - 0.55) / 0.45);
  }

  // Draws one filler as it grows: `frac` runs 0 → ~1.35. The stem reaches its
  // tip at 1; blossoms and leaves open after the stem has passed them.
  function drawFiller(f: Filler, frac: number, sw: number) {
    if (frac <= 0.7) return;
    const move = (p: V3) => turn(p, neck, sw);
    // Only the outer half of the stem is ever visible.
    glow(
      to2(f.stem.slice(21).map(move), id),
      SAGE,
      0.8,
      0.55,
      (frac - 0.7) / 0.3,
    );
    for (const b of f.branches) {
      const g = (frac - b.at) / 0.07;
      if (g > 0) glow(to2(b.pts.map(move), id), SAGE, 0.65, 0.5, g);
    }
    for (const leaf of f.leaves) {
      const appear = smooth(leaf.at, leaf.at + 0.14, frac);
      if (appear <= 0) continue;
      const c = move(leaf.c);
      const pts = to2(
        ring(c, leaf.r * appear, leaf.r * 0.7 * appear, leaf.ang, 18),
        id,
      );
      path(pts);
      ctx!.closePath();
      ctx!.fillStyle = FILL;
      ctx!.fill();
      ctx!.fillStyle = `rgba(${SAGE}, 0.05)`;
      ctx!.fill();
      glow(pts, SAGE, 0.9, 0.62 * appear);
      const dx = Math.cos(leaf.ang) * leaf.r * appear;
      const dy = Math.sin(leaf.ang) * leaf.r * appear;
      glow(
        to2(
          [
            [c[0] - dx, c[1] - dy, c[2]],
            [c[0] + dx * 0.75, c[1] + dy * 0.75, c[2]],
          ],
          id,
        ),
        SAGE,
        0.6,
        0.32 * appear,
      );
    }
    for (const fl of f.florets) {
      const appear = smooth(fl.at, fl.at + 0.15, frac);
      if (appear <= 0) continue;
      const pts = to2(
        ring(move(fl.c), fl.r * appear, fl.r * appear, 0, 10),
        id,
      );
      path(pts);
      ctx!.fillStyle = `rgba(${BLOSSOM}, ${0.22 * appear})`;
      ctx!.fill();
      glow(pts, BLOSSOM, 0.8, 0.8 * appear);
    }
    for (const b of f.blooms) {
      const appear = smooth(b.at, b.at + 0.18, frac);
      if (appear <= 0) continue;
      const c = move(b.c);
      if (b.bud) {
        glow(
          to2(ring(c, b.r * appear, b.r * appear, 0, 8), id),
          WAXFLOWER,
          0.8,
          0.75 * appear,
        );
        continue;
      }
      const petals: V3[] = [];
      for (let k = 0; k <= 40; k++) {
        const th = (k / 40) * TAU;
        const r = b.r * appear * (0.45 + 0.55 * Math.abs(Math.cos(2.5 * th)));
        petals.push([
          c[0] + r * Math.cos(th + b.rot),
          c[1] + r * Math.sin(th + b.rot),
          c[2],
        ]);
      }
      const pts = to2(petals, id);
      path(pts);
      ctx!.closePath();
      ctx!.fillStyle = FILL;
      ctx!.fill();
      ctx!.fillStyle = `rgba(${WAXFLOWER}, 0.08)`;
      ctx!.fill();
      glow(pts, WAXFLOWER, 0.9, 0.85 * appear);
      glow(
        to2(ring(c, b.r * 0.18, b.r * 0.18, 0, 8), id),
        WAXFLOWER,
        0.8,
        0.9 * appear,
      );
    }
  }

  // A soft dark space behind each rose hides the lines passing behind it,
  // with a faint warm glow, so the roses stand clear of the wrapping.
  function drawHalo(rose: Rose, open: number, strength: number) {
    if (strength <= 0) return;
    const c = project(add(rose.head, scale(rose.axis, rose.size * 0.32)));
    const R = rose.size * S * (0.5 + 0.42 * open);
    ctx!.save();
    ctx!.translate(c[0], c[1]);
    ctx!.scale(1, 0.8);
    const dark = ctx!.createRadialGradient(0, 0, 0, 0, 0, R * 1.18);
    dark.addColorStop(0, `rgba(8, 9, 13, ${0.94 * strength})`);
    dark.addColorStop(0.75, `rgba(8, 9, 13, ${0.94 * strength})`);
    dark.addColorStop(1, 'rgba(8, 9, 13, 0)');
    ctx!.fillStyle = dark;
    ctx!.beginPath();
    ctx!.arc(0, 0, R * 1.18, 0, TAU);
    ctx!.fill();
    const warm = ctx!.createRadialGradient(0, 0, 0, 0, 0, R * 1.1);
    warm.addColorStop(0, `rgba(255, 246, 232, ${0.09 * strength})`);
    warm.addColorStop(1, 'rgba(255, 246, 232, 0)');
    ctx!.fillStyle = warm;
    ctx!.beginPath();
    ctx!.arc(0, 0, R * 1.1, 0, TAU);
    ctx!.fill();
    ctx!.restore();
  }

  // ---- Animation loop ------------------------------------------------------
  const start = performance.now();
  let last = start;
  let frameId = 0;

  function draw(nowMs: number) {
    const dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    // Reduced motion: show the finished, bloomed bouquet straight away.
    const T = reducedMotion ? 30 : startAt + (nowMs - start) / 1000;
    const ease = 1 - Math.exp(-dt * 2.2);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    const calm = reducedMotion ? 0.2 : 1;
    yaw = (Math.sin(T * 0.11) * 0.1 + pointer.x * 0.32) * calm;
    pitch = (Math.sin(T * 0.09 + 1) * 0.03 + pointer.y * 0.1) * calm;
    sway = Math.sin(T * 0.37) * 0.012 * calm;

    ctx!.clearRect(0, 0, W, H);
    ctx!.lineCap = 'round';
    ctx!.lineJoin = 'round';

    // Dust: a faint trace of the point-cloud style.
    const dustIn = smooth(0, 2, T);
    for (const d of dust) {
      const y = ((d.y + 2.3 + T * d.speed) % 3.8) - 2.3;
      const p = project([d.x + 0.05 * Math.sin(T * 0.3 + d.ph), y, -0.6]);
      const a = dustIn * (0.25 + 0.25 * Math.sin(T * 0.8 + d.ph));
      ctx!.fillStyle = `rgba(255, 250, 240, ${a})`;
      ctx!.beginPath();
      ctx!.arc(p[0], p[1], d.r, 0, TAU);
      ctx!.fill();
    }

    // Back wrapping paper fans out first, behind everything.
    // Kept quiet (no pleats, dim outline) so it never competes with the roses.
    drawSheet(wrap.back, [], T / 1.4, KRAFT, 0.42);

    const bloom = easeInOut(clamp((T - 3.8) / 10));
    const opens = roses.map((_, i) =>
      i === 0
        ? lerp(baseOpen[0], 0.9, bloom)
        : baseOpen[i] + 0.02 * Math.sin(T * 0.4 + i),
    );
    // Clear space behind each rose: it hides the wrapping paper's lines, but
    // comes before the stems, leaves and fillers so those still show at the
    // base of each flower.
    roses.forEach((rose, i) =>
      drawHalo(rose, opens[i], smooth(2.1 + i * 0.45, 3.4 + i * 0.45, T)),
    );

    // Stems grow upward from the tie.
    stems.forEach((s, i) => {
      glow(
        to2(stemPath(s), (p) => p),
        SAGE,
        1.5,
        0.8,
        (T - 0.2 - i * 0.18) / 1.5,
      );
    });
    thorns.forEach(([si, t, side], k) => {
      const frac = (T - 1.4 - k * 0.05) / 0.3;
      if (frac <= 0) return;
      const s = stems[si];
      const a = stemPoint(s, t);
      const b = stemPoint(s, t + 0.02);
      const d = norm([b[0] - a[0], b[1] - a[1], 0]);
      const n: V3 = [-d[1] * side, d[0] * side, 0];
      const tip = add(a, add(scale(n, 0.035), scale(d, -0.025)));
      glow(
        to2([add(a, scale(d, 0.02)), tip, add(a, scale(d, -0.02))], (p) => p),
        SAGE,
        1,
        0.7,
        frac,
      );
    });
    leaves.forEach((leaf, k) => drawLeaf(leaf, (T - 1.3 - k * 0.22) / 1.2));

    // Fillers are placed one after another in a sweep around the dome; each
    // grows out of the bundle and then its blossoms open, base to tip.
    fillers.forEach((f, k) =>
      drawFiller(
        f,
        ((T - 2.3 - k * 0.17) / 2) * 1.35,
        0.012 * Math.sin(T * 0.5 + k * 1.3) * calm,
      ),
    );

    // Roses, farthest first; within each, petals sorted back to front.
    const order = roses
      .map((rose, i) => ({ rose, i, z: project(rose.head)[2] }))
      .sort((a, b) => a.z - b.z);
    for (const { rose, i } of order) {
      const open = opens[i];
      const wobble: V3 = [
        0.03 * Math.sin(T * 0.5 + i * 2) * calm,
        0,
        0.02 * Math.cos(T * 0.43 + i) * calm,
      ];
      const place = frameOf(rose, wobble);
      const startAt = 2.1 + i * 0.45;

      const sepalMap = place(
        add(rose.head, scale(rose.axis, -0.02 * rose.size)),
      );
      for (const sp of rose.sepals(open))
        drawPetal(
          petalOutline(sp),
          sepalMap,
          (T - startAt + 0.3) / 0.8,
          SAGE,
          0.8,
        );

      const map = place(rose.head);
      const petals = rose
        .petals(open)
        .map((shape, k) => {
          const outline = petalOutline(shape);
          const z =
            outline.rim.reduce((sum, p) => sum + project(map(p))[2], 0) /
            outline.rim.length;
          return { outline, k, z };
        })
        .sort((a, b) => a.z - b.z);
      for (const { outline, k } of petals)
        // Outer petals catch more light than the shadowed centre.
        drawPetal(
          outline,
          map,
          (T - startAt - k * 0.08) / 0.9,
          ROSE_LINE,
          1,
          0.06 + 0.1 * (k / 15),
        );
    }

    // Front wrapping paper folds across the stems; the ribbon ties it.
    drawSheet(wrap.skirt, wrap.skirtLines, (T - 1.1) / 1.1, PEARL);
    drawSheet(wrap.left, wrap.leftLines, (T - 1.2) / 1.2, PEARL);
    drawSheet(wrap.right, wrap.rightLines, (T - 1.4) / 1.2, PEARL);
    drawRibbon((T - 2) / 1.2);

    // Now and then, a single petal lets go and drifts down.
    if (!reducedMotion && T > nextFall && falling.length < 3) {
      const r = roses[(rand() * roses.length) | 0];
      falling.push({
        x: r.head[0] + lerp(-0.2, 0.2, rand()),
        y: r.head[1] + 0.1,
        born: T,
        ph: rand() * TAU,
        size: lerp(0.05, 0.075, rand()),
      });
      nextFall = T + lerp(5, 9, rand());
    }
    for (let k = falling.length - 1; k >= 0; k--) {
      const f = falling[k];
      if (f.y - (T - f.born) * 0.07 < -2.3) falling.splice(k, 1);
      else drawFallingPetal(f, T);
    }

    frameId = requestAnimationFrame(draw);
  }
  frameId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
  };
}
