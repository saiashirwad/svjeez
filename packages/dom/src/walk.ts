import type { Box } from "./tree.ts";

/**
 * Reads the element at `selector` into a `Box` tree. Runs inside the page, so it must not reference anything outside
 * its own body.
 */
export function walk({ selector, pad }: { selector: string; pad: number }): Box {
  const root = document.querySelector(selector);

  if (!root) throw new Error(`snapshot() found nothing at ${selector}.`);
  const origin = root.getBoundingClientRect();
  const px = (value: string): number => parseFloat(value) || 0;
  const round = (n: number): number => Math.round(n * 100) / 100;

  const rel = (r: DOMRect) => ({
    x: round(r.left - origin.left + pad),
    y: round(r.top - origin.top + pad),
    width: round(r.width),
    height: round(r.height),
  });

  // Computed colors come back in whatever space the CSS used (oklch for Tailwind 4); a canvas pixel turns them into sRGB.
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const colors = new Map<string, string | undefined>();

  const color = (css: string): string | undefined => {
    if (!css || css === "transparent" || css === "none") return undefined;

    if (colors.has(css)) return colors.get(css);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data as unknown as number[];

    const value =
      a === 0
        ? undefined
        : a === 255
          ? `rgb(${r},${g},${b})`
          : `rgba(${r},${g},${b},${round(a! / 255)})`;

    colors.set(css, value);

    return value;
  };

  // Where the baseline sits inside a glyph's content area, which is what a Range's rect covers.
  const metrics = new Map<string, { ascent: number; area: number }>();

  const probe = (s: CSSStyleDeclaration) => {
    const key = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    let found = metrics.get(key);

    if (found) return found;
    const div = document.createElement("div");
    div.style.cssText =
      "position:absolute;left:0;top:0;white-space:nowrap;line-height:normal;visibility:hidden";
    div.style.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}/normal ${s.fontFamily}`;
    div.append("x");
    const mark = document.createElement("i");
    mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    div.append(mark);
    document.body.append(div);
    const range = document.createRange();
    range.selectNodeContents(div.firstChild!);
    const text = range.getBoundingClientRect();
    found = { ascent: mark.getBoundingClientRect().top - text.top, area: text.height };
    div.remove();
    metrics.set(key, found);

    return found;
  };

  const radii = (s: CSSStyleDeclaration, w: number, h: number) => {
    const corner = (v: string, side: number) =>
      v.trim().endsWith("%") ? (px(v) / 100) * side : px(v);

    const r = [
      corner(s.borderTopLeftRadius, w),
      corner(s.borderTopRightRadius, w),
      corner(s.borderBottomRightRadius, w),
      corner(s.borderBottomLeftRadius, w),
    ];

    const f = Math.min(
      1,
      w / (r[0]! + r[1]! || 1),
      w / (r[3]! + r[2]! || 1),
      h / (r[0]! + r[3]! || 1),
      h / (r[1]! + r[2]! || 1),
    );

    return r.map((n) => round(n * f)) as unknown as [number, number, number, number];
  };

  const shadows = (value: string) =>
    value === "none"
      ? []
      : value
          .split(/,(?![^(]*\))/)
          .map((part) => part.trim())
          .filter((part) => !/\binset\b/.test(part))
          .flatMap((part) => {
            const m = /^(.*\)|\S+)\s+(.*)$/.exec(part);
            const c = m && color(m[1]!);

            if (!m || !c) return [];
            const [x = 0, y = 0, blur = 0, spread = 0] = m[2]!.split(/\s+/).map(px);

            return [{ color: c, x, y, blur, spread }];
          });

  const family = (s: CSSStyleDeclaration) =>
    s.fontFamily
      .split(",")[0]!
      .trim()
      .replace(/^["']|["']$/g, "");

  const transform = (text: string, s: CSSStyleDeclaration) =>
    s.textTransform === "uppercase"
      ? text.toUpperCase()
      : s.textTransform === "lowercase"
        ? text.toLowerCase()
        : s.textTransform === "capitalize"
          ? text.replace(/(^|\s)(\S)/g, (_, a: string, b: string) => a + b.toUpperCase())
          : text;

  const run = (s: CSSStyleDeclaration, text: string, x: number, top: number, c: string) => ({
    kind: "text" as const,
    text: transform(text, s),
    x: round(x - origin.left + pad),
    y: round(top + probe(s).ascent - origin.top + pad),
    family: family(s),
    weight: px(s.fontWeight),
    style: (s.fontStyle === "italic" ? "italic" : "normal") as "normal" | "italic",
    size: px(s.fontSize),
    color: c,
    letterSpacing: s.letterSpacing === "normal" ? 0 : px(s.letterSpacing),
  });

  // One run per line: walk the characters, start a line where the top jumps.
  const texts = (node: Text, s: CSSStyleDeclaration, out: unknown[]) => {
    const c = color(s.color);

    if (!c || s.visibility === "hidden") return;
    const range = document.createRange();
    const data = node.data;
    let line: { top: number; left: number; height: number; text: string } | undefined;
    const lines: (typeof line & {})[] = [];

    for (let i = 0; i < data.length;) {
      const len = data.codePointAt(i)! > 0xffff ? 2 : 1;
      range.setStart(node, i);
      range.setEnd(node, i + len);
      const ch = data.slice(i, i + len);
      i += len;
      const r = range.getClientRects()[0];

      if (!r) continue;
      const space = /\s/.test(ch);

      if (space && r.width === 0) continue;

      if (!line || Math.abs(r.top - line.top) > line.height / 2) {
        if (space) continue;
        line = { top: r.top, left: r.left, height: r.height, text: "" };
        lines.push(line);
      }

      if (space && line.text.endsWith(" ")) continue;
      line.text += space ? " " : ch;
    }

    for (const l of lines) if (l.text.trim()) out.push(run(s, l.text.trimEnd(), l.left, l.top, c));
  };

  const GEOMETRY = [
    "d",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x",
    "y",
    "x1",
    "y1",
    "x2",
    "y2",
    "width",
    "height",
    "points",
    "transform",
    "fill-rule",
  ];

  const shape = (el: Element): unknown => {
    const s = getComputedStyle(el);
    const attrs: Record<string, string> = {};

    for (const name of GEOMETRY) {
      const v = el.getAttribute(name);

      if (v !== null) attrs[name] = v;
    }

    if (el.tagName !== "g") {
      attrs.fill = s.fill === "none" ? "none" : (color(s.fill) ?? "none");
      attrs.stroke = s.stroke === "none" ? "none" : (color(s.stroke) ?? "none");

      if (attrs.stroke !== "none") {
        attrs["stroke-width"] = String(px(s.strokeWidth));
        attrs["stroke-linecap"] = s.strokeLinecap;
        attrs["stroke-linejoin"] = s.strokeLinejoin;
      }
    }

    if (s.opacity !== "1") attrs.opacity = s.opacity;

    return { tag: el.tagName, attrs, children: [...el.children].map(shape) };
  };

  const element = (el: Element): unknown => {
    const s = getComputedStyle(el);

    if (s.display === "none") return undefined;
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();

    if (el instanceof SVGSVGElement) {
      if (!r.width || !r.height) return undefined;
      const vb = el.viewBox.baseVal;

      const viewBox =
        vb && vb.width ? [vb.x, vb.y, vb.width, vb.height] : [0, 0, r.width, r.height];

      return { kind: "graphic", box: rel(r), viewBox, children: [...el.children].map(shape) };
    }

    if (el instanceof HTMLImageElement) {
      try {
        const c = document.createElement("canvas");
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        c.getContext("2d")!.drawImage(el, 0, 0);

        return {
          kind: "image",
          box: rel(r),
          radii: radii(s, r.width, r.height),
          href: c.toDataURL("image/png"),
        };
      } catch {
        return undefined;
      }
    }

    const visible = s.visibility !== "hidden";

    const widths = [
      px(s.borderTopWidth),
      px(s.borderRightWidth),
      px(s.borderBottomWidth),
      px(s.borderLeftWidth),
    ];

    const sides = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
    const borderColor = color(sides[widths.findIndex((w) => w > 0)] ?? "");
    const children: unknown[] = [];

    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) texts(child as Text, s, children);
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const item = element(child as Element);

        if (item) children.push(item);
      }
    }

    if (
      (el instanceof HTMLInputElement && !/checkbox|radio|range|color|file/.test(el.type)) ||
      el instanceof HTMLTextAreaElement
    ) {
      const value = el.value;
      const text = value || el.placeholder;
      const c = color(value ? s.color : getComputedStyle(el, "::placeholder").color);

      if (text && c) {
        const top = px(s.paddingTop) + px(s.borderTopWidth);
        const inner = r.height - top - px(s.paddingBottom) - px(s.borderBottomWidth);
        const { area } = probe(s);
        const x = r.left + px(s.paddingLeft) + px(s.borderLeftWidth);

        const lineTop =
          el instanceof HTMLTextAreaElement ? r.top + top : r.top + top + (inner - area) / 2;

        children.push(run(s, text, x, lineTop, c));
      }
    }

    return {
      kind: "box",
      tag,
      part: el.getAttribute("data-part") ?? undefined,
      classes: el.getAttribute("class") ?? "",
      box: rel(r),
      radii: radii(s, r.width, r.height),
      background: visible ? color(s.backgroundColor) : undefined,
      border:
        visible && borderColor && widths.some((w) => w > 0)
          ? { widths, color: borderColor }
          : undefined,
      shadows: visible ? shadows(s.boxShadow) : [],
      opacity: px(s.opacity),
      clip: s.overflowX !== "visible" || s.overflowY !== "visible",
      children,
    };
  };

  return element(root) as Box;
}
