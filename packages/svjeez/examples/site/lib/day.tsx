import { def, ease, motion, render, type SvgNode } from "svjeez";
import { code, type CodeTokens } from "svjeez/extras";
import { CSS, chrome, highlight } from "../kit";
import { mono, theme } from "../../style";

// The home page hero: a day in ten seconds, written as one motion() chain beside the sky it paints. As each step of the
// chain plays, its line in the code lights up in the color the sky is heading for, so the timeline in the code and the
// timeline on screen read as the same thing. The scene below is built from the same numbers the code shows.

const SKY = { dawn: "#FFB38A", noon: "#8CCBFF", dusk: "#FF7E5F", night: "#2B2F66" } as const;
const SUN = "#FFD60A";
const LAND = "#141826";
const D = 10;
const BAR = 40;

const sky = motion({ fill: SKY.dawn })
  .to({ fill: SKY.noon }, 2)
  .wait(2)
  .to({ fill: SKY.dusk }, 2)
  .to({ fill: SKY.night }, 1.5)
  .wait(1)
  .to({ fill: SKY.dawn }, 1.5);

const sunX = motion({ x: -200 }).to({ x: 200 }, 6, ease.linear);
const sunY = motion({ y: 60 }).to({ y: -170 }, 3).to({ y: 60 }, 3, ease.in);

// Each step of the sky chain: the line that writes it, when it plays, and the color its line lights up in: the sky it
// heads for, but indigo for night, which would read as gray on a white page. A wait has no tint.
const STEPS = [
  { line: /fill: noon/, at: 0, over: 2, tint: SKY.noon },
  { line: /wait\(2\)/, at: 2, over: 2 },
  { line: /fill: dusk/, at: 4, over: 2, tint: SKY.dusk },
  { line: /fill: night/, at: 6, over: 1.5, tint: "#5E5CE6" },
  { line: /wait\(1\)/, at: 7.5, over: 1 },
  { line: /fill: dawn \}, 1\.5/, at: 8.5, over: 1.5, tint: SKY.dawn },
] as const;

// The sun gets named motions like the sky, so every chain reads top to bottom and the JSX stays one line per element.
const MOTIONS = [
  "const sky = motion({ fill: dawn })",
  "  .to({ fill: noon }, 2)",
  "  .wait(2)",
  "  .to({ fill: dusk }, 2)",
  "  .to({ fill: night }, 1.5)",
  "  .wait(1)",
  "  .to({ fill: dawn }, 1.5);",
  "",
  "const sunX = motion({ x: -200 })",
  "  .to({ x: 200 }, 6, ease.linear);",
  "const sunY = motion({ y: 60 })",
  "  .to({ y: -170 }, 3)",
  "  .to({ y: 60 }, 3, ease.in);",
  "",
  "<rect width={w} height={h} animation={sky} />",
];

const SOURCE = {
  wide: [
    ...MOTIONS,
    "<circle r={24} fill={sun} animation={[sunX, sunY]} />",
    "<path d={hills} fill={land} />",
  ],
  tall: [
    ...MOTIONS,
    "<circle r={24} fill={sun}",
    "  animation={[sunX, sunY]} />",
    "<path d={hills} fill={land} />",
  ],
};

/** The source text for one layout. */
export const source = (name: "wide" | "tall"): string => SOURCE[name].join("\n");

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

export function day(layout: Layout): string {
  const { name, width, height, fontSize, panel } = layout;
  const lines = SOURCE[name];
  const { lineHeight } = layout;
  const y = layout.code.y ?? BAR + (height - BAR - lines.length * fontSize * lineHeight) / 2;

  const listing = code(highlight(source(name)) as CodeTokens, {
    theme,
    font: mono,
    fontSize,
    lineHeight,
    x: layout.code.x,
    y,
  });

  const lineH = listing.metrics.height;

  // One bar per step behind its line, tinted toward the color that step is heading for; a wait gets a quiet gray.
  const bars: SvgNode[] = STEPS.map((step) => {
    const row = lines.findIndex((line) => step.line.test(line));
    const indent = lines[row]!.length - lines[row]!.trimStart().length;
    const x = listing.metrics.origin + indent * listing.metrics.advance;
    const width = lines[row]!.trim().length * listing.metrics.advance;

    const shown = motion({ opacity: 0 })
      .at(step.at)
      .to({ opacity: 1 }, 0.15)
      .at(step.at + step.over - 0.15)
      .to({ opacity: 0 }, 0.15);

    return (
      <rect
        x={x - 6}
        y={listing.metrics.y + row * lineH}
        width={width + 12}
        height={lineH}
        rx={5}
        fill={"tint" in step ? step.tint : theme.base03}
        fillOpacity={"tint" in step ? 0.28 : 0.16}
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
      duration: D,
      title: "svjeez: a day on one timeline",
      desc: "A motion() chain beside the sky it paints. The sky turns from dawn to noon, holds, goes to dusk and night, then back to dawn, while a sun arcs over two hills. Each line of the chain lights up while its step plays.",
      css: CSS,
      reducedMotion: { at: 3 },
    },
    <>
      {chrome(width, height, "day.tsx", { mono: true, bar: BAR }).node}
      {bars}
      {listing.node}
      <g clipPath={clip}>
        <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} animation={sky} />
        <g transform={origin}>
          <circle r={24} fill={SUN} animation={[sunX, sunY]} />
          <path d={HILLS} fill={LAND} />
        </g>
      </g>
    </>,
  );
}
