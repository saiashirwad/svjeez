import { highlight } from "@svjeez/code";
import { code, css as cssTag, ease, motion, render, type CodeTokens, type Motion } from "svjeez";

import { PERIOD, boing, flash, flip, glance, kick } from "./moves";

import { css, mono, theme } from "../style";
import scene, { frame } from "./scene.tsx";
import { SQUASH, chick, type ChickMotions } from "../site/lib/chick";

// Edit a scene and the SVG does what the code says. The left side is scene.tsx's hop, edited five times. Each edit swaps
// or adds one whole line, and at that moment the chick on the right plays the edited code. Every state is built from
// the same lines in `states`: they are what the left shows and, evaluated, what the right plays.
// examples/tests/explainer.test.tsx checks that each state compiles and that what plays is what it shows.

const W = 1200;
const H = 675;
const M = 64;

/** The hop and the render call as scene.tsx writes them, for the shown part of the file. */
const start = [
  "const hop = motion({ y: 100 })",
  "  .at(0.4).to({ y: 10 }, 0.4, ease.out)",
  "  .to({ y: 100 }, 0.4, ease.in);",
  "",
  "render(frame, chick({",
  "  body: hop,",
  "}));",
];

/** Each edit swaps the line at `line`, or inserts before it when `insert` is set. */
const edits = [
  { line: 6, text: "  stretch: boing(),", insert: true },
  { line: 7, text: "  glow: flash(),", insert: true },
  { line: 8, text: "  look: glance(),", insert: true },
  { line: 9, text: "  feet: kick(),", insert: true },
  { line: 5, text: "  body: [hop, flip()]," },
];

export interface State {
  readonly lines: readonly string[];
  /** The line the edit touched, 0-based, or -1 for the start. */
  readonly changed: number;
}

export const states: readonly State[] = edits.reduce<State[]>(
  (all, { line, text, insert }) => {
    const lines = [...all[all.length - 1]!.lines];

    lines.splice(line, insert ? 0 : 1, text);

    return [...all, { lines, changed: line }];
  },
  [{ lines: start, changed: -1 }],
);

/** What the chick plays: the props a state's lines write. They are run, so what plays is what is shown. */
export const propsOf = ({ lines }: State) =>
  new Function(
    "motion",
    "ease",
    "frame",
    "chick",
    "boing",
    "flash",
    "glance",
    "kick",
    "flip",
    lines
      .join("\n")
      .replace("render(frame, chick(", "return (")
      .replace(/\)\);\s*$/, ");"),
  )(
    motion,
    ease,
    frame,
    (props: ChickMotions) => props,
    boing,
    flash,
    glance,
    kick,
    flip,
  ) as ChickMotions;

type Layer = Motion<any> | readonly (Motion<any> | false | null | undefined)[] | undefined;

const repeated = (layer: Layer): any =>
  layer === undefined
    ? undefined
    : Array.isArray(layer)
      ? layer.map((m) => m && m.loop(PERIOD))
      : (layer as Motion<any>).loop(PERIOD);

/** The chick the explainer shows for a state: the same props, each looping on the scene's clock. */
export const chickOf = (state: State) => {
  const p = propsOf(state);

  return chick({
    body: repeated(p.body),
    stretch: repeated(p.stretch),
    glow: repeated(p.glow),
    look: repeated(p.look),
    feet: p.feet && { left: repeated(p.feet.left), right: repeated(p.feet.right) },
  });
};

/** The size of the file on disk, to a tenth of a KB. */
export const fileKb = (new TextEncoder().encode(scene()).length / 1024).toFixed(1);
export const fileLine = `scene.svg · ${fileKb} KB · 0 lines of JS`;

/** Two tones and one accent: names and values are ink, punctuation and keywords recede. */
const quiet = {
  ...theme,
  base0E: theme.base04,
  base0D: theme.base06,
  base0B: theme.base06,
  base09: theme.base06,
  base0A: theme.base06,
  base08: theme.base06,
  base0C: theme.base06,
};

/** The one accent, and only the highlight uses it. */
const accent = theme.base0D;

const FONT = 26;
const LINE = 46;
const SLOTS = Math.max(...states.map((s) => s.lines.length));
const top = (H - SLOTS * LINE) / 2;

const style = { x: M, y: top, fontSize: FONT, lineHeight: LINE / FONT, theme: quiet, font: mono };

/** The clock, in seconds. Each state holds two hops. */
const EDIT = [3, 6, 9, 12, 15] as const;
const FILE = 18;
const BACK = 21;
const D = 22.5;
const FADE = 0.4;
const DRIFT = 10;

const slot = (state: State, text: string) => state.lines.indexOf(text);

