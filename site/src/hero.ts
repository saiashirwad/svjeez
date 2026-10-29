// The hero and every variant its knobs can reach, compiled at build time. Only the default gets posters: it is the one
// the page preloads and shows first, and the others hold their own still frame when they need one.
import { getScene } from "@svjeez/astro/scene";
import { KNOBS, VARIANTS } from "@examples/site/hero-knobs";
import { live } from "./live";
import { facts, type FileFacts } from "./proof";

export { KNOBS };

const [first, ...rest] = VARIANTS;

export const hero = { wide: live(first!.wide), tall: live(first!.tall) };

/** What the browser needs to swap the hero to a variant: its files and the alt text each describes itself with. */
export interface HeroVariant {
  readonly key: string;
  readonly knobs: Readonly<Record<string, string>>;
  readonly wide: FileFacts & { readonly alt: string };
  readonly tall: FileFacts & { readonly alt: string };
}

const file = (scene: ReturnType<typeof getScene>) => ({ ...facts(scene), alt: scene.desc });

export const variants: readonly HeroVariant[] = [
  { key: first!.key, knobs: { ...first!.knobs }, wide: file(hero.wide), tall: file(hero.tall) },
  ...rest.map((v) => ({ key: v.key, knobs: { ...v.knobs }, wide: file(getScene(v.wide)), tall: file(getScene(v.tall)) })),
];
