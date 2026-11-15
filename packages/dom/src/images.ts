import type { Box, Item, Placement, Rect } from "./tree.ts";

/**
 * Loads every image the page's CSS names and leaves its size in `__svjeezImages`, so the walk, which can't wait,
 * can lay out `background-size: contain` and the like. Runs inside the page, so it must not reference anything
 * outside its own body.
 */
export async function preload(): Promise<void> {
  const sizes = (globalThis.__svjeezImages ??= new Map());
  const urls = new Set<string>();

  // `querySelectorAll` stops at a shadow root, so each open one is searched in turn.
  const all = (root: ParentNode): Element[] =>
    [...root.querySelectorAll("*")].flatMap((el) => [el, ...(el.shadowRoot ? all(el.shadowRoot) : [])]);

  for (const el of all(document)) {
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

/**
 * Leaves a still of each visible canvas in `__svjeezStills` and says which ones it couldn't read: a canvas that is
 * tainted, or a WebGL one whose buffer was already shown, gives nothing, and those need a screenshot of their own.
 * Runs inside the page, so it must not reference anything outside its own body.
 */
export async function stills(): Promise<number[]> {
  const found: NonNullable<typeof globalThis.__svjeezStills> = (globalThis.__svjeezStills = new WeakMap());
  const need: number[] = [];

  const all = (root: ParentNode): Element[] =>
    [...root.querySelectorAll("*")].flatMap((el) => [el, ...(el.shadowRoot ? all(el.shadowRoot) : [])]);

  const list = all(document).filter((el): el is HTMLCanvasElement => el instanceof HTMLCanvasElement);
  (globalThis as { __svjeezCanvases?: HTMLCanvasElement[] }).__svjeezCanvases = list;
  const probe = new OffscreenCanvas(32, 32).getContext("2d", { willReadFrequently: true })!;

  list.forEach((canvas, i) => {
    const r = canvas.getBoundingClientRect();
    const s = getComputedStyle(canvas);

    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight)
      return;

    if (s.display === "none" || s.visibility === "hidden" || canvas.width === 0 || canvas.height === 0) return;

    try {
      probe.clearRect(0, 0, 32, 32);
      probe.drawImage(canvas, 0, 0, 32, 32);
      const data = probe.getImageData(0, 0, 32, 32).data;

      for (let k = 3; k < data.length; k += 4) {
        if (data[k]! > 0) {
          found.set(canvas, { href: canvas.toDataURL("image/webp", 0.9) });

          return;
        }
      }
    } catch {
      // A tainted canvas can't be read back.
    }

    need.push(i);
  });

  return need;
}

/**
 * Re-encodes a raster image no larger than twice the size it is drawn at, as WebP, when that is smaller. Answers the
 * data URI, or nothing when the file is better left as it is. Runs inside the page, so it must not reference
 * anything outside its own body.
 */
export async function shrink({
  data,
  mime,
  width,
  height,
}: {
  data: string;
  mime: string;
  width: number;
  height: number;
}): Promise<string | undefined> {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));

  // An animation would lose all but its first frame.
  if (mime === "image/gif" || head.includes("acTL") || (mime === "image/webp" && head.includes("ANIM")))
    return undefined;

  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  const k = Math.min(1, (2 * width) / bitmap.width, (2 * height) / bitmap.height);
  const same = k >= 1;

  // Nothing to save when the file is small, or already WebP or JPEG at the size it is drawn.
  if (same && (bytes.length < 20_000 || mime === "image/webp" || mime === "image/jpeg")) {
    bitmap.close();

    return undefined;
  }

  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const canvas = new OffscreenCanvas(w, h);

  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });

  if (blob.type !== "image/webp") blob = await canvas.convertToBlob({ type: "image/png" });

  if (same && blob.size >= bytes.length) return undefined;

  const out = new Uint8Array(await blob.arrayBuffer());
  let text = "";

  for (let i = 0; i < out.length; i += 0x8000)
    text += String.fromCharCode(...out.subarray(i, i + 0x8000));

  return `data:${blob.type};base64,${btoa(text)}`;
}

/** The most a picture is drawn at, in px. */
export type Size = readonly [number, number];

/** The files of a tree's images, as data URIs: one fetch per URL. A URL that won't download is `undefined`. */
export type Load = (url: string, size: Size) => Promise<string | undefined>;

/** Every image URL in a tree, with the largest size it is drawn at. */
const urlsOf = (item: Item, out = new Map<string, Size>()): Map<string, Size> => {
  const add = (href: string, r: Rect) => {
    const [w = 0, h = 0] = out.get(href) ?? [];

    out.set(href, [Math.max(w, r.width), Math.max(h, r.height)]);
  };

  if (item.kind === "image") add(item.href, item.fit ?? item.box);

  if (item.kind === "box") {
    for (const p of [...(item.pictures ?? []), ...(item.mask ?? [])])
      for (const t of p.tiles) add(p.href, t);

    for (const child of item.children) urlsOf(child, out);
  }

  return out;
};

/** The tree with every image URL replaced by its file, and what couldn't be fetched left out. */
export const embed = async (root: Box, load: Load): Promise<Box> => {
  const files = new Map(
    await Promise.all(
      [...urlsOf(root)].map(async ([url, size]) => [url, await load(url, size)] as const),
    ),
  );

  const href = (url: string) => files.get(url);
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

/** An image file: its type and bytes. */
export interface Fetched {
  readonly mime: string;
  readonly bytes: Buffer;
}

/** The type and bytes inside a `data:` URI. */
export const unpack = (url: string): Fetched | undefined => {
  const comma = url.indexOf(",");
  const [mime = "", ...flags] = url.slice(5, comma).split(";");
  const payload = url.slice(comma + 1);

  try {
    return {
      mime,
      bytes: flags.includes("base64")
        ? Buffer.from(payload, "base64")
        : Buffer.from(decodeURIComponent(payload)),
    };
  } catch {
    return undefined;
  }
};

/**
 * An SVG file as a data URI, with the width and height Chrome needs to draw it at any scale: an SVG that has only a
 * `viewBox` is as big as its box lets it be, and drawn as a one pixel image that is stretched, it comes out blank.
 */
export const svgUri = (text: string): string => {
  const sized = text.replace(/<svg\b[^>]*>/, (tag) => {
    const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`).exec(tag)?.[1];
    const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
    const fixed = (v: string | undefined) => v !== undefined && /^[\d.]+(px)?$/.test(v.trim());

    if (!box || box.length !== 4 || !(box[2]! > 0) || !(box[3]! > 0)) return tag;

    const w = attr("width");
    const h = attr("height");

    if (fixed(w) && fixed(h)) return tag;

    const wide = fixed(w) ? parseFloat(w!) : fixed(h) ? (parseFloat(h!) * box[2]!) / box[3]! : box[2]!;
    const high = fixed(h) ? parseFloat(h!) : (wide * box[3]!) / box[2]!;
    const bare = tag.replace(/\s(width|height)\s*=\s*(["'])[^"']*\2/g, "");

    return bare.replace(/<svg\b/, `<svg width="${+wide.toFixed(2)}" height="${+high.toFixed(2)}"`);
  });

  // The characters a data URI can't hold, and nothing more: base64 would make it a third bigger.
  const escaped = encodeURIComponent(sized).replace(/%(?:20|2F|3A|3D|2C|3B|40)/g, decodeURIComponent);

  return `data:image/svg+xml,${escaped}`;
};
