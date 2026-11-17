import { highlight } from "@svjeez/code";
import {
  code,
  css as cssTag,
  ease,
  motion,
  render,
  span,
  type CodeTokens,
  type Motion,
} from "svjeez";

import { PERIOD, boing, flash, flip, glance, kick } from "./moves";

import { css, mono, theme } from "../style";
import scene, { frame } from "./scene.tsx";
import { SQUASH, blip, type BlipMotions } from "../site/lib/blip";

const W = 1200;
const H = 675;
const M = 64;

const start = [
  "const hop = motion({ y: 100 })",
  "  .to({ y: 10 }, span(0.4, 0.4), ease.out)",
  "  .to({ y: 100 }, span(0.8, 0.4), ease.in);",
  "",
  "render(frame, blip({",
  "  body: hop,",
  "}));",
];

const edits = [
  { line: 6, text: "  stretch: boing(),", insert: true },
  { line: 7, text: "  glow: flash(),", insert: true },
  { line: 8, text: "  look: glance(),", insert: true },
  { line: 9, text: "  feet: kick(),", insert: true },
  { line: 5, text: "  body: [hop, flip()]," },
];

export interface State {
  readonly lines: readonly string[];
  readonly changed: number;
}

export const states: readonly State[] = edits.reduce<State[]>(
  (all, { line, text, insert }) => {
    const lines = [...all[all.length - 1]!.lines];

    lines.splice(line, insert ? 0 : 1, text);

    all.push({ lines, changed: line });

    return all;
  },
  [{ lines: start, changed: -1 }],
);

// SAFETY: the state's lines are a `blip({...})` call whose props are exactly BlipMotions, and they are written to be run.
export const propsOf = ({ lines }: State) =>
  new Function(
    "motion",
    "span",
    "ease",
    "frame",
    "blip",
    "boing",
    "flash",
    "glance",
    "kick",
    "flip",
    lines
      .join("\n")
      .replace("render(frame, blip(", "return (")
      .replace(/\)\);\s*$/, ");"),
  )(
    motion,
    span,
    ease,
    frame,
    (props: BlipMotions) => props,
    boing,
    flash,
    glance,
    kick,
    flip,
  ) as BlipMotions;

type Layer = Motion<any> | readonly (Motion<any> | false | null | undefined)[] | undefined;

const repeated = (layer: Layer): any =>
  layer === undefined
    ? undefined
    : Array.isArray(layer)
      ? layer.map((m) => m && m.loop(PERIOD))
      : // SAFETY: Array.isArray rules out the array branch, and undefined was handled first, so layer is one Motion.
        (layer as Motion<any>).loop(PERIOD);

export const blipOf = (state: State) => {
  const p = propsOf(state);

  return blip({
    body: repeated(p.body),
    stretch: repeated(p.stretch),
    glow: repeated(p.glow),
    look: repeated(p.look),
    feet: p.feet && { left: repeated(p.feet.left), right: repeated(p.feet.right) },
  });
};

export const fileKb = (new TextEncoder().encode(scene()).length / 1024).toFixed(1);
export const fileLine = `scene.svg · ${fileKb} KB · 0 lines of JS`;

const quiet = {
  ...theme,
  base0B: theme.base06,
  base0A: theme.base06,
  base08: theme.base06,
  base0C: theme.base06,
};

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

const rows = new Map<string, CodeTokens[number]>();

for (const state of states) {
  // SAFETY: highlight returns one token run list per input line, which is the shape CodeTokens names.
  const tokens = highlight(state.lines.join("\n"), "tsx") as CodeTokens;

  state.lines.forEach((text, i) => text && !rows.has(text) && rows.set(text, tokens[i]!));
}

const lineOf = (text: string) => {
  const slots = states.map((s) => slot(s, text));
  const home = slots.find((s) => s >= 0)!;
  const y = (s: number) => (s - home) * LINE;

  let m = motion({ opacity: slots[0]! >= 0 ? 1 : 0, y: y(slots[0]! >= 0 ? slots[0]! : home) });

  const move = (at: number, from: number, to: number) => {
    if (from >= 0 && to >= 0) {
      if (from !== to) m = m.to({ y: y(to) }, span(at, FADE), ease.out);
    } else if (from >= 0) {
      m = m.to({ opacity: 0, y: y(from) - DRIFT }, span(at, FADE), ease.out);
    } else if (to >= 0) {
      m = m.set({ y: y(to) + DRIFT }, at).to({ opacity: 1, y: y(to) }, span(at, FADE), ease.out);
    }
  };

  EDIT.forEach((at, i) => move(at, slots[i]!, slots[i + 1]!));
  move(FILE, slots[slots.length - 1]!, -1);
  move(BACK, -1, slots[0]!);

  return <g animation={m}>{code([rows.get(text)!], { ...style, y: top + home * LINE }).node}</g>;
};

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
        .to({ opacity: 0.2 }, span(at, FADE), ease.out)
        .to({ opacity: 0 }, span(at + 2.6, FADE), ease.out)}
    />
  );
};

const file = code([[fileLine]], { ...style, fontSize: 32, lineHeight: 1.4, y: H / 2 - 22 });

const leave = span(BACK - 0.3, 0.3);

const fileMotion = motion({ opacity: 0, y: DRIFT })
  .to({ opacity: 1, y: 0 }, span(FILE + 0.2, FADE), ease.out)
  .to({ opacity: 0, y: -DRIFT }, leave, ease.out)
  .set({ y: DRIFT }, leave.end);

const blips = states.map((state, i) => {
  const from = i === 0 ? 0 : EDIT[i - 1]!;
  const to = i === states.length - 1 ? BACK : EDIT[i]!;

  let on = motion({ opacity: i === 0 ? 1 : 0 });

  if (i > 0) on = on.set({ opacity: 1 }, from);
  on = on.set({ opacity: 0 }, to);

  if (i === 0) on = on.set({ opacity: 1 }, BACK);

  return <g animation={on}>{blipOf(state)}</g>;
});

const SCALE = 1.9;

const picture = { x: 940 - 104 * SCALE, y: H / 2 - 134 * SCALE };

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Blip",
      desc: "A short svjeez scene makes Blip, the svjeez mascot, hop. Each line of code changes what Blip does: five edits add squash and stretch, a flashing bulb, darting eyes, kicking feet and a flip, and Blip does each at once. The scene compiles to one animated SVG with no JavaScript.",
      reducedMotion: { at: 16 },
      css: cssTag(Object.assign([css, ""], { raw: [css, ""] }), SQUASH),
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />

      <g transform={`translate(${picture.x} ${picture.y}) scale(${SCALE})`}>{blips}</g>

      {states.slice(1).map((state, i) => bar(state, EDIT[i]!))}
      {[...rows.keys()].map(lineOf)}
      <g animation={fileMotion}>{file.node}</g>
    </>,
  );
}
