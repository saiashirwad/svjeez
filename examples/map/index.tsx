import { Stroke, brush, def, ease, enter, font, motion, nib, pen, rect, render, type Child, type Font, type Paint, type Rect, type Ref, type SvgNode } from "svjeez";
import { Camera, travel, type CameraStop } from "svjeez/extras";

const W = 960;
const H = 640;
const D = 22;

const load = (file: string) => font.load(new URL(`./${file}`, import.meta.url));
const roman = await load("Cinzel.ttf");
const uncial = await load("UncialAntiqua-Regular.ttf");

const C = { paper: "#EBDDBB", land: "#F1E5C6", sea: "#DCCDA6", ink: "#3B2A1A", faded: "#7A6142", river: "#3F5E6E", red: "#9E2B1E", ember: "#E0662A" } as const;

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Mulberry32, so every tree and peak lands in the same place on every build. */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const n = (v: number) => Math.round(v * 10) / 10;

/** Catmull-Rom through the points, as cubic Béziers. */
const smooth = (points: readonly Pt[], closed = false): string => {
  const at = (i: number) => points[closed ? (i + points.length) % points.length : Math.max(0, Math.min(points.length - 1, i))]!;
  const count = closed ? points.length : points.length - 1;
  let d = `M${n(points[0]!.x)} ${n(points[0]!.y)}`;
  for (let i = 0; i < count; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${n(p1.x + (p2.x - p0.x) / 6)} ${n(p1.y + (p2.y - p0.y) / 6)} ${n(p2.x - (p3.x - p1.x) / 6)} ${n(p2.y - (p3.y - p1.y) / 6)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return closed ? `${d}Z` : d;
};

/** Points along the same Catmull-Rom curve, for lengths and for laying labels and travellers on it. */
const sample = (points: readonly Pt[], steps = 16): Pt[] => {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  const out: Pt[] = [points[0]!];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const [t2, t3] = [t * t, t * t * t];
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
};

const lengths = (points: readonly Pt[]): number[] => points.reduce<number[]>((acc, p, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y)], []);

/** A coastline: an ellipse pushed in and out by a few seeded waves. */
const shore = (cx: number, cy: number, rx: number, ry: number, seed: number, rough = 1, count = 96): Pt[] => {
  const rand = random(seed);
  const waves = [2, 3, 4, 5, 7, 9, 13, 17].map((k) => ({ k, a: (0.12 / Math.sqrt(k)) * rough * (0.5 + rand()), phase: rand() * Math.PI * 2 }));
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const r = 1 + waves.reduce((sum, w) => sum + w.a * Math.sin(w.k * angle + w.phase), 0);
    return { x: cx + rx * r * Math.cos(angle), y: cy + ry * r * Math.sin(angle) };
  });
};

const MAINLAND = smooth(shore(490, 334, 392, 226, 7), true);
const ISLANDS = [smooth(shore(96, 548, 46, 26, 3, 1.4, 28), true), smooth(shore(70, 168, 26, 16, 11, 1.4, 24), true), smooth(shore(912, 120, 20, 30, 5, 1.6, 24), true)];
const LAND = [MAINLAND, ...ISLANDS];
const landClip = def.clipPath({}, <path d={LAND.join("")} />);
/**
 * The map is drawn twice: an intro copy that animates in at the overview, and a still copy the camera zooms. Chromium keeps
 * every animated element on its own raster, and when a camera scales hundreds of them they fall behind and flash blank,
 * so the copy that zooms has no animations at all. Geometry lives in shared symbols, so drawing it twice costs little.
 */
const shapes = new Map<string, Ref<"symbol">>();
const shape = (d: string): Ref<"symbol"> => {
  let symbol = shapes.get(d);
  if (!symbol) shapes.set(d, (symbol = def.symbol({ style: "overflow:visible" }, <path d={d} />)));
  return symbol;
};
const landShape = shape(LAND.join(""));

