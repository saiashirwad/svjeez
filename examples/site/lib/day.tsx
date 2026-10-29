import { def, ease, motion, render, type Color, type SvgNode } from "svjeez";
import { code } from "svjeez/extras";
import { highlight } from "@svjeez/code";
import { CSS, chrome } from "../kit";
import { mono, theme } from "../../style";

// The home page hero: a day in ten seconds, written as one motion() chain beside the sky it paints. As each step of the
// chain plays, its line in the code lights up in the color the sky is heading for, so the timeline in the code and the
// timeline on screen read as the same thing. The scene and the code are both printed from the tables below, so a knob
// that changes a color, an ease or a duration changes the picture and the text together.

type Phase = "dawn" | "noon" | "dusk" | "night";
type EaseName = "linear" | "in" | "pop";

/** Which world the day happens on. */
export type Sky = "earth" | "mars" | "sorbet";
/** How every step moves: today's eases, all linear, or all bouncy. */
export type Feel = "smooth" | "robot" | "bouncy";
/** How long the day takes: twice as long, as written, or half. */
export type Speed = "snail" | "normal" | "rabbit";

export interface Knobs {
  readonly sky: Sky;
  readonly feel: Feel;
  readonly speed: Speed;
}

export const DEFAULT: Knobs = { sky: "earth", feel: "smooth", speed: "normal" };

interface World {
  /** The window's title. */
  readonly file: string;
  readonly sky: Readonly<Record<Phase, Color>>;
  /** The color a step's line lights up in, where the sky's own would read as gray on a white page. */
  readonly tint: Partial<Readonly<Record<Phase, Color>>>;
  readonly sun: Color;
  readonly sunR: number;
  readonly land: Color;
  /** What the sun does, for the description. */
  readonly scene: string;
}

// Mars runs the other way round: a butterscotch noon and blue sunsets, under a sun two thirds the size.
const WORLDS: Readonly<Record<Sky, World>> = {
  earth: {
    file: "day.tsx",
    sky: { dawn: "#FFB38A", noon: "#8CCBFF", dusk: "#FF7E5F", night: "#2B2F66" },
    tint: { night: "#5E5CE6" },
    sun: "#FFD60A",
    sunR: 24,
    land: "#141826",
    scene: "a sun arcs over two hills",
  },
  mars: {
    file: "mars.tsx",
    sky: { dawn: "#A9BCD0", noon: "#E2A66B", dusk: "#4F86C6", night: "#1C1424" },
    tint: { night: "#8E5CD9" },
    sun: "#F4F1E6",
    sunR: 16,
    land: "#5A1F14",
    scene: "a small pale sun arcs over two rust-red hills",
  },
  sorbet: {
    file: "sorbet.tsx",
    sky: { dawn: "#FFB5CC", noon: "#9EEBD5", dusk: "#FFB070", night: "#6A4BA8" },
    tint: { night: "#9B6BFF" },
    sun: "#FF4F7B",
    sunR: 24,
    land: "#5B3426",
    scene: "a cherry sun arcs over two chocolate hills",
  },
};

/** The ease each step names in the code. Undefined is the default ease, which the code leaves out. */
interface Eases {
  readonly sky?: EaseName;
  readonly sunX: EaseName;
  readonly rise?: EaseName;
  readonly set: EaseName;
}

const FEELS: Readonly<Record<Feel, Eases>> = {
  smooth: { sunX: "linear", set: "in" },
  robot: { sky: "linear", sunX: "linear", rise: "linear", set: "linear" },
  bouncy: { sky: "pop", sunX: "linear", rise: "pop", set: "in" },
};

const SPEEDS: Readonly<Record<Speed, number>> = { snail: 2, normal: 1, rabbit: 0.5 };

/** The sky's chain after its first value, in seconds as written for a normal day. */
const CHAIN: readonly (
  | { readonly to: Phase; readonly over: number }
  | { readonly wait: number }
)[] = [
  { to: "noon", over: 2 },
  { wait: 2 },
  { to: "dusk", over: 2 },
  { to: "night", over: 1.5 },
  { wait: 1 },
  { to: "dawn", over: 1.5 },
];

/** The sun takes the first six seconds of a normal day: three up, three down. */
const ARC = 3;
const BAR = 40;

const to = (target: string, over: number, name: EaseName | undefined) =>
  `.to({ ${target} }, ${over}${name ? `, ease.${name}` : ""})`;

const curve = (name: EaseName | undefined) => (name ? ease[name] : undefined);

