export interface ValidationResult {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const collect = (source: string, pattern: RegExp, group = 1): string[] => {
  const values: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const value = match[group];
    if (value) values.push(value);
  }
  return values;
};

const FILTERED_ANIMATION_LIMIT = 40;

const filteredAnimation = (source: string): string[] => {
  const warnings: string[] = [];
  const open: { tag: string; filter?: string; animated: number }[] = [];
  const base = /\.([A-Za-z][\w-]*)\{animation-duration/.exec(source)?.[1] ?? "a";
  const animatedClass = new RegExp(`\\bclass="(?:[^"]*\\s)?${base}(?:\\s[^"]*)?"`);
  for (const [, closing, tag, attrs = "", selfClosing] of source.matchAll(/<(\/?)([A-Za-z][\w-]*)([^>]*?)(\/?)>/g)) {
    if (closing) {
      const element = open.pop();
      if (element?.filter && element.animated >= FILTERED_ANIMATION_LIMIT) {
        warnings.push(
          `<${element.tag} filter="${element.filter}"> sits over ${element.animated} animated elements and re-renders every frame; Safari can drop far below 60 fps. Paint the glow with a gradient, or filter something that holds still.`,
        );
      }
      continue;
    }
    if (tag === "animate" || animatedClass.test(attrs)) {
      for (const ancestor of open) if (ancestor.filter) ancestor.animated++;
    }
    if (!selfClosing) open.push({ tag: tag!, filter: /\bfilter="([^"]+)"/.exec(attrs)?.[1], animated: 0 });
  }
  return warnings;
};

const EMBED_WARN_BYTES = 256 * 1024;

const imageHrefs = (source: string): string[] => {
  const warnings: string[] = [];
  for (const [, tag, attrs = ""] of source.matchAll(/<(image|feImage|use)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g)) {
    const href = /\s(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs)?.slice(1).find((value) => value !== undefined);
    if (href === undefined || href.startsWith("#") || href.startsWith("data:")) continue;
    warnings.push(
      `<${tag} href="${href.length > 60 ? `${href.slice(0, 57)}...` : href}"> will not load when the SVG is shown through <img> (GitHub, Markdown). Embed the image as a data URI: load it with picture.load() and draw it with <Picture>.`,
    );
  }
  for (const [, uri = ""] of source.matchAll(/\s(?:xlink:)?href\s*=\s*"(data:[^"]*)"/g)) {
    if (uri.length > EMBED_WARN_BYTES) {
      warnings.push(`An embedded ${uri.slice(5, uri.search(/[;,]/))} image is ${Math.round(uri.length / 1024)} KB, and the whole file downloads before the first frame. Resize it to the drawn size, or recompress it.`);
    }
  }
  return warnings;
};

const embeddedFonts = (source: string): string[] =>
  [...source.matchAll(/@font-face\{[^}]*?url\((data:[^)]*)\)/g)]
    .filter(([, uri = ""]) => uri.length > EMBED_WARN_BYTES)
    .map(([, uri = ""]) => `An embedded font is ${Math.round(uri.length / 1024)} KB, and the whole file downloads before the first frame. Use a smaller font, or draw short titles with <Glyphs>, which embeds no font.`);

export const validateSvg = (source: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!/^\s*(?:<!--[\s\S]*?-->\s*)*<svg\b/.test(source)) {
    errors.push("The document must start with an <svg> root.");
  }
  if (!/\bviewBox="/.test(source)) warnings.push("The root <svg> has no viewBox.");

  const ids = collect(source, /\bid="([^"]*)"/g);
  const idSet = new Set<string>();
  for (const id of ids) {
    if (idSet.has(id)) errors.push(`Duplicate id "${id}".`);
    idSet.add(id);
  }

  for (const reference of collect(source, /url\(#([^)]+)\)/g)) {
    if (!idSet.has(reference)) errors.push(`url(#${reference}) has no matching id.`);
  }
  for (const list of collect(source, /\baria-labelledby="([^"]+)"/g)) {
    for (const reference of list.split(/\s+/)) {
      if (reference && !idSet.has(reference)) {
        errors.push(`aria-labelledby references missing id "${reference}".`);
      }
    }
  }
  for (const reference of collect(source, /\b(?:xlink:)?href="#([^"]+)"/g)) {
    if (!idSet.has(reference)) errors.push(`href="#${reference}" has no matching id.`);
  }

  const keyframes = collect(source, /@keyframes\s+([A-Za-z0-9_-]+)/g);
  const keyframeSet = new Set<string>();
  for (const name of keyframes) {
    if (keyframeSet.has(name)) errors.push(`Duplicate @keyframes "${name}".`);
    keyframeSet.add(name);
  }

  const animated = new Set<string>();
  for (const list of collect(source, /animation-name:\s*([^;}]+)/g)) {
    for (const name of list.split(",")) animated.add(name.trim());
  }
  for (const name of collect(source, /\banimation:\s*([A-Za-z0-9_-]+)/g)) {
    if (!["none", "initial", "inherit", "unset", "revert"].includes(name)) animated.add(name);
  }
  for (const name of animated) {
    if (!keyframeSet.has(name)) errors.push(`Animation "${name}" has no matching @keyframes.`);
  }
  for (const name of keyframeSet) {
    if (!animated.has(name)) warnings.push(`@keyframes "${name}" is never referenced.`);
  }

  warnings.push(...imageHrefs(source), ...embeddedFonts(source), ...filteredAnimation(source));

  return { errors, warnings };
};