/** Hand tools: a broad nib for coasts and lettering rules, a fine pen for peaks, a brush for rivers and lava. */
const COAST = nib({ size: 2.6, angle: 40, thin: 0.35 });
const PEN = pen({ size: 1.05, seed: 4 });
const HATCH = pen({ size: 0.65, taper: 0.3, seed: 5 });
const RIVER = brush({ size: 2.6, taper: 0.18, pressure: 0.3, seed: 6 });
const LAVA = brush({ size: 2.8, taper: 0.4, seed: 9 });

/** Drops a motion from the still copy. */
const intro = (still: boolean) => <T,>(motion: T): T | undefined => (still ? undefined : motion);

/** A line of outlined text from a shared symbol, readable by assistive tech. */
function Words({ face, text, size, x, y, fill }: { face: Font; text: string; size: number; x: number; y: number; fill: Paint }): SvgNode {
  return <use href={shape(face.path(text, { size, x, y }).d)} fill={fill} role="img" aria-label={text} />;
}

/** A range of peaks along a line, each a little inked tent with hatching down its shadowed side. */
const range = (spine: readonly Pt[], seed: number, size: number, spacing: number) => {
  const rand = random(seed);
  const along = sample(spine, 24);
  const length = lengths(along);
  const peaks: { x: number; y: number; h: number; w: number }[] = [];
  for (let s = 0; s < length.at(-1)!; s += spacing * (0.7 + rand() * 0.6)) {
    const i = length.findIndex((l) => l >= s);
    const p = along[Math.max(0, i)]!;
    for (let k = 0; k < (rand() < 0.5 ? 2 : 1); k++) {
      const h = size * (0.65 + rand() * 0.5);
      peaks.push({ x: p.x + (rand() - 0.5) * spacing * 1.6, y: p.y + (rand() - 0.5) * spacing * 1.4, h, w: h * (1.15 + rand() * 0.35) });
    }
  }
  return peaks.sort((a, b) => a.y - b.y);
};

/** A peak: a ridge line up the left, a shoulder on the right, and hatching down the shadowed flank. */
const peak = ({ x, y, h, w }: { x: number; y: number; h: number; w: number }) => {
  const top = { x: x - w * 0.06, y: y - h };
  const hatch = [0.18, 0.34, 0.5, 0.66, 0.82]
    .map((t) => {
      const sx = top.x + (x + w / 2 - top.x) * t;
      const sy = top.y + (y - top.y) * t;
      return `M${n(sx)} ${n(sy)}L${n(sx - w * 0.1)} ${n(Math.min(y, sy + h * 0.32))}`;
    })
    .join("");
  const body = `M${n(x - w / 2)} ${n(y)}Q${n(x - w * 0.3)} ${n(y - h * 0.55)} ${n(top.x)} ${n(top.y)}L${n(x + w * 0.12)} ${n(y - h * 0.72)}L${n(x + w * 0.2)} ${n(y - h * 0.78)}L${n(x + w / 2)} ${n(y)}`;
  return { body, hatch };
};

function Range({ spine, seed, size = 22, spacing = 16, at, still }: { spine: readonly Pt[]; seed: number; size?: number; spacing?: number; at: number; still: boolean }): SvgNode {
  const peaks = range(spine, seed, size, spacing);
  const play = intro(still);
  return (
    <g>
      {peaks.map((p, i) => {
        const { body, hatch } = peak(p);
        return (
          <g animation={play(enter({ at: at + i * 0.012, over: 0.35 }, { opacity: 0, y: 4 }))}>
            <use href={shape(`${body}Z`)} fill={C.land} />
            <Stroke d={body} tool={PEN} color={C.ink} />
            <Stroke d={hatch} tool={HATCH} color={C.ink} />
          </g>
        );
      })}
    </g>
  );
}

