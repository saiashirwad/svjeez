// The examples gallery: which scenes it shows, in what order, and the posters its cards and pages use.
import { getScene, type SceneImage } from "@svjeez/astro/scene";

export const REPO = "https://github.com/saiashirwad/svjeez";

/** Where the examples' sources live on GitHub. */
export const SOURCES = `${REPO}/tree/main/examples`;

/** The width a card draws its poster at. */
export const POSTER_WIDTH = 480;

const SECTIONS = [
  {
    title: "Scenes",
    blurb: "Complete animated scenes, each in a single SVG.",
    names: [
      "earth",
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
    blurb: "Explore diagrams, terminals, fonts, images, and effects.",
    names: [
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
    scene: getScene(build, { posters: { scale: POSTER_WIDTH / width, quality: 0.7 } }),
  };
};

export const sections = SECTIONS.map((section) => ({
  ...section,
  examples: section.names.map(example),
}));

export const examples = sections.flatMap((section) => section.examples);
