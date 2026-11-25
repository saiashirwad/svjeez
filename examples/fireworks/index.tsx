import {
  Group,
  Shape,
  circle,
  ease,
  ellipse,
  line,
  linear,
  mix,
  path,
  polygon,
  radial,
  rect,
  sampled,
  scene,
  span,
  track,
  type Geometry,
  type SceneElement,
  type Track,
  type Vec,
} from "svjeez";

type Hex = `#${string}`;

const WIDTH = 960;
const HEIGHT = 540;
const WATER_Y = 386;
const SECONDS = 8;

const rnd = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const q = (v: number): number => Math.round(v * 10) / 10;

const starRnd = rnd(20260721);

interface Star {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly o: number;
  readonly color: Hex;
  readonly glint: boolean;
  readonly twinkle: boolean;
}

const STAR_COLORS: readonly Hex[] = ["#E2ECFF", "#FFF4DC", "#BDD7FF", "#F5F7FF"];

const stars: readonly Star[] = Array.from({ length: 96 }, (_, i) => {
  const y = Math.pow(starRnd(), 1.35) * 320;
  const horizonFade = Math.max(0.12, 1 - y / 345);

  return {
    x: q(starRnd() * WIDTH),
    y: q(y),
    r: q(0.45 + starRnd() * 1.05),
    o: q((0.25 + starRnd() * 0.65) * horizonFade),
    color: STAR_COLORS[Math.floor(starRnd() * STAR_COLORS.length)]!,
    glint: i < 5 && y < 170,
    twinkle: i % 6 === 1,
  };
});

const twinkles: readonly Track<number>[] = [
  track(0.22).to(0.95, span(0.4, 0.8), ease.inOut).to(0.22, span(1.2, 0.8), ease.inOut).loop(2),
  track(0.18).to(0.92, span(1.2, 1.0), ease.inOut).to(0.18, span(2.2, 1.0), ease.inOut).loop(4),
  track(0.25).to(1.0, span(0.1, 0.9), ease.inOut).to(0.25, span(1.0, 1.1), ease.inOut).loop(4),
  track(0.16).to(0.88, span(0.8, 0.6), ease.inOut).to(0.16, span(1.4, 0.6), ease.inOut).loop(2),
];

const MOON_AT: Vec = [104, 78];

const crescentMoon = path.parse("M 3.5 -16.6 A 17 17 0 1 0 13.4 10.5 A 16 16 0 0 1 3.5 -16.6 Z");

const cloudPath = (cx: number, cy: number, rx: number, ry: number): Geometry =>
  path()
    .moveTo([q(cx - rx), q(cy + ry * 0.25)])
    .curveTo(
      [q(cx - rx * 0.7), q(cy - ry * 0.85)],
      [q(cx - rx * 0.15), q(cy - ry * 1.1)],
      [q(cx + rx * 0.12), q(cy - ry * 0.45)],
    )
    .curveTo(
      [q(cx + rx * 0.42), q(cy - ry * 0.95)],
      [q(cx + rx * 0.85), q(cy - ry * 0.45)],
      [q(cx + rx), q(cy + ry * 0.25)],
    )
    .curveTo(
      [q(cx + rx * 0.5), q(cy + ry * 0.55)],
      [q(cx - rx * 0.5), q(cy + ry * 0.55)],
      [q(cx - rx), q(cy + ry * 0.25)],
    )
    .close();

