// The examples gallery: which scenes it shows, in what order, and the posters its cards and pages use.
import { getScene, type SceneImage } from "@svjeez/astro/scene";

export const REPO = "https://github.com/saiashirwad/svjeez";

/** Where the examples' sources live on GitHub. */
export const SOURCES = `${REPO}/tree/main/examples`;

/** A poster's width in device pixels: a card is at most about 560px wide on a phone, and screens draw it at 2x or more. */
export const POSTER_WIDTH = 1200;

const SECTIONS = [
  {
    title: "Scenes",
    blurb: "Complete animated scenes, each in a single SVG.",
    names: [
      "earth",
      "cables",
      "map",
      "world",
      "newspaper",
      "horizon",
      "lighthouse",
      "minecraft",
      "breaker",
      "neon",
      "explainer",
    ],
  },
  {
    title: "Building blocks",
    blurb: "Explore charts, diagrams, code, equations, fonts, and effects.",
    names: [
      "charts",
      "mermaid",
      "code",
      "math",
      "flowchart",
      "sequence",
      "state",
      "tree",
      "lanes",
      "flows",
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
}

const modules = import.meta.glob<() => string>("../../examples/*/index.tsx", {
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
  };
};

export const sections = SECTIONS.map((section) => ({
  ...section,
  examples: section.names.map(example),
}));

export const examples = sections.flatMap((section) => section.examples);
