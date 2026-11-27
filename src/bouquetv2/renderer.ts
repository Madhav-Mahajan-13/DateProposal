import { buildBouquetV2, STRIDE, type BouquetV2Data, type V3 } from './scene';

const VERTEX = `
attribute vec3 aPos, aCol, aStrand, aFrom, aMeta;
uniform mat3 uRot;
uniform float uTime, uBloom, uZoom, uAspect, uSize, uAlpha, uMotion, uLift;
varying vec4 vC;

vec3 breathe(vec3 p, float t) {
  return vec3(
    sin(p.y * 1.9 + t * 0.5) + 0.5 * sin(p.z * 2.8 + p.x * 1.2 + t * 0.35),
    sin(p.x * 2.1 + t * 0.42 + 1.7) + 0.5 * sin(p.z * 2.4 - t * 0.38 + p.y * 0.9),
    sin(p.x * 2.6 + p.y * 1.1 + t * 0.4) + 0.5 * sin(p.y * 2.2 - t * 0.47));
}

void main() {
  float s = aMeta.x;
  float tip = aMeta.y;
  float delay = aMeta.z;
  // Each dot glides from its bud position to its place in the bouquet.
  float k = smoothstep(delay, delay + 0.85, uBloom);
  vec3 p = mix(aFrom, aPos, k);
  p += uMotion * (0.016 * breathe(p, uTime) + 0.005 * breathe(p * 3.6 + 4.0, uTime * 1.6));
  p += uMotion * 0.0016 * vec3(sin(uTime * 2.1 + s * 90.0), cos(uTime * 2.5 + s * 70.0), sin(uTime * 1.6 + s * 50.0));
  vec3 h = aStrand * (0.9 + 0.3 * sin(uTime * 1.2 + s * 40.0) * uMotion)
    + length(aStrand) * 0.3 * uMotion * vec3(sin(uTime * 1.8 + s * 61.0), cos(uTime * 1.5 + s * 47.0), sin(uTime * 1.1 + s * 29.0));
  p += tip * h * k;
  vec3 q = uRot * p;
  float w = 6.0 - q.z;
  gl_Position = vec4(q.x * uZoom / uAspect, (q.y + uLift) * uZoom, -q.z * 0.12 * w, w);
  gl_PointSize = uSize * 6.0 / w;
  vC = vec4(aCol, uAlpha * (1.0 - 0.45 * tip));
}`;

const FRAGMENT = `
precision mediump float;
varying vec4 vC;
uniform float uRound;
void main() {
  if (uRound > 0.5) {
    vec2 d = gl_PointCoord * 2.0 - 1.0;
    if (dot(d, d) > 1.0) discard;
  }
  gl_FragColor = vC;
}`;

const UNIFORMS = [
  'uRot',
  'uTime',
  'uBloom',
  'uZoom',
  'uAspect',
  'uSize',
  'uAlpha',
  'uMotion',
  'uLift',
  'uRound',
] as const;

const cache = new Map<number, BouquetV2Data>();

export type Phase = 'opening' | 'open';

export interface BouquetV2Options {
  reducedMotion?: boolean;
  onPhase?: (phase: Phase) => void;
  /** Start this many seconds into the bloom (for previewing). */
  startAt?: number;
}

const BLOOM_SPEED = 1 / 3; // bloom units per second
const BLOOM_END = 2.9; // last dot settles here
const HOLD = 1.1; // seconds showing the buds before they gather