/** Lollipop trees scattered inside an ellipse, all in one path. */
function Forest({ cx, cy, rx, ry, seed, at, still }: { cx: number; cy: number; rx: number; ry: number; seed: number; at: number; still: boolean }): SvgNode {
  const rand = random(seed);
  const trees: Pt[] = [];
  for (let y = cy - ry; y <= cy + ry; y += 7) {
    for (let x = cx - rx; x <= cx + rx; x += 8) {
      const p = { x: x + (rand() - 0.5) * 5, y: y + (rand() - 0.5) * 4 };
      if (((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1 - rand() * 0.25) trees.push(p);
    }
  }
  trees.sort((a, b) => a.y - b.y);
  const rows = [0, 1, 2, 3].map((band) => trees.filter((_, i) => Math.floor((i / trees.length) * 4) === band));
  return (
    <g stroke={C.ink} strokeWidth={0.8} fill={C.land}>
      {rows.map((row, band) => (
        <use
          href={shape(row.map(({ x, y }) => `M${n(x)} ${n(y)}v3M${n(x - 3.2)} ${n(y)}a3.2 3.6 0 1 1 6.4 0a3.2 1.6 0 0 1 -6.4 0Z`).join(""))}
          animation={intro(still)(enter({ at: at + band * 0.15, over: 0.5 }, { opacity: 0 }))}
        />
      ))}
    </g>
  );
}

/** A label whose letters sit on a curve, each glyph turned to the curve's direction. */
function Curved({ text, face, size, path, tracking = 0.25, fill = C.ink, at, step = 0.04, still }: { text: string; face: Font; size: number; path: readonly Pt[]; tracking?: number; fill?: Paint; at: number; step?: number; still: boolean }): SvgNode {
  const along = sample(path, 30);
  const length = lengths(along);
  const glyphs = [...text].map((char) => ({ char, advance: face.measure(char, size) }));
  const total = glyphs.reduce((sum, g) => sum + g.advance, 0) + tracking * size * (glyphs.length - 1);
  let s = (length.at(-1)! - total) / 2;
  const lift = (face.metrics.capHeight ?? 0.7) * size * 0.5;
  return (
    <g fill={fill} role="img" aria-label={text}>
      {glyphs.map(({ char, advance }, i) => {
        const middle = s + advance / 2;
        s += advance + tracking * size;
        if (char === " ") return null;
        const k = Math.max(1, length.findIndex((l) => l >= middle));
        const [a, b] = [along[k - 1]!, along[k]!];
        const t = (middle - length[k - 1]!) / (length[k]! - length[k - 1]! || 1);
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        return (
          <g transform={`translate(${n(a.x + (b.x - a.x) * t)} ${n(a.y + (b.y - a.y) * t)}) rotate(${n(angle)})`}>
            <use href={shape(face.path(char, { size, x: -advance / 2, y: lift }).d)} animation={intro(still)(enter({ at: at + i * step, over: 0.4 }, { opacity: 0 }))} />
          </g>
        );
      })}
    </g>
  );
}

interface Place {
  readonly name: string;
  readonly at: Pt;
  readonly side?: "left" | "right" | "above" | "below";
  readonly kind?: "town" | "tower" | "port";
}

const PLACES = {
  bramblecott: { name: "Bramblecott", at: { x: 236, y: 290 }, side: "below" },
  ford: { name: "Ford of Glass", at: { x: 333, y: 360 }, side: "left" },
  elder: { name: "Elderhall", at: { x: 452, y: 402 }, side: "below" },
  pass: { name: "Gate of Teeth", at: { x: 590, y: 352 }, side: "above", kind: "tower" },
  ashfall: { name: "Ashfall", at: { x: 690, y: 400 }, side: "below", kind: "tower" },
  westhaven: { name: "Westhaven", at: { x: 160, y: 352 }, side: "below", kind: "port" },
  northmark: { name: "Northmark", at: { x: 470, y: 176 }, side: "above" },
  gull: { name: "Gullreach", at: { x: 700, y: 486 }, side: "right", kind: "port" },
} as const satisfies Record<string, Place>;

const CINDER = { x: 772, y: 336 };

function Marker({ place, at, still }: { place: Place; at: number; still: boolean }): SvgNode {
  const { x, y } = place.at;
  const size = 10.5;
  const width = roman.measure(place.name, size);
  const side = place.side ?? "right";
  const [lx, ly] = side === "right" ? [x + 8, y + 3.5] : side === "left" ? [x - 8 - width, y + 3.5] : side === "above" ? [x - width / 2, y - 10] : [x - width / 2, y + 16];
  const icon =
    place.kind === "tower" ? (
      <path d={`M${x - 3} ${y + 4}V${y - 5}h1.5v1.5h1.5v-1.5h1.5v-1.5h-.01h1.5v1.5h1.5v-1.5h0V${y + 4}Z`} fill={C.ink} />
    ) : place.kind === "port" ? (
      <path d={`M${x} ${y - 5}v9M${x - 4} ${y + 1}q4 5 8 0M${x - 2.5} ${y - 3}h5`} fill="none" stroke={C.ink} strokeWidth={1.2} />
    ) : (
      <>
        <circle cx={x} cy={y} r={3.6} fill="none" stroke={C.ink} strokeWidth={1} />
        <circle cx={x} cy={y} r={1.6} fill={C.ink} />
      </>
    );
  return (
    <g animation={intro(still)(enter({ at, over: 0.5 }, { opacity: 0, scale: 0.6 }, ease.pop))}>
      {icon}
      <Words face={roman} text={place.name} size={size} x={lx} y={ly} fill={C.ink} />
    </g>
  );
}

const ROUTE_POINTS: Pt[] = [PLACES.bramblecott.at, { x: 286, y: 330 }, PLACES.ford.at, { x: 396, y: 392 }, PLACES.elder.at, { x: 520, y: 392 }, PLACES.pass.at, { x: 640, y: 372 }, PLACES.ashfall.at, { x: 742, y: 372 }, CINDER];
const ROUTE = sample(ROUTE_POINTS, 6);
const ROUTE_LENGTH = lengths(ROUTE);

const JOURNEY = { at: 6, over: 9.5 };
/** When the traveller reaches a route point, by arc length. */
const reach = (p: Pt) => {
  const i = ROUTE.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 0.01);
  return JOURNEY.at + (JOURNEY.over * ROUTE_LENGTH[i]!) / ROUTE_LENGTH.at(-1)!;
};

const view = (center: Pt, width: number): Rect => rect(center.x - width / 2, center.y - width / 3, width, (width * 2) / 3);
const FRAME = rect(0, 0, W, H);
const PAN = 1.1;

/** The intro has finished and the camera has not moved: the moment to swap the animated copy for the still one. */
const SWAP = 4.9;

const STOPS: CameraStop[] = [
  { during: { at: 5, over: PAN }, target: view(PLACES.bramblecott.at, 300) },
  ...[PLACES.ford.at, PLACES.elder.at, PLACES.pass.at, PLACES.ashfall.at].map((p) => ({ during: { at: reach(p) - PAN * 0.8, over: PAN }, target: view(p, 320) })),
  { during: { at: reach(CINDER) - PAN * 0.6, over: PAN }, target: view({ x: CINDER.x - 6, y: CINDER.y - 22 }, 210) },
  { during: { at: 18.2, over: PAN }, target: "all" },
];

/** The volcano. `live` is the glow and smoke, which loop forever and so belong in the live layer. */
function Cinder({ at, live = false, still = false }: { at: number; live?: boolean; still?: boolean }): SvgNode {
  const { x, y } = CINDER;
  const glow = def.radialGradient({}, (
    <>
      <stop offset={0} stopColor={C.ember} stopOpacity={0.7} />
      <stop offset={1} stopColor={C.ember} stopOpacity={0} />
    </>
  ));
  const rim = { l: x - 9, r: x + 9, y: y - 54 };
  const body = `M${x - 52} ${y}Q${x - 40} ${y - 6} ${x - 34} ${y - 16}L${x - 26} ${y - 24}L${x - 22} ${y - 22}L${rim.l} ${rim.y}Q${x} ${rim.y + 5} ${rim.r} ${rim.y}L${x + 20} ${y - 30}L${x + 26} ${y - 32}L${x + 36} ${y - 14}Q${x + 42} ${y - 4} ${x + 52} ${y}Z`;
  const hatch = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 1) / 10;
    const [sx, sy] = [rim.r + (x + 52 - rim.r) * t, rim.y + (y - rim.y) * t];
    return `M${n(sx)} ${n(sy)}l${n(-6 - t * 4)} ${n(10 + t * 6)}`;
  }).join("");
  const lava = `M${x - 4} ${rim.y + 2}q-3 10 -9 16q-4 6 -10 22M${x + 2} ${rim.y + 3}q4 14 2 22q2 8 9 18`;
  const puff = (i: number) => (
    <circle
      cx={x + 1}
      cy={rim.y - 6}
      r={6}
      fill={C.faded}
      animation={motion({ opacity: 0, y: 0, x: 0, scale: 0.5 })
        .at(i * 1.1)
        .to({ opacity: 0.55 }, 0.3)
        .to({ opacity: 0, y: -38, x: 12 + i * 3, scale: 2 }, 1.8, ease.out)
        .loop(4.4)}
    />
  );
  if (live) {
    return (
      <g animation={enter({ at, over: 0.6 }, { opacity: 0 })}>
        <ellipse cx={x} cy={rim.y} rx={70} ry={52} fill={glow} animation={motion({ opacity: 0.55 }).to({ opacity: 1 }, 1.1, ease.inOut).to({ opacity: 0.55 }, 1.1, ease.inOut).loop(2.2)} />
        {[0, 1, 2].map(puff)}
      </g>
    );
  }
  return (
    <g animation={intro(still)(enter({ at, over: 0.6 }, { opacity: 0, y: 6 }))}>
      <use href={shape(body)} fill={C.land} />
      <Stroke d={body} tool={pen({ size: 1.5, seed: 8 })} color={C.ink} />
      <Stroke d={hatch} tool={HATCH} color={C.ink} />
      <Stroke d={`M${rim.l} ${rim.y}Q${x} ${rim.y - 4} ${rim.r} ${rim.y}`} tool={PEN} color={C.ink} />
      <Stroke d={lava} tool={LAVA} color={C.red} />
    </g>
  );
}

