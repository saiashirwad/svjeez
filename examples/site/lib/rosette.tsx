import { draw, ease, enter, motion, rect, render, type Ease, type SvgNode } from "svjeez";
import { code, morph, type CodeTokens } from "svjeez/extras";
import { CSS, highlight, outro, theme } from "../kit";

// The home page hero: a few lines of TSX beside the scene they make. Four values in the code change one after another,
// each swapped in place with a short flash, and the scene replays with the new value. All of it is one timeline in one file,
// so the code and the picture can never drift apart. The code on screen is generated from the same numbers the scene draws with.

const BLUE = "#0A6CFF" as const;
const ORANGE = "#FF9F0A" as const;
type Dials = { n: number; over: number; color: typeof BLUE | typeof ORANGE; ease: "out" | "pop" };
const PHASES: readonly Dials[] = [
  { n: 6, over: 1.5, color: BLUE, ease: "out" },
  { n: 9, over: 1.5, color: BLUE, ease: "out" },
  { n: 9, over: 1.5, color: ORANGE, ease: "out" },
  { n: 9, over: 1.5, color: ORANGE, ease: "pop" },
  { n: 9, over: 0.4, color: ORANGE, ease: "pop" },
];
const ids = ["n", "over", "color", "ease"] as const;
type Dial = (typeof ids)[number];
const text = (d: Dials): Record<Dial, string> => ({ n: String(d.n), over: String(d.over), color: `"${d.color}"`, ease: d.ease });

const wide = [
  "const n = @n@;",
  "const over = @over@;",
  "const color = @color@;",
  "",
  "{Array.from({ length: n }, (_, i) => (",
  "  <path d={petal} stroke={color}",
  "    transform={`rotate(${(360 / n) * i})`}",
  "    animation={draw({ at: i / 10, over })} />",
  "))}",
  "<circle r={16} fill={color}",
  "  animation={enter({ at: 0, over }, { scale: 0 }, ease.@ease@)} />",
];
const tall = [
  "const n = @n@;",
  "const over = @over@;",
  "const color = @color@;",
  "",
  "{Array.from({ length: n }, (_, i) => (",
  "  <path d={petal} stroke={color}",
  "    transform={`rotate(${(360 / n) * i})`}",
  "    animation={draw({ at: i / 10, over })} />",
  "))}",
  "<circle r={16} fill={color}",
  "  animation={enter({ at: 0, over },",
  "    { scale: 0 }, ease.@ease@)} />",
];

/** The source text for one set of values. */
export const source = (layout: "wide" | "tall", d: Dials): string => {
  const t = text(d);
  return (layout === "wide" ? wide : tall).map((line) => line.replace(/@(n|over|color|ease)@/g, (_, k: Dial) => t[k])).join("\n");
};

const DIAL_LINE: Record<Dial, RegExp> = { n: /^const n = /, over: /^const over = /, color: /^const color = /, ease: /ease\./ };

/** Highlights the source and names each dial's value token, so `morph` swaps it in place. */
const tokens = (layout: "wide" | "tall", d: Dials): CodeTokens => {
  const lines = source(layout, d).split("\n");
  const t = text(d);
  return highlight(lines.join("\n")).map((row, i) => {
    const dial = ids.find((k) => DIAL_LINE[k].test(lines[i]!));
    return row.map((piece) => {
      if (!dial) return piece;
      const content = typeof piece === "string" ? piece : Array.isArray(piece) ? piece[1] : (piece as { content: string }).content;
      return content === t[dial] ? (["number", content, dial] as const) : piece;
    });
  });
};

// A leaf from the middle outward and back. Spaced so nine of them overlap and six only touch.
const PETAL = "M0 0C52 -40 52 -118 0 -160C-52 -118 -52 -40 0 0Z";
const STEP = 0.1;
const LEAD = 0.35;
const HOLD = 0.9;

const curves: Record<Dials["ease"], Ease> = { out: ease.out, pop: ease.pop };

/** One replay of the scene, drawn from `at` with the dials' values. */
const Rosette = ({ at, d }: { at: number; d: Dials }) => (
  <g>
    {Array.from({ length: d.n }, (_, i) => (
      <path d={PETAL} fill="none" stroke={d.color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${(360 / d.n) * i})`} animation={draw({ at: at + i * STEP, over: d.over })} />
    ))}
    <circle r={16} fill={d.color} animation={enter({ at, over: d.over }, { scale: 0 }, curves[d.ease])} />
  </g>
);

export interface Layout {
  readonly name: "wide" | "tall";
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  /** Top-left of the code. */
  readonly code: { readonly x: number; readonly y: number };
  /** Rounded panel and the rosette's center. */
  readonly panel: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly scale: number;
}

export function rosette(layout: Layout): string {
  const { name, width, height, fontSize, panel } = layout;
  const opts = { theme, fontSize, lineHeight: 1.75, x: layout.code.x, y: layout.code.y };
  const versions = PHASES.map((d) => code(tokens(name, d), opts));

  const starts: number[] = [];
  let cursor = 0.6;
  for (const d of PHASES) {
    starts.push(cursor);
    cursor += d.over + (d.n - 1) * STEP + HOLD + LEAD;
  }
  const swaps = starts.slice(1).map((s) => s - LEAD);
  const last = starts.at(-1)!;
  const D = Math.ceil(last + PHASES.at(-1)!.over + (PHASES.at(-1)!.n - 1) * STEP + 1.8 + 0.5);
  const hold = last + PHASES.at(-1)!.over + (PHASES.at(-1)!.n - 1) * STEP + 0.6;

  const moved = morph(versions, { at: swaps, over: 0.2 });
  const flashes = swaps.map((at, k) => {
    const dial = ids.find((id) => text(PHASES[k]!)[id] !== text(PHASES[k + 1]!)[id])!;
    const box = versions[k + 1]!.get(dial).pad(3);
    return (
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={5} fill="#34C759" fillOpacity={0.3} animation={motion({ opacity: 0 }).at(at).to({ opacity: 1 }, 0.08).wait(0.25).to({ opacity: 0 }, 0.9)} />
    );
  });
  const layers: SvgNode[] = PHASES.map((d, k) => {
    const shown = motion({ opacity: 0 }).at(starts[k]! - 0.1).to({ opacity: 1 }, 0.05);
    const gone = k < PHASES.length - 1 ? shown.at(swaps[k]!).to({ opacity: 0 }, 0.2) : shown;
    return <g animation={gone}><Rosette at={starts[k]!} d={d} /></g>;
  });

  return render(
    {
      width,
      height,
      duration: D,
      title: "svjeez live tweaking",
      desc: "A short TSX scene beside the animation it makes. Four values change in turn, the number of petals, the draw time, the color and the easing of the center dot, and each time the animation replays with the new value.",
      css: CSS,
      reducedMotion: { at: hold },
    },
    <>
      <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={20} fill={theme.base01} />
      <g animation={outro(D)}>
        <g class="mono" animation={enter({ at: 0.1, over: 0.45 }, { opacity: 0, y: 6 })}>
          {moved.node}
          {flashes}
        </g>
        <g transform={`translate(${panel.x + panel.w / 2} ${panel.y + panel.h / 2}) scale(${layout.scale})`}>{layers}</g>
      </g>
    </>,
  );
}
