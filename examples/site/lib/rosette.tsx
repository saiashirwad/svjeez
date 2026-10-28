import { draw, motion, render, type SvgNode } from "svjeez";
import { code, type CodeRole, type CodeTokens } from "svjeez/extras";
import { CSS, highlight, outro, theme } from "../kit";

// The home page hero: a few lines of TSX beside the flower they draw, in one card. Three values in the code change one
// after another, each swapped in place under a soft tint, and the flower draws itself again with the new value.
// The code on screen is generated from the same numbers the scene draws with, so the two can never drift apart.

const BLUE = "#0A6CFF" as const;
const ORANGE = "#FF9F0A" as const;
type Dials = { petals: number; color: typeof BLUE | typeof ORANGE; over: number };
const PHASES: readonly Dials[] = [
  { petals: 6, color: BLUE, over: 1.5 },
  { petals: 9, color: BLUE, over: 1.5 },
  { petals: 9, color: ORANGE, over: 1.5 },
  { petals: 9, color: ORANGE, over: 0.5 },
];
const ids = ["petals", "color", "over"] as const;
type Dial = (typeof ids)[number];
const text = (d: Dials): Record<Dial, string> => ({ petals: String(d.petals), color: `"${d.color}"`, over: String(d.over) });

const TEMPLATE = [
  "const petals = @petals@;",
  "const color = @color@;",
  "const over = @over@;",
  "",
  "{Array.from({ length: petals }, (_, i) => (",
  "  <path d={petal} stroke={color}",
  "    transform={`rotate(${(i * 360) / petals})`}",
  "    animation={draw({ at: i / 10, over })} />",
  "))}",
];

/** The source text for one set of values. */
export const source = (d: Dials): string => {
  const t = text(d);
  return TEMPLATE.map((line) => line.replace(/@(petals|color|over)@/g, (_, k: Dial) => t[k])).join("\n");
};

const DIAL_LINE: Record<Dial, RegExp> = { petals: /^const petals = /, color: /^const color = /, over: /^const over = / };

/** Highlights the source and names each dial's value token. With `blank` the dial values are left as spaces, so they can be laid over the static text. */
const tokens = (d: Dials, blank = false): CodeTokens => {
  const lines = source(d).split("\n");
  const t = text(d);
  return highlight(lines.join("\n")).map((row, i) => {
    const dial = ids.find((k) => DIAL_LINE[k].test(lines[i]!));
    return row.map((piece) => {
      if (!dial) return piece;
      const content = typeof piece === "string" ? piece : Array.isArray(piece) ? piece[1] : (piece as { content: string }).content;
      return content === t[dial] ? (blank ? " ".repeat(content.length) : (["number", content, dial] as const)) : piece;
    });
  });
};

// A leaf that starts a little off the middle, so the petals leave a clean ring at the center instead of a knot of lines.
const PETAL = "M0 -18C46 -50 46 -118 0 -150C-46 -118 -46 -50 0 -18Z";
const STEP = 0.1;
const LEAD = 0.35;
const HOLD = 1.1;

/** One replay of the flower, drawn from `at` with the dials' values. */
const Flower = ({ at, d }: { at: number; d: Dials }) => (
  <g>
    {Array.from({ length: d.petals }, (_, i) => (
      <path d={PETAL} fill="none" stroke={d.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${(i * 360) / d.petals})`} animation={draw({ at: at + i * STEP, over: d.over })} />
    ))}
  </g>
);

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  /** Top-left of the code. */
  readonly code: { readonly x: number; readonly y: number };
  /** The flower's center and scale. */
  readonly flower: { readonly x: number; readonly y: number; readonly scale: number };
  /** The hairline between the code and the flower. */
  readonly rule: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };
}

export function rosette(layout: Layout): string {
  const { width, height, fontSize, flower, rule } = layout;
  const opts = { theme, fontSize, lineHeight: 1.8, x: layout.code.x, y: layout.code.y };
  const versions = PHASES.map((d) => code(tokens(d), opts));
  const drawn = (d: Dials) => d.over + (d.petals - 1) * STEP;

  const starts: number[] = [];
  let cursor = 0.6;
  for (const d of PHASES) {
    starts.push(cursor);
    cursor += drawn(d) + HOLD + LEAD;
  }
  const swaps = starts.slice(1).map((s) => s - LEAD);
  const last = starts.at(-1)! + drawn(PHASES.at(-1)!);
  const D = Math.ceil(last + 2.2);

  // The code is static except for the dial values, so only those are animated: each distinct value is its own piece of text, laid over a blank, and switched on and off in turn.
  const still = code(tokens(PHASES[0]!, true), opts);
  const roles = Object.fromEntries(ids.map((dial) => [dial, (tokens(PHASES[0]!).flat().find((piece) => Array.isArray(piece) && piece[2] === dial) as readonly [CodeRole, string, string])[0]])) as Record<Dial, CodeRole>;
  const values = ids.flatMap((dial) =>
    PHASES.flatMap((d, k) => {
      const value = text(d)[dial];
      if (k > 0 && value === text(PHASES[k - 1]!)[dial]) return [];
      const next = PHASES.findIndex((e, j) => j > k && text(e)[dial] !== value);
      const word = versions[k]!.words.find((w) => w.id === dial)!;
      let shown = motion({ opacity: k === 0 ? 1 : 0 });
      if (k > 0) shown = shown.at(swaps[k - 1]!).to({ opacity: 1 }, 0.2);
      if (next > 0) shown = shown.at(swaps[next - 1]!).to({ opacity: 0 }, 0.2);
      return [<g animation={shown}>{code([[[roles[dial], value]]], { ...opts, x: word.x, y: word.y }).node}</g>];
    }),
  );
  // A soft tint behind the value that just changed, in the color the flower is about to be drawn in.
  const tints = swaps.map((at, k) => {
    const dial = ids.find((id) => text(PHASES[k]!)[id] !== text(PHASES[k + 1]!)[id])!;
    const box = versions[k + 1]!.get(dial).pad(3);
    return (
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill={PHASES[k + 1]!.color} fillOpacity={0.14} animation={motion({ opacity: 0 }).at(at).to({ opacity: 1 }, 0.15).wait(0.6).to({ opacity: 0 }, 0.8)} />
    );
  });
  const layers: SvgNode[] = PHASES.map((d, k) => {
    const shown = motion({ opacity: 0 }).at(starts[k]! - 0.1).to({ opacity: 1 }, 0.05);
    const gone = k < PHASES.length - 1 ? shown.at(swaps[k]!).to({ opacity: 0 }, 0.3) : shown;
    return <g animation={gone}><Flower at={starts[k]!} d={d} /></g>;
  });

  return render(
    {
      width,
      height,
      duration: D,
      title: "svjeez live tweaking",
      desc: "A short TSX scene beside the flower it draws. Three values change in turn, the number of petals, the color and the draw time, and each time the flower draws itself again with the new value.",
      css: CSS,
      reducedMotion: { at: last + 0.3 },
    },
    <>
      <rect x={0.5} y={0.5} width={width - 1} height={height - 1} rx={20} fill={theme.base01} />
      <line {...rule} stroke={theme.base02} strokeWidth={1} />
      <g animation={outro(D)}>
        <g class="mono">
          {tints}
          {still.node}
          {values}
        </g>
        <g transform={`translate(${flower.x} ${flower.y}) scale(${flower.scale})`}>{layers}</g>
      </g>
    </>,
  );
}
