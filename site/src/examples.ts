// The examples gallery: which scenes it shows, in what order, and the posters its cards and pages use.
import { getScene, type SceneImage } from "@svjeez/astro/scene";

export const REPO = "https://github.com/saiashirwad/svjeez";

/** Where the examples' sources live on GitHub. */
export const SOURCES = `${REPO}/tree/main/examples`;

/** The posters' widths in device pixels. A card is at most about 560px wide, so most screens take the small one; the big one is for 2x screens and the example's own page. */
export const POSTER_WIDTH = 1200;
export const SMALL_POSTER_WIDTH = 600;

const SECTIONS = [
  {
    title: "Scenes",
    blurb: "Complete animated scenes, each in a single SVG.",
    names: [
      "earth",
      "cables",
      "map",
      "newspaper",
      "horizon",
      "neon",
      "explainer",
    ],
  },
  {
    title: "Building blocks",
    blurb: "Explore charts, diagrams, code, equations, fonts, and effects.",
    names: [
      "charts",
      "code",
      "math",
      "flowchart",
      "sequence",
      "state",
      "lanes",
      "terminal",
      "effects",
      "fonts",
      "images",
    ],
  },
] as const;

export interface Example {
  readonly name: string;
  readonly scene: SceneImage;
  /** The same scene with posters at `SMALL_POSTER_WIDTH`. */
  readonly small: SceneImage;
}

// The dom example is not in the gallery, and it imports Tailwind, whose native binary the site's bundle cannot load.
const modules = import.meta.glob<() => string>(["../../examples/*/index.tsx", "!../../examples/dom/index.tsx"], {
  eager: true,
  import: "default",
});

const example = (name: string): Example => {
  const build = modules[`../../examples/${name}/index.tsx`];

  if (!build) throw new Error(`No example named ${name} in examples/.`);
  const { width } = getScene(build);

  return {
    name,
    scene: getScene(build, { posters: { scale: POSTER_WIDTH / width, quality: 0.85 } }),
    small: getScene(build, { posters: { scale: SMALL_POSTER_WIDTH / width, quality: 0.85 } }),
  };
};

export const sections = SECTIONS.map((section) => ({
  ...section,
  examples: section.names.map(example),
}));

export const examples = sections.flatMap((section) => section.examples);