function Compass({ x, y, at, still }: { x: number; y: number; at: number; still: boolean }): SvgNode {
  const star = (r: number, inner: number, count: number, turn = 0) =>
    Array.from({ length: count * 2 }, (_, i) => {
      const a = ((i * Math.PI) / count) + turn - Math.PI / 2;
      const rr = i % 2 ? inner : r;
      return `${i ? "L" : "M"}${n(x + rr * Math.cos(a))} ${n(y + rr * Math.sin(a))}`;
    }).join("") + "Z";
  return (
    <g animation={intro(still)(motion({ opacity: 0, rotate: -90, scale: 0.4 }).at(at).to({ opacity: 1, rotate: 0, scale: 1 }, 1.4, ease.out))}>
      <circle cx={x} cy={y} r={34} fill="none" stroke={C.ink} strokeWidth={0.8} />
      <circle cx={x} cy={y} r={30} fill="none" stroke={C.ink} strokeWidth={0.5} strokeDasharray="1.5 3" />
      <path d={star(26, 4, 4, Math.PI / 4)} fill={C.faded} opacity={0.5} />
      <path d={star(40, 6, 4)} fill={C.land} stroke={C.ink} strokeWidth={0.9} strokeLinejoin="round" />
      <path d={`M${x} ${y - 40}L${x + 6} ${y - 6}L${x} ${y}Z`} fill={C.red} />
      <Words face={roman} text="N" size={13} x={x - roman.measure("N", 13) / 2} y={y - 45} fill={C.ink} />
    </g>
  );
}