export function startBouquetV2(
  canvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  { reducedMotion = false, onPhase, startAt = 0 }: BouquetV2Options = {},
): () => void {
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  });
  const ctx = overlay.getContext('2d');
  if (!gl || !ctx) throw new Error('WebGL is not available');

  const quality =
    Math.min(window.innerWidth, window.innerHeight) < 700 ? 0.6 : 1;
  let data = cache.get(quality);
  if (!data) {
    data = buildBouquetV2(quality);
    cache.set(quality, data);
  }

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  gl.useProgram(program);

  const attrs = (['aPos', 'aCol', 'aStrand', 'aFrom', 'aMeta'] as const).map(
    (n) => gl.getAttribLocation(program, n),
  );
  const u = Object.fromEntries(
    UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)]),
  ) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  const upload = (arr: Float32Array) => {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    return { buffer, count: arr.length / STRIDE };
  };
  const pts = upload(data.points);
  const strands = upload(data.strands);
  const bind = (b: { buffer: WebGLBuffer }) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
    attrs.forEach((loc, i) => {
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, STRIDE * 4, i * 12);
    });
  };

  // ---- Floating constellations (drawn on the 2D overlay) -----------------
  const shapes = Array.from({ length: 16 }, (_, i) => {
    const kind = i % 3; // triangle, diamond, tetrahedron
    const size = 0.05 + ((i * 37) % 7) * 0.01;
    const verts: V3[] =
      kind === 0
        ? [0, 1, 2].map(
            (k) =>
              [
                Math.cos((k * Math.PI * 2) / 3) * size,
                Math.sin((k * Math.PI * 2) / 3) * size,
                0,
              ] as V3,
          )
        : kind === 1
          ? [
              [0, size * 1.3, 0],
              [size * 0.7, 0, 0],
              [0, -size * 1.3, 0],
              [-size * 0.7, 0, 0],
            ]
          : [
              [0, size, 0],
              [size, -size * 0.6, size * 0.5],
              [-size, -size * 0.6, size * 0.5],
              [0, -size * 0.6, -size],
            ];
    const edges: [number, number][] =
      kind === 2
        ? [
            [0, 1],
            [0, 2],
            [0, 3],
            [1, 2],
            [2, 3],
            [3, 1],
          ]
        : verts.map((_, k) => [k, (k + 1) % verts.length]);
    return {
      verts,
      edges,
      x: ((i * 0.618) % 1) * 3.2 - 1.6,
      y0: ((i * 0.377) % 1) * 3.6 - 1.8,
      z: ((i * 0.27) % 1) * 0.8 - 0.6,
      speed: 0.025 + ((i * 13) % 5) * 0.006,
      spin: 0.2 + ((i * 7) % 5) * 0.08,
      phase: i * 1.7,
    };
  });

  // ---- View, input --------------------------------------------------------
  let W = 1;
  let H = 1;
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    for (const c of [canvas, overlay]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    gl!.viewport(0, 0, canvas.width, canvas.height);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let yaw = 0;
  let pitch = 0;
  let yawTarget = 0;
  let pitchTarget = 0;
  let paused = false;
  let down: {
    x: number;
    y: number;
    t: number;
    lastX: number;
    lastY: number;
  } | null = null;
  const motion = reducedMotion ? 0 : 1;
  let time = 0;
  // Seconds into the bloom; negative while the buds are held.
  let bloomClock = reducedMotion ? 99 : startAt > 0 ? startAt : -HOLD;
  let phase: Phase | null = null;
  const setPhase = (p: Phase) => {
    if (p !== phase) {
      phase = p;
      onPhase?.(p);
    }
  };

  const onDown = (e: PointerEvent) => {
    down = {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      lastX: e.clientX,
      lastY: e.clientY,
    };
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!down) return;
    yawTarget += (e.clientX - down.lastX) * 0.006;
    pitchTarget = Math.max(
      -0.35,
      Math.min(0.35, pitchTarget + (e.clientY - down.lastY) * 0.003),
    );
    down.lastX = e.clientX;
    down.lastY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    // A tap (not a drag) plays the bloom again from the buds.
    if (moved < 6 && performance.now() - down.t < 400 && !reducedMotion)
      bloomClock = -0.4;
    down = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      paused = !paused;
      e.preventDefault();
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);

  let last = performance.now();
  let frameId = 0;

  function draw(now: number) {
    frameId = requestAnimationFrame(draw);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused) {
      time += dt;
      bloomClock += dt;
    }
    const bloom = Math.max(0, bloomClock) * BLOOM_SPEED;
    setPhase(bloom >= BLOOM_END ? 'open' : 'opening');

    yaw += (yawTarget - yaw) * 0.08;
    pitch += (pitchTarget - pitch) * 0.08;
    const ay = yaw + motion * Math.sin(time * 0.2) * 0.1;
    const ax = pitch + motion * Math.sin(time * 0.15 + 1) * 0.03;
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    const R = [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];
    const asp = canvas.width / canvas.height;
    const zoom = Math.min(6 / 1.95, (6 * asp) / 1.5);
    const lift = 0;

    gl!.clearColor(0, 0, 0, 0);
    gl!.depthMask(true);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    gl!.enable(gl!.DEPTH_TEST);
    gl!.depthFunc(gl!.LEQUAL);
    gl!.uniformMatrix3fv(u.uRot, false, R);
    gl!.uniform1f(u.uTime, time);
    gl!.uniform1f(u.uBloom, bloom);
    gl!.uniform1f(u.uZoom, zoom);
    gl!.uniform1f(u.uAspect, asp);
    gl!.uniform1f(u.uLift, lift);
    gl!.uniform1f(u.uMotion, motion);
    gl!.uniform1f(
      u.uSize,
      // Big enough that petals read as surfaces, not speckle; phones get
      // fewer dots, so each one is a little larger.
      Math.max(
        1.7,
        Math.min(
          4.6,
          ((Math.min(canvas.height, canvas.width * 1.2) / 900) * 2.45) /
            Math.sqrt(quality),
        ),
      ),
    );

    gl!.disable(gl!.BLEND);
    gl!.uniform1f(u.uRound, 1);
    gl!.uniform1f(u.uAlpha, 1);
    bind(pts);
    gl!.drawArrays(gl!.POINTS, 0, pts.count);

    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
    gl!.depthMask(false);
    gl!.uniform1f(u.uRound, 0);
    gl!.uniform1f(u.uAlpha, 0.5);
    bind(strands);
    gl!.drawArrays(gl!.LINES, 0, strands.count);

    // ---- Overlay: constellations and a faint dotted ring -----------------
    ctx!.clearRect(0, 0, W, H);
    const toScreen = (p: V3): [number, number] => {
      const qx = R[0] * p[0] + R[3] * p[1] + R[6] * p[2];
      const qy = R[1] * p[0] + R[4] * p[1] + R[7] * p[2];
      const qz = R[2] * p[0] + R[5] * p[1] + R[8] * p[2];
      const w = 6 - qz;
      return [
        ((qx * zoom) / asp / w + 1) * 0.5 * W,
        (1 - ((qy + lift) * zoom) / w) * 0.5 * H,
      ];
    };
    const reveal = Math.min(1, Math.max(0, (bloom - 1.6) / 1.2));
    if (reveal > 0) {
      // Dotted ring with small ticks around the bouquet.
      ctx!.fillStyle = `rgba(240, 225, 235, ${0.35 * reveal})`;
      ctx!.strokeStyle = `rgba(240, 225, 235, ${0.25 * reveal})`;
      ctx!.lineWidth = 1;
      const spin = time * 0.03;
      for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2 + spin;
        if (Math.sin(a) < -0.45) continue; // open at the bottom, around the stems
        const p = toScreen([
          Math.cos(a) * 1.3,
          0.38 + Math.sin(a) * 1.15,
          -0.5,
        ]);
        ctx!.beginPath();
        ctx!.arc(p[0], p[1], 0.9, 0, Math.PI * 2);
        ctx!.fill();
        if (k % 8 === 0) {
          const q = toScreen([
            Math.cos(a) * 1.38,
            0.38 + Math.sin(a) * 1.23,
            -0.5,
          ]);
          ctx!.beginPath();
          ctx!.moveTo(p[0], p[1]);
          ctx!.lineTo(q[0], q[1]);
          ctx!.stroke();
        }
      }
    }
    for (const s of shapes) {
      const span = 3.8;
      const y = ((s.y0 + 1.9 + time * s.speed) % span) - 1.9;
      const fade =
        Math.sin((Math.PI * (y + 1.9)) / span) ** 1.5 * (0.35 + 0.65 * reveal);
      const a1 = time * s.spin + s.phase;
      const a2 = time * s.spin * 0.7 + s.phase * 0.5;
      const pts2 = s.verts.map((v) => {
        const x1 = v[0] * Math.cos(a1) + v[2] * Math.sin(a1);
        const z1 = -v[0] * Math.sin(a1) + v[2] * Math.cos(a1);
        const y1 = v[1] * Math.cos(a2) - z1 * Math.sin(a2);
        const z2 = v[1] * Math.sin(a2) + z1 * Math.cos(a2);
        return toScreen([s.x + x1, y + y1, s.z + z2]);
      });
      ctx!.strokeStyle = `rgba(235, 215, 225, ${0.32 * fade})`;
      ctx!.lineWidth = 0.8;
      for (const [i, j] of s.edges) {
        ctx!.beginPath();
        ctx!.moveTo(pts2[i][0], pts2[i][1]);
        ctx!.lineTo(pts2[j][0], pts2[j][1]);
        ctx!.stroke();
      }
      ctx!.fillStyle = `rgba(255, 240, 230, ${0.75 * fade})`;
      for (const p of pts2) {
        ctx!.beginPath();
        ctx!.arc(p[0], p[1], 1.4, 0, Math.PI * 2);
        ctx!.fill();
      }
    }
  }
  frameId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
    gl.deleteBuffer(pts.buffer);
    gl.deleteBuffer(strands.buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };
}
