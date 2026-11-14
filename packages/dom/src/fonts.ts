import type { Face, Item } from "./tree.ts";

/** A face the page loaded, with the URL its `@font-face` rule points at, before the bytes are fetched. */
export type Source = Omit<Face, "src"> & { readonly url: string };

/** The first family of every text run in a tree: the ones whose faces a snapshot needs. */
export const families = (item: Item, out = new Set<string>()): Set<string> => {
  if (item.kind === "text") out.add(item.family);
  else if (item.kind === "box") for (const child of item.children) families(child, out);

  return out;
};

/**
 * The `@font-face` rules behind the faces of `used` that the page actually loaded. A face added from script, or from
 * a stylesheet the page can't read, has no rule to find, and its text draws in a fallback. Runs inside the page, so
 * it must not reference anything outside its own body.
 */
export function sources(used: string[]): Source[] {
  const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, "");
  // "U+0000-00FF" and "U+0-FF" are one range.
  const range = (s: string) =>
    (s || "U+0-10FFFF")
      .toUpperCase()
      .replace(/\s/g, "")
      .replace(/(^|[+-])0+(?=[0-9A-F])/g, "$1");
  const rules: CSSFontFaceRule[] = [];

  const collect = (list: CSSRuleList) => {
    for (const rule of list) {
      if (rule instanceof CSSFontFaceRule) rules.push(rule);
      else if (rule instanceof CSSImportRule && rule.styleSheet) read(rule.styleSheet);
      else if ("cssRules" in rule) collect((rule as CSSGroupingRule).cssRules);
    }
  };

  const read = (sheet: CSSStyleSheet) => {
    try {
      collect(sheet.cssRules);
    } catch {
      // A cross-origin stylesheet without CORS hides its rules.
    }
  };

  for (const sheet of document.styleSheets) read(sheet);
  for (const sheet of document.adoptedStyleSheets) read(sheet);

  const loaded = [...document.fonts].filter(
    (f) => f.status === "loaded" && used.includes(unquote(f.family)),
  );

  return loaded.flatMap((face) => {
    const rule = rules.find(
      (r) =>
        unquote(r.style.getPropertyValue("font-family")) === unquote(face.family) &&
        (r.style.getPropertyValue("font-weight") || "normal").replace("normal", "400") ===
          face.weight.replace("normal", "400") &&
        (r.style.getPropertyValue("font-style") || "normal") === face.style &&
        range(r.style.getPropertyValue("unicode-range")) === range(face.unicodeRange),
    );
    // The first url() is the one a modern browser takes: authors list woff2 first.
    const url = rule && /url\(\s*(["']?)(.*?)\1\s*\)/.exec(rule.style.getPropertyValue("src"))?.[2];

    if (!rule || !url) return [];
    const base = rule.parentStyleSheet?.href ?? document.baseURI;
    const unicodeRange = range(face.unicodeRange);

    return [
      {
        family: unquote(face.family),
        weight: face.weight.replace("normal", "400").replace("bold", "700"),
        style: face.style === "italic" || face.style.startsWith("oblique") ? "italic" : "normal",
        ...(unicodeRange === "U+0-10FFFF" ? {} : { unicodeRange }),
        url: new URL(url, base).href,
      },
    ];
  });
}

const MIME: Readonly<Record<string, string>> = {
  wOF2: "font/woff2",
  wOFF: "font/woff",
  OTTO: "font/otf",
};

/** A font file as a data URI, its type read from the bytes. */
export const dataUri = (bytes: Uint8Array): string => {
  const tag = String.fromCharCode(...bytes.subarray(0, 4));

  return `data:${MIME[tag] ?? "font/ttf"};base64,${Buffer.from(bytes).toString("base64")}`;
};
