import type { Box } from "./tree.ts";

/** Border quads from Chromium, eight numbers each: an element's own, and its `::before` and `::after` when drawn. */
export interface Marks {
  readonly own: readonly number[];
  readonly before?: readonly number[];
  readonly after?: readonly number[];
}

/**
 * Reads the element at `selector` into a `Box` tree. `parts` names elements by CSS selector. Runs inside the page, so
 * it must not reference anything outside its own body.
 */
export function walk({
  selector,
  pad,
  parts,
}: {
  selector: string;
  pad: number;
  parts: Record<string, string>;
}): Box {
  const root = document.querySelector(selector);
  // Where Chromium put each element's ::before and ::after, left by `pseudos`: the DOM has no node to measure.
  const marks = (globalThis as { __svjeezPseudo?: WeakMap<Element, Marks> }).__svjeezPseudo;

  if (!root) throw new Error(`snap() found nothing at ${selector}.`);
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

  const shadows = (value: string, inset: boolean) =>
    value === "none"
      ? []
      : value
          .split(/,(?![^(]*\))/)
          .map((part) => part.trim())
          .filter((part) => /\binset\b/.test(part) === inset)
          .flatMap((part) => {
            const m = /^(.*\)|\S+)\s+(.*)$/.exec(part.replace(/\s*\binset\b/, ""));
            const c = m && color(m[1]!);

            if (!m || !c) return [];
            const [x = 0, y = 0, blur = 0, spread = 0] = m[2]!.split(/\s+/).map(px);

            return [{ color: c, x, y, blur, spread }];
          });

  /** Splits at `by` outside parentheses. */
  const split = (text: string, by: RegExp = /,/): string[] => {
    const out: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < text.length; i++) {
      const c = text[i]!;

      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (depth === 0 && by.test(c)) {
        out.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }

    out.push(text.slice(start).trim());

    return out.filter(Boolean);
  };

  const alpha = (c: string) => Number(/rgba\(.*,\s*([\d.]+)\)$/.exec(c)?.[1] ?? 1);
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).join(",");

  /**
   * Color stops at fractions of a gradient line `length` px long, placed as CSS places the ones without a position.
   * A clear stop takes its neighbors' color, since CSS fades to clear without the gray an unmixed blend would pass.
   */
  const stopsOf = (args: string[], length: number) => {
    const raw: { color: string; at?: number }[] = [];

    for (const arg of args) {
      const [c = "", ...at] = split(arg, /\s/);

      // A lone length is a hint at where the midpoint falls; the blend stays even.
      if (/^[-\d.]/.test(c)) continue;
      const value = color(c) ?? "rgba(0,0,0,0)";
      const pos = (t: string) =>
        t.endsWith("%") ? px(t) / 100 : t.endsWith("px") ? px(t) / (length || 1) : undefined;

      if (at.length === 0) raw.push({ color: value });

      for (const t of at) raw.push({ color: value, at: pos(t) });
    }

    if (raw.length === 0) return [];
    raw[0]!.at ??= 0;
    raw[raw.length - 1]!.at ??= 1;

    for (let i = 1, top = raw[0]!.at; i < raw.length; i++) {
      const at = raw[i]!.at;

      if (at === undefined) continue;
      raw[i]!.at = Math.max(at, top);
      top = raw[i]!.at!;
    }

    for (let i = 1; i < raw.length; i++) {
      if (raw[i]!.at !== undefined) continue;
      const from = i - 1;
      let to = i;

      while (raw[to]!.at === undefined) to++;

      for (let k = i; k < to; k++)
        raw[k]!.at = raw[from]!.at! + ((raw[to]!.at! - raw[from]!.at!) * (k - from)) / (to - from);
    }

    return raw.flatMap((stop, i) => {
      if (alpha(stop.color) > 0) return [{ offset: stop.at!, color: stop.color }];
      const before = raw.slice(0, i).findLast((s) => alpha(s.color) > 0);
      const after = raw.slice(i + 1).find((s) => alpha(s.color) > 0);
      const sides = [...new Set([before, after].flatMap((s) => (s ? [rgb(s.color)] : [])))];

      return (sides.length ? sides : ["0,0,0"]).map((side) => ({
        offset: stop.at!,
        color: `rgba(${side},0)`,
      }));
    });
  };

  /** Stops renumbered from `lo`..`hi` to 0..1, for a gradient line drawn from `lo` to `hi`. */
  const span = (stops: { offset: number; color: string }[], lo: number, hi: number) =>
    stops.map((s) => ({ ...s, offset: round((s.offset - lo) / (hi - lo)) }));

  /**
   * `linear-gradient` and `radial-gradient` layers, bottom first, in the snapshot's coordinates, laid out over the
   * padding box as CSS does by default. Conic gradients and images are skipped.
   */
  const gradientsOf = (
    s: CSSStyleDeclaration,
    b: { x: number; y: number; width: number; height: number },
  ) => {
    if (s.backgroundImage === "none" || s.visibility === "hidden") return [];
    const [bt, br, bb, bl] = [
      s.borderTopWidth,
      s.borderRightWidth,
      s.borderBottomWidth,
      s.borderLeftWidth,
    ].map(px) as [number, number, number, number];
    const x0 = b.x + bl;
    const y0 = b.y + bt;
    const w = b.width - bl - br;
    const h = b.height - bt - bb;

    if (w <= 0 || h <= 0) return [];

    return split(s.backgroundImage)
      .flatMap((layer): object[] => {
        const m = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/s.exec(layer);

        if (!m) return [];
        const repeat = Boolean(m[1]);
        const args = split(m[3]!);

        if (m[2] === "linear") {
          let dx = 0;
          let dy = 1;
          const lead = args[0]!.replace(/\s*\bin\b.*$/, "").trim();

          if (/^(to\b|-?[\d.]+(deg|rad|turn|grad)$|in\b)/.test(args[0]!)) {
            args.shift();
            const angle = /^(-?[\d.]+)(deg|rad|turn|grad)$/.exec(lead);

            if (angle) {
              const deg =
                Number(angle[1]) *
                { deg: 1, rad: 180 / Math.PI, turn: 360, grad: 0.9 }[angle[2] as "deg"];
              dx = Math.sin((deg * Math.PI) / 180);
              dy = -Math.cos((deg * Math.PI) / 180);
            } else if (lead.startsWith("to")) {
              const sx = /right/.test(lead) ? 1 : /left/.test(lead) ? -1 : 0;
              const sy = /bottom/.test(lead) ? 1 : /top/.test(lead) ? -1 : 0;
              // To a corner, the line runs square to the diagonal between the other two corners.
              [dx, dy] = sx && sy ? [sx * h, sy * w] : [sx, sy];
              const n = Math.hypot(dx, dy) || 1;
              dx /= n;
              dy /= n;
            }
          }

          const length = Math.abs(w * dx) + Math.abs(h * dy);
          const stops = stopsOf(args, length);

          if (stops.length === 0) return [];
          const first = stops[0]!.offset;
          const last = stops.at(-1)!.offset;
          const [lo, hi] = repeat ? [first, last] : [Math.min(0, first), Math.max(1, last)];

          if (hi - lo <= 0) return [];
          const at = (t: number): [number, number] => [
            round(x0 + w / 2 + dx * length * (t - 0.5)),
            round(y0 + h / 2 + dy * length * (t - 0.5)),
          ];
          const [x1, y1] = at(lo);
          const [x2, y2] = at(hi);

          return [
            {
              kind: "linear",
              x1,
              y1,
              x2,
              y2,
              stops: span(stops, lo, hi),
              ...(repeat ? { repeat } : {}),
            },
          ];
        }

        let shape = "";

        if (/^(circle|ellipse|closest|farthest|at\b|in\b|[\d.])/.test(args[0]!))
          shape = args.shift()!;
        const [size = "", where = ""] = shape
          .replace(/\s*\bin\b.*$/, "")
          .split(/\bat\b/)
          .map((t) => t.trim());
        let cx: number | undefined;
        let cy: number | undefined;
        const loose: string[] = [];

        for (const t of where.split(/\s+/).filter(Boolean)) {
          if (t === "left") cx = 0;
          else if (t === "right") cx = w;
          else if (t === "top") cy = 0;
          else if (t === "bottom") cy = h;
          else loose.push(t);
        }

        for (const t of loose) {
          const v = (side: number) =>
            t === "center" ? side / 2 : t.endsWith("%") ? (px(t) / 100) * side : px(t);

          if (cx === undefined) cx = v(w);
          else if (cy === undefined) cy = v(h);
        }

        cx ??= w / 2;
        cy ??= h / 2;
        const words = size.split(/\s+/).filter(Boolean);
        const lengths = words.filter((t) => /^[\d.]/.test(t));
        const circle =
          words.includes("circle") || (lengths.length === 1 && !words.includes("ellipse"));
        const near = [Math.min(cx, w - cx), Math.min(cy, h - cy)] as const;
        const far = [Math.max(cx, w - cx), Math.max(cy, h - cy)] as const;
        let rx: number;
        let ry: number;

        if (lengths.length > 0) {
          rx = lengths[0]!.endsWith("%") ? (px(lengths[0]!) / 100) * w : px(lengths[0]!);
          ry = circle
            ? rx
            : lengths[1]?.endsWith("%")
              ? (px(lengths[1]) / 100) * h
              : px(lengths[1] ?? lengths[0]!);
        } else {
          const key = words.find((t) => /closest|farthest/.test(t)) ?? "farthest-corner";
          const [sx, sy] = key.startsWith("closest") ? near : far;

          const pick = key.startsWith("closest") ? Math.min : Math.max;

          if (key.endsWith("side")) [rx, ry] = circle ? [pick(sx, sy), pick(sx, sy)] : [sx, sy];
          else if (circle) rx = ry = Math.hypot(sx, sy);
          else [rx, ry] = [sx * Math.SQRT2, sy * Math.SQRT2];
        }

        if (rx <= 0 || ry <= 0) return [];
        const stops = stopsOf(args, rx);

        if (stops.length === 0) return [];
        // SVG has no ring a radial gradient starts at, so stops before the center sit on it.
        const hi = repeat ? stops.at(-1)!.offset : Math.max(1, stops.at(-1)!.offset);

        if (hi <= 0) return [];

        return [
          {
            kind: "radial",
            cx: round(x0 + cx),
            cy: round(y0 + cy),
            rx: round(rx * hi),
            ry: round(ry * hi),
            stops: span(stops, 0, hi).map((st) => ({ ...st, offset: Math.max(0, st.offset) })),
            ...(repeat ? { repeat } : {}),
          },
        ];
      })
      .reverse();
  };

  /**
   * A see-through fill under `backdrop-filter: blur()` drawn more solid instead: what shows through is blurred on the
   * page, and blurring it here would need a filter, which makes zooming stutter.
   */
  const frost = (c: string | undefined, s: CSSStyleDeclaration) => {
    const blur = /blur\(([\d.]+)px\)/.exec(s.backdropFilter);

    if (!c || !blur || alpha(c) >= 1) return c;

    const a = alpha(c);

    return `rgba(${rgb(c)},${round(a + (1 - a) * Math.min(0.5, Number(blur[1]) / 24))})`;
  };

  /** What an element or pseudo-element paints of itself: corners, fill, gradients, border, shadows. */
  const surface = (
    s: CSSStyleDeclaration,
    r: { width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => {
    const visible = s.visibility !== "hidden";

    const widths = [
      px(s.borderTopWidth),
      px(s.borderRightWidth),
      px(s.borderBottomWidth),
      px(s.borderLeftWidth),
    ];

    const sides = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
    const borderColor = color(sides[widths.findIndex((w) => w > 0)] ?? "");
    const gradients = gradientsOf(s, b);

    return {
      radii: radii(s, r.width, r.height),
      background: visible ? frost(color(s.backgroundColor), s) : undefined,
      ...(gradients.length > 0 ? { gradients } : {}),
      border:
        visible && borderColor && widths.some((w) => w > 0)
          ? { widths, color: borderColor }
          : undefined,
      shadows: visible ? shadows(s.boxShadow, false) : [],
      ...(visible && /\binset\b/.test(s.boxShadow) ? { insets: shadows(s.boxShadow, true) } : {}),
      opacity: px(s.opacity),
    };
  };

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

  const run = (
    s: CSSStyleDeclaration,
    text: string,
    x: number,
    top: number,
    c: string,
    advances: number[],
    placeholder = false,
  ) => ({
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
    advances: advances.map(round),
    ...(placeholder ? { placeholder } : {}),
  });

  // Where each character of an input's value ends: the value isn't in the DOM, so lay it out in a probe.
  const measure = (s: CSSStyleDeclaration, text: string): number[] => {
    const span = document.createElement("span");
    span.style.cssText = "position:absolute;left:0;top:0;white-space:pre;visibility:hidden";
    span.style.font = s.font;
    span.style.letterSpacing = s.letterSpacing;
    span.append(text);
    document.body.append(span);
    const node = span.firstChild as Text;
    const range = document.createRange();
    const left = span.getBoundingClientRect().left;
    const ends: number[] = [];

    for (let i = 0; i < text.length;) {
      const len = text.codePointAt(i)! > 0xffff ? 2 : 1;
      range.setStart(node, i);
      range.setEnd(node, i + len);
      i += len;
      ends.push(range.getBoundingClientRect().right - left);
    }

    span.remove();

    return ends;
  };

  // One run per line: walk the characters, start a line where the top jumps.
  const texts = (node: Text, s: CSSStyleDeclaration, out: unknown[]) => {
    const c = color(s.color);

    if (!c || s.visibility === "hidden") return;
    const range = document.createRange();
    const data = node.data;
    let line:
      | { top: number; left: number; height: number; text: string; ends: number[] }
      | undefined;
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
        line = { top: r.top, left: r.left, height: r.height, text: "", ends: [] };
        lines.push(line);
      }

      if (space && line.text.endsWith(" ")) continue;
      line.text += space ? " " : ch;
      line.ends.push(r.right - line.left);
    }

    for (const l of lines) {
      const text = l.text.trimEnd();

      if (text.trim()) out.push(run(s, text, l.left, l.top, c, l.ends.slice(0, [...text].length)));
    }
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

  const TRANSFORMS = ["transform", "rotate", "scale", "translate"] as const;

  /**
   * Elements with a z-index, and fixed ones, are painted by the nearest stacking context around them, not where they
   * sit in the tree: each context keeps a list of the layers found under it.
   */
  const layers: { z: number; item: unknown }[][] = [];

  /** The z-index an element is painted at by its stacking context, when it doesn't paint in tree order. */
  const layerOf = (s: CSSStyleDeclaration, parent: CSSStyleDeclaration): number | undefined => {
    const z = s.zIndex === "auto" ? undefined : Number(s.zIndex);

    if (s.position === "fixed") return z ?? 0;

    return s.position !== "static" || /flex|grid/.test(parent.display) ? z : undefined;
  };

  const isContext = (s: CSSStyleDeclaration): boolean =>
    (s.zIndex !== "auto" && s.position !== "static") ||
    s.position === "fixed" ||
    s.position === "sticky" ||
    px(s.opacity) < 1 ||
    TRANSFORMS.some((p) => s[p] !== "none") ||
    s.filter !== "none" ||
    s.backdropFilter !== "none" ||
    s.isolation === "isolate" ||
    s.mixBlendMode !== "normal" ||
    /paint|layout|strict|content/.test(s.contain);

  /**
   * The element's own 2D transform, from `translate`, `rotate`, `scale` and `transform` in the order CSS applies
   * them. A pure translation needs nothing: the boxes the browser reports already moved.
   */
  const matrixOf = (s: CSSStyleDeclaration): DOMMatrix | undefined => {
    if (TRANSFORMS.every((p) => s[p] === "none")) return undefined;
    const m = new DOMMatrix();

    if (s.translate !== "none") {
      const [x = 0, y = 0] = s.translate.split(/\s+/).map(px);
      m.translateSelf(x, y);
    }

    if (s.rotate !== "none") {
      const turn = /(-?[\d.]+)(deg|rad|turn|grad)$/.exec(s.rotate);
      const unit = { deg: 1, rad: 180 / Math.PI, turn: 360, grad: 0.9 }[turn?.[2] ?? "deg"]!;
      m.rotateSelf(turn ? Number(turn[1]) * unit : 0);
    }

    if (s.scale !== "none") {
      const [x = 1, y = x] = s.scale.split(/\s+/).map(Number);
      m.scaleSelf(x, y);
    }

    if (s.transform !== "none") m.multiplySelf(new DOMMatrix(s.transform));

    return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 ? undefined : m;
  };

  /**
   * An element turned, scaled or skewed is read as laid out, with its transform switched off for the moment, and the
   * transform is kept to draw it with. Transitions are off meanwhile, so putting it back doesn't animate.
   */
  const element = (el: Element): unknown => {
    const s = getComputedStyle(el);

    if (s.display === "none") return undefined;
    const m = matrixOf(s);

    if (!m || !(el instanceof HTMLElement || el instanceof SVGElement)) return laid(el, s);
    const saved = ["transition", ...TRANSFORMS].map(
      (p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)] as const,
    );

    for (const [p] of saved) el.style.setProperty(p, "none", "important");
    const [ox = 0, oy = 0] = s.transformOrigin.split(/\s+/).map(px);
    const item = laid(el, s, true) as { box: { x: number; y: number } } | undefined;

    for (const [p, value, priority] of saved.slice(1)) el.style.setProperty(p, value, priority);
    void getComputedStyle(el).transform;
    const [p, value, priority] = saved[0]!;
    el.style.setProperty(p, value, priority);

    if (!item) return undefined;

    return {
      ...item,
      transform: {
        matrix: [m.a, m.b, m.c, m.d, m.e, m.f].map(round),
        origin: [round(item.box.x + ox), round(item.box.y + oy)],
      },
    };
  };

  /** The text a pseudo-element's `content` puts in: its strings, joined. Counters and images give none. */
  const contentText = (content: string): string =>
    [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((m) =>
        m[1]!
          .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
            String.fromCodePoint(parseInt(hex, 16)),
          )
          .replace(/\\(.)/g, "$1"),
      )
      .join("");

  /**
   * A `::before` or `::after`, from where Chromium laid it out (`marks`) and its computed style. The box comes moved by
   * however far `el` moved since it was measured, so a transform switched off for reading still holds. Its text is
   * one line, placed as the box aligns it.
   */
  const pseudo = (el: Element, which: "before" | "after", now: DOMRect): unknown => {
    const mark = marks?.get(el);
    const quad = mark?.[which];

    if (!mark || !quad) return undefined;
    const s = getComputedStyle(el, `::${which}`);

    if (s.display === "none" || s.content === "none" || s.content === "normal") return undefined;
    const dx = now.left - mark.own[0]!;
    const dy = now.top - mark.own[1]!;
    const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!];
    const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!];
    const m = matrixOf(s);
    const [ox = 0, oy = 0] = s.transformOrigin.split(/\s+/).map(px);
    let r = new DOMRect(
      Math.min(...xs) + dx,
      Math.min(...ys) + dy,
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    );

    if (m) {
      // The quad is the box after its transform: its first corner, carried back through the matrix about the origin.
      const outer = s.boxSizing === "border-box" ? 0 : 1;
      const w =
        px(s.width) +
        outer *
          (px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth));
      const h =
        px(s.height) +
        outer *
          (px(s.paddingTop) + px(s.paddingBottom) + px(s.borderTopWidth) + px(s.borderBottomWidth));
      const x = quad[0]! - m.e + m.a * ox + m.c * oy - ox;
      const y = quad[1]! - m.f + m.b * ox + m.d * oy - oy;
      r = new DOMRect(x + dx, y + dy, w, h);
    }

    const b = rel(r);
    const children: unknown[] = [];
    const text = contentText(s.content);
    const c = color(s.color);

    if (text.trim() && c && s.visibility !== "hidden") {
      const ends = measure(s, text);
      const width = ends.at(-1) ?? 0;
      const left = r.left + px(s.borderLeftWidth) + px(s.paddingLeft);
      const top = r.top + px(s.borderTopWidth) + px(s.paddingTop);
      const cw = r.width - (left - r.left) - px(s.borderRightWidth) - px(s.paddingRight);
      const ch = r.height - (top - r.top) - px(s.borderBottomWidth) - px(s.paddingBottom);
      const boxy = /flex|grid/.test(s.display);
      const { area } = probe(s);
      const line = s.lineHeight === "normal" ? area : px(s.lineHeight);

      const x =
        s.textAlign === "center" || (boxy && s.justifyContent === "center")
          ? left + (cw - width) / 2
          : /right|end/.test(s.textAlign) || (boxy && /end/.test(s.justifyContent))
            ? left + cw - width
            : left;
      const y =
        s.display === "inline"
          ? top
          : boxy && s.alignItems === "center"
            ? top + (ch - area) / 2
            : top + (line - area) / 2;

      children.push(run(s, text, x, y, c, ends));
    }

    return {
      kind: "box",
      tag: `::${which}`,
      box: b,
      ...surface(s, r, b),
      clip: s.overflowX !== "visible" || s.overflowY !== "visible",
      children,
      ...(m
        ? {
            transform: {
              matrix: [m.a, m.b, m.c, m.d, m.e, m.f].map(round),
              origin: [round(b.x + ox), round(b.y + oy)],
            },
          }
        : {}),
    };
  };

  /** `turned`: the element has a transform, switched off while it's read, so it is a stacking context. */
  const laid = (el: Element, s: CSSStyleDeclaration, turned = false): unknown => {
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

    let children: unknown[] = [];
    const context = el === root || turned || isContext(s);

    if (context) layers.push([]);

    const place = (item: unknown, own: CSSStyleDeclaration) => {
      const z = item ? layerOf(own, s) : undefined;

      if (item && z !== undefined) layers.at(-1)!.push({ z, item });
      else if (item) children.push(item);
    };

    place(pseudo(el, "before", r), getComputedStyle(el, "::before"));

    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) texts(child as Text, s, children);
      else if (child.nodeType === Node.ELEMENT_NODE)
        place(element(child as Element), getComputedStyle(child as Element));
    }

    place(pseudo(el, "after", r), getComputedStyle(el, "::after"));

    // A stacking context paints its layers below zero, then its own flow, then the rest by z-index, ties in tree order.
    if (context) {
      const raised = layers.pop()!.sort((a, b) => a.z - b.z);

      children = [
        ...raised.filter((l) => l.z < 0).map((l) => l.item),
        ...children,
        ...raised.filter((l) => l.z >= 0).map((l) => l.item),
      ];
    }

    if (
      (el instanceof HTMLInputElement && !/checkbox|radio|range|color|file/.test(el.type)) ||
      el instanceof HTMLTextAreaElement
    ) {
      const value =
        el instanceof HTMLInputElement && el.type === "password"
          ? "•".repeat(el.value.length)
          : el.value;
      const text = value || el.placeholder;
      const c = color(value ? s.color : getComputedStyle(el, "::placeholder").color);

      if (text && c) {
        const top = px(s.paddingTop) + px(s.borderTopWidth);
        const inner = r.height - top - px(s.paddingBottom) - px(s.borderBottomWidth);
        const { area } = probe(s);
        const x = r.left + px(s.paddingLeft) + px(s.borderLeftWidth);

        const lineTop =
          el instanceof HTMLTextAreaElement ? r.top + top : r.top + top + (inner - area) / 2;

        children.push(run(s, text, x, lineTop, c, measure(s, text), !value));
      }
    }

    const named = Object.keys(parts).find((name) => el.matches(parts[name]!));

    return {
      kind: "box",
      tag,
      part: el.getAttribute("data-part") ?? named,
      key: el.getAttribute("data-key") ?? undefined,
      id: el.id || undefined,
      box: rel(r),
      ...surface(s, r, rel(r)),
      clip: s.overflowX !== "visible" || s.overflowY !== "visible",
      children,
    };
  };

  return element(root) as Box;
}
