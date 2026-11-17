export interface FileFacts {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly gzip: number;
  readonly script: number;
}

export interface SceneFile {
  readonly size: string;
  readonly download: string;
  /** Pixel size, gzipped size and script, for the menu's first line. */
  readonly facts: string;
  readonly tag: string;
}

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

const attr = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export const facts = (scene: {
  src: string;
  width: number;
  height: number;
  gzip: number;
  svg: string;
}): FileFacts => ({
  src: scene.src,
  width: scene.width,
  height: scene.height,
  gzip: scene.gzip,
  script: [...scene.svg.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].reduce(
    (sum, m) => sum + m[1]!.length,
    0,
  ),
});

export const proof = (file: FileFacts, name: string, alt: string): SceneFile => ({
  size: kb(file.gzip),
  download: `svjeez-${name}.svg`,
  facts: `${file.width} × ${file.height}, ${kb(file.gzip)} gzipped, ${file.script ? `${file.script} bytes of script` : "no JavaScript"}`,
  tag: `<img src="${new URL(file.src, import.meta.env.SITE)}" width="${file.width}" height="${file.height}" alt="${attr(alt)}">`,
});
