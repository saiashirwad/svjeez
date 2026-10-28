import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { assets, ROUTE } from "./assets";
import { poster, type PosterOptions, type Scheme } from "./posters";

/** A scene's default export, or the string render() returned. */
export type SceneSource = string | (() => string);

export interface SceneImage {
  /** The SVG's URL, named by its content. */
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** The SVG's <title> and <desc>, for alt text. */
  readonly title: string;
  readonly desc: string;
  readonly svg: string;
  readonly gzip: number;
  /** A still frame per color scheme, when getScene() was asked for posters. */
  readonly posters?: Readonly<Record<Scheme, string>>;
}

const hash = (text: string) => createHash("sha256").update(text).digest("base64url").slice(0, 12);
const unescape = (text: string) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const compiled = new WeakMap<() => string, string>();
const compile = (scene: SceneSource) => {
  if (typeof scene === "string") return scene;
  let svg = compiled.get(scene);
  if (svg === undefined) compiled.set(scene, (svg = scene()));
  return svg;
};

/** Compiles a scene and gives it a URL, plus poster stills when asked. The files are served in dev and written by the build. */
export const getScene = (scene: SceneSource, options: { posters?: boolean | PosterOptions } = {}): SceneImage => {
  const svg = compile(scene);
  const name = hash(svg);
  const text = new TextEncoder().encode(svg);
  assets.files.set(`${name}.svg`, { type: "image/svg+xml", bytes: async () => text });
  const [, , width, height] = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number);
  let posters: Record<Scheme, string> | undefined;
  if (options.posters) {
    const settings = options.posters === true ? {} : options.posters;
    const variant = hash(JSON.stringify([settings.scale, settings.quality, settings.background]));
    posters = { light: "", dark: "" };
    for (const scheme of ["light", "dark"] as const) {
      const file = `${name}-${variant}-${scheme}.webp`;
      assets.files.set(file, { type: "image/webp", bytes: () => poster(file, svg, scheme, settings) });
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
