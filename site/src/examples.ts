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

// The gallery's order, set like a front page: rows of 7 + 5, 4 + 4 + 4, 5 + 7 and 6 + 6, so every row fills the twelve columns.
const ROWS = [
  [
    ["globe", globe, 7],
    ["charts", charts, 5],
  ],
  [
    ["code", code, 4],
    ["math", math, 4],
    ["state", state, 4],
  ],
  [
    ["flowchart", flowchart, 5],
    ["lanes", lanes, 7],
  ],
  [
    ["sequence", sequence, 4],
    ["layout", layout, 4],
    ["icons", icons, 4],
  ],
  [
    ["epicycles", epicycles, 6],
    ["paint", paint, 6],
  ],
  [
    ["type", type, 4],
    ["morph", morph, 4],
    ["springs", springs, 4],
  ],
  [
    ["clips", clips, 7],
    ["count", count, 5],
  ],
  [
    ["derived", derived, 4],
    ["escapement", escapement, 4],
    ["geometry", geometry, 4],
  ],
] as const satisfies readonly (readonly (readonly [string, SceneSource, Span])[])[];

export interface Example {
  readonly name: string;
  readonly span: Span;
  readonly scene: SceneImage;
}

const example = ([name, source, span]: readonly [string, SceneSource, Span]): Example => ({
  name,
  span,
  scene: getScene(source, { posters: { widths: POSTER_WIDTHS, quality: 0.85 } }),
});

export const examples = ROWS.flat().map(example);
