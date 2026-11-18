import type {
  Anim,
  Box,
  Gradient,
  Graphic,
  Item,
  Picture,
  Placement,
  Radii,
  Rect,
  Rgb,
  Shadow,
  Stop,
  TextRun,
  Vector,
} from "./tree.ts";

export interface Marks {
  readonly own: readonly number[];
  readonly before?: readonly number[];
  readonly after?: readonly number[];
  readonly text?: { readonly before?: string; readonly after?: string };
}

export interface RangeMarks {
  readonly track: RangePart;
  readonly thumb: RangePart;
}

interface RangePart {
  readonly rect: readonly [number, number, number, number];
  readonly style: Readonly<Record<string, string>>;
}

declare global {
  var __svjeezPseudo: WeakMap<Element, Marks> | undefined;
  var __svjeezRange: WeakMap<Element, RangeMarks> | undefined;
  var __svjeezAnims: WeakMap<Element, Anim[]> | undefined;
  var __svjeezImages: Map<string, readonly [number, number]> | undefined;
  var __svjeezStills: WeakMap<Element, { href: string; at?: Rect }> | undefined;
  var __svjeezCanvases: HTMLCanvasElement[] | undefined;
}

type Surface = Pick<
  Box,
  | "radii"
  | "background"
  | "gradients"
  | "pictures"
  | "mask"
  | "border"
  | "outline"
  | "shadows"
  | "insets"
  | "opacity"
  | "blend"
  | "isolate"
>;

