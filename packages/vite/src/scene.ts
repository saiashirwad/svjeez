import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { isScene, svg as backend, type Scene } from "svjeez/tools";
import { register, ROUTE } from "./assets.ts";
import {
  imageName,
  imageType,
  renderOg,
  type RenderOptions as StillOptions,
} from "@svjeez/og/render";
import { poster, type PosterOptions, type Scheme } from "./posters.ts";

/** A poster still of a scene: its URL and its width in pixels. */
export interface Poster {
  readonly src: string;
  readonly width: number;
}

/** What a `?svjeez` import is. */
export interface SceneModule {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc: string;
  /** The scene's stills by scheme, narrowest first. */
  readonly posters?: Readonly<Record<Scheme, readonly Poster[]>>;
  /** The SVG's markup, in server code (SSR, an Astro page) and in an `?svjeez&inline` import: any other browser bundle gets the URL alone. */
  readonly svg?: string;
}

/** SVG markup, a scene, a function that makes either, or a `?svjeez` import in server code. */
export type SceneSource = string | Scene | (() => string | Scene) | SceneModule;

export interface SceneImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly desc: string;
  readonly svg: string;
  readonly gzip: number;
  /** The scene's stills by scheme, narrowest first. */
  readonly posters?: Readonly<Record<Scheme, readonly Poster[]>>;
}

const hash = (text: string) => createHash("sha256").update(text).digest("base64url").slice(0, 12);

const unescape = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const compiled = new WeakMap<Exclude<SceneSource, string>, string>();

const isSvgText = (scene: SceneSource): scene is string => typeof scene === "string";

const isModule = (scene: SceneSource): scene is SceneModule =>
  typeof scene === "object" && "src" in scene;

const compile = (scene: SceneSource, prefix?: string) => {
  if (isSvgText(scene)) return scene;

  if (isModule(scene)) {
    if (scene.svg === undefined)
      throw new Error(
        `getScene() got the ?svjeez import of ${scene.src} without its markup, which only server code (SSR, an Astro page) gets.`,
      );

    return scene.svg;
  }

  const known = prefix === undefined ? compiled.get(scene) : undefined;

  if (known !== undefined) return known;
  const made = isScene(scene) ? scene : scene();
  const svg = isSvgText(made) ? made : backend.emit(made, { prefix });

  if (prefix === undefined) compiled.set(scene, svg);

  return svg;
};

const describe = (caller: string, svg: string) => {
  const box = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(svg);

  if (!box) throw new Error(`${caller} needs a scene whose svg has a viewBox, found none.`);

  return {
    width: Number(box[3]),
    height: Number(box[4]),
    title: unescape(/<title[^>]*>([^<]*)<\/title>/.exec(svg)?.[1] ?? ""),
    desc: unescape(/<desc[^>]*>([^<]*)<\/desc>/.exec(svg)?.[1] ?? ""),
  };
};

export const getScene = (
  scene: SceneSource,
  options: { posters?: boolean | PosterOptions; prefix?: string } = {},
): SceneImage => {
  const svg = compile(scene, options.prefix);
  const name = hash(svg);
  const text = new TextEncoder().encode(svg);
  register(`${name}.svg`, { type: "image/svg+xml", bytes: async () => text });

  const { width, height, title, desc } = describe("getScene()", svg);

  let posters: Record<Scheme, readonly Poster[]> | undefined;

  if (options.posters) {
    const settings = options.posters === true ? {} : options.posters;

    const widths = [...(settings.widths ?? [Math.round(width * (settings.scale ?? 1))])].sort(
      (a, b) => a - b,
    );

    const variant = hash(JSON.stringify([widths, settings.quality, settings.background]));

    const made = (scheme: Scheme): Poster[] =>
      widths.map((wide) => {
        const file = `${name}-${variant}-${wide}-${scheme}.webp`;

        register(file, {
          type: "image/webp",
          bytes: () => poster(file, svg, scheme, { ...settings, scale: wide / width }),
        });

        return { src: ROUTE + file, width: wide };
      });

    posters = { light: made("light"), dark: made("dark") };
  }

  return {
    src: `${ROUTE}${name}.svg`,
    width,
    height,
    title,
    desc,
    svg,
    gzip: gzipSync(svg).length,
    posters,
  };
};

/** Inline imports need a scene model so its SVG IDs and CSS can receive a file-specific prefix. */
export const getInlineScene = (
  source: SceneSource,
  file: string,
  options: { readonly prefix: string; readonly posters: boolean | PosterOptions },
): SceneImage => {
  if (!isSvgText(source) && !isModule(source)) {
    const made = isScene(source) ? source : source();

    if (!isSvgText(made)) return getScene(made, options);
  }

  throw new Error(
    `${file} exports SVG markup, which can't take a prefix. Import it with ?svjeez, or export a scene model for ?svjeez&inline.`,
  );
};

export type { StillOptions };

export interface StillImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** The image's MIME type. */
  readonly type: string;
  readonly title: string;
  readonly desc: string;
}

/**
 * A scene's picture at one moment (its first frame by default), as a PNG, JPEG or WebP asset in `/_svjeez/`: what a
 * link preview (`og:image`) needs, since crawlers do not draw SVG. Rendered when first requested in dev, and written
 * into the build by the integration.
 */
export const getStill = (scene: SceneSource, options: StillOptions = {}): StillImage => {
  const svg = compile(scene);
  const { width, height, title, desc } = describe("getStill()", svg);
  const scale = options.scale ?? 1;
  const file = imageName(svg, options);
  const type = imageType(options);
  register(file, { type, bytes: async () => (await renderOg(svg, options)).bytes });

  return {
    src: ROUTE + file,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    type,
    title,
    desc,
  };
};
