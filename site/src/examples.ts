import { getScene, type SceneImage, type SceneSource } from "@svjeez/astro/scene";
import charts from "@examples/charts/index.tsx";
import clips from "@examples/clips/index.tsx";
import code from "@examples/code/index.tsx";
import count from "@examples/count/index.tsx";
import derived from "@examples/derived/index.tsx";
import epicycles from "@examples/epicycles/index.tsx";
import escapement from "@examples/escapement/index.tsx";
import flowchart from "@examples/flowchart/index.tsx";
import geometry from "@examples/geometry/index.tsx";
import globe from "@examples/globe/index.tsx";
import icons from "@examples/icons/index.tsx";
import lanes from "@examples/lanes/index.tsx";
import layout from "@examples/layout/index.tsx";
import math from "@examples/math/index.tsx";
import morph from "@examples/morph/index.tsx";
import paint from "@examples/paint/index.tsx";
import sequence from "@examples/sequence/index.tsx";
import springs from "@examples/springs/index.tsx";
import state from "@examples/state/index.tsx";
import type from "@examples/type/index.tsx";

export const REPO = "https://github.com/saiashirwad/svjeez";

export const SOURCES = `${REPO}/tree/main/examples`;

/** The posters' widths in device pixels. A card is at most about 606px wide, so most screens take the small one; the big one is for 2x screens and the example's own page. */
export const POSTER_WIDTHS = [600, 1200] as const;

/** How many of the gallery's twelve columns a card takes. */
export type Span = 4 | 5 | 6 | 7;

/** Every example on the site, by its folder name in `examples/`: the id its page, card and source link go by. */
const SCENES = {
  charts,
  clips,
  code,
  count,
  derived,
  epicycles,
  escapement,
  flowchart,
  geometry,
  globe,
  icons,
  lanes,
  layout,
  math,
  morph,
  paint,
  sequence,
  springs,
  state,
  type,
} satisfies Record<string, SceneSource>;

export type ExampleName = keyof typeof SCENES;

const ROWS: readonly (readonly (readonly [ExampleName, Span])[])[] = [
  [
    ["globe", 7],
    ["charts", 5],
  ],
  [
    ["code", 4],
    ["math", 4],
    ["state", 4],
  ],
  [
    ["flowchart", 5],
    ["lanes", 7],
  ],
  [
    ["sequence", 4],
    ["layout", 4],
    ["icons", 4],
  ],
  [
    ["epicycles", 6],
    ["paint", 6],
  ],
  [
    ["type", 4],
    ["morph", 4],
    ["springs", 4],
  ],
  [
    ["clips", 7],
    ["count", 5],
  ],
  [
    ["derived", 4],
    ["escapement", 4],
    ["geometry", 4],
  ],
];

/**
 * When a card takes its picture, for an example whose still moment does not show what it is about: epicycles holds the
 * finished pi, so its card catches the circles still tracing it.
 */
const MOMENTS: Partial<Record<ExampleName, number>> = { epicycles: 9.5 };

export interface Example {
  readonly name: ExampleName;
  readonly span: Span;
  readonly scene: SceneImage;
  /** When its link-preview card takes its picture, in seconds. The scene's still moment if not set. */
  readonly moment?: number;
}

export const examples: readonly Example[] = ROWS.flat().map(([name, span]) => ({
  name,
  span,
  scene: getScene(SCENES[name], { posters: { widths: POSTER_WIDTHS, quality: 0.85 } }),
  moment: MOMENTS[name],
}));

/** The example with this name, and its neighbors in the gallery's order (wrapping around). */
export const example = (name: string) => {
  const i = examples.findIndex((example) => example.name === name);

  if (i < 0) throw new Error(`No example is called ${name}.`);

  const at = (j: number) => examples[(j + examples.length) % examples.length]!;

  return { ...at(i), prev: at(i - 1), next: at(i + 1) };
};