function Cartouche({ at, still }: { at: number; still: boolean }): SvgNode {
  const box = { x: 26, y: 24, w: 300, h: 92 };
  const title = "The Western Reaches";
  const titleSize = 27;
  const sub = "Being a map of the long road to Mount Cinder";
  const subSize = 9;
  return (
    <g animation={intro(still)(enter({ at, over: 0.8 }, { opacity: 0, y: -8 }))}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={C.land} stroke={C.ink} strokeWidth={1.4} />
      <rect x={box.x + 5} y={box.y + 5} width={box.w - 10} height={box.h - 10} fill="none" stroke={C.ink} strokeWidth={0.6} />
      <Words face={uncial} text={title} size={titleSize} x={box.x + (box.w - uncial.measure(title, titleSize)) / 2} y={box.y + 50} fill={C.ink} />
      <Stroke d={`M${box.x + 60} ${box.y + 62}h${box.w - 120}`} tool={brush({ size: 2.4, taper: 0.45, seed: 12 })} color={C.red} draw={still ? undefined : { at: at + 0.6, over: 0.8 }} />
      <Words face={roman} text={sub} size={subSize} x={box.x + (box.w - roman.measure(sub, subSize)) / 2} y={box.y + 78} fill={C.faded} />
    </g>
  );
}

