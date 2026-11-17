// The examples gallery: which scenes it shows, in what order, and the posters its cards and pages use.
import { getScene, type SceneImage } from "@svjeez/astro/scene";

export const REPO = "https://github.com/saiashirwad/svjeez";

/** Where the examples' sources live on GitHub. */
export const SOURCES = `${REPO}/tree/main/examples`;

/** The posters' widths in device pixels. A card is at most about 606px wide, so most screens take the small one; the big one is for 2x screens and the example's own page. */
export const POSTER_WIDTH = 1200;
export const SMALL_POSTER_WIDTH = 600;

/** Laid out like a front page, strongest scenes first: a wide and a narrow card, then three, and again, on the site's
 * twelve columns. The wide slots go to scenes that need the room. Order carries the layout, so a new example needs a slot. */
const NAMES: readonly (readonly [string, Span])[] = [
  ["earth", 7],
  ["cables", 5],
  ["map", 4],
  ["newspaper", 4],
  ["horizon", 4],
  ["explainer", 5],
  ["charts", 7],
  ["code", 4],
  ["math", 4],
  ["terminal", 4],
  ["flowchart", 7],
  ["state", 5],
  ["sequence", 4],
  ["lanes", 4],
  ["effects", 4],
  ["fonts", 6],
  ["images", 6],
  ["metrics", 4],
  ["leaderboard", 4],
  ["release-card", 4],
];

/** How many of the twelve columns a card takes on a wide screen. */
export type Span = 4 | 5 | 6 | 7;

export interface Example {
  readonly name: string;
  readonly span: Span;
  readonly scene: SceneImage;
  /** The same scene with posters at `SMALL_POSTER_WIDTH`. */
  readonly small: SceneImage;
}

// The dom example is not in the gallery, and it imports Tailwind, whose native binary the site's bundle cannot load.
const modules = import.meta.glob<() => string>(
  ["../../examples/*/index.tsx", "!../../examples/dom/index.tsx"],
  {
    eager: true,
    import: "default",
  },
);

const example = ([name, span]: readonly [string, Span]): Example => {
  const build = modules[`../../examples/${name}/index.tsx`];

  if (!build) throw new Error(`No example named ${name} in examples/.`);
  const { width } = getScene(build);

  return {
    name,
    span,
    scene: getScene(build, { posters: { scale: POSTER_WIDTH / width, quality: 0.85 } }),
    small: getScene(build, { posters: { scale: SMALL_POSTER_WIDTH / width, quality: 0.85 } }),
  };
};

export const examples = NAMES.map(example);