const smoothPath = (pts: readonly Vec[]): Geometry => {
  let p = path().moveTo([q(pts[0]![0]), q(pts[0]![1])]);

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1: Vec = [q(p1[0] + (p2[0] - p0[0]) / 6), q(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2: Vec = [q(p2[0] - (p3[0] - p1[0]) / 6), q(p2[1] - (p3[1] - p1[1]) / 6)];

    p = p.curveTo(c1, c2, [q(p2[0]), q(p2[1])]);
  }

  return p;
};

const posAt = (vx: number, vy: number, drag: number, gravity: number, u: number): Vec => {
  const e = 1 - Math.exp(-drag * u);

  return [(vx / drag) * e, ((vy - gravity / drag) / drag) * e + (gravity / drag) * u];
};

const progressAt = (u: number, life: number, drag: number): number => {
  const clamped = Math.max(0, Math.min(life, u));
  const dragFrac = (1 - Math.exp(-drag * clamped)) / (1 - Math.exp(-drag * life));
  const linearFrac = clamped / life;

  return 0.84 * dragFrac + 0.16 * linearFrac;
};

interface RingSpec {
  readonly count: number;
  readonly speed: number;
  readonly drag: number;
  readonly gravity: number;
  readonly life: number;
  readonly trail: number;
  readonly strokeWidth: number;
  readonly palette: readonly Hex[];
  readonly hotHead: boolean;
  readonly glitter: boolean;
}

interface ShellSpec {
  readonly id: string;
  readonly from: Vec;
  readonly at: Vec;
  readonly launch: number;
  readonly apex: number;
  readonly bloomColor: Hex;
  readonly bloomRadius: number;
  readonly reflectionColor: Hex;
  readonly rings: readonly RingSpec[];
}

const SHELLS: readonly ShellSpec[] = [
  {
    id: "willow",
    from: [292, WATER_Y + 6],
    at: [252, 160],
    launch: 0.2,
    apex: 1.05,
    bloomColor: "#FFB84D",
    bloomRadius: 290,
    reflectionColor: "#FFC766",
    rings: [
      {
        count: 42,
        speed: 248,
        drag: 1.75,
        gravity: 112,
        life: 2.25,
        trail: 0.82,
        strokeWidth: 2.0,
        palette: ["#FFE7A8", "#FFD06B", "#F6A43C", "#E8872E"],
        hotHead: true,
        glitter: true,
      },
    ],
  },
  {
    id: "sapphire",
    from: [692, WATER_Y + 6],
    at: [724, 146],
    launch: 1.35,
    apex: 2.2,
    bloomColor: "#38BDF8",
    bloomRadius: 300,
    reflectionColor: "#67D8FF",
    rings: [
      {
        count: 44,
        speed: 278,
        drag: 2.05,
        gravity: 92,
        life: 1.95,
        trail: 0.56,
        strokeWidth: 2.1,
        palette: ["#D8F6FF", "#7CE5FF", "#38BDF8", "#6096FF"],
        hotHead: true,
        glitter: false,
      },
      {
        count: 20,
        speed: 138,
        drag: 2.25,
        gravity: 78,
        life: 1.45,
        trail: 0.42,
        strokeWidth: 1.7,
        palette: ["#FFFDF7", "#FFE6CC", "#FFD0A8"],
        hotHead: false,
        glitter: false,
      },
    ],
  },
  {
    id: "rose",
    from: [435, WATER_Y + 6],
    at: [414, 128],
    launch: 2.6,
    apex: 3.45,
    bloomColor: "#F472B6",
    bloomRadius: 310,
    reflectionColor: "#FF85B8",
    rings: [
      {
        count: 46,
        speed: 290,
        drag: 2.1,
        gravity: 96,
        life: 1.95,
        trail: 0.52,
        strokeWidth: 2.1,
        palette: ["#FFE4F0", "#FF85B8", "#F43F7A", "#C084FC"],
        hotHead: true,
        glitter: false,
      },
      {
        count: 18,
        speed: 145,
        drag: 2.3,
        gravity: 80,
        life: 1.4,
        trail: 0.38,
        strokeWidth: 1.65,
        palette: ["#FFF8E7", "#FFD27D"],
        hotHead: false,
        glitter: false,
      },
    ],
  },
  {
    id: "emerald",
    from: [204, WATER_Y + 6],
    at: [184, 192],
    launch: 3.55,
    apex: 4.3,
    bloomColor: "#2DD4BF",
    bloomRadius: 260,
    reflectionColor: "#5EEAD4",
    rings: [
      {
        count: 34,
        speed: 222,
        drag: 2.15,
        gravity: 90,
        life: 1.8,
        trail: 0.5,
        strokeWidth: 1.95,
        palette: ["#E2FFF8", "#5EEAD4", "#2DD4BF", "#A7F3D0"],
        hotHead: true,
        glitter: false,
      },
    ],
  },
  {
    id: "finale",
    from: [548, WATER_Y + 6],
    at: [564, 122],
    launch: 3.8,
    apex: 4.7,
    bloomColor: "#FFC45C",
    bloomRadius: 360,
    reflectionColor: "#FFD078",
    rings: [
      {
        count: 54,
        speed: 335,
        drag: 1.85,
        gravity: 118,
        life: 2.45,
        trail: 0.86,
        strokeWidth: 2.25,
        palette: ["#FFF6D8", "#FFD570", "#F7A642", "#FFBB5C"],
        hotHead: true,
        glitter: true,
      },
      {
        count: 26,
        speed: 172,
        drag: 2.15,
        gravity: 88,
        life: 1.65,
        trail: 0.48,
        strokeWidth: 1.9,
        palette: ["#FFE2EC", "#FB7185", "#F472B6", "#FDE08D"],
        hotHead: true,
        glitter: false,
      },
    ],
  },
];

interface Ray {
  readonly key: string;
  readonly geometry: Geometry;
  readonly color: Hex;
  readonly width: number;
  readonly depthOpacity: number;
  readonly tip: Vec;
  readonly midTip: Vec;
}

interface BuiltRing {
  readonly key: string;
  readonly rays: readonly Ray[];
  readonly tailTrim: Track<Vec>;
  readonly headTrim: Track<Vec>;
  readonly tailOpacity: Track<number>;
  readonly headOpacity: Track<number>;
  readonly hotHead: boolean;
  readonly glitter: boolean;
  readonly glitterTracks: readonly Track<number>[];
}

interface RippleSegment {
  readonly x1: number;
  readonly x2: number;
  readonly y: number;
  readonly width: number;
  readonly hot: boolean;
  readonly phase: number;
}

interface BuiltShell {
  readonly spec: ShellSpec;
  readonly launchPath: Geometry;
  readonly launchTrim: Track<Vec>;
  readonly launchHeadTrim: Track<Vec>;
  readonly launchOpacity: Track<number>;
  readonly bloomOpacity: Track<number>;
  readonly flashOpacity: Track<number>;
  readonly flashScale: Track<number>;
  readonly reflectionOpacity: Track<number>;
  readonly ripples: readonly RippleSegment[];
  readonly rings: readonly BuiltRing[];
}

const sparkRnd = rnd(9876543);
const rippleRnd = rnd(77123);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const buildRipples = (cx: number): RippleSegment[] => {
  const rows = [6, 13, 21, 30, 41, 53, 67, 83, 101, 120, 138];
  const segments: RippleSegment[] = [];

  rows.forEach((y, rowIdx) => {
    const spread = 24 + Math.sin(((rowIdx + 1) / rows.length) * Math.PI) * 68;
    const count = rowIdx < 3 ? 2 : rowIdx < 8 ? 3 : 2;

    for (let k = 0; k < count; k++) {
      const slot = (k / (count - 1)) * 2 - 1;
      const jitter = (rippleRnd() - 0.5) * 18;
      const mid = cx + slot * spread * 0.52 + jitter;
      const len = 12 + rippleRnd() * (34 - rowIdx * 1.9);

      segments.push({
        x1: q(mid - len / 2),
        x2: q(mid + len / 2),
        y: q(y + (rippleRnd() - 0.5) * 2.4),
        width: q(Math.max(1.0, 2.3 - rowIdx * 0.11)),
        hot: rowIdx < 4 && Math.abs(mid - cx) < 28,
        phase: (rowIdx + k) % 2,
      });
    }
  });

  return segments;
};

const buildShell = (spec: ShellSpec): BuiltShell => {
  const [fx, fy] = spec.from;
  const [ax, ay] = spec.at;
  const rise = spec.apex - spec.launch;

  const ctrlX = q((fx + ax) / 2 + (ax - fx) * 0.25);
  const ctrlY = q(fy - (fy - ay) * 0.62);
  const launchPath = path().moveTo(spec.from).quadTo([ctrlX, ctrlY], spec.at);

  const launchProgress = (u: number): number =>
    1 - Math.pow(1 - Math.max(0, Math.min(1, u / rise)), 2.2);

  const launchTrim = sampled(
    (u): Vec => [launchProgress(u - 0.19), launchProgress(u)],
    span(spec.launch, rise),
    { step: 0.04, tolerance: 0.008, precision: 3 },
  );

  const launchHeadTrim = sampled(
    (u): Vec => [launchProgress(u - 0.045), launchProgress(u)],
    span(spec.launch, rise),
    { step: 0.04, tolerance: 0.008, precision: 3 },
  );

  const launchOpacity = track(0)
    .to(1, span(spec.launch, 0.08), ease.out)
    .to(0, span(spec.apex - 0.06, 0.08), ease.in);

  const maxLife = Math.max(...spec.rings.map((r) => r.life));

  const bloomOpacity = track(0)
    .to(0.55, span(spec.apex, 0.14), ease.out)
    .to(0.24, span(spec.apex + 0.14, maxLife * 0.45), ease.out)
    .to(0, span(spec.apex + 0.14 + maxLife * 0.45, maxLife * 0.55), ease.in);

  const flashOpacity = track(0)
    .to(0.95, span(spec.apex, 0.06), ease.out)
    .to(0, span(spec.apex + 0.06, 0.28), ease.in);

  const flashScale = track(0.15).to(1.25, span(spec.apex, 0.34), ease.out);

  const reflectionOpacity = track(0)
    .to(0.85, span(spec.apex, 0.16), ease.out)
    .to(0.42, span(spec.apex + 0.16, maxLife * 0.45), ease.out)
    .to(0, span(spec.apex + 0.16 + maxLife * 0.45, maxLife * 0.55), ease.in);

  const rings: BuiltRing[] = spec.rings.map((ring, rIdx) => {
    const rays: Ray[] = [];
    const phaseOffset = sparkRnd() * Math.PI * 2;
    const segments = 8;

    for (let i = 0; i < ring.count; i++) {
      const z = 1 - (2 * (i + 0.5)) / ring.count;
      const radialLen = Math.sqrt(Math.max(0, 1 - z * z));
      const theta = GOLDEN_ANGLE * i + phaseOffset + (sparkRnd() - 0.5) * 0.18;
      const dx = Math.cos(theta) * radialLen;
      const dy = Math.sin(theta) * radialLen;

      const speed = ring.speed * (0.86 + sparkRnd() * 0.28);
      const vx = dx * speed;
      const vy = dy * speed;

      const pts: Vec[] = Array.from({ length: segments + 1 }, (_, s) => {
        const u = ring.life * Math.pow(s / segments, 1.15);

        return posAt(vx, vy, ring.drag, ring.gravity, u);
      });

      const depthFactor = 0.65 + 0.35 * ((z + 1) / 2);
      const color = ring.palette[Math.floor(sparkRnd() * ring.palette.length)]!;

      rays.push({
        key: `${spec.id}-r${rIdx}-${i}`,
        geometry: smoothPath(pts),
        color,
        width: q(ring.strokeWidth * (0.78 + 0.32 * depthFactor)),
        depthOpacity: q(0.55 + 0.45 * depthFactor),
        tip: [q(pts.at(-1)![0]), q(pts.at(-1)![1])],
        midTip: [q(pts.at(-2)![0]), q(pts.at(-2)![1])],
      });
    }

    const totalRun = ring.life + ring.trail * 0.45;

    const tailTrim = sampled(
      (u): Vec => {
        const head = progressAt(u, ring.life, ring.drag);

        const tailU =
          u <= ring.life
            ? Math.max(0, u - ring.trail)
            : ring.life - ring.trail + ((u - ring.life) / (ring.trail * 0.45)) * ring.trail;

        const tail = Math.min(head, progressAt(tailU, ring.life, ring.drag));

        return [tail, head];
      },
      span(spec.apex, totalRun),
      { step: 0.05, tolerance: 0.008, precision: 3 },
    );

    const headTrim = sampled(
      (u): Vec => {
        const head = progressAt(u, ring.life, ring.drag);
        const tail = Math.min(head, progressAt(u - 0.085, ring.life, ring.drag));

        return [tail, head];
      },
      span(spec.apex, ring.life),
      { step: 0.05, tolerance: 0.008, precision: 3 },
    );

    const tailOpacity = track(0)
      .set(1, span(spec.apex))
      .to(0.88, span(spec.apex, ring.life * 0.6), ease.out)
      .to(0, span(spec.apex + ring.life * 0.6, totalRun - ring.life * 0.6), ease.in);

    const headOpacity = track(0)
      .set(1, span(spec.apex))
      .to(0.95, span(spec.apex, ring.life * 0.55), ease.out)
      .to(0, span(spec.apex + ring.life * 0.55, ring.life * 0.45), ease.in);

    const glitterTracks: Track<number>[] = ring.glitter
      ? [0, 0.14, 0.28].map((delay) => {
          const t0 = spec.apex + ring.life * 0.52 + delay;

          return track(0)
            .to(1, span(t0, 0.12), ease.out)
            .to(0.15, span(t0 + 0.12, 0.14), ease.inOut)
            .to(0.92, span(t0 + 0.26, 0.12), ease.inOut)
            .to(0.1, span(t0 + 0.38, 0.16), ease.inOut)
            .to(0.65, span(t0 + 0.54, 0.12), ease.inOut)
            .to(0, span(t0 + 0.66, 0.24), ease.in);
        })
      : [];

    return {
      key: `${spec.id}-ring-${rIdx}`,
      rays,
      tailTrim,
      headTrim,
      tailOpacity,
      headOpacity,
      hotHead: ring.hotHead,
      glitter: ring.glitter,
      glitterTracks,
    };
  });

  return {
    spec,
    launchPath,
    launchTrim,
    launchHeadTrim,
    launchOpacity,
    bloomOpacity,
    flashOpacity,
    flashScale,
    reflectionOpacity,
    ripples: buildRipples(spec.at[0]),
    rings,
  };
};

const builtShells = SHELLS.map(buildShell);

const cityRnd = rnd(44219);

interface BuildingSpec {
  readonly x: number;
  readonly w: number;
  readonly top: number;
  readonly kind: "flat" | "setback" | "spire" | "slant" | "dome";
  readonly beacon?: boolean;
  readonly crownLight?: boolean;
}

const HERO_BUILDINGS: readonly BuildingSpec[] = [
  { x: 224, w: 38, top: 342, kind: "flat" },
  { x: 264, w: 34, top: 320, kind: "setback" },
  { x: 300, w: 46, top: 282, kind: "slant", crownLight: true },
  { x: 348, w: 36, top: 332, kind: "flat" },
  { x: 386, w: 44, top: 346, kind: "flat" },
  { x: 432, w: 54, top: 334, kind: "dome" },
  { x: 490, w: 36, top: 324, kind: "flat" },
  { x: 528, w: 42, top: 300, kind: "setback", beacon: true },
  { x: 572, w: 38, top: 336, kind: "flat" },
  { x: 612, w: 42, top: 314, kind: "flat" },
  { x: 656, w: 38, top: 290, kind: "slant", crownLight: true },
  { x: 696, w: 44, top: 328, kind: "flat" },
  { x: 742, w: 52, top: 262, kind: "spire", beacon: true, crownLight: true },
  { x: 798, w: 40, top: 310, kind: "setback" },
  { x: 840, w: 46, top: 332, kind: "flat" },
  { x: 888, w: 36, top: 318, kind: "flat" },
  { x: 926, w: 42, top: 340, kind: "flat" },
];

const FAR_BUILDINGS: readonly { x: number; w: number; top: number }[] = [
  { x: 242, w: 40, top: 306 },
  { x: 334, w: 40, top: 310 },
  { x: 412, w: 44, top: 316 },
  { x: 504, w: 44, top: 294 },
  { x: 592, w: 46, top: 304 },
  { x: 680, w: 42, top: 302 },
  { x: 726, w: 40, top: 288 },
  { x: 822, w: 44, top: 310 },
  { x: 874, w: 42, top: 322 },
];

const WINDOW_PALETTE: readonly Hex[] = ["#FFE399", "#FFC66D", "#B7DCFF", "#FFF0C2"];

interface LitWindow {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: Hex;
  readonly o: number;
}

const buildingWindows: readonly LitWindow[] = (() => {
  const out: LitWindow[] = [];

  for (const b of HERO_BUILDINGS) {
    const startY = b.top + (b.kind === "slant" ? 18 : 11);
    const cols = Math.max(2, Math.floor((b.w - 10) / 7));

    for (let wy = startY; wy < WATER_Y - 10; wy += 9) {
      const bandChance = cityRnd() < 0.22;

      for (let c = 0; c < cols; c++) {
        const lit = bandChance ? cityRnd() < 0.68 : cityRnd() < 0.16;

        if (!lit) continue;
        const wx = b.x + 6 + c * 7;

        if (wx + 3.5 > b.x + b.w - 4) continue;
        out.push({
          x: q(wx),
          y: q(wy),
          w: 3.2,
          h: 3.8,
          color: WINDOW_PALETTE[Math.floor(cityRnd() * WINDOW_PALETTE.length)]!,
          o: q(0.35 + cityRnd() * 0.52),
        });
      }
    }
  }

  return out;
})();

const buildingSilhouette = (b: BuildingSpec): Geometry => {
  const { x, w, top } = b;
  const bot = WATER_Y + 2;

  if (b.kind === "slant") return polygon([x, bot], [x, top + 14], [x + w, top], [x + w, bot]);

  if (b.kind === "setback") {
    const step = Math.round(w * 0.2);

    return polygon(
      [x, bot],
      [x, top + 16],
      [x + step, top + 16],
      [x + step, top],
      [x + w - step, top],
      [x + w - step, top + 16],
      [x + w, top + 16],
      [x + w, bot],
    );
  }

  if (b.kind === "spire") {
    const s1 = Math.round(w * 0.18);
    const s2 = Math.round(w * 0.34);

    return polygon(
      [x, bot],
      [x, top + 24],
      [x + s1, top + 24],
      [x + s1, top + 10],
      [x + s2, top + 10],
      [x + s2, top],
      [x + w - s2, top],
      [x + w - s2, top + 10],
      [x + w - s1, top + 10],
      [x + w - s1, top + 24],
      [x + w, top + 24],
      [x + w, bot],
    );
  }

  if (b.kind === "dome")
    return path()
      .moveTo([x, bot])
      .lineTo([x, top + 14])
      .lineTo([x + 6, top + 14])
      .curveTo([x + 8, top - 10], [x + w - 8, top - 10], [x + w - 6, top + 14])
      .lineTo([x + w, top + 14])
      .lineTo([x + w, bot])
      .close();

  return rect(w, bot - top);
};

const beaconA = track(0.15)
  .to(1, span(0, 0.35), ease.inOut)
  .to(0.15, span(0.35, 0.55), ease.inOut)
  .loop(2);

const beaconB = track(0.15)
  .to(1, span(1.0, 0.35), ease.inOut)
  .to(0.15, span(1.35, 0.55), ease.inOut)
  .loop(2);

const lamps = Array.from({ length: 19 }, (_, i) => q(232 + i * 40));

const BRIDGE_DECK_Y = 368;
const TOWER_1_X = 56;
const TOWER_2_X = 176;
const TOWER_TOP_Y = 304;

const bridgeCable = path()
  .moveTo([-12, BRIDGE_DECK_Y])
  .quadTo([24, 352], [TOWER_1_X, TOWER_TOP_Y + 4])
  .quadTo([(TOWER_1_X + TOWER_2_X) / 2, 366], [TOWER_2_X, TOWER_TOP_Y + 4])
  .quadTo([208, 352], [238, BRIDGE_DECK_Y]);

const bridgeLights: readonly Vec[] = [
  ...Array.from({ length: 4 }, (_, i): Vec => {
    const t = (i + 1) / 5;
    const u = 1 - t;

    return [
      q(u * u * -12 + 2 * u * t * 24 + t * t * TOWER_1_X),
      q(u * u * BRIDGE_DECK_Y + 2 * u * t * 352 + t * t * (TOWER_TOP_Y + 4)),
    ];
  }),
  ...Array.from({ length: 7 }, (_, i): Vec => {
    const t = (i + 1) / 8;
    const u = 1 - t;
    const mid = (TOWER_1_X + TOWER_2_X) / 2;

    return [
      q(u * u * TOWER_1_X + 2 * u * t * mid + t * t * TOWER_2_X),
      q(u * u * (TOWER_TOP_Y + 4) + 2 * u * t * 366 + t * t * (TOWER_TOP_Y + 4)),
    ];
  }),
  ...Array.from({ length: 4 }, (_, i): Vec => {
    const t = (i + 1) / 5;
    const u = 1 - t;

    return [
      q(u * u * TOWER_2_X + 2 * u * t * 208 + t * t * 238),
      q(u * u * (TOWER_TOP_Y + 4) + 2 * u * t * 352 + t * t * BRIDGE_DECK_Y),
    ];
  }),
];

const rippleA = track(0.42)
  .to(0.95, span(0, 1.0), ease.inOut)
  .to(0.42, span(1.0, 1.0), ease.inOut)
  .loop(2);

const rippleB = track(0.88)
  .to(0.36, span(0, 1.0), ease.inOut)
  .to(0.88, span(1.0, 1.0), ease.inOut)
  .loop(2);

const renderRing = (ring: BuiltRing): SceneElement => (
  <Group key={ring.key}>
    <Group opacity={ring.tailOpacity}>
      {ring.rays.map((ray) => (
        <Shape
          key={`${ray.key}-halo`}
          geometry={ray.geometry}
          trim={ring.tailTrim}
          opacity={q(ray.depthOpacity * 0.24)}
          stroke={{
            color: ray.color,
            width: q(ray.width * 3.1),
            cap: "round",
          }}
        />
      ))}
    </Group>

    <Group opacity={ring.tailOpacity}>
      {ring.rays.map((ray) => (
        <Shape
          key={ray.key}
          geometry={ray.geometry}
          trim={ring.tailTrim}
          opacity={ray.depthOpacity}
          stroke={{
            color: ray.color,
            width: ray.width,
            cap: "round",
          }}
        />
      ))}
    </Group>

    {ring.hotHead && (
      <Group opacity={ring.headOpacity}>
        {ring.rays.map((ray) => (
          <Shape
            key={`${ray.key}-head`}
            geometry={ray.geometry}
            trim={ring.headTrim}
            opacity={ray.depthOpacity}
            stroke={{
              color: "#FFFDF6",
              width: q(Math.max(1.25, ray.width * 0.78)),
              cap: "round",
            }}
          />
        ))}
      </Group>
    )}

    {ring.glitter && (
      <Group>
        {ring.rays.flatMap((ray, idx) =>
          idx % 2 === 0
            ? [
                <Group
                  key={`${ray.key}-glit`}
                  opacity={ring.glitterTracks[(idx / 2) % ring.glitterTracks.length]}
                >
                  <Shape
                    geometry={circle((idx / 2) % 3 === 0 ? 1.5 : 1.1)}
                    at={(idx / 2) % 2 === 0 ? ray.tip : ray.midTip}
                    anchor="center"
                    fill="#FFF8DF"
                  />
                </Group>,
              ]
            : [],
        )}
      </Group>
    )}
  </Group>
);

export default scene(
  {
    size: [WIDTH, HEIGHT],
    duration: SECONDS,
    still: 5.05,
    title: "Fireworks over the Harbor",
    desc: "Five choreographed fireworks shells rise over a waterfront skyline and suspension bridge, bursting into 3D-projected spherical blooms of golden willow, sapphire chrysanthemum, rose peony, emerald, and a grand champagne finale, casting shimmering reflections across the dark harbor water.",
  },
  () => (
    <Group>
      <Shape
        geometry={rect(WIDTH, WATER_Y + 2)}
        fill={linear({
          from: [0, 0],
          to: [0, WATER_Y + 2],
          stops: [
            [0, "#040714"],
            [0.38, "#091026"],
            [0.74, "#111B3A"],
            [1, "#1D264A"],
          ],
        })}
      />

      <Shape
        geometry={ellipse(540, 145)}
        at={[WIDTH * 0.56, WATER_Y + 18]}
        anchor="center"
        fill={radial.across({
          stops: [
            [0, "#593B5252"],
            [0.32, "#33284A24"],
            [0.64, "#1D264A00"],
            [1, "#1D264A00"],
          ],
        })}
      />

      <Group>
        {stars.map((star, i) => (
          <Group key={`star-${i}`} opacity={star.twinkle ? twinkles[i % twinkles.length] : star.o}>
            <Shape
              geometry={circle(star.r)}
              at={[star.x, star.y]}
              anchor="center"
              fill={star.color}
            />
            {star.glint && (
              <Group opacity={0.55}>
                <Shape
                  geometry={line([star.x - 4.5, star.y], [star.x + 4.5, star.y])}
                  stroke={{ color: star.color, width: 0.65, cap: "round" }}
                />
                <Shape
                  geometry={line([star.x, star.y - 4.5], [star.x, star.y + 4.5])}
                  stroke={{ color: star.color, width: 0.65, cap: "round" }}
                />
              </Group>
            )}
          </Group>
        ))}
      </Group>

      <Shape
        geometry={circle(96)}
        at={MOON_AT}
        anchor="center"
        fill={radial({
          center: [0, 0],
          radius: 96,
          stops: [
            [0, "#FFF6DE48"],
            [0.26, "#D8E4FF1C"],
            [0.62, "#9BB8FF06"],
            [1, "#9BB8FF00"],
          ],
        })}
      />
      <Shape geometry={circle(17)} at={MOON_AT} anchor="center" fill="#2A3558" opacity={0.22} />
      <Shape geometry={crescentMoon} at={MOON_AT} anchor="center" fill="#FFF7E2" />

      <Group opacity={0.42}>
        <Shape geometry={cloudPath(220, 236, 138, 22)} fill="#0E1734" />
        <Shape geometry={cloudPath(680, 210, 162, 24)} fill="#0E1734" />
        <Shape geometry={cloudPath(470, 272, 128, 18)} fill="#131E40" />
      </Group>

      <Group blend="screen">
        {builtShells.map(({ spec, bloomOpacity }) => (
          <Shape
            key={`bloom-${spec.id}`}
            geometry={circle(spec.bloomRadius)}
            at={spec.at}
            anchor="center"
            opacity={bloomOpacity}
            fill={radial({
              center: [0, 0],
              radius: spec.bloomRadius,
              stops: [
                [0, mix(spec.bloomColor, "#00000000", 0.52)],
                [0.32, mix(spec.bloomColor, "#00000000", 0.22)],
                [0.68, mix(spec.bloomColor, "#00000000", 0.05)],
                [1, "#00000000"],
              ],
            })}
          />
        ))}
      </Group>

      <Group blend="screen">
        {builtShells.map(({ spec, launchPath, launchTrim, launchHeadTrim, launchOpacity }) => (
          <Group key={`launch-${spec.id}`} opacity={launchOpacity}>
            <Shape
              geometry={launchPath}
              trim={launchTrim}
              opacity={0.38}
              stroke={{ color: "#FFB85C", width: 5.5, cap: "round" }}
            />
            <Shape
              geometry={launchPath}
              trim={launchTrim}
              stroke={{ color: "#FFE3A3", width: 1.8, cap: "round" }}
            />
            <Shape
              geometry={launchPath}
              trim={launchHeadTrim}
              stroke={{ color: "#FFFFFF", width: 2.8, cap: "round" }}
            />
          </Group>
        ))}
      </Group>

      <Group blend="screen">
        {builtShells.map(({ spec, rings, flashOpacity, flashScale }) => (
          <Group key={`burst-${spec.id}`} offset={spec.at}>
            {rings.map(renderRing)}
            <Group origin="at" motion={{ scale: flashScale }} opacity={flashOpacity}>
              <Shape
                geometry={circle(62)}
                fill={radial({
                  center: [0, 0],
                  radius: 62,
                  stops: [
                    [0, "#FFFFFF"],
                    [0.24, mix(spec.bloomColor, "#00000000", 0.8)],
                    [0.62, mix(spec.bloomColor, "#00000000", 0.14)],
                    [1, "#00000000"],
                  ],
                })}
              />
            </Group>
          </Group>
        ))}
      </Group>

      <Group>
        {bridgeLights.map(([bx, by], i) => (
          <Shape
            key={`susp-${i}`}
            geometry={line([bx, by], [bx, BRIDGE_DECK_Y])}
            stroke={{ color: "#141F42", width: 0.9 }}
          />
        ))}
        <Shape geometry={bridgeCable} stroke={{ color: "#1B2852", width: 1.8 }} />
        <Shape
          geometry={line([-10, BRIDGE_DECK_Y], [238, BRIDGE_DECK_Y])}
          stroke={{ color: "#0B1126", width: 3.4 }}
        />
        {[TOWER_1_X, TOWER_2_X].map((tx, i) => (
          <Group key={`tower-${i}`}>
            <Shape
              geometry={rect(5, WATER_Y - TOWER_TOP_Y + 2)}
              at={[tx - 2.5, TOWER_TOP_Y]}
              fill="#0B1126"
            />
            <Shape geometry={rect(11, 2.2)} at={[tx - 5.5, TOWER_TOP_Y + 14]} fill="#152042" />
            <Shape geometry={rect(11, 2.2)} at={[tx - 5.5, TOWER_TOP_Y + 34]} fill="#152042" />
            <Shape
              geometry={circle(1.7)}
              at={[tx, TOWER_TOP_Y - 2]}
              anchor="center"
              fill="#FF4D6D"
              opacity={i === 0 ? beaconA : beaconB}
            />
          </Group>
        ))}
        {bridgeLights.map(([bx, by], i) => (
          <Shape
            key={`blight-${i}`}
            geometry={circle(1.3)}
            at={[bx, by]}
            anchor="center"
            fill="#FFE196"
            opacity={0.78}
          />
        ))}

        {FAR_BUILDINGS.map((b, i) => (
          <Shape
            key={`far-${i}`}
            geometry={rect(b.w, WATER_Y + 2 - b.top)}
            at={[b.x, b.top]}
            fill="#101835"
          />
        ))}
      </Group>

      <Group>
        {HERO_BUILDINGS.map((b, i) => {
          const geom = buildingSilhouette(b);
          const isRect = b.kind === "flat";

          return (
            <Group key={`bldg-${i}`}>
              <Shape geometry={geom} at={isRect ? [b.x, b.top] : undefined} fill="#070B19" />
              {b.kind === "spire" && (
                <Shape
                  geometry={line([b.x + b.w / 2, b.top], [b.x + b.w / 2, b.top - 36])}
                  stroke={{ color: "#0B1126", width: 2.2, cap: "round" }}
                />
              )}
              {b.crownLight && (
                <Shape
                  geometry={line([b.x + 8, b.top + 12], [b.x + b.w - 8, b.top + 12])}
                  stroke={{ color: "#FFD98A", width: 1.4, cap: "round" }}
                  opacity={0.55}
                />
              )}
              {b.beacon && (
                <>
                  {b.kind !== "spire" && (
                    <Shape
                      geometry={line([b.x + b.w / 2, b.top], [b.x + b.w / 2, b.top - 20])}
                      stroke={{ color: "#0B1126", width: 1.6 }}
                    />
                  )}
                  <Shape
                    geometry={circle(2.2)}
                    at={[b.x + b.w / 2, b.kind === "spire" ? b.top - 37 : b.top - 21]}
                    anchor="center"
                    fill="#FF4D6D"
                    opacity={i % 2 === 0 ? beaconA : beaconB}
                  />
                </>
              )}
            </Group>
          );
        })}

        {buildingWindows.map((w, i) => (
          <Shape
            key={`win-${i}`}
            geometry={rect(w.w, w.h)}
            at={[w.x, w.y]}
            fill={w.color}
            opacity={w.o}
          />
        ))}

        <Shape geometry={rect(WIDTH - 222, 4)} at={[222, WATER_Y - 2]} fill="#050814" />
        {lamps.map((lx, i) => (
          <Shape
            key={`lamp-${i}`}
            geometry={circle(1.5)}
            at={[lx, WATER_Y - 2.5]}
            anchor="center"
            fill="#FFE29A"
            opacity={0.78}
          />
        ))}
      </Group>

      <Group clip={rect(WIDTH, HEIGHT - WATER_Y)} offset={[0, WATER_Y]}>
        <Shape
          geometry={rect(WIDTH, HEIGHT - WATER_Y)}
          fill={linear({
            from: [0, 0],
            to: [0, HEIGHT - WATER_Y],
            stops: [
              [0, "#0A132D"],
              [0.35, "#070E22"],
              [1, "#030612"],
            ],
          })}
        />

        <Group opacity={0.45}>
          {HERO_BUILDINGS.map((b, i) => {
            const h = Math.min(82, (WATER_Y - b.top) * 0.62);

            return (
              <Shape key={`ref-bldg-${i}`} geometry={rect(b.w, h)} at={[b.x, 0]} fill="#030612" />
            );
          })}
        </Group>

        <Group opacity={0.42}>
          {[6, 15, 26, 39, 55, 74, 96].map((ry, i) => {
            const rw = q(28 - i * 3);
            const shift = ((i % 3) - 1) * 4;

            return (
              <Shape
                key={`moon-rip-${i}`}
                geometry={line(
                  [MOON_AT[0] + shift - rw / 2, ry],
                  [MOON_AT[0] + shift + rw / 2, ry],
                )}
                stroke={{ color: "#DCE8FF", width: q(1.5 - i * 0.13), cap: "round" }}
                opacity={i % 2 === 0 ? rippleA : rippleB}
              />
            );
          })}
        </Group>

        <Group opacity={0.32}>
          {bridgeLights.flatMap(([bx], i) =>
            i % 2 === 0
              ? [
                  <Shape
                    key={`bref-${i}`}
                    geometry={line(
                      [bx - 5, 8 + ((i / 2) % 4) * 5],
                      [bx + 5, 8 + ((i / 2) % 4) * 5],
                    )}
                    stroke={{ color: "#FFD985", width: 1.2, cap: "round" }}
                    opacity={(i / 2) % 2 === 0 ? rippleA : rippleB}
                  />,
                ]
              : [],
          )}
        </Group>

        <Group opacity={0.36}>
          {lamps.map((lx, i) => (
            <Group key={`lamp-ref-${i}`}>
              <Shape
                geometry={line([lx - 4.5, 5 + (i % 3) * 3], [lx + 4.5, 5 + (i % 3) * 3])}
                stroke={{ color: "#FFD580", width: 1.4, cap: "round" }}
              />
              {i % 2 === 0 && (
                <Shape
                  geometry={line([lx - 7, 15 + (i % 4) * 5], [lx + 7, 15 + (i % 4) * 5])}
                  stroke={{ color: "#FFC566", width: 1.1, cap: "round" }}
                  opacity={i % 4 === 0 ? rippleA : rippleB}
                />
              )}
            </Group>
          ))}
        </Group>

        <Group opacity={0.13}>
          {[14, 32, 54, 80, 110, 140].map((wy, i) => (
            <Shape
              key={`wave-${i}`}
              geometry={line([0, wy], [WIDTH, wy])}
              stroke={{ color: "#5270B5", width: 0.7 }}
            />
          ))}
        </Group>

        <Shape
          geometry={line([0, 0.8], [WIDTH, 0.8])}
          stroke={{ color: "#4C67A8", width: 1.2 }}
          opacity={0.42}
        />
      </Group>

      <Group clip={rect(WIDTH, HEIGHT - WATER_Y)} offset={[0, WATER_Y]} blend="screen">
        {builtShells.map(({ spec, reflectionOpacity, ripples }) => (
          <Group key={`water-ref-${spec.id}`} opacity={reflectionOpacity}>
            <Shape
              geometry={ellipse(165, 105)}
              at={[spec.at[0], 56]}
              anchor="center"
              fill={radial.across({
                stops: [
                  [0, mix(spec.reflectionColor, "#00000000", 0.4)],
                  [0.3, mix(spec.reflectionColor, "#00000000", 0.16)],
                  [0.62, "#00000000"],
                  [1, "#00000000"],
                ],
              })}
            />
            {ripples.map((seg, j) => (
              <Shape
                key={`rip-${j}`}
                geometry={line([seg.x1, seg.y], [seg.x2, seg.y])}
                stroke={{
                  color: seg.hot ? "#FFF4DB" : spec.reflectionColor,
                  width: seg.width,
                  cap: "round",
                }}
                opacity={seg.phase === 0 ? rippleA : rippleB}
              />
            ))}
          </Group>
        ))}
      </Group>
    </Group>
  ),
);