/** Everything one set of knobs decides: the motions, the code that writes them, and when each line of the chain plays. */
const plan = ({ sky, feel, speed }: Knobs) => {
  const world = WORLDS[sky];
  const eases = FEELS[feel];
  const k = SPEEDS[speed];
  const arc = ARC * k;

  const steps = CHAIN.map((step) =>
    "to" in step ? { ...step, over: step.over * k } : { wait: step.wait * k },
  );

  let skyMotion = motion({ fill: world.sky.dawn });
  let at = 0;

  const timing = steps.map((step) => {
    const start = at;

    if ("to" in step) {
      skyMotion = skyMotion.to({ fill: world.sky[step.to] }, step.over, curve(eases.sky));
      at += step.over;

      return { at: start, over: step.over, tint: world.tint[step.to] ?? world.sky[step.to] };
    }

    skyMotion = skyMotion.wait(step.wait);
    at += step.wait;

    return { at: start, over: step.wait };
  });

  const sunX = motion({ x: -200 }).to({ x: 200 }, 2 * arc, curve(eases.sunX));
  const sunY = motion({ y: 60 })
    .to({ y: -170 }, arc, curve(eases.rise))
    .to({ y: 60 }, arc, curve(eases.set));

  const chain = steps.map((step, i) => {
    const end = i === steps.length - 1 ? ";" : "";

    return "to" in step
      ? `  ${to(`fill: ${step.to}`, step.over, eases.sky)}${end}`
      : `  .wait(${step.wait})${end}`;
  });

  const motions = [
    "const sky = motion({ fill: dawn })",
    ...chain,
    "",
    "const sunX = motion({ x: -200 })",
    `  ${to("x: 200", 2 * arc, eases.sunX)};`,
    "const sunY = motion({ y: 60 })",
    `  ${to("y: -170", arc, eases.rise)}`,
    `  ${to("y: 60", arc, eases.set)};`,
    "",
    "<rect width={w} height={h} animation={sky} />",
  ];

  const circle = `<circle r={${world.sunR}} fill={sun}`;

  return {
    world,
    duration: at,
    reducedAt: arc,
    sky: skyMotion,
    sun: [sunX, sunY],
    // The chain's steps sit on the lines after its first.
    timing: timing.map((t, i) => ({ ...t, row: i + 1 })),
    source: {
      wide: [...motions, `${circle} animation={[sunX, sunY]} />`, "<path d={hills} fill={land} />"],
      tall: [...motions, circle, "  animation={[sunX, sunY]} />", "<path d={hills} fill={land} />"],
    },
  };
};

// Two ridges drawn around the horizon at 0,0, wide enough to hide the sun below it at both ends.
const HILLS =
  "M-300 4C-220 -40 -150 -36 -80 -6C-20 18 40 -48 120 -34C190 -22 240 -8 300 6V200H-300Z";

export interface Layout {
  readonly name: "wide" | "tall";
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly lineHeight: number;
  /** Top-left of the code. Without a y the code sits centered in the window's body below the bar. */
  readonly code: { readonly x: number; readonly y?: number };
  /** The sky's pane inside the window, and how far down it the horizon sits. Its corners are square except where it meets the window's own rounded corner. */
  readonly panel: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly horizon: number;
  readonly scale: number;
}

export function day(layout: Layout, knobs: Knobs = DEFAULT): string {
  const { name, width, height, fontSize, panel } = layout;
  const scene = plan(knobs);
  const { world } = scene;
  const lines = scene.source[name];
  const { lineHeight } = layout;
  const y = layout.code.y ?? BAR + (height - BAR - lines.length * fontSize * lineHeight) / 2;

  const listing = code(highlight(lines.join("\n"), "tsx"), {
    theme,
    font: mono,
    fontSize,
    lineHeight,
    x: layout.code.x,
    y,
  });

  const lineH = listing.metrics.height;

  // One bar per step behind its line, tinted toward the color that step is heading for; a wait gets a quiet gray.
  const bars: SvgNode[] = scene.timing.map((step) => {
    const line = lines[step.row]!;
    const indent = line.length - line.trimStart().length;
    const x = listing.metrics.origin + indent * listing.metrics.advance;
    const width = line.trim().length * listing.metrics.advance;

    const shown = motion({ opacity: 0 })
      .at(step.at)
      .to({ opacity: 1 }, 0.15)
      .at(step.at + step.over - 0.15)
      .to({ opacity: 0 }, 0.15);

    return (
      <rect
        x={x - 6}
        y={listing.metrics.y + step.row * lineH}
        width={width + 12}
        height={lineH}
        rx={5}
        fill={step.tint ?? theme.base03}
        fillOpacity={step.tint ? 0.28 : 0.16}
        animation={shown}
      />
    );
  });

  // The pane meets the window's bottom-right corner in the wide cut and only its bottom edge in the tall one, which sits between the bar and the code.
  const r = panel.x + panel.w >= width - 1 && panel.y + panel.h >= height - 1 ? 12 : 0;
  const [x0, y0, x1, y1] = [panel.x, panel.y, panel.x + panel.w, panel.y + panel.h];

  const clip = def.clipPath(
    {},
    <path d={`M${x0} ${y0}H${x1}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0}Z`} />,
  );

  const origin = `translate(${panel.x + panel.w / 2} ${panel.y + panel.h * layout.horizon}) scale(${layout.scale})`;

  return render(
    {
      width,
      height,
      duration: scene.duration,
      title: "svjeez: a day on one timeline",
      desc: `A motion() chain beside the sky it paints. The sky turns from dawn to noon, holds, goes to dusk and night, then back to dawn, while ${world.scene}. Each line of the chain lights up while its step plays.`,
      css: CSS,
      reducedMotion: { at: scene.reducedAt },
    },
    <>
      {chrome(width, height, world.file, { mono: true, bar: BAR }).node}
      {bars}
      {listing.node}
      <g clipPath={clip}>
        <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} animation={scene.sky} />
        <g transform={origin}>
          <circle r={world.sunR} fill={world.sun} animation={scene.sun} />
          <path d={HILLS} fill={world.land} />
        </g>
      </g>
    </>,
  );
}