export function walk({
  selector,
  pad,
  parts,
}: {
  selector: string;
  pad: number;
  parts: Record<string, string>;
}): Box {
  const found = document.querySelector(selector);
  const wholePage = found === document.body || found === document.documentElement;
  const root = wholePage ? document.documentElement : found;
  const marks = globalThis.__svjeezPseudo;
  const marked = globalThis.__svjeezRange;
  const stills = globalThis.__svjeezStills;

  if (!root) throw new Error(`snap() found nothing at ${selector}.`);

  const origin = wholePage
    ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    : root.getBoundingClientRect();

  const frame = wholePage
    ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight }
    : {
        left: origin.left - pad,
        top: origin.top - pad,
        right: origin.right + pad,
        bottom: origin.bottom + pad,
      };

  const outside = (r: { left: number; top: number; right: number; bottom: number }): boolean =>
    r.right <= frame.left ||
    r.left >= frame.right ||
    r.bottom <= frame.top ||
    r.top >= frame.bottom;

  const px = (value: string): number => parseFloat(value) || 0;
  const round = (n: number): number => Math.round(n * 100) / 100;

  const degrees = (unit: string): number =>
    unit === "rad" ? 180 / Math.PI : unit === "turn" ? 360 : unit === "grad" ? 0.9 : 1;

  const rel = (r: DOMRect): Rect => ({
    x: round(r.left - origin.left + pad),
    y: round(r.top - origin.top + pad),
    width: round(r.width),
    height: round(r.height),
  });

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const colors = new Map<string, Rgb | undefined>();

  const color = (css: string): Rgb | undefined => {
    if (!css || css === "transparent" || css === "none") return undefined;

    if (colors.has(css)) return colors.get(css);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

    const value: Rgb | undefined =
      a === 0
        ? undefined
        : a === 255
          ? `rgb(${r},${g},${b})`
          : `rgba(${r},${g},${b},${round(a! / 255)})`;

    colors.set(css, value);

    return value;
  };

  const metrics = new Map<string, { ascent: number; area: number }>();

  const probe = (s: CSSStyleDeclaration) => {
    const key = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    let found = metrics.get(key);

    if (found) return found;
    const div = document.createElement("div");
    div.style.cssText =
      "position:absolute;left:0;top:0;white-space:nowrap;line-height:normal;visibility:hidden";
    div.style.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize}/normal ${s.fontFamily}`;
    const x = document.createTextNode("x");

    div.append(x);
    const mark = document.createElement("i");
    mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    div.append(mark);
    document.body.append(div);
    const range = document.createRange();
    range.selectNodeContents(x);
    const text = range.getBoundingClientRect();
    found = { ascent: mark.getBoundingClientRect().top - text.top, area: text.height };
    div.remove();
    metrics.set(key, found);

    return found;
  };

  const radii = (s: CSSStyleDeclaration, w: number, h: number): Radii => {
    const corner = (v: string, side: number) =>
      v.trim().endsWith("%") ? (px(v) / 100) * side : px(v);

    const tl = corner(s.borderTopLeftRadius, w);
    const tr = corner(s.borderTopRightRadius, w);
    const br = corner(s.borderBottomRightRadius, w);
    const bl = corner(s.borderBottomLeftRadius, w);

    const f = Math.min(
      1,
      w / (tl + tr || 1),
      w / (bl + br || 1),
      h / (tl + bl || 1),
      h / (tr + br || 1),
    );

    return [round(tl * f), round(tr * f), round(br * f), round(bl * f)];
  };

  const shadows = (value: string, inset: boolean): Shadow[] =>
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

  const alpha = (c: string): number => Number(/rgba\(.*,\s*([\d.]+)\)$/.exec(c)?.[1] ?? 1);
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).join(",");

  const stopsOf = (args: string[], length: number): Stop[] => {
    const raw: { color: Rgb; at?: number }[] = [];

    for (const arg of args) {
      const [c = "", ...at] = split(arg, /\s/);

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

      return (sides.length ? sides : ["0,0,0"]).map((side): Stop => ({
        offset: stop.at!,
        color: `rgba(${side},0)`,
      }));
    });
  };

  const span = (stops: Stop[], lo: number, hi: number): Stop[] =>
    stops.map((s) => ({ ...s, offset: round((s.offset - lo) / (hi - lo)) }));

  const gradientsOf = (s: CSSStyleDeclaration, b: Rect): Gradient[] => {
    if (s.backgroundImage === "none" || s.visibility === "hidden") return [];
    const bt = px(s.borderTopWidth);
    const br = px(s.borderRightWidth);
    const bb = px(s.borderBottomWidth);
    const bl = px(s.borderLeftWidth);
    const x0 = b.x + bl;
    const y0 = b.y + bt;
    const w = b.width - bl - br;
    const h = b.height - bt - bb;

    if (w <= 0 || h <= 0) return [];

    return split(s.backgroundImage)
      .flatMap((layer): Gradient[] => {
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
              const deg = Number(angle[1]) * degrees(angle[2]!);
              dx = Math.sin((deg * Math.PI) / 180);
              dy = -Math.cos((deg * Math.PI) / 180);
            } else if (lead.startsWith("to")) {
              const sx = /right/.test(lead) ? 1 : /left/.test(lead) ? -1 : 0;
              const sy = /bottom/.test(lead) ? 1 : /top/.test(lead) ? -1 : 0;
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
              repeat: repeat || undefined,
            },
          ];
        }

        let ending = "";

        if (/^(circle|ellipse|closest|farthest|at\b|in\b|[\d.])/.test(args[0]!))
          ending = args.shift()!;

        const [size = "", where = ""] = ending
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
            repeat: repeat || undefined,
          },
        ];
      })
      .reverse();
  };

  const frost = (c: Rgb | undefined, s: CSSStyleDeclaration): Rgb | undefined => {
    const blur = /blur\(([\d.]+)px\)/.exec(s.backdropFilter);

    if (!c || !blur || alpha(c) >= 1) return c;

    const a = alpha(c);

    return `rgba(${rgb(c)},${round(a + (1 - a) * Math.min(0.5, Number(blur[1]) / 24))})`;
  };

  const natural = (url: string): readonly [number, number] | undefined =>
    globalThis.__svjeezImages?.get(url);

  const lengthOf = (v: string | undefined, of: number): number | undefined => {
    const calc = /^calc\(\s*(-?[\d.]+)%\s*([+-])\s*([\d.]+)px\s*\)$/.exec(v ?? "");

    if (calc)
      return (parseFloat(calc[1]!) / 100) * of + (calc[2] === "-" ? -1 : 1) * parseFloat(calc[3]!);
    const n = parseFloat(v ?? "");

    return !v || !Number.isFinite(n) ? undefined : v.endsWith("%") ? (n / 100) * of : n;
  };

  const placements = (
    image: string,
    sizes: string,
    positions: string,
    repeats: string,
    area: Rect,
  ): Placement[] => {
    if (!image.includes("url(") || area.width <= 0 || area.height <= 0) return [];
    const sz = split(sizes);
    const ps = split(positions);
    const rp = split(repeats);

    const pick = (list: string[], i: number, rest: string) =>
      (list[i % list.length] ?? rest).trim();

    const run = (start: number, len: number, lo: number, hi: number): number[] => {
      const out: number[] = [];

      for (let s = start - Math.ceil((start - lo) / len) * len; s < hi && out.length < 40; s += len)
        out.push(s);

      return out;
    };

    return split(image)
      .flatMap((layer, i): Placement[] => {
        const href = /url\(\s*(["']?)(.*?)\1\s*\)/.exec(layer)?.[2];

        if (!href) return [];
        const [nw, nh] = natural(href) ?? [0, 0];
        const ratio = nw && nh ? nw / nh : undefined;
        const size = pick(sz, i, "auto");
        const [sx, sy = "auto"] = size.match(/calc\([^)]*\)|\S+/g) ?? [];
        let w: number | undefined;
        let h: number | undefined;

        if (size === "cover" || size === "contain") {
          const fit = size === "cover" ? Math.max : Math.min;
          const k = ratio ? fit(area.width / nw, area.height / nh) : undefined;

          [w, h] = k ? [nw * k, nh * k] : [area.width, area.height];
        } else {
          w = lengthOf(sx, area.width);
          h = lengthOf(sy, area.height);

          if (w === undefined && h === undefined)
            [w, h] = nw ? [nw, nh] : [area.width, area.height];
          else if (w === undefined) w = ratio && h ? h * ratio : area.width;
          else if (h === undefined) h = ratio ? w / ratio : area.height;
        }

        if (!w || !h || w <= 0 || h <= 0) return [];
        const [ox = "50%", oy = "50%"] = pick(ps, i, "0% 0%").match(/calc\([^)]*\)|\S+/g) ?? [];
        const x = area.x + (lengthOf(ox, area.width - w) ?? 0);
        const y = area.y + (lengthOf(oy, area.height - h) ?? 0);
        const repeat = pick(rp, i, "repeat");
        const both = repeat === "repeat" || /space|round/.test(repeat);
        const xs = both || repeat === "repeat-x" ? run(x, w, area.x, area.x + area.width) : [x];
        const ys = both || repeat === "repeat-y" ? run(y, h, area.y, area.y + area.height) : [y];

        const tiles = ys
          .flatMap((ty) =>
            xs.map((tx) => ({ x: round(tx), y: round(ty), width: round(w), height: round(h) })),
          )
          .slice(0, 400);

        return [{ href, tiles }];
      })
      .reverse();
  };

  const surface = (s: CSSStyleDeclaration, r: DOMRect, b: Rect): Surface => {
    const visible = s.visibility !== "hidden";

    const widths = [
      px(s.borderTopWidth),
      px(s.borderRightWidth),
      px(s.borderBottomWidth),
      px(s.borderLeftWidth),
    ] as const;

    const sides = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
    const borderColor = color(sides[widths.findIndex((w) => w > 0)] ?? "");
    const gradients = gradientsOf(s, b);
    const ring = color(s.outlineColor);
    const auto = s.outlineStyle === "auto";

    const padding = {
      x: b.x + widths[3],
      y: b.y + widths[0],
      width: b.width - widths[1] - widths[3],
      height: b.height - widths[0] - widths[2],
    };

    const listed = (list: Placement[]) => (list.length > 0 ? list : undefined);

    return {
      radii: radii(s, r.width, r.height),
      background: visible ? frost(color(s.backgroundColor), s) : undefined,
      gradients: gradients.length > 0 ? gradients : undefined,
      pictures: visible
        ? listed(
            placements(
              s.backgroundImage,
              s.backgroundSize,
              s.backgroundPosition,
              s.backgroundRepeat,
              padding,
            ),
          )
        : undefined,
      mask: listed(
        placements(
          s.maskImage || s.webkitMaskImage,
          s.maskSize || s.webkitMaskSize,
          s.maskPosition || s.webkitMaskPosition,
          s.maskRepeat || s.webkitMaskRepeat,
          b,
        ),
      ),
      border:
        visible && borderColor && widths.some((w) => w > 0)
          ? { widths, color: borderColor }
          : undefined,
      outline:
        visible && ring && !/^(none|hidden)$/.test(s.outlineStyle) && px(s.outlineWidth) > 0
          ? {
              width: auto ? Math.max(2, px(s.outlineWidth)) : px(s.outlineWidth),
              offset: auto ? -Math.max(2, px(s.outlineWidth)) : px(s.outlineOffset),
              color: ring,
            }
          : undefined,
      shadows: visible ? shadows(s.boxShadow, false) : [],
      insets: visible && /\binset\b/.test(s.boxShadow) ? shadows(s.boxShadow, true) : undefined,
      opacity: px(s.opacity),
      blend: s.mixBlendMode !== "normal" ? s.mixBlendMode : undefined,
      isolate: s.isolation === "isolate" ? true : undefined,
    };
  };

  const stack = (s: CSSStyleDeclaration) =>
    s.fontFamily.split(",").map((f) => f.trim().replace(/^["']|["']$/g, ""));

  const family = (s: CSSStyleDeclaration) => stack(s)[0]!;

  const fallback = (s: CSSStyleDeclaration): string => {
    const [first, ...rest] = stack(s);
    const generic = /^(serif|sans-serif|monospace|cursive|fantasy)$/;
    const names = rest.filter((f) => f && f !== first);

    if (!names.some((f) => generic.test(f)) && !generic.test(first!))
      names.push(
        /mono|courier|consolas|menlo|code/i.test(first!)
          ? "monospace"
          : /times|georgia|garamond|palatino|cambria|bookman|didot|serif/i.test(first!) &&
              !/sans/i.test(first!)
            ? "serif"
            : "sans-serif",
      );

    return names.map((f) => (/^[\w -]+$/.test(f) && !/^\d/.test(f) ? f : `'${f}'`)).join(", ");
  };

  const stretch = (s: CSSStyleDeclaration): number | undefined => {
    const n = parseFloat(s.fontStretch);

    return Number.isFinite(n) && n !== 100 ? n : undefined;
  };

  const up = (node: Node): Element | null => {
    const root = node.getRootNode();

    return node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
  };

  const decorationOf = (node: Text): TextRun["decoration"] => {
    for (let el = up(node); el && el !== document.body; el = up(el)) {
      const s = getComputedStyle(el);
      const line = /underline|line-through|overline/.exec(s.textDecorationLine)?.[0];

      if (line) {
        const c = color(s.textDecorationColor);

        // SAFETY: the regex matches only the three keywords TextRun["decoration"] names.
        return c && alpha(c) > 0 ? (line as TextRun["decoration"]) : undefined;
      }

      if (
        s.display.startsWith("inline-") ||
        s.cssFloat !== "none" ||
        /absolute|fixed/.test(s.position)
      )
        return undefined;
    }

    return undefined;
  };

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
    c: Rgb,
    advances: number[],
    placeholder = false,
  ): TextRun => ({
    kind: "text",
    text: transform(text, s),
    x: round(x - origin.left + pad),
    y: round(top + probe(s).ascent - origin.top + pad),
    family: family(s),
    fallback: fallback(s) || undefined,
    weight: px(s.fontWeight),
    style: s.fontStyle === "italic" ? "italic" : "normal",
    size: px(s.fontSize),
    color: c,
    stretch: stretch(s),
    letterSpacing: s.letterSpacing === "normal" ? 0 : px(s.letterSpacing),
    advances: advances.map(round),
    placeholder: placeholder || undefined,
  });

  const measure = (s: CSSStyleDeclaration, text: string): number[] => {
    const span = document.createElement("span");
    span.style.cssText = "position:absolute;left:0;top:0;white-space:pre;visibility:hidden";
    span.style.font = s.font || `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    span.style.letterSpacing = s.letterSpacing;
    const node = document.createTextNode(text);

    span.append(node);
    document.body.append(span);
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

  const texts = (node: Text, s: CSSStyleDeclaration, out: Item[]) => {
    const c = color(s.color);

    if (!c || s.visibility === "hidden") return;
    const decoration = decorationOf(node);
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

    let box: Element | null = up(node);

    while (box && /^(inline|contents)$/.test(getComputedStyle(box).display)) box = up(box);
    const cut = box && getComputedStyle(box);

    const limit =
      box && cut && cut.textOverflow === "ellipsis" && cut.overflowX !== "visible"
        ? box.getBoundingClientRect().right - px(cut.borderRightWidth) - px(cut.paddingRight)
        : undefined;

    for (const l of lines) {
      if (limit !== undefined && l.left + (l.ends.at(-1) ?? 0) > limit + 0.5) {
        const chars = [...l.text];
        const dots = measure(s, "…")[0] ?? 0;
        let keep = 0;

        while (keep < chars.length && l.left + l.ends[keep]! + dots <= limit + 0.5) keep++;

        l.text = chars.slice(0, keep).join("") + "…";
        l.ends = [...l.ends.slice(0, keep), (l.ends[keep - 1] ?? 0) + dots];
      }

      const text = l.text.trimEnd();

      if (
        outside({
          left: l.left,
          top: l.top,
          right: l.left + (l.ends.at(-1) ?? 0),
          bottom: l.top + px(s.fontSize) * 2,
        })
      )
        continue;

      if (text.trim())
        out.push({
          ...run(s, text, l.left, l.top, c, l.ends.slice(0, [...text].length)),
          decoration,
        });
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

  const DRAWN = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"];
  const CONTAINERS = ["g", "svg", "a", "switch"];

  let extent: readonly [number, number] = [0, 0];

  const maskText = (el: Element, s: CSSStyleDeclaration): Vector | undefined => {
    // SAFETY: maskText is only called for a `<text>`, which is an SVG element.
    const svg = (el as SVGElement).ownerSVGElement;
    const c = color(s.fill);
    const text = el.textContent?.trim();

    if (!svg || !c || !text) return undefined;
    const box = svg.getBoundingClientRect();
    const kx = box.width / (extent[0] || 1);
    const ky = box.height / (extent[1] || 1);
    const at = (name: string, of: number) => lengthOf(el.getAttribute(name) ?? "0", of) ?? 0;
    const ends = measure(s, text);
    const width = ends.at(-1) ?? 0;
    const { ascent, area } = probe(s);

    const x =
      box.left +
      at("x", extent[0]) * kx -
      (s.textAnchor === "middle" ? width / 2 : s.textAnchor === "end" ? width : 0);

    const y = box.top + (at("y", extent[1]) + at("dy", extent[1])) * ky;
    const centered = /central|middle/.test(s.dominantBaseline);

    return {
      tag: "text",
      attrs: {},
      children: [],
      run: run(s, text, x, centered ? y - area / 2 : y - ascent, c, ends),
    };
  };

  const vector = (el: Element, via?: CSSStyleDeclaration, depth = 0): Vector | undefined => {
    const tag = el.tagName.toLowerCase();
    const s = getComputedStyle(el);

    if (s.display === "none" || depth > 8) return undefined;

    if (tag === "text" && el.closest("mask")) return maskText(el, s);

    const attrs: Record<string, string> = {};

    for (const name of GEOMETRY) {
      const v = el.getAttribute(name);

      if (v === null || (CONTAINERS.includes(tag) && name !== "transform")) continue;

      attrs[name] = v.trim().endsWith("%")
        ? String(
            round((px(v) / 100) * (/^(x|cx|rx|width|x1|x2)$/.test(name) ? extent[0] : extent[1])),
          )
        : v;
    }

    if (tag === "use") {
      const id = (el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? "").replace(
        /^.*#/,
        "",
      );

      const target = id ? el.ownerDocument.getElementById(id) : null;

      if (!target) return undefined;

      const move = `translate(${px(el.getAttribute("x") ?? "0")} ${px(el.getAttribute("y") ?? "0")})`;
      const place = [el.getAttribute("transform"), move].filter(Boolean).join(" ");

      const inner = (
        target.tagName.toLowerCase() === "symbol" ? [...target.children] : [target]
      ).flatMap((c) => vector(c, s, depth + 1) ?? []);

      if (s.opacity === "1") return { tag: "g", attrs: { transform: place }, children: inner };

      return { tag: "g", attrs: { transform: place, opacity: s.opacity }, children: inner };
    }

    const container = CONTAINERS.includes(tag);

    if (!container && !DRAWN.includes(tag)) return undefined;

    if (container) {
      if (tag === "svg") {
        const x = px(el.getAttribute("x") ?? "0");
        const y = px(el.getAttribute("y") ?? "0");

        if (x || y) attrs.transform = `translate(${x} ${y})`;
      }
    } else {
      // SAFETY: only the elements in DRAWN get this far, and they are SVG elements.
      const own = (name: string) =>
        el.hasAttribute(name) || (el as SVGElement).style.getPropertyValue(name) !== "";

      const paint = (name: "fill" | "stroke") => (via && !own(name) ? via : s)[name];

      attrs.fill = paint("fill") === "none" ? "none" : (color(paint("fill")) ?? "none");
      attrs.stroke = paint("stroke") === "none" ? "none" : (color(paint("stroke")) ?? "none");

      if (attrs.stroke !== "none") {
        attrs["stroke-width"] = String(px(s.strokeWidth));
        attrs["stroke-linecap"] = s.strokeLinecap;
        attrs["stroke-linejoin"] = s.strokeLinejoin;
      }
    }

    if (s.opacity !== "1") attrs.opacity = s.opacity;

    const drawn: Vector = {
      tag: tag === "svg" || tag === "a" || tag === "switch" ? "g" : tag,
      attrs,
      children: container ? [...el.children].flatMap((c) => vector(c, via, depth) ?? []) : [],
    };

    const ref = /url\(["']?#([^)"']+)/.exec(el.getAttribute("mask") ?? "");
    const mask = ref ? el.ownerDocument.getElementById(ref[1]!) : null;

    return mask?.tagName.toLowerCase() === "mask"
      ? {
          tag: "g",
          attrs: {},
          children: [drawn],
          mask: [...mask.children].flatMap((c) => vector(c, via, depth + 1) ?? []),
        }
      : drawn;
  };

  const TRANSFORMS = ["transform", "rotate", "scale", "translate"] as const;

  const layers: { z: number; item: Item }[][] = [];

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

  const matrixOf = (s: CSSStyleDeclaration): DOMMatrix | undefined => {
    if (TRANSFORMS.every((p) => s[p] === "none")) return undefined;
    const m = new DOMMatrix();

    if (s.translate !== "none") {
      const [x = 0, y = 0] = s.translate.split(/\s+/).map(px);
      m.translateSelf(x, y);
    }

    if (s.rotate !== "none") {
      const turn = /(-?[\d.]+)(deg|rad|turn|grad)$/.exec(s.rotate);
      m.rotateSelf(turn ? Number(turn[1]) * degrees(turn[2]!) : 0);
    }

    if (s.scale !== "none") {
      const [x = 1, y = x] = s.scale.split(/\s+/).map(Number);
      m.scaleSelf(x, y);
    }

    if (s.transform !== "none") m.multiplySelf(new DOMMatrix(s.transform));

    return m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 ? undefined : m;
  };

  const culled = (el: Element): boolean => {
    const r = el.getBoundingClientRect();

    if (!r.width || !r.height || !outside(r)) return false;

    if (getComputedStyle(el).display === "inline") return false;

    return (
      !(el instanceof HTMLElement) ||
      (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) ||
      el.clientWidth === 0
    );
  };

  const flat = (parent: Element | ShadowRoot): Node[] =>
    [...parent.childNodes].flatMap((n) =>
      n instanceof HTMLSlotElement ? n.assignedNodes({ flatten: true }) : [n],
    );

  const element = (el: Element): Item | undefined => {
    const s = getComputedStyle(el);

    if (s.display === "none") return undefined;

    if (el !== root && culled(el)) return undefined;
    const m = matrixOf(s);

    if (!m || !(el instanceof HTMLElement || el instanceof SVGElement)) return laid(el, s);

    const saved = ["transition", ...TRANSFORMS].map(
      (p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)] as const,
    );

    for (const [p] of saved) el.style.setProperty(p, "none", "important");
    const [ox = 0, oy = 0] = s.transformOrigin.split(/\s+/).map(px);
    const item = laid(el, s, true);

    for (const [p, value, priority] of saved.slice(1)) el.style.setProperty(p, value, priority);
    void getComputedStyle(el).transform;
    const [p, value, priority] = saved[0]!;
    el.style.setProperty(p, value, priority);

    if (!item) return undefined;

    return {
      ...item,
      transform: {
        matrix: [round(m.a), round(m.b), round(m.c), round(m.d), round(m.e), round(m.f)],
        origin: [round(item.box.x + ox), round(item.box.y + oy)],
      },
    };
  };

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

  const pseudo = (el: Element, which: "before" | "after", now: DOMRect): Box | undefined => {
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
    const children: Item[] = [];
    const text = mark.text?.[which] ?? contentText(s.content);
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
      transform: m && {
        matrix: [round(m.a), round(m.b), round(m.c), round(m.d), round(m.e), round(m.f)],
        origin: [round(b.x + ox), round(b.y + oy)],
      },
    };
  };

  const laid = (
    el: Element,
    s: CSSStyleDeclaration,
    turned = false,
  ): Box | Graphic | Picture | undefined => {
    const r = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();

    if (el instanceof SVGSVGElement) {
      if (!r.width || !r.height) return undefined;
      const vb = el.viewBox.baseVal;

      const viewBox: Graphic["viewBox"] =
        vb && vb.width ? [vb.x, vb.y, vb.width, vb.height] : [0, 0, r.width, r.height];

      extent = [viewBox[2], viewBox[3]];

      return {
        kind: "graphic",
        box: rel(r),
        viewBox,
        anims: globalThis.__svjeezAnims?.get(el),
        children: [...el.children].flatMap((c) => vector(c) ?? []),
      };
    }

    if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) {
      const still = el instanceof HTMLCanvasElement ? stills?.get(el) : undefined;
      const href = el instanceof HTMLImageElement ? el.currentSrc || el.src : still?.href;
      const loaded = el instanceof HTMLImageElement ? el.complete : true;

      if (!href || !loaded || r.width === 0 || r.height === 0) return undefined;

      const cx = r.left + px(s.borderLeftWidth) + px(s.paddingLeft);
      const cy = r.top + px(s.borderTopWidth) + px(s.paddingTop);

      const cw =
        r.width -
        px(s.borderLeftWidth) -
        px(s.borderRightWidth) -
        px(s.paddingLeft) -
        px(s.paddingRight);

      const ch =
        r.height -
        px(s.borderTopWidth) -
        px(s.borderBottomWidth) -
        px(s.paddingTop) -
        px(s.paddingBottom);

      const nw = el instanceof HTMLImageElement ? el.naturalWidth : el.width;
      const nh = el instanceof HTMLImageElement ? el.naturalHeight : el.height;
      let fit: Rect | undefined;

      if (nw && nh && cw > 0 && ch > 0 && s.objectFit !== "fill") {
        const k =
          s.objectFit === "cover"
            ? Math.max(cw / nw, ch / nh)
            : s.objectFit === "none"
              ? 1
              : s.objectFit === "scale-down"
                ? Math.min(1, cw / nw, ch / nh)
                : Math.min(cw / nw, ch / nh);

        const [ox = "50%", oy = "50%"] = s.objectPosition.split(/\s+/);

        const at = (v: string, space: number) =>
          v.endsWith("%") ? (parseFloat(v) / 100) * space : px(v);

        fit = rel(new DOMRect(cx + at(ox, cw - nw * k), cy + at(oy, ch - nh * k), nw * k, nh * k));
      }

      const own = surface(s, r, rel(r));

      const chrome =
        own.background ||
        own.border ||
        own.gradients ||
        own.insets ||
        own.shadows.length > 0 ||
        own.opacity < 1 ||
        own.blend;

      if (still?.at)
        fit = rel(new DOMRect(still.at.x, still.at.y, still.at.width, still.at.height));

      if (!chrome) return { kind: "image", box: rel(r), radii: own.radii, href, fit };

      const inner = rel(new DOMRect(cx, cy, Math.max(cw, 0), Math.max(ch, 0)));

      return {
        kind: "box",
        tag,
        part: el.getAttribute("data-part") ?? undefined,
        key: el.getAttribute("data-key") ?? undefined,
        id: el.id || undefined,
        box: rel(r),
        ...own,
        clip: own.radii.some((r) => r > 0),
        children: [{ kind: "image", box: inner, radii: [0, 0, 0, 0], href, fit }],
      };
    }

    let children: Item[] = [];
    const context = el === root || turned || isContext(s);

    if (context) layers.push([]);

    const place = (item: Item | undefined, own: CSSStyleDeclaration) => {
      const z = item ? layerOf(own, s) : undefined;

      if (item && z !== undefined) layers.at(-1)!.push({ z, item });
      else if (item) children.push(item);
    };

    place(pseudo(el, "before", r), getComputedStyle(el, "::before"));

    for (const child of flat(el.shadowRoot ?? el)) {
      if (child instanceof Text) texts(child, s, children);
      else if (child instanceof Element) place(element(child), getComputedStyle(child));
    }

    place(pseudo(el, "after", r), getComputedStyle(el, "::after"));

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

    if (el instanceof HTMLInputElement && el.type === "color") {
      const [dy, dx] = s.appearance === "none" ? [0, 0] : [4, 2];
      const left = r.left + px(s.borderLeftWidth) + px(s.paddingLeft) + dx;
      const top = r.top + px(s.borderTopWidth) + px(s.paddingTop) + dy;
      const right = r.right - px(s.borderRightWidth) - px(s.paddingRight) - dx;
      const bottom = r.bottom - px(s.borderBottomWidth) - px(s.paddingBottom) - dy;
      const swatch = new DOMRect(left, top, right - left, bottom - top);

      if (swatch.width > 0 && swatch.height > 0)
        children.push({
          kind: "box",
          tag: "::swatch",
          box: rel(swatch),
          radii: radii(s, swatch.width, swatch.height),
          background: color(el.value),
          shadows: [],
          opacity: 1,
          clip: false,
          children: [],
        });
    }

    const range =
      el instanceof HTMLInputElement && el.type === "range" ? marked?.get(el) : undefined;

    if (range && s.appearance !== "none") {
      const accent = color(s.accentColor === "auto" ? "rgb(0, 117, 255)" : s.accentColor);

      if (accent) {
        const fill = (
          x: number,
          y: number,
          width: number,
          height: number,
          r: number,
          c: Rgb,
        ): Box => ({
          kind: "box",
          tag: "::native",
          box: rel(new DOMRect(x, y, width, height)),
          radii: [r, r, r, r],
          background: c,
          shadows: [],
          opacity: 1,
          clip: false,
          children: [],
        });

        const [tx, ty, tw, th] = range.track.rect;
        const [hx, hy, hw, hh] = range.thumb.rect;
        const [groove, dot] = [6, 16];
        const top = ty + th / 2 - groove / 2;
        const [cx, cy] = [hx + hw / 2, hy + hh / 2];

        children.push(
          fill(tx, top, tw, groove, groove / 2, "rgb(239,239,239)"),
          fill(tx, top, cx - tx, groove, groove / 2, accent),
          fill(cx - dot / 2, cy - dot / 2, dot, dot, dot / 2, accent),
        );
      }
    } else if (range) {
      const probe = document.createElement("div");

      document.documentElement.append(probe);

      for (const [tag, part] of [
        ["::track", range.track],
        ["::thumb", range.thumb],
      ] as const) {
        probe.style.cssText = "position:fixed;pointer-events:none";

        for (const [name, value] of Object.entries(part.style))
          probe.style.setProperty(name, value);

        const rect = new DOMRect(...part.rect);

        children.push({
          kind: "box",
          tag,
          box: rel(rect),
          ...surface(getComputedStyle(probe), rect, rel(rect)),
          clip: false,
          children: [],
        });
      }

      probe.remove();
    }

    const named = Object.keys(parts).find((name) => el.matches(parts[name]!));

    const box: Box = {
      kind: "box",
      tag,
      part: el.getAttribute("data-part") ?? named,
      key: el.getAttribute("data-key") ?? undefined,
      id: el.id || undefined,
      box: rel(r),
      ...surface(s, r, rel(r)),
      clip:
        s.overflowX !== "visible" ||
        s.overflowY !== "visible" ||
        (s.maskImage || "none") !== "none",
      anims: globalThis.__svjeezAnims?.get(el),
      children,
    };

    const bare = el instanceof HTMLInputElement && el.type === "range" && s.appearance !== "none";

    return bare ? { ...box, background: undefined, border: undefined } : box;
  };

  const tree = element(root);

  if (tree?.kind !== "box") throw new Error(`snap() found no element to draw at ${selector}.`);

  if (!wholePage) return tree;

  const body = color(getComputedStyle(document.body).backgroundColor);

  return {
    ...tree,
    box: { x: pad, y: pad, width: innerWidth, height: innerHeight },
    background: tree.background ?? body,
    clip: true,
  };
}