function ScaleBar({ x, y, at, still }: { x: number; y: number; at: number; still: boolean }): SvgNode {
  const segment = 30;
  return (
    <g animation={intro(still)(enter({ at, over: 0.6 }, { opacity: 0 }))}>
      {[0, 1, 2, 3].map((i) => (
        <rect x={x + i * segment} y={y} width={segment} height={5} fill={i % 2 ? C.land : C.ink} stroke={C.ink} strokeWidth={0.8} />
      ))}
      {[0, 50, 100].map((v, i) => (
        <Words face={roman} text={String(v)} size={8} x={x + i * segment * 2 - roman.measure(String(v), 8) / 2} y={y + 16} fill={C.ink} />
      ))}
      <Words face={roman} text="Leagues" size={9} x={x + segment * 2 - roman.measure("Leagues", 9) / 2} y={y - 6} fill={C.ink} />
    </g>
  );
}

const coastRipples = (at: number, still: boolean): Child =>
  [
    { width: 26, color: C.faded, opacity: 0.18 },
    { width: 21, color: C.sea, opacity: 1 },
    { width: 13, color: C.faded, opacity: 0.35 },
    { width: 9, color: C.sea, opacity: 1 },
  ].map(({ width, color, opacity }, i) => <use href={landShape} fill="none" stroke={color} strokeWidth={width} strokeLinejoin="round" opacity={opacity} animation={intro(still)(enter({ at: at + i * 0.15, over: 0.8 }, { opacity: 0 }))} />);

const RIVERS: Pt[][] = [
  [{ x: 300, y: 196 }, { x: 330, y: 260 }, { x: 352, y: 304 }, { x: 330, y: 360 }, { x: 318, y: 440 }, { x: 290, y: 520 }, { x: 270, y: 600 }],
  [{ x: 600, y: 300 }, { x: 650, y: 330 }, { x: 690, y: 432 }, { x: 730, y: 500 }, { x: 780, y: 600 }],
  [{ x: 470, y: 230 }, { x: 440, y: 270 }, { x: 395, y: 300 }, { x: 352, y: 304 }],
];

/**
 * The dashed route, revealed in short pieces as the traveller passes. A mask that draws on would be simpler, but a masked
 * element inside the zooming camera makes Chromium re-raster the whole map each frame, and tiles flash blank mid-zoom.
 */
function Route(): SvgNode {
  const fine = sample(ROUTE_POINTS, 24);
  const along = lengths(fine);
  const PIECE = 6;
  const pieces = Array.from({ length: Math.ceil((fine.length - 1) / PIECE) }, (_, k) => fine.slice(k * PIECE, k * PIECE + PIECE + 1));
  return (
    <g fill="none" stroke={C.red} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round">
      {pieces.map((piece, k) => (
        <path
          d={piece.map((p, i) => `${i ? "L" : "M"}${n(p.x)} ${n(p.y)}`).join("")}
          strokeDashoffset={-n(along[k * PIECE]!)}
          animation={motion({ opacity: 0 }).at(JOURNEY.at + (JOURNEY.over * along[k * PIECE]!) / along.at(-1)!).set({ opacity: 1 })}
        />
      ))}
    </g>
  );
}

