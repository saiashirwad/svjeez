import { Code, codeLayout, codeTokens, lines, ts } from "@svjeez/code";
import { palette } from "@svjeez/code/palettes";
import {
  Group,
  Shape,
  alpha,
  ease,
  enter,
  exit,
  morph,
  rect,
  span,
  track,
  type Color,
  type Paint,
  type Track,
  type Span,
  type SceneElement,
} from "svjeez";
import { Caption, Chapter, H, W, clay, horizon, ivory, mono, slate } from "../kit";
import { Pelican, type Look } from "../rig";

export const SOURCE = 7;

/**
 * Two looks, defined once. The code on the card is generated from them and so is the pelican, so what you read is what
 * you see. Only colors are listed here; `width` and `detail` are the same in both.
 */
interface Colors {
  readonly line: Color;
  readonly body: Color;
  readonly wing: Color;
  readonly beak: Color;
  readonly pouch: Color;
  readonly frame: Color;
  readonly tyre: Color;
}

const studio: Colors = {
  line: "#A39887",
  body: "#F6F2EA",
  wing: "#E9E3D8",
  beak: "#E9963A",
  pouch: "#E58A3E",
  frame: "#2F5D62",
  tyre: "#1D1B19",
};

const riso: Colors = {
  line: "#1B2A6B",
  body: "#CFE0FF",
  wing: "#9DBBF7",
  beak: "#FF48B0",
  pouch: "#FF7CC4",
  frame: "#0078BF",
  tyre: "#1B2A6B",
};

/** A soft dark editor theme, the same in both color schemes, so the card reads on the ivory page. */
const EDITOR = "#1F1E1B";

const ink = {
  plain: "#E6E1D6",
  comment: "#8F8A7E",
  punctuation: "#B0AB9E",
  keyword: "#E58A68",
  string: "#E8C277",
  number: "#F2A07B",
  constant: "#F2A07B",
  variable: "#8FB8DE",
  function: "#8FB8DE",
  type: "#B7A6E8",
  attribute: "#8FB8DE",
  tag: "#E58A68",
  inserted: "#8FCB8F",
  deleted: "#E58A8A",
} as const;

const editor = palette("editor", { light: ink, dark: ink });

const TYPE: Span = span(0.8, 2.6);
const SWAP: Span = span(4.3, 1.3);

/** The source text of a look, one property per line. */
const render = (name: string, look: Colors): string =>
  [
    `import type { Look } from "./rig";`,
    ``,
    `export const ${name}: Look = {`,
    ...Object.entries(look).map(([key, value]) => `  ${key}: "${value}",`),
    `  width: 0.4,`,
    `  detail: true,`,
    `};`,
  ].join("\n");

const before = render("studio", studio);
const after = render("risoBlue", riso);

/** One of the pelican's paints: a track from its color in the first look to its color in the second. */
const fade = (key: keyof Colors): Track<Paint> =>
  track<Paint>(studio[key]).to(riso[key], SWAP, ease.inOut);

const dressed: Look = {
  line: fade("line"),
  body: fade("body"),
  wing: fade("wing"),
  beak: fade("beak"),
  pouch: fade("pouch"),
  frame: fade("frame"),
  tyre: fade("tyre"),
  width: 0.4,
  detail: true,
  far: 0.8,
};

const style = {
  font: mono,
  size: 21,
  lineHeight: 1.6,
  at: [336, 400] as const,
  anchor: [0.5, 0.5] as const,
};

const layout = codeLayout(style, before);
const codeAt = layout.origin;

/** Lines that differ between the two sources: where the highlight goes. */
const changed = before.split("\n").flatMap((text, i) => (text === after.split("\n")[i] ? [] : [i]));

const state = (source: string, typing?: Span): SceneElement => (
  <Code
    key={typing ? "typed" : "source"}
    lang={ts}
    font={mono}
    size={style.size}
    lineHeight={style.lineHeight}
    palette={editor}
    at={codeAt}
    by={typing ? lines : codeTokens.across(before, after)}
    typing={typing}
  >
    {source}
  </Code>
);

const ground = horizon(470, 1800);
const rider = ground.at(930);
const card = layout.bounds;

export const Source = (): SceneElement => (
  <Group>
    <Shape geometry={rect(W, H)} fill={ivory} />
    {/* The ground runs behind the editor card. */}
    <Shape
      key="horizon"
      geometry={ground.visible(ground.reach)}
      offset={ground.center}
      stroke={{ color: alpha(slate, 0.5), width: 1 }}
    />
    <Group
      motion={enter(span(0.2, 0.7), { from: { opacity: 0, offset: [0, 14] }, curve: ease.out })}
    >
      <Shape
        geometry={rect(card.width + 64, card.height + 56, { radius: 14 })}
        offset={[card.x - 32, card.y - 28]}
        fill={EDITOR}
      />
      {changed.map((line) => {
        const box = layout.box(line);

        return (
          <Shape
            key={line}
            geometry={rect(box.width + 20, box.height, { radius: 5 })}
            offset={[box.x - 10, box.y]}
            fill={clay}
            opacity={track(0)
              .to(0.3, span(SWAP.start - 0.2, 0.3))
              .to(0, span(SWAP.start + SWAP.over + 0.3, 0.6))}
          />
        );
      })}
      {/* typing clips can't morph (see report), so the typed listing hands off to the token-keyed morph at the same pixels */}
      <Group motion={exit(span(SWAP.start, 0.05))}>{state(before, TYPE)}</Group>
      <Group motion={enter(span(SWAP.start - 0.05, 0.05))}>
        {morph(state(before), state(after), SWAP, { curve: ease.inOut })}
      </Group>
    </Group>
    <Group offset={[0, 0]}>
      <Group offset={[rider.point[0], rider.point[1] + 2]} rotate={rider.angle} origin="own">
        <Group scale={1.6} origin="own">
          <Pelican look={dressed} phase={0} />
        </Group>
      </Group>
    </Group>
    <Chapter numeral="VIII" medium="Source" fill={slate} length={SOURCE} />
    <Caption when={[1.2, 4.6]} fill={slate}>
      Some days, you read the instructions.
    </Caption>
  </Group>
);
