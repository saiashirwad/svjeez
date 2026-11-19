import type { State } from "./record.ts";
import type { Background, ElementNode, Snapshot } from "./schema.ts";

export interface AssetOptions {
  /** How to download a URL. Defaults to the global `fetch`. */
  readonly fetch?: (url: string) => Promise<Response>;
}

const TYPES = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["svg", "image/svg+xml"],
  ["woff2", "font/woff2"],
  ["woff", "font/woff"],
  ["ttf", "font/ttf"],
  ["otf", "font/otf"],
]);

const toDataUrl = async (url: string, get: (url: string) => Promise<Response>): Promise<string> => {
  const response = await get(url).catch((error: Error) => {
    throw new Error(`inlineAssets could not fetch ${url}: ${error.message}`);
  });

  if (!response.ok)
    throw new Error(
      `inlineAssets could not fetch ${url}: ${response.status} ${response.statusText}`.trim(),
    );

  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? "";
  const header = response.headers.get("content-type")?.split(";")[0]?.trim();

  const type =
    (header && header !== "application/octet-stream" ? header : TYPES.get(extension)) ??
    "application/octet-stream";

  return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
};

const remote = (src: string): boolean => !src.startsWith("data:");

const families = (node: ElementNode, into: Set<string>) => {
  for (const child of node.children)
    if (child.type === "text")
      for (const { font } of child.runs)
        into.add(
          font.family
            .split(",")[0]!
            .trim()
            .replace(/^["']|["']$/g, "")
            .toLowerCase(),
        );
    else families(child, into);
};

const urls = (node: ElementNode, into: Set<string>) => {
  if (node.image && remote(node.image.src)) into.add(node.image.src);

  for (const layer of [...(node.backgrounds ?? []), ...(node.masks ?? [])])
    if (layer.kind === "image" && remote(layer.src)) into.add(layer.src);

  for (const child of node.children) if (child.type === "element") urls(child, into);
};

const inlined = (layers: readonly Background[], data: ReadonlyMap<string, string>) =>
  layers.map((layer) =>
    layer.kind === "image" ? { ...layer, src: data.get(layer.src) ?? layer.src } : layer,
  );

const rewrite = (node: ElementNode, data: ReadonlyMap<string, string>): ElementNode => ({
  ...node,
  ...(node.image && { image: { ...node.image, src: data.get(node.image.src) ?? node.image.src } }),
  ...(node.backgrounds && { backgrounds: inlined(node.backgrounds, data) }),
  ...(node.masks && { masks: inlined(node.masks, data) }),
  children: node.children.map((child) => (child.type === "element" ? rewrite(child, data) : child)),
});

/**
 * Downloads what each Snapshot (or each State's snapshot) points at and embeds it as `data:` URLs, so the scene needs no network:
 * `<img>`, background and mask images, and the web fonts its text uses (the page's `@font-face` files; unused ones are dropped).
 * Each URL is fetched once across all the snapshots. A URL that cannot be fetched throws.
 */
export async function inlineAssets(
  input: readonly Snapshot[],
  options?: AssetOptions,
): Promise<Snapshot[]>;
export async function inlineAssets(
  input: readonly State[],
  options?: AssetOptions,
): Promise<State[]>;
export async function inlineAssets(
  input: readonly (Snapshot | State)[],
  { fetch: get = (url) => fetch(url) }: AssetOptions = {},
): Promise<(Snapshot | State)[]> {
  const snapshots = input.map((one) => ("snapshot" in one ? one.snapshot : one));
  const wanted = new Set<string>();

  const used = snapshots.map((snapshot) => {
    const names = new Set<string>();

    families(snapshot.root, names);
    urls(snapshot.root, wanted);

    const fonts = (snapshot.fonts ?? []).filter(
      ({ family, src }) => names.has(family.toLowerCase()) && remote(src),
    );

    for (const { src } of fonts) wanted.add(src);

    return fonts;
  });

  const data = new Map(
    await Promise.all([...wanted].map(async (url) => [url, await toDataUrl(url, get)] as const)),
  );

  return snapshots.map((snapshot, i) => {
    const { fonts: _, ...rest } = snapshot;

    const keep = [
      ...(snapshot.fonts ?? []).filter(({ src }) => !remote(src)),
      ...used[i]!.map((font) => ({ ...font, src: data.get(font.src)! })),
    ];

    const inlined: Snapshot = {
      ...rest,
      root: rewrite(snapshot.root, data),
      ...(keep.length > 0 && { fonts: keep }),
    };

    const one = input[i]!;

    return "snapshot" in one ? { ...one, snapshot: inlined } : inlined;
  });
}