/** Everything that settles before the camera first moves. `still` drops every motion, for the copy the camera zooms. */
function Atlas({ still }: { still: boolean }): SvgNode {
  const play = intro(still);
  return (
    <>
      <rect width={W} height={H} fill={C.sea} />
      <g animation={play(enter({ at: 0.2, over: 1 }, { opacity: 0 }))}>{coastRipples(0.2, still)}</g>
      <use href={landShape} fill={C.land} animation={play(enter({ at: 0.1, over: 1 }, { opacity: 0 }))} />
      <Stroke d={LAND.join("")} tool={COAST} color={C.ink} draw={still ? undefined : { at: 0.1, over: 1.6 }} />
      <g clipPath={landClip}>
        {RIVERS.map((river, i) => (
          <Stroke d={smooth(river)} tool={i === 2 ? brush({ size: 1.7, taper: 0.25, seed: 7 }) : RIVER} color={C.river} draw={still ? undefined : { at: 1.8 + i * 0.3, over: 1.4 }} />
        ))}
        <ellipse cx={352} cy={304} rx={16} ry={8} fill={C.sea} stroke={C.river} strokeWidth={1} animation={play(enter({ at: 2.4, over: 0.6 }, { opacity: 0 }))} />
      </g>
      <Forest cx={420} cy={330} rx={68} ry={40} seed={21} at={1.6} still={still} />
      <Forest cx={268} cy={440} rx={46} ry={26} seed={22} at={1.8} still={still} />
      <Forest cx={545} cy={470} rx={60} ry={30} seed={23} at={2} still={still} />
      <Forest cx={196} cy={230} rx={44} ry={24} seed={24} at={1.9} still={still} />
      <Forest cx={740} cy={196} rx={56} ry={26} seed={25} at={2.1} still={still} />
      <Forest cx={420} cy={520} rx={40} ry={18} seed={26} at={2.2} still={still} />
      <Range spine={[{ x: 560, y: 160 }, { x: 590, y: 240 }, { x: 600, y: 320 }]} seed={31} spacing={12} at={1.2} still={still} />
      <Range spine={[{ x: 600, y: 392 }, { x: 590, y: 450 }, { x: 612, y: 516 }]} seed={32} spacing={12} at={1.4} still={still} />
      <Range spine={[{ x: 150, y: 430 }, { x: 196, y: 470 }, { x: 240, y: 500 }]} seed={35} size={14} spacing={11} at={1.6} still={still} />
      <Range spine={[{ x: 268, y: 190 }, { x: 300, y: 176 }, { x: 340, y: 186 }]} seed={33} size={18} spacing={12} at={1.5} still={still} />
      <Range spine={[{ x: 720, y: 300 }, { x: 772, y: 280 }, { x: 822, y: 310 }, { x: 830, y: 370 }]} seed={34} size={16} spacing={11} at={1.7} still={still} />
      <Cinder at={2.2} still={still} />
      <Curved text="THE IRON TEETH" face={roman} size={13} path={[{ x: 630, y: 170 }, { x: 648, y: 250 }, { x: 640, y: 318 }]} at={3} still={still} />
      <Curved text="ELDERWOOD" face={roman} size={12} path={[{ x: 360, y: 336 }, { x: 420, y: 326 }, { x: 482, y: 336 }]} tracking={0.5} fill={C.faded} at={3.2} still={still} />
      <Curved text="THE ASHLANDS" face={roman} size={12} path={[{ x: 700, y: 268 }, { x: 772, y: 252 }, { x: 846, y: 276 }]} tracking={0.4} fill={C.red} at={3.4} still={still} />
      <Curved text="GREY HILLS" face={roman} size={10} path={[{ x: 254, y: 210 }, { x: 304, y: 216 }, { x: 352, y: 208 }]} tracking={0.35} fill={C.faded} at={3.5} still={still} />
      <Curved text="SEA OF WHISPERS" face={roman} size={17} path={[{ x: 300, y: 600 }, { x: 470, y: 618 }, { x: 640, y: 596 }]} tracking={0.6} fill={C.faded} at={3.6} step={0.05} still={still} />
      <Curved text="THE GREAT WEST" face={roman} size={15} path={[{ x: 52, y: 470 }, { x: 46, y: 330 }, { x: 64, y: 200 }]} tracking={0.5} fill={C.faded} at={3.7} still={still} />
      <Curved text="WESTWOLD" face={roman} size={9.5} path={[{ x: 156, y: 205 }, { x: 196, y: 198 }, { x: 236, y: 205 }]} tracking={0.45} fill={C.faded} at={3.75} still={still} />
      <Curved text="THE BARROWS" face={roman} size={9.5} path={[{ x: 140, y: 500 }, { x: 186, y: 515 }, { x: 236, y: 530 }]} tracking={0.35} fill={C.faded} at={3.75} still={still} />
      <Curved text="River Glass" face={roman} size={8.5} path={[{ x: 334, y: 420 }, { x: 324, y: 470 }, { x: 304, y: 512 }]} tracking={0.2} fill={C.river} at={3.8} still={still} />
      {Object.values(PLACES).map((place, i) => (
        <Marker place={place} at={3 + i * 0.12} still={still} />
      ))}
      <Compass x={884} y={560} at={0.6} still={still} />
      <Cartouche at={0.4} still={still} />
      <ScaleBar x={44} y={604} at={0.8} still={still} />
    </>
  );
}

