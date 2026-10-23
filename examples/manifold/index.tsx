import { def, ease, el, motion, render, sampled, type Color, type Motion, type SvgNode } from "svg-motion";
import { height, knot, lerp, project, seat, sphere, type Camera, type Point, type Seat, type Surface } from "./space";

const W = 800;
const H = 600;
const D = 12;
const CX = W / 2;
const CY = 300;

const DOTS = 320;
const FLOOR = -160;
const SPREAD = 0.4;
const TAU = Math.PI * 2;

const CAMERA: Camera = { pitch: (22 * Math.PI) / 180, distance: 720, zoom: 1.3 };

const C = {
  bgTop: "#0B0A1C",
  bgBottom: "#030308",
  grid: "#6B63B5",
  label: "#7D76A8",
  word: "#EDE8FF",
  cyan: "#3EE6D6",
  violet: "#9F8CFF",
  pink: "#FF5FA8",
} as const;

const CSS = `.sans{font-family:"Inter","SF Pro Display",system-ui,sans-serif}.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace}`;

interface Act {
  readonly surface: Surface;
  readonly caption: string;
  readonly hold: number;
  readonly morph: number;
}

const ACTS: readonly Act[] = [
  { surface: sphere(118), caption: "S² · SPHERE · GENUS 0", hold: 2.2, morph: 1.6 },
  { surface: knot({ radius: 112, wobble: 0, thickness: 36 }), caption: "T² · TORUS · GENUS 1", hold: 1.6, morph: 1.6 },
  { surface: knot({ radius: 92, wobble: 44, thickness: 9 }), caption: "3₁ · TREFOIL · KNOTTED", hold: 3.2, morph: 1.8 },
];

const STARTS = ACTS.map((_, i) => ACTS.slice(0, i).reduce((sum, act) => sum + act.hold + act.morph, 0));

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const shapeAt = (s: Seat, t: number): Point => {
  const i = STARTS.findLastIndex((start) => start <= t);
  const act = ACTS[i]!;
  const next = ACTS[(i + 1) % ACTS.length]!;
  const progress = (t - STARTS[i]! - act.hold) / act.morph;
  const lag = (SPREAD * (1 - height(s.around))) / 2;
  return lerp(act.surface(s), next.surface(s), smooth(clamp((progress - lag) / (1 - SPREAD))));
};

const fog = (depth: number) => clamp(0.95 - ((depth + 150) / 300) * 0.75, 0.15, 1);

const flight = (s: Seat) =>
  sampled(
    (t) => {
      const { x, y, size, depth } = project(CAMERA, (-TAU * t) / D, shapeAt({ along: (s.along + t / D) % 1, around: s.around }, t));
      return { opacity: round(fog(depth), 3), scale: round(size, 3), x: round(x, 1), y: round(y, 1) };
    },
    { duration: D, tolerance: { translate: 1, scale: 0.015, opacity: 0.02 } },
  );

const rgb = (color: string) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

const mix = (a: string, b: string, t: number): Color =>
  `#${rgb(a)
    .map((channel, i) => Math.round(channel + (rgb(b)[i]! - channel) * t).toString(16).padStart(2, "0"))
    .join("")}`;

const PALETTE = [C.cyan, C.violet, C.pink] as const;

const tint = (along: number): Color => {
  const u = (along * PALETTE.length) % PALETTE.length;
  const k = Math.floor(u);
  return mix(PALETTE[k]!, PALETTE[(k + 1) % PALETTE.length]!, u - k);
};

const bg = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.bgTop} />
    <stop offset={1} stopColor={C.bgBottom} />
  </>
));

const underglow = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.violet} stopOpacity={0.35} />
    <stop offset={1} stopColor={C.violet} stopOpacity={0} />
  </>
));

const PULSES = ACTS.map((act, i) => STARTS[i]! + act.hold);

function Floor(): SvgNode {
  const radii = Array.from({ length: 9 }, (_, k) => 60 + k * 40);
  const ring = (r: number) =>
    Array.from({ length: 96 }, (_, j) => {
      const p = project(CAMERA, 0, { x: r * Math.cos((TAU * j) / 96), y: FLOOR, z: r * Math.sin((TAU * j) / 96) });
      return `${j === 0 ? "M" : "L"}${round(p.x, 1)} ${round(p.y, 1)}`;
    }).join("") + "Z";
  const center = project(CAMERA, 0, { x: 0, y: FLOOR, z: 0 });
  const glowAt = (r: number) => project(CAMERA, 0, { x: r, y: FLOOR, z: 0 });
  const glow = el.ellipse({
    cx: center.x,
    cy: center.y,
    rx: glowAt(220).x,
    ry: glowAt(220).x * Math.sin(CAMERA.pitch),
    fill: underglow,
    animation: motion({ opacity: 0.7 }).to({ opacity: 1 }, D / 6, ease.inOut).to({ opacity: 0.7 }, D / 6, ease.inOut).loop(D / 3),
  });
  return (
    <>
      {glow}
      <g fill="none" stroke={C.grid} strokeWidth={0.8}>
        {radii.map((r, k) => {
          const rest = round(0.32 * (1 - k / radii.length), 2);
          let pulse: Motion<"opacity"> = motion({ opacity: rest });
          for (const at of PULSES) pulse = pulse.at(at + k * 0.09).to({ opacity: 0.85 }, 0.12).to({ opacity: rest }, 0.9, ease.inOut);
          return el.path({ d: ring(r), animation: pulse });
        })}
      </g>
    </>
  );
}

function Cloud(): SvgNode {
  return (
    <>
      {Array.from({ length: DOTS }, (_, i) => {
        const s = seat(i, DOTS);
        return el.circle({ r: 2.2, fill: tint(s.along), animation: flight(s) });
      })}
    </>
  );
}

const captionMotion = (start: number, hold: number): Motion<"opacity" | "y"> => {
  const shown = { opacity: 1, y: 0 };
  const below = { opacity: 0, y: 6 };
  const above = { opacity: 0, y: -6 };
  const arrive = (start - 0.5 + D) % D;
  return start === 0
    ? motion(shown).at(hold).to(above, 0.4, ease.in).at(arrive).set(below).to(shown, 0.5)
    : motion(below).at(arrive).to(shown, 0.5).at(start + hold).to(above, 0.4, ease.in);
};

function Title(): SvgNode {
  return (
    <>
      <text x={CX} y={62} class="sans" fontSize={26} fontWeight={300} letterSpacing={14} fill={C.word} textAnchor="middle">
        MANIFOLD
      </text>
      {ACTS.map((act, i) =>
        el.text(
          { x: CX, y: 90, class: "mono", fontSize: 10, letterSpacing: 3, fill: C.label, textAnchor: "middle", animation: captionMotion(STARTS[i]!, act.hold) },
          act.caption,
        ),
      )}
    </>
  );
}

export function buildManifold(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Manifold",
      desc: "Two hundred points in 3D, projected with perspective, flow around a sphere that opens into a torus, ties itself into a trefoil knot, and closes back into a sphere while the camera circles and pulses ripple across the floor.",
      css: CSS,
      reducedMotion: { at: 8 },
      comment: "Generated by svg-motion. Edit examples/manifold/ instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={bg} />
      <g transform={`translate(${CX} ${CY})`}>
        <Floor />
        <Cloud />
      </g>
      <Title />
    </>,
  );
}

export default buildManifold;
