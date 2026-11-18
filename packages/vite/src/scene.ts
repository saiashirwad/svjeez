import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { isScene, svg as backend, type Scene } from "svjeez/tools";
import { register, ROUTE } from "./assets.ts";
import { poster, type PosterOptions, type Scheme } from "./posters.ts";

export type SceneSource = string | Scene | (() => string | Scene);

export interface SceneImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc: string;
  readonly svg: string;
  readonly gzip: number;
  readonly posters?: Readonly<Record<Scheme, string>>;
}

const hash = (text: string) => createHash("sha256").update(text).digest("base64url").slice(0, 12);

const unescape = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const compiled = new WeakMap<object, string>();

const isSvgText = (scene: SceneSource): scene is string => typeof scene === "string";

const emit = (made: string | Scene) => (isSvgText(made) ? made : backend.emit(made));

const compile = (scene: SceneSource) => {
  if (isSvgText(scene)) return scene;
  let svg = compiled.get(scene);

  if (svg === undefined) compiled.set(scene, (svg = emit(isScene(scene) ? scene : scene())));

  return svg;
};

export const getScene = (
  scene: SceneSource,
  options: { posters?: boolean | PosterOptions } = {},
): SceneImage => {
  const svg = compile(scene);
  const name = hash(svg);
  const text = new TextEncoder().encode(svg);
  register(`${name}.svg`, { type: "image/svg+xml", bytes: async () => text });

  const box = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(svg);

  if (!box) throw new Error("getScene() needs a scene whose svg has a viewBox, found none.");

  const [, , width, height] = box.slice(1).map(Number);

  let posters: Record<Scheme, string> | undefined;

  if (options.posters) {
    const settings = options.posters === true ? {} : options.posters;
    const variant = hash(JSON.stringify([settings.scale, settings.quality, settings.background]));
    posters = { light: "", dark: "" };

    for (const scheme of ["light", "dark"] as const) {
      const file = `${name}-${variant}-${scheme}.webp`;
      register(file, {
        type: "image/webp",
        bytes: () => poster(file, svg, scheme, settings),
      });
      posters[scheme] = ROUTE + file;
    }
  }

  return {
    src: `${ROUTE}${name}.svg`,
    width: width!,
    height: height!,
    title: unescape(/<title[^>]*>([^<]*)<\/title>/.exec(svg)?.[1] ?? ""),
    desc: unescape(/<desc[^>]*>([^<]*)<\/desc>/.exec(svg)?.[1] ?? ""),
    svg,
    gzip: gzipSync(svg).length,
    posters,
  };
};