/**
 * What keeps moving while the camera does: the route, the traveller, the smoke. Chromium re-rasters a zooming layer whenever
 * anything inside it changes, and a whole map re-rastered every frame shows blank tiles, so these ride a second camera.
 */
function Live(): SvgNode {
  const traveller = ROUTE.filter((_, i) => i % 3 === 0 || i === ROUTE.length - 1);
  return (
    <>
      <Cinder at={2.2} live />
      <Route />
      <g animation={travel(traveller, JOURNEY)}>
        <circle r={5.5} fill={C.red} opacity={0.25} />
        <circle r={3} fill={C.red} stroke={C.land} strokeWidth={1} />
      </g>
      <g animation={motion({ opacity: 0, scale: 0.3 }).at(reach(CINDER)).to({ opacity: 1, scale: 1 }, 0.5, ease.pop)}>
        <path d={`M${CINDER.x - 6} ${CINDER.y + 8}l12 12M${CINDER.x + 6} ${CINDER.y + 8}l-12 12`} stroke={C.red} strokeWidth={2.6} strokeLinecap="round" />
      </g>
    </>
  );
}

export default function build(): string {
  const grain = def.filter({}, (
    <>
      <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={4} result="noise" />
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.23  0 0 0 0 0.16  0 0 0 0 0.1  0 0 0 0.55 -0.12" />
    </>
  ));
  const vignette = def.radialGradient({ r: 0.75 }, (
    <>
      <stop offset={0.55} stopColor="#2A1C0E" stopOpacity={0} />
      <stop offset={1} stopColor="#2A1C0E" stopOpacity={0.45} />
    </>
  ));
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "The Western Reaches",
      desc: "A hand-inked fantasy map draws itself: coastlines, mountain ranges, forests, rivers and lettered place names. Then the view zooms in on the village of Bramblecott and follows a dashed red route east past the Ford of Glass, Elderhall, the Gate of Teeth and Ashfall to the smoking Mount Cinder, before pulling back to the whole map.",
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width={W} height={H} fill={C.paper} />
      <g animation={motion({ opacity: 1 }).at(SWAP).set({ opacity: 0 })}>
        <Atlas still={false} />
      </g>
      <g animation={motion({ opacity: 0 }).at(SWAP).set({ opacity: 1 })}>
        <Camera frame={FRAME} stops={STOPS} over={PAN}>
          <Atlas still />
        </Camera>
      </g>
      <Camera frame={FRAME} stops={STOPS} over={PAN}>
        <Live />
      </Camera>
      <rect width={W} height={H} filter={grain} opacity={0.5} />
      <rect width={W} height={H} fill={vignette} />
      <rect x={6} y={6} width={W - 12} height={H - 12} fill="none" stroke={C.ink} strokeWidth={2} />
      <rect x={11} y={11} width={W - 22} height={H - 22} fill="none" stroke={C.ink} strokeWidth={0.6} />
    </>,
  );
}