/** Every distinct line once, with the tokens it is drawn from. */
const rows = new Map<string, CodeTokens[number]>();

for (const state of states) {
  const tokens = highlight(state.lines.join("\n"), "tsx") as CodeTokens;

  state.lines.forEach((text, i) => text && !rows.has(text) && rows.set(text, tokens[i]!));
}

/** A line is drawn once, at the first slot it holds, and slides or fades from there. */
const lineOf = (text: string) => {
  const slots = states.map((s) => slot(s, text));
  const home = slots.find((s) => s >= 0)!;
  const y = (s: number) => (s - home) * LINE;

  let m = motion({ opacity: slots[0]! >= 0 ? 1 : 0, y: y(slots[0]! >= 0 ? slots[0]! : home) });

  const move = (at: number, from: number, to: number) => {
    if (from >= 0 && to >= 0) {
      if (from !== to) m = m.at(at).to({ y: y(to) }, FADE, ease.out);
    } else if (from >= 0) {
      m = m.at(at).to({ opacity: 0, y: y(from) - DRIFT }, FADE, ease.out);
    } else if (to >= 0) {
      m = m
        .at(at)
        .set({ y: y(to) + DRIFT })
        .to({ opacity: 1, y: y(to) }, FADE, ease.out);
    }
  };

  EDIT.forEach((at, i) => move(at, slots[i]!, slots[i + 1]!));
  move(FILE, slots[slots.length - 1]!, -1);
  move(BACK, -1, slots[0]!);

  return <g animation={m}>{code([rows.get(text)!], { ...style, y: top + home * LINE }).node}</g>;
};

/** A soft bar behind exactly the changed line: its text's left edge to its right edge, evenly padded. */
const PAD = 14;
const mark = code("", style).metrics.advance;

const bar = ({ lines, changed }: State, at: number) => {
  const text = lines[changed]!;
  const indent = text.length - text.trimStart().length;
  const h = LINE - 8;

  return (
    <rect
      x={M + indent * mark - PAD}
      y={top + changed * LINE + (LINE - h) / 2}
      width={text.trim().length * mark + 2 * PAD}
      height={h}
      rx={6}
      fill={accent}
      animation={motion({ opacity: 0 })
        .at(at)
        .to({ opacity: 0.2 }, FADE, ease.out)
        .at(at + 2.6)
        .to({ opacity: 0 }, FADE, ease.out)}
    />
  );
};

/** The file line replaces the code once the edits are done. */
const file = code([[fileLine]], { ...style, fontSize: 32, lineHeight: 1.4, y: H / 2 - 22 });

const fileMotion = motion({ opacity: 0, y: DRIFT })
  .at(FILE + 0.2)
  .to({ opacity: 1, y: 0 }, FADE, ease.out)
  .at(BACK - 0.3)
  .to({ opacity: 0, y: -DRIFT }, 0.3, ease.out)
  .set({ y: DRIFT });

/** Each state's chick is on from its edit until the next, and swaps at the hops' rest. The last gives way to the first as the code returns. */
const chicks = states.map((state, i) => {
  const from = i === 0 ? 0 : EDIT[i - 1]!;
  const to = i === states.length - 1 ? BACK : EDIT[i]!;

  let on = motion({ opacity: i === 0 ? 1 : 0 });

  if (i > 0) on = on.at(from).set({ opacity: 1 });
  on = on.at(to).set({ opacity: 0 });
  if (i === 0) on = on.at(BACK).set({ opacity: 1 });

  return <g animation={on}>{chickOf(state)}</g>;
});

const SCALE = 1.9;
/** The chick's whole travel, from the flip's top to the feet, is about y 0 to 268 of the scene, and a flip reaches 82 either side of its middle. It centers on the code block's middle, in the space the code leaves, with the right margin the code has on the left. */
const picture = { x: 940 - 104 * SCALE, y: H / 2 - 134 * SCALE };

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Explainer",
      desc: "A short svjeez scene makes a chick hop. Five edits, each one line of code, add squash and stretch, a flashing bulb, darting eyes, kicking feet and a flip, and the chick does each at once. The scene compiles to one animated SVG with no JavaScript.",
      reducedMotion: { at: 16 },
      css: cssTag(Object.assign([css, ""], { raw: [css, ""] }), SQUASH),
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />

      <g transform={`translate(${picture.x} ${picture.y}) scale(${SCALE})`}>{chicks}</g>

      {states.slice(1).map((state, i) => bar(state, EDIT[i]!))}
      {[...rows.keys()].map(lineOf)}
      <g animation={fileMotion}>{file.node}</g>
    </>,
  );
}
