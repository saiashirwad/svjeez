import type { Box, Item, Placement } from "./tree.ts";

/**
 * Loads every image the page's CSS names and leaves its size in `__svjeezImages`, so the walk, which can't wait,
 * can lay out `background-size: contain` and the like. Runs inside the page, so it must not reference anything
 * outside its own body.
 */
export async function preload(): Promise<void> {
  const sizes = (globalThis.__svjeezImages ??= new Map());
  const urls = new Set<string>();

  for (const el of document.querySelectorAll("*")) {
    for (const which of [null, "::before", "::after"]) {
      const s = getComputedStyle(el, which);

      for (const css of [s.backgroundImage, s.maskImage, s.webkitMaskImage])
        for (const m of (css || "").matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/g))
          if (!sizes.has(m[2]!)) urls.add(m[2]!);
    }
  }

  await Promise.all(
    [...urls].map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          const done = () => {
            sizes.set(url, [img.naturalWidth, img.naturalHeight]);
            resolve();
          };

          img.onload = done;
          img.onerror = done;
          img.src = url;
          setTimeout(done, 3000);
        }),
    ),
  );
}

/** The files of a tree's images, as data URIs: one fetch per URL. A URL that won't download is `undefined`. */
export type Load = (url: string) => Promise<string | undefined>;

/** Every image URL in a tree that isn't a data URI yet. */
const urlsOf = (item: Item, out = new Set<string>()): Set<string> => {
  const add = (href: string) => href.startsWith("data:") || out.add(href);

  if (item.kind === "image") add(item.href);

  if (item.kind === "box") {
    for (const p of [...(item.pictures ?? []), ...(item.mask ?? [])]) add(p.href);

    for (const child of item.children) urlsOf(child, out);
  }

  return out;
};

/** The tree with every image URL replaced by its file, and what couldn't be fetched left out. */
export const embed = async (root: Box, load: Load): Promise<Box> => {
  const files = new Map(
    await Promise.all([...urlsOf(root)].map(async (url) => [url, await load(url)] as const)),
  );

  const href = (url: string) => (url.startsWith("data:") ? url : files.get(url));

  const placed = (list: readonly Placement[] | undefined) => {
    const out = (list ?? []).flatMap((p) => {
      const h = href(p.href);

      return h ? [{ ...p, href: h }] : [];
    });

    return out.length > 0 ? out : undefined;
  };

  const item = (it: Item): Item[] => {
    if (it.kind === "image") {
      const h = href(it.href);

      return h ? [{ ...it, href: h }] : [];
    }

    return it.kind === "box" ? [box(it)] : [it];
  };

  const box = (b: Box): Box => ({
    ...b,
    pictures: placed(b.pictures),
    mask: placed(b.mask),
    children: b.children.flatMap(item),
  });

  return box(root);
};
