import type {
  Animation,
  Background,
  ClipShape,
  Control,
  Corner,
  ElementNode,
  Extent,
  FilterFn,
  Font,
  Offset,
  Rect,
  Repeat,
  Run,
  Shadow,
  Side,
  Snapshot,
  Stop,
  SvgNode,
  TextNode,
  TextShadow,
  WebFont,
} from "./schema.ts";

/**
 * Reads a DOM subtree into a Snapshot. It runs inside the page, so it is one self-contained function:
 * no imports at run time, no module state, every helper nested. That is what lets `captureScript` be its own source.
 *
 * Layout is read as it renders right now, so a running animation or transition is captured mid-flight.
 */
interface Pending {
  color: string;
  at?: number;
}

interface Clipped {
  shape?: ClipShape;
  notes: string[];
}

type Pseudo = "::before" | "::after";

type Writable<T> = { -readonly [K in keyof T]: T[K] };

export const capture = (root: Element): Snapshot => {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const scratch = document.createElement("canvas");
  const paint = scratch.getContext("2d", { willReadFrequently: true })!;

  const round = (value: number) => Math.round(value * 1000) / 1000;
  const px = (value: string) => parseFloat(value) || 0;

  /** Any CSS color, as `rgb(r, g, b)` or `rgba(r, g, b, a)`. */
  const color = (value: string): string => {
    const parts = /^rgba?\((.+)\)$/
      .exec(value.trim())?.[1]
      ?.split(/[\s,/]+/)
      .map(Number);

    let [r, g, b, a = 1] = parts ?? [];

    if (r === undefined || g === undefined || b === undefined || [r, g, b, a].some(Number.isNaN)) {
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = "#000";
      paint.fillStyle = value;
      paint.fillRect(0, 0, 1, 1);
      const [pr = 0, pg = 0, pb = 0, pa = 0] = paint.getImageData(0, 0, 1, 1).data;

      [r, g, b, a] = [pr, pg, pb, pa / 255];
    }

    a = round(a);

    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  /** Splits on `separator` outside parentheses. */
  const split = (value: string, separator: string) => {
    const out: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      if (char === "(") depth++;
      else if (char === ")") depth--;
      else if (depth === 0 && char === separator) {
        out.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }

    out.push(value.slice(start).trim());

    return out.filter(Boolean);
  };

  const words = (value: string) => {
    const out: string[] = [];
    let depth = 0;
    let current = "";

    for (const char of value) {
      if (char === "(") depth++;

      if (char === ")") depth--;

      if (depth === 0 && /\s/.test(char)) {
        if (current) out.push(current);
        current = "";
      } else current += char;
    }

    if (current) out.push(current);

    return out;
  };

  // ---------------------------------------------------------------- geometry

  /** The 2D part of an element's own transform: translate, rotate, scale, then transform. */
  const ownMatrix = (style: CSSStyleDeclaration, width: number, height: number) => {
    const matrix = new DOMMatrix();
    const [tx = "0", ty = "0"] = style.translate === "none" ? [] : style.translate.split(" ");

    const length = (value: string, of: number) =>
      value.endsWith("%") ? (parseFloat(value) / 100) * of : px(value);

    matrix.translateSelf(length(tx, width), length(ty, height));

    if (style.rotate !== "none") matrix.rotateSelf(parseFloat(style.rotate.split(" ").pop()!) || 0);

    if (style.scale !== "none") {
      const [sx = "1", sy = sx] = style.scale.split(" ");

      matrix.scaleSelf(parseFloat(sx), parseFloat(sy));
    }

    if (style.transform !== "none") matrix.multiplySelf(new DOMMatrix(style.transform));

    return matrix;
  };

  const invertible = (m: DOMMatrix) => m.a * m.d - m.b * m.c !== 0;

  const isPlain = (m: DOMMatrix) =>
    m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;

  const pageRect = (el: Element | Range) => {
    const rect = el.getBoundingClientRect();

    return {
      left: rect.left + scrollX,
      top: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
    };
  };

  // ------------------------------------------------------------------ paint

  const radiusOf = (style: CSSStyleDeclaration, width: number, height: number) => {
    const read = (value: string): Corner => {
      const [x = "0", y = x] = value.split(" ");

      return [
        x.endsWith("%") ? (parseFloat(x) / 100) * width : px(x),
        y.endsWith("%") ? (parseFloat(y) / 100) * height : px(y),
      ];
    };

    const [tl, tr, br, bl] = [
      read(style.borderTopLeftRadius),
      read(style.borderTopRightRadius),
      read(style.borderBottomRightRadius),
      read(style.borderBottomLeftRadius),
    ];

    const scale = Math.min(
      1,
      width / (tl[0] + tr[0]),
      width / (bl[0] + br[0]),
      height / (tl[1] + bl[1]),
      height / (tr[1] + br[1]),
    );

    const fit = ([x, y]: Corner): Corner => [round(x * scale), round(y * scale)];

    return [fit(tl), fit(tr), fit(br), fit(bl)] as const;
  };

  const fixStops = (parts: Pending[]): Stop[] => {
    const offsets = parts.map((part) => part.at);

    if (offsets[0] === undefined) offsets[0] = 0;

    if (offsets[offsets.length - 1] === undefined) offsets[offsets.length - 1] = 1;
    let high = 0;

    for (let i = 0; i < offsets.length; i++) {
      const at = offsets[i];

      if (at === undefined) continue;
      offsets[i] = high = Math.max(high, at);
    }

    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] !== undefined) continue;
      let next = i;

      while (offsets[next] === undefined) next++;
      const from = offsets[i - 1]!;
      const to = offsets[next]!;

      for (let j = i; j < next; j++)
        offsets[j] = from + ((to - from) * (j - i + 1)) / (next - i + 1);
    }

    return parts.map((part, i) => ({ offset: round(offsets[i]!), color: part.color }));
  };

  /** `red 10%, blue 20px 30px` as stops, with px resolved against `length`. */
  const stopsOf = (args: string[], length: number) => {
    const parts: Pending[] = [];

    for (const arg of args) {
      const [first = "", ...positions] = words(arg);

      if (/^[-\d.]/.test(first)) continue; // an interpolation hint

      const offsets = positions.length === 0 ? [undefined] : positions;

      for (const position of offsets) {
        const at =
          position === undefined
            ? undefined
            : position.endsWith("%")
              ? parseFloat(position) / 100
              : length > 0
                ? px(position) / length
                : 0;

        const part: Pending = { color: color(first) };

        if (at !== undefined) part.at = at;
        parts.push(part);
      }
    }

    return fixStops(parts);
  };

  const angleOf = (value: string, width: number, height: number) => {
    const to = /^to\s+(.+)$/.exec(value)?.[1]?.split(/\s+/);

    if (to) {
      const corner = Math.atan2(width, height) * (180 / Math.PI);
      const key = [...to].sort().join(" ");

      const named = new Map([
        ["top", 0],
        ["right", 90],
        ["bottom", 180],
        ["left", 270],
        ["right top", corner],
        ["bottom right", 180 - corner],
        ["bottom left", 180 + corner],
        ["left top", 360 - corner],
      ]);

      return named.get(key) ?? 180;
    }

    const n = parseFloat(value);

    if (value.endsWith("grad")) return (n * 360) / 400;

    if (value.endsWith("rad")) return n * (180 / Math.PI);

    if (value.endsWith("turn")) return n * 360;

    return n;
  };

  /** A center word pair (`left`, `25%`, `10px top`, ...) as px from the top-left of a `width` by `height` box. */
  const placeOf = (given: string[], width: number, height: number): [number, number] => {
    // `top` and `left` can come in either order.
    const [first = "center", second = "center"] =
      given[0] === "top" || given[0] === "bottom" ? [given[1], given[0]] : given;

    const along = (word: string, of: number, start: string, end: string) =>
      word === start
        ? 0
        : word === end
          ? of
          : word === "center"
            ? of / 2
            : word.endsWith("%")
              ? (parseFloat(word) / 100) * of
              : px(word);

    return [along(first, width, "left", "right"), along(second, height, "top", "bottom")];
  };

  /** `(repeating-)linear/radial-gradient(...)` as a layer drawn into a tile of `width` by `height`. */
  const gradient = (value: string, width: number, height: number): Background | undefined => {
    const call = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/s.exec(value);

    if (!call) return undefined;
    const args = split(call[3]!, ",");
    const repeating = call[1] ? { repeating: true as const } : {};

    const config = /^(to\s|[-\d.]+(deg|grad|rad|turn)$)/.test(args[0] ?? "")
      ? args.shift()
      : /^(circle|ellipse|closest|farthest|[-\d.]+(px|%)|at\s)/.test(args[0] ?? "")
        ? args.shift()
        : undefined;

    if (call[2] === "linear") {
      const angle = config === undefined ? 180 : angleOf(config, width, height);
      const rad = (angle * Math.PI) / 180;
      const length = Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad));

      return { kind: "linear", angle: round(angle), stops: stopsOf(args, length), ...repeating };
    }

    const [shapeAndSize = "", position = ""] = (config ?? "").split(/\bat\b/).map((s) => s.trim());
    const [cx, cy] = placeOf(position ? words(position) : [], width, height);
    const [nearX, farX] = [Math.min(cx, width - cx), Math.max(cx, width - cx)];
    const [nearY, farY] = [Math.min(cy, height - cy), Math.max(cy, height - cy)];
    const given = words(shapeAndSize);
    const lengths = given.filter((word) => /^[-\d.]/.test(word));
    const keyword = /(closest|farthest)-(side|corner)/.exec(shapeAndSize)?.[0];
    const circle = given.includes("circle") || (lengths.length === 1 && !given.includes("ellipse"));
    const closest = keyword?.startsWith("closest") === true;
    const corner = keyword?.endsWith("corner") !== false;
    const [x, y] = closest ? [nearX, nearY] : [farX, farY];

    // An explicit size wins; else the keyword (farthest-corner by default) decides.
    const [rx, ry] =
      lengths.length > 0
        ? circle
          ? [px(lengths[0]!), px(lengths[0]!)]
          : [
              lengths[0]!.endsWith("%") ? (parseFloat(lengths[0]!) / 100) * width : px(lengths[0]!),
              lengths[1]?.endsWith("%")
                ? (parseFloat(lengths[1]) / 100) * height
                : px(lengths[1] ?? lengths[0]!),
            ]
        : circle
          ? corner
            ? [Math.hypot(x, y), Math.hypot(x, y)]
            : [closest ? Math.min(x, y) : Math.max(x, y), closest ? Math.min(x, y) : Math.max(x, y)]
          : corner
            ? [x * Math.SQRT2, y * Math.SQRT2]
            : [x, y];

    return {
      kind: "radial",
      at: [round(cx), round(cy)],
      radius: [round(rx), round(ry)],
      stops: stopsOf(args, rx),
      ...repeating,
    };
  };

  const KEYWORD_PERCENT = new Map([
    ["left", 0],
    ["top", 0],
    ["center", 50],
    ["right", 100],
    ["bottom", 100],
  ]);

  /** One length, plain or `calc(a% + bpx)`, as its `percent` and `px` parts. */
  const lengthOf = (word: string): Offset => {
    const keyword = KEYWORD_PERCENT.get(word);

    if (keyword !== undefined) return { percent: keyword, px: 0 };
    let percent = 0;
    let pixels = 0;

    for (const [, sign, number, unit] of word.matchAll(/([+-])?\s*(\d*\.?\d+)(%|px)?/g)) {
      const n = (sign === "-" ? -1 : 1) * parseFloat(number!);

      if (unit === "%") percent += n;
      else pixels += n;
    }

    return { percent: round(percent), px: round(pixels) };
  };

  const isRepeat = (word: string): word is Repeat =>
    word === "repeat" || word === "no-repeat" || word === "space" || word === "round";

  /** The border, padding or content box of an element, in px from its border box's corner. */
  const boxOf = (style: CSSStyleDeclaration, rect: Rect, name: string): Rect => {
    const edge = (side: "Top" | "Right" | "Bottom" | "Left") =>
      (name === "border-box" ? 0 : px(style[`border${side}Width`])) +
      (name === "content-box" ? px(style[`padding${side}`]) : 0);

    const [t, r, b, l] = [edge("Top"), edge("Right"), edge("Bottom"), edge("Left")];

    return {
      x: round(l),
      y: round(t),
      width: round(Math.max(0, rect.width - l - r)),
      height: round(Math.max(0, rect.height - t - b)),
    };
  };

  /**
   * The `background-*` (or `mask-*`) layers, topmost first, and what of them cannot be drawn.
   * A mask's origin and clip default to the border box, and its `fill-box`, `stroke-box` and `view-box` are the border box.
   */
  const layersOf = (
    style: CSSStyleDeclaration,
    rect: Rect,
    prefix: "background" | "mask" = "background",
  ) => {
    const layers: Background[] = [];
    const notes: string[] = [];
    const get = (name: string) => style.getPropertyValue(`${prefix}-${name}`).trim();
    const list = (name: string) => split(get(name), ",");

    const [sizes, positions, repeats, origins, clips, attachments] = [
      list("size"),
      list("position"),
      list("repeat"),
      list("origin"),
      list("clip"),
      list("attachment"),
    ];

    // Shorter lists repeat to the number of layers.
    const nth = (values: string[], i: number, none: string) =>
      values.length > 0 ? values[i % values.length]! : none;

    const boxName = (name: string) => (/^(padding|content)-box$/.test(name) ? name : "border-box");

    split(get("image"), ",").forEach((one, i) => {
      if (one === "none") return;

      const origin = boxOf(
        style,
        rect,
        boxName(nth(origins, i, prefix === "mask" ? "border-box" : "padding-box")),
      );

      const clip = boxOf(style, rect, boxName(nth(clips, i, "border-box")));

      const [sx = "auto", sy = sx] = words(nth(sizes, i, "auto"));
      const sized = nth(sizes, i, "auto");
      const keyword = sized === "cover" || sized === "contain" ? sized : undefined;

      const extent = (word: string, of: number): Extent =>
        word === "auto"
          ? "auto"
          : round(Math.max(0, lengthOf(word).px + (lengthOf(word).percent / 100) * of));

      const [pxWord = "0%", pyWord = "0%"] = words(nth(positions, i, "0% 0%"));
      const [rxWord = "repeat", ryWord = rxWord] = words(nth(repeats, i, "repeat"));

      const repeat: [Repeat, Repeat] =
        rxWord === "repeat-x"
          ? ["repeat", "no-repeat"]
          : rxWord === "repeat-y"
            ? ["no-repeat", "repeat"]
            : isRepeat(rxWord) && isRepeat(ryWord)
              ? [rxWord, ryWord]
              : ["repeat", "repeat"];

      const position: [Offset, Offset] = [lengthOf(pxWord), lengthOf(pyWord)];

      const common = {
        position,
        repeat,
        origin,
        clip,
      };

      if (prefix === "background" && nth(attachments, i, "scroll") === "fixed")
        notes.push("background-attachment: fixed is drawn as scroll");

      const url = /^url\((.*)\)$/s.exec(one)?.[1];

      if (url !== undefined) {
        const src = url.replace(/^["']|["']$/g, "").replace(/\\(["'])/g, "$1");

        // A mask can point at an element in the page (`url(#mask)`), which is not an image.
        if (prefix === "mask" && src.startsWith("#")) {
          notes.push("mask-image: url(#...) is not drawn");

          return;
        }

        layers.push({
          kind: "image",
          src,
          place: {
            size: keyword ?? [extent(sx, origin.width), extent(sy, origin.height)],
            ...common,
          },
        });

        return;
      }

      // A gradient has no size of its own: `auto`, `cover` and `contain` are the origin box.
      const whole = (word: Extent, of: number) => (word === "auto" ? of : word);

      const tile: [number, number] = keyword
        ? [origin.width, origin.height]
        : [
            whole(extent(sx, origin.width), origin.width),
            whole(extent(sy, origin.height), origin.height),
          ];

      const drawn = tile[0] > 0 && tile[1] > 0 ? gradient(one, tile[0], tile[1]) : undefined;

      if (drawn) layers.push({ ...drawn, place: { size: tile, ...common } });
      else if (tile[0] > 0 && tile[1] > 0)
        notes.push(`${/^[\w-]+/.exec(one)?.[0] ?? `${prefix}-image`}() is not drawn`);
    });

    return { layers, notes };
  };

  const sidesOf = (style: CSSStyleDeclaration) => {
    const side = (name: "Top" | "Right" | "Bottom" | "Left"): Side => ({
      width: px(style[`border${name}Width`]),
      // SAFETY: a computed border-style is always one of the BorderStyle keywords.
      style: style[`border${name}Style`] as Side["style"],
      color: color(style[`border${name}Color`]),
    });

    const sides = [side("Top"), side("Right"), side("Bottom"), side("Left")] as const;

    return sides.some((s) => s.width > 0 && s.style !== "none" && s.style !== "hidden")
      ? sides
      : undefined;
  };

  const shadowsOf = (value: string): Shadow[] =>
    value === "none"
      ? []
      : split(value, ",").map((one) => {
          const tokens = words(one);
          const numbers = tokens.filter((t) => /^[-\d.]/.test(t)).map(px);
          const paint = tokens.find((t) => !/^[-\d.]/.test(t) && t !== "inset");

          return {
            x: numbers[0] ?? 0,
            y: numbers[1] ?? 0,
            blur: numbers[2] ?? 0,
            spread: numbers[3] ?? 0,
            color: color(paint ?? "black"),
            inset: tokens.includes("inset"),
          };
        });

  const lengthIn = (word: string, of: number) => {
    const { px: pixels, percent } = lengthOf(word);

    return pixels + (percent / 100) * of;
  };

  /** A computed `filter` as its functions, in order, and the ones that cannot be drawn. */
  const filterOf = (value: string) => {
    const list: FilterFn[] = [];
    const notes: string[] = [];

    for (const one of value === "none" ? [] : words(value)) {
      const [, name = "", args = ""] = /^([\w-]+)\((.*)\)$/s.exec(one) ?? [];
      const n = parseFloat(args);

      if (name === "blur") list.push({ fn: "blur", radius: px(args) });
      else if (name === "hue-rotate")
        list.push({ fn: "hue-rotate", amount: round(angleOf(args, 0, 0)) });
      else if (name === "drop-shadow") {
        const tokens = words(args);
        const lengths = tokens.filter((t) => /^[-\d.]/.test(t)).map(px);
        const paint = tokens.find((t) => !/^[-\d.]/.test(t));

        list.push({
          fn: "drop-shadow",
          x: lengths[0] ?? 0,
          y: lengths[1] ?? 0,
          blur: lengths[2] ?? 0,
          color: color(paint ?? "black"),
        });
      } else if (
        ["brightness", "contrast", "saturate", "grayscale", "opacity"].includes(name) &&
        !Number.isNaN(n)
      )
        // SAFETY: the name is one of the five amounts just listed.
        list.push({
          fn: name as "brightness",
          amount: round(args.endsWith("%") ? n / 100 : n),
        });
      else notes.push(`filter: ${name || one}() is not drawn`);
    }

    return { list, notes };
  };

  /** A computed `text-shadow`, topmost first. */
  const textShadowsOf = (style: CSSStyleDeclaration): TextShadow[] =>
    shadowsOf(style.textShadow).map(({ x, y, blur, color }) => ({ x, y, blur, color }));

  /** The `mask-image` layers that draw as an alpha mask, and what of the mask cannot be drawn. */
  const masksOf = (style: CSSStyleDeclaration, rect: Rect) => {
    const { layers, notes } = layersOf(style, rect, "mask");
    const get = (name: string) => style.getPropertyValue(name).trim();

    if (layers.length === 0) return { layers, notes };

    if (split(get("mask-mode"), ",").includes("luminance"))
      return { layers: [], notes: [...notes, "mask-mode: luminance is not drawn"] };

    const composite = split(get("mask-composite"), ",").find((one) => one !== "add");

    if (composite && layers.length > 1) notes.push(`mask-composite: ${composite} is drawn as add`);

    return { layers, notes };
  };

  /** A computed `clip-path`, resolved to px, and what of it cannot be drawn. */
  const clipPathOf = (style: CSSStyleDeclaration, rect: Rect): Clipped => {
    const value = style.clipPath;

    if (value === "none") return { notes: [] };

    const call = /^(inset|circle|ellipse|polygon|path)\((.*?)\)\s*([\w-]+-box)?$/s.exec(value);

    if (!call) return { notes: [`clip-path: ${/^[\w-]+/.exec(value)?.[0] ?? value} is not drawn`] };

    const [, name, args = "", named = "border-box"] = call;
    const notes: string[] = [];

    if (!/^(border|padding|content)-box$/.test(named))
      notes.push(`clip-path: ${named} is drawn as border-box`);

    const ref = boxOf(style, rect, /^(padding|content)-box$/.test(named) ? named : "border-box");
    const rule = args.startsWith("evenodd") ? ("evenodd" as const) : ("nonzero" as const);

    if (name === "inset") {
      const [sides = "", corners] = args.split(/\bround\b/).map((part) => part.trim());
      const [t = "0", r = t, b = t, l = r] = words(sides);
      const x = ref.x + lengthIn(l, ref.width);
      const y = ref.y + lengthIn(t, ref.height);

      const shape: ClipShape = {
        kind: "inset",
        rect: {
          x: round(x),
          y: round(y),
          width: round(Math.max(0, ref.x + ref.width - lengthIn(r, ref.width) - x)),
          height: round(Math.max(0, ref.y + ref.height - lengthIn(b, ref.height) - y)),
        },
      };

      if (corners) {
        const [across = "", down = across] = corners.split("/").map((part) => part.trim());

        const four = (given: string) => {
          const [a = "0", b = a, c = a, d = b] = words(given);

          return [a, b, c, d] as const;
        };

        const [h, v] = [four(across), four(down)];

        const corner = (i: 0 | 1 | 2 | 3): Corner => [
          round(lengthIn(h[i], ref.width)),
          round(lengthIn(v[i], ref.height)),
        ];

        return { shape: { ...shape, radii: [corner(0), corner(1), corner(2), corner(3)] }, notes };
      }

      return { shape, notes };
    }

    if (name === "circle" || name === "ellipse") {
      const [size = "", position = ""] = args.split(/\bat\b/).map((part) => part.trim());
      const [cx, cy] = placeOf(words(position), ref.width, ref.height);
      const sides = [Math.min(cx, ref.width - cx), Math.min(cy, ref.height - cy)] as const;
      const far = [Math.max(cx, ref.width - cx), Math.max(cy, ref.height - cy)] as const;
      const given = words(size);
      const diagonal = Math.hypot(ref.width, ref.height) / Math.SQRT2;

      // An omitted radius is `closest-side`; a circle takes the nearest or farthest of all four sides.
      const radius = (word: string | undefined, axis: 0 | 1, of: number) =>
        word === "farthest-side"
          ? far[axis]
          : word === undefined || word === "closest-side"
            ? sides[axis]
            : lengthIn(word, of);

      const [rx, ry] =
        name === "circle"
          ? [
              given[0] === "farthest-side"
                ? Math.max(...far)
                : given[0] === undefined || given[0] === "closest-side"
                  ? Math.min(...sides)
                  : lengthIn(given[0], diagonal),
            ].flatMap((r) => [r, r])
          : [radius(given[0], 0, ref.width), radius(given[1], 1, ref.height)];

      return {
        shape: {
          kind: "ellipse",
          center: [round(ref.x + cx), round(ref.y + cy)],
          radius: [round(Math.max(0, rx!)), round(Math.max(0, ry!))],
        },
        notes,
      };
    }

    if (name === "polygon") {
      const points = split(args.replace(/^(nonzero|evenodd)\s*,?/, ""), ",").map(
        (pair): [number, number] => {
          const [x = "0", y = "0"] = words(pair);

          return [round(ref.x + lengthIn(x, ref.width)), round(ref.y + lengthIn(y, ref.height))];
        },
      );

      return { shape: { kind: "polygon", points, rule }, notes };
    }

    const d = /["']([^"']*)["']/.exec(args)?.[1] ?? "";

    return { shape: { kind: "path", d, at: [ref.x, ref.y], rule }, notes };
  };

  // ------------------------------------------------------------------- text

  const fontOf = (style: CSSStyleDeclaration): Font => ({
    family: style.fontFamily,
    weight: parseInt(style.fontWeight, 10) || 400,
    italic: style.fontStyle !== "normal",
    stretch: parseFloat(style.fontStretch) || 100,
    size: px(style.fontSize),
  });

  const decorationOf = (el: Element): Run["decoration"] => {
    for (let at: Element | null = el; at; at = at.parentElement) {
      const style = getComputedStyle(at);

      const lines = style.textDecorationLine
        .split(" ")
        .filter((l): l is "underline" | "overline" | "line-through" =>
          ["underline", "overline", "line-through"].includes(l),
        );

      if (lines.length > 0) {
        const size = px(style.textDecorationThickness);

        return {
          lines,
          color: color(style.textDecorationColor),
          thickness: size > 0 ? size : round(px(style.fontSize) / 16),
        };
      }

      if (!style.display.startsWith("inline")) break;
    }

    return undefined;
  };

  const casing = (style: CSSStyleDeclaration, char: string, before: string) => {
    const cased =
      style.textTransform === "uppercase"
        ? char.toUpperCase()
        : style.textTransform === "lowercase"
          ? char.toLowerCase()
          : style.textTransform === "capitalize" && /\s|^$/.test(before)
            ? char.toUpperCase()
            : char;

    return [...cased].length === 1 ? cased : char;
  };

  const textOf = (node: Text, parent: Element, a: DOMMatrix): TextNode | undefined => {
    const style = getComputedStyle(parent);
    const font = fontOf(style);
    const spacing = style.letterSpacing === "normal" ? 0 : px(style.letterSpacing);
    const text = node.data;

    paint.font =
      style.font || `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const metrics = paint.measureText("Hg");
    const ascent = metrics.fontBoundingBoxAscent;
    const height = ascent + metrics.fontBoundingBoxDescent;
    const aligned = a.b === 0 && a.c === 0 && invertible(a);
    const inverse = invertible(a) ? a.inverse() : new DOMMatrix();
    const range = document.createRange();

    const lines: { x: number; top: number; chars: { char: string; x: number; width: number }[] }[] =
      [];

    for (let i = 0; i < text.length;) {
      const char = String.fromCodePoint(text.codePointAt(i)!);

      range.setStart(node, i);
      range.setEnd(node, i + char.length);
      i += char.length;
      const box = range.getClientRects()[0];

      if (!box || (box.width === 0 && /\s/.test(char))) continue;

      let x: number;
      let top: number;
      let width: number;

      if (aligned) {
        const from = inverse.transformPoint(new DOMPoint(box.left + scrollX, box.top + scrollY));
        const to = inverse.transformPoint(new DOMPoint(box.right + scrollX, box.bottom + scrollY));

        x = Math.min(from.x, to.x);
        top = Math.min(from.y, to.y);
        width = Math.abs(to.x - from.x);
      } else {
        // A rotated or skewed ancestor turns each character's box into a bounding box.
        // A box's center survives the transform, so the box comes back from its center and the font's size.
        const centre = inverse.transformPoint(
          new DOMPoint(box.left + box.width / 2 + scrollX, box.top + box.height / 2 + scrollY),
        );

        width = paint.measureText(char).width + spacing;
        x = centre.x - width / 2;
        top = centre.y - height / 2;
      }

      const before = text.slice(0, i - char.length).slice(-1);
      let line = lines[lines.length - 1];

      if (!line || Math.abs(top - line.top) > height / 2) {
        line = { x, top, chars: [] };
        lines.push(line);
      }

      line.chars.push({ char: casing(style, char, before), x, width });
    }

    const decoration = decorationOf(parent);
    const shadows = textShadowsOf(style);
    const runs: Run[] = [];

    for (const line of lines) {
      const chars = [...line.chars];

      while (chars.length > 0 && /\s/.test(chars[chars.length - 1]!.char)) chars.pop();

      if (chars.length === 0) continue;

      const run: Writable<Run> = {
        x: round(line.x),
        y: round(line.top + ascent),
        text: chars.map((c) => c.char).join(""),
        advances: chars.map((c, i) => round((chars[i + 1]?.x ?? c.x + c.width) - c.x)),
        font,
        letterSpacing: round(spacing),
        color: color(style.color),
      };

      if (decoration) run.decoration = decoration;

      if (shadows.length > 0) run.shadows = shadows;
      runs.push(run);
    }

    return runs.length > 0 ? { type: "text", runs } : undefined;
  };

  // -------------------------------------------------------------------- svg

  const SVG_PAINT = [
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "opacity",
  ];

  const svgOf = (el: Element): SvgNode | undefined => {
    const tag = el.localName;
    const style = getComputedStyle(el);

    if (style.display === "none" || ["title", "desc", "metadata"].includes(tag)) return undefined;

    const paints: Record<string, string> = {};

    for (const name of SVG_PAINT) {
      const value = style.getPropertyValue(name);

      paints[name] = /^(rgb|color|hsl|oklch|oklab|lab|lch|#)/.test(value) ? color(value) : value;
    }

    const children = [...el.children].flatMap((child) => svgOf(child) ?? []);
    const text = el.children.length === 0 ? el.textContent?.trim() : undefined;

    const node: Writable<SvgNode> = {
      tag,
      attrs: Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])),
      style: paints,
      children,
    };

    if (text) node.text = text;

    return node;
  };

  // ------------------------------------------------------------- animations

  const TRANSFORMS = ["transform", "translate", "rotate", "scale"];

  /** Far enough ahead that no animation has started: with `fill: none`, an effect that has not started draws nothing. */
  const LATER = 1e15;

  /**
   * What `names` compute to on `el` with `animations` not in effect, which a capture mid-flight cannot see.
   * Each effect is pushed past its start with no fill and put back exactly, with nothing rendered or awaited in between:
   * the animations keep their time, play state and rate, and no event fires.
   */
  const underlying = (
    el: Element,
    pseudo: Pseudo | undefined,
    animations: readonly globalThis.Animation[],
    names: readonly string[],
  ) => {
    const effects = animations.flatMap((animation) =>
      animation.playState === "finished" || !animation.effect ? [] : [animation.effect],
    );

    const timings = effects.map((effect) => {
      const { fill, delay } = effect.getTiming();

      return { fill, delay };
    });

    const out: Record<string, string> = {};

    try {
      for (const effect of effects) effect.updateTiming({ fill: "none", delay: LATER });

      const style = getComputedStyle(el, pseudo);

      for (const name of names) {
        // A keyframe names its property in camelCase (`cssFloat` for `float`).
        const css =
          name === "cssFloat" ? "float" : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

        const value = style.getPropertyValue(css);

        if (value !== "") out[name] = value;
      }
    } finally {
      effects.forEach((effect, i) => effect.updateTiming(timings[i]));
    }

    return out;
  };

  /** An element's animations, and what their properties are without them. */
  interface Found {
    animations: Animation[];
    base?: Record<string, string>;
  }

  const animationsOf = (el: Element, pseudo?: Pseudo): Found => {
    // A pseudo-element's animations are listed with the subtree's, and only there.
    const live = el.getAnimations({ subtree: pseudo !== undefined }).filter((animation) => {
      const effect = animation.effect;

      return (
        effect instanceof KeyframeEffect &&
        effect.target === el &&
        (effect.pseudoElement ?? undefined) === pseudo &&
        animation.playState !== "idle"
      );
    });

    const animations = live.map((animation): Animation => {
      // SAFETY: `live` holds only animations of a KeyframeEffect.
      const effect = animation.effect as KeyframeEffect;
      const timing = effect.getComputedTiming();

      const kind =
        animation instanceof CSSTransition
          ? "transition"
          : animation instanceof CSSAnimation
            ? "animation"
            : "script";

      return {
        kind,
        name:
          animation instanceof CSSTransition
            ? animation.transitionProperty
            : animation instanceof CSSAnimation
              ? animation.animationName
              : animation.id,
        keyframes: effect.getKeyframes().map((frame) => ({
          offset: round(frame.computedOffset ?? 0),
          easing: frame.easing ?? "linear",
          props: Object.fromEntries(
            Object.entries(frame)
              .filter(
                ([name]) => !["offset", "computedOffset", "easing", "composite"].includes(name),
              )
              .map(([name, value]) => [name, String(value)]),
          ),
        })),
        duration: Number(timing.duration) || 0,
        delay: Number(timing.delay) || 0,
        endDelay: Number(timing.endDelay) || 0,
        iterations: timing.iterations === Infinity ? "infinite" : Number(timing.iterations),
        direction: timing.direction ?? "normal",
        easing: timing.easing ?? "linear",
        fill: timing.fill ?? "none",
        currentTime: Number(animation.currentTime) || 0,
        playbackRate: animation.playbackRate,
        // SAFETY: idle animations are filtered out above, which leaves these three.
        playState: animation.playState as Animation["playState"],
      };
    });

    if (animations.length === 0) return { animations };

    const names = new Set(
      animations.flatMap(({ keyframes }) => keyframes.flatMap(({ props }) => Object.keys(props))),
    );

    // The four compose into one transform, so a base for one needs the others.
    if (TRANSFORMS.some((name) => names.has(name))) for (const name of TRANSFORMS) names.add(name);

    return { animations, base: underlying(el, pseudo, live, [...names]) };
  };

  // ------------------------------------------------------------ form controls

  const MIRRORED = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-stretch",
    "font-variant",
    "font-kerning",
    "font-feature-settings",
    "font-variation-settings",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "text-indent",
    "text-align",
    "text-rendering",
    "tab-size",
    "direction",
    "overflow-wrap",
    "word-break",
  ];

  const TEXT_INPUTS = new Set(["", "text", "search", "email", "url", "tel", "password", "number"]);
  const BUTTON_INPUTS = new Set(["button", "submit", "reset"]);

  /**
   * The text a control shows, as a text node placed in the control's own layout space.
   * A `Range` cannot reach into a control's UA shadow, so the text is laid out in a temporary mirror `<div>`
   * with the control's font, content width and wrapping, and the mirror's runs are moved into the control's content box.
   */
  const mirrored = (
    el: HTMLElement,
    style: CSSStyleDeclaration,
    rect: { x: number; y: number },
    shown: string,
    tint?: string,
  ): TextNode | undefined => {
    if (shown === "") return undefined;

    const [pt, pr, pb, pl] = [
      px(style.paddingTop),
      px(style.paddingRight),
      px(style.paddingBottom),
      px(style.paddingLeft),
    ];

    const mirror = document.createElement("div");

    mirror.style.cssText =
      "position:fixed;left:0;top:0;visibility:hidden;margin:0;padding:0;border:0;box-sizing:content-box;overflow:visible;transform:none;";

    for (const name of MIRRORED) mirror.style.setProperty(name, style.getPropertyValue(name));

    mirror.style.whiteSpace = el instanceof HTMLTextAreaElement ? style.whiteSpace : "pre";
    mirror.style.width = `${Math.max(0, el.clientWidth - pl - pr)}px`;
    mirror.textContent = shown;
    document.documentElement.append(mirror);

    try {
      // SAFETY: the mirror's only child is the text node `textContent` just made (`shown` is not empty).
      const node = textOf(mirror.firstChild as Text, mirror, new DOMMatrix());

      if (!node) return undefined;

      const content = Math.max(0, el.clientHeight - pt - pb);
      const lines = mirror.getBoundingClientRect().height;
      // A single line sits in the middle of the content box; a textarea starts at its top.
      const dy = el instanceof HTMLTextAreaElement ? 0 : (content - lines) / 2;
      const left = rect.x + px(style.borderLeftWidth) + pl - scrollX - el.scrollLeft;
      const top = rect.y + px(style.borderTopWidth) + pt + dy - scrollY - el.scrollTop;

      return {
        type: "text",
        runs: node.runs.map((run) => ({
          ...run,
          x: round(run.x + left),
          y: round(run.y + top),
          ...(tint && { color: tint }),
        })),
      };
    } finally {
      mirror.remove();
    }
  };

  const NATIVE_ACCENT = "rgb(0, 117, 255)";

  /**
   * What an `<input>`, `<textarea>` or `<select>` draws: the text it displays (its value, else its placeholder) as children,
   * and a `control` for a native checkbox, radio or select chevron. Undefined for any other element.
   */
  const formOf = (
    el: Element,
    style: CSSStyleDeclaration,
    rect: { x: number; y: number },
  ): { kids: TextNode[]; control?: Control; native?: boolean; clip?: boolean } | undefined => {
    const native = style.appearance !== "none";

    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (!native) return { kids: [] };

      const accent = style.accentColor;

      return {
        kids: [],
        native: true,
        control: {
          kind: el.type,
          checked: el.checked,
          indeterminate: el.type === "checkbox" && el.indeterminate,
          accent: color(accent === "auto" ? NATIVE_ACCENT : accent),
        },
      };
    }

    let shown: string | undefined;
    let tint: string | undefined;

    if (el instanceof HTMLSelectElement) {
      if (el.multiple || el.size > 1) return { kids: [] };

      shown = el.selectedOptions[0]?.textContent?.trim() ?? "";
    } else if (
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && (TEXT_INPUTS.has(el.type) || BUTTON_INPUTS.has(el.type)))
    ) {
      const value = el.value;

      if (value !== "")
        shown =
          el instanceof HTMLInputElement && el.type === "password"
            ? "\u2022".repeat([...value].length)
            : value;
      else if (el instanceof HTMLInputElement && BUTTON_INPUTS.has(el.type)) shown = "";
      else if (el.placeholder) {
        const hint = getComputedStyle(el, "::placeholder");

        const [r, g, b, a] = color(hint.color)
          .replace(/^rgba?\(|\)$/g, "")
          .split(",")
          .map(Number);

        const alpha = round((a ?? 1) * (Number(hint.opacity) || 0));

        shown = el.placeholder;
        tint = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    } else return undefined;

    // SAFETY: only inputs, textareas and selects get here, and all three are HTMLElements.
    const text = mirrored(el as HTMLElement, style, rect, shown ?? "", tint);

    return {
      kids: text ? [text] : [],
      clip: true,
      ...(el instanceof HTMLSelectElement &&
        native && { control: { kind: "select" as const, color: color(style.color) } }),
    };
  };

  /** What a node needs beyond its computed style: the rect it sits in, and what an element (not a pseudo-element) adds. */
  interface Draw {
    tag: string;
    rect: { x: number; y: number; width: number; height: number };
    own: DOMMatrix;
    origin: readonly [number, number];
    kids: (ElementNode | TextNode)[];
    animations: Animation[];
    /** What the animated properties compute to without the animations. */
    base?: Record<string, string>;
    /** What the caller could not represent, besides what the style says. */
    notes?: string[];
    bare?: boolean;
    clip?: boolean;
    image?: ElementNode["image"];
    svg?: SvgNode;
    control?: Control;
    el?: Element;
    /** Names a pseudo-element's node among its siblings. */
    part?: string;
  }

  /** The CSS an element has that the Snapshot cannot represent, as short phrases, for `notes`. */
  const unsupported = (style: CSSStyleDeclaration, d: Draw): string[] => {
    const out: string[] = [];
    const get = (name: string) => style.getPropertyValue(name).trim();
    const set = (name: string) => !["", "none", "normal"].includes(get(name));
    const hasText = d.kids.some((kid) => kid.type === "text");

    if (d.bare !== true) {
      out.push(...layersOf(style, d.rect).notes);

      if (/\btext\b/.test(get("background-clip"))) out.push("background-clip: text is not drawn");
    }

    if (
      !d.own.is2D ||
      style.rotate.split(" ").length > 1 ||
      style.translate.split(" ").length > 2 ||
      style.scale.split(" ").length > 2
    )
      out.push("a 3D transform is flattened to 2D");

    if (set("perspective")) out.push("perspective is not drawn");

    if (get("transform-style") === "preserve-3d")
      out.push("transform-style: preserve-3d is not drawn");

    out.push(...filterOf(get("filter")).notes);

    if (set("backdrop-filter")) out.push("backdrop-filter is not drawn");

    out.push(...clipPathOf(style, d.rect).notes);
    out.push(...masksOf(style, d.rect).notes);

    if (hasText && !get("writing-mode").startsWith("horizontal"))
      out.push("a vertical writing-mode is not drawn");

    if (d.el?.localName === "canvas" || d.el?.localName === "video")
      out.push(`<${d.el.localName}> is not drawn`);

    if (d.el?.shadowRoot) out.push("a shadow root is not walked");

    return out;
  };

  const draw = (style: CSSStyleDeclaration, d: Draw): ElementNode => {
    const { rect, own, origin, animations } = d;
    // A native checkbox or radio has no CSS of its own to draw: compile draws it whole.
    const bare = d.bare === true;
    const radii = radiusOf(style, rect.width, rect.height);
    const border = bare ? undefined : sidesOf(style);
    const outlineWidth = px(style.outlineWidth);
    const shadows = bare ? [] : shadowsOf(style.boxShadow);

    const backgrounds = bare ? [] : layersOf(style, rect).layers;

    const background = bare ? "rgba(0, 0, 0, 0)" : color(style.backgroundColor);

    const clip = {
      x: d.clip === true || style.overflowX !== "visible",
      y: d.clip === true || style.overflowY !== "visible",
    };

    const node: Writable<ElementNode> = {
      type: "element",
      tag: d.tag,
      rect,
      children: d.kids,
    };

    const key = d.el?.getAttribute("data-key");
    const part = d.el?.getAttribute("data-part");

    if (d.el?.id) node.id = d.el.id;

    if (key) node.key = key;

    if (part ?? d.part) node.part = (part ?? d.part)!;

    if (!bare && radii.some(([x, y]) => x > 0 || y > 0)) node.radii = radii;

    // An animation of the transform needs the origin it turns about, even at a moment when the transform is none.
    const turns = animations.some(({ keyframes }) =>
      keyframes.some(({ props }) =>
        ["transform", "translate", "rotate", "scale"].some((name) => name in props),
      ),
    );

    if (!isPlain(own) || turns)
      node.transform = {
        matrix: [
          round(own.a),
          round(own.b),
          round(own.c),
          round(own.d),
          round(own.e),
          round(own.f),
        ],
        origin,
      };

    if (Number(style.opacity) !== 1) node.opacity = round(Number(style.opacity));

    if (style.mixBlendMode !== "normal") node.blendMode = style.mixBlendMode;

    if (clip.x || clip.y) node.clip = clip;

    if (background !== "rgba(0, 0, 0, 0)") node.background = background;

    if (backgrounds.length > 0) node.backgrounds = backgrounds;

    if (border) node.border = border;

    if (outlineWidth > 0 && style.outlineStyle !== "none")
      node.outline = {
        width: outlineWidth,
        offset: px(style.outlineOffset),
        color: color(style.outlineColor),
        // SAFETY: a computed outline-style is always one of the BorderStyle keywords.
        style: style.outlineStyle as Side["style"],
      };

    if (shadows.length > 0) node.shadows = shadows;

    const filter = filterOf(style.filter).list;
    const clipPath = clipPathOf(style, rect).shape;
    const masks = masksOf(style, rect).layers;

    if (filter.length > 0) node.filter = filter;

    if (clipPath) node.clipPath = clipPath;

    if (masks.length > 0) node.masks = masks;

    if (d.image) node.image = d.image;

    if (d.svg) node.svg = d.svg;

    if (d.control) node.control = d.control;

    if (animations.length > 0) node.animations = animations;

    if (d.base && Object.keys(d.base).length > 0) node.base = d.base;

    const notes = [...new Set([...(d.notes ?? []), ...unsupported(style, d)])];

    if (notes.length > 0) node.notes = notes;

    return node;
  };

  /** The transform every child of a node rides on: `a`, then the node's own transform about its origin. */
  const within = (a: DOMMatrix, own: DOMMatrix, origin: readonly [number, number]) =>
    isPlain(own)
      ? a
      : a
          .multiply(new DOMMatrix().translate(origin[0], origin[1]))
          .multiply(own)
          .multiply(new DOMMatrix().translate(-origin[0], -origin[1]));

  // ---------------------------------------------------------- pseudo-elements

  /** Elements that draw their own content, so `::before` and `::after` do not apply to them. */
  const REPLACED = new Set([
    "img",
    "input",
    "textarea",
    "select",
    "video",
    "audio",
    "canvas",
    "iframe",
    "embed",
    "object",
    "br",
    "hr",
    "meter",
    "progress",
  ]);

  const MARK = "data-svjeez-pseudo";

  /** A CSS string's text, with its escapes undone. */
  const unquote = (value: string) =>
    value
      .slice(1, -1)
      .replace(/\\([0-9a-fA-F]{1,6}) ?|\\(.)/gs, (_, hex?: string, char?: string) =>
        hex ? String.fromCodePoint(parseInt(hex, 16)) : char!,
      );

  /**
   * What a pseudo-element's `content` says, as text and an optional image.
   * `counter()`, `counters()` and gradients have no value outside the cascade, so they draw nothing, and `notes` says so.
   */
  const contentOf = (el: Element, style: CSSStyleDeclaration) => {
    const quotes = /"((?:[^"\\]|\\.)*)"/gs;
    const pairs = [...style.quotes.matchAll(quotes)].map((m) => unquote(m[0]));
    const none = style.quotes === "none";
    const [open = none ? "" : "“", close = none ? "" : "”"] = pairs;
    const notes: string[] = [];
    let text = "";
    let url: string | undefined;

    for (const [token = ""] of style.content.matchAll(
      /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[\w-]+\((?:[^()"']|"[^"]*"|'[^']*')*\)|[\w-]+/gs,
    )) {
      if (token.startsWith('"')) text += unquote(token);
      else if (token.startsWith("'")) text += unquote(`"${token.slice(1, -1)}"`);
      else if (token.startsWith("attr(")) text += el.getAttribute(token.slice(5, -1).trim()) ?? "";
      else if (token.startsWith("url("))
        url = token
          .slice(4, -1)
          .trim()
          .replace(/^["']|["']$/g, "");
      else if (token === "open-quote" || token === "close-quote") {
        text += token === "open-quote" ? open : close;

        if (pairs.length === 0 && !none) notes.push("quotes: auto is drawn as “ ”");
      } else if (/^[\w-]+\(/.test(token) && !token.startsWith("attr(") && !token.startsWith("url("))
        notes.push(`${/^[\w-]+/.exec(token)![0]}() content is not drawn`);
    }

    return { text, url, notes };
  };

  /** Properties that would start something on the stand-in that the pseudo-element does not run. */
  const INERT = /^(animation|transition|view-transition|content|counter-)/;

  /**
   * A pseudo-element as a synthetic element node: tag `::before` or `::after`, named by `part` so it pairs with itself across states.
   * Called after the host's real children are captured, because the general path inserts a stand-in next to them.
   *
   * - Fast path, no DOM change: an absolutely positioned, empty (`content: ""`) pseudo-element of a host that is its containing block
   *   and has px size and insets. Its rect is computed from the host's padding box.
   * - General path: a real `<span>` (an `<img>` for `url()`) is inserted where the pseudo-element is, wearing its computed style,
   *   while the pseudo-element itself is switched off through a temporary adopted stylesheet keyed on a marker attribute.
   *   It is measured like any element and removed in `finally`. Caveat: for that moment the host has one more child, so a real
   *   child's `:first-child`, `:last-child`, `:empty` or `+` styling may differ, which can move the stand-in a little. The real
   *   children are already captured, so only the pseudo-element's own position can be off, and `counter()` content draws nothing.
   */
  const pseudo = (
    el: Element,
    which: Pseudo,
    a: DOMMatrix,
    /** Where to say what the content cannot draw: the host's notes. */
    sink: string[],
    host?: { rect: Draw["rect"]; style: CSSStyleDeclaration },
  ): (ElementNode | TextNode)[] => {
    if (el instanceof SVGElement || REPLACED.has(el.localName)) return [];

    const style = getComputedStyle(el, which);

    if (
      style.content === "none" ||
      style.content === "normal" ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    )
      return [];

    const { animations, base } = animationsOf(el, which);
    const stand: Stand = { tag: which, animations, base };

    const fast =
      host &&
      style.position === "absolute" &&
      style.content === '""' &&
      [style.width, style.height, style.left, style.top].every((v) => v.endsWith("px")) &&
      (host.style.position !== "static" ||
        host.style.transform !== "none" ||
        host.style.translate !== "none" ||
        host.style.rotate !== "none" ||
        host.style.scale !== "none" ||
        host.style.perspective !== "none" ||
        host.style.filter !== "none" ||
        /\b(transform|filter|perspective)\b/.test(host.style.willChange) ||
        /\b(layout|paint|strict|content)\b/.test(host.style.contain));

    if (fast) {
      const sized = (value: string, edges: string[]) =>
        px(value) +
        (style.boxSizing === "border-box"
          ? 0
          : edges.reduce((sum, e) => sum + px(style.getPropertyValue(e)), 0));

      const width = sized(style.width, [
        "padding-left",
        "padding-right",
        "border-left-width",
        "border-right-width",
      ]);

      const height = sized(style.height, [
        "padding-top",
        "padding-bottom",
        "border-top-width",
        "border-bottom-width",
      ]);

      // `left` and `top` are measured from the host's padding box, to the pseudo-element's margin edge.
      const rect = {
        x: round(
          host.rect.x +
            px(host.style.borderLeftWidth) +
            px(style.left) +
            px(style.marginLeft) -
            el.scrollLeft,
        ),
        y: round(
          host.rect.y +
            px(host.style.borderTopWidth) +
            px(style.top) +
            px(style.marginTop) -
            el.scrollTop,
        ),
        width: round(width),
        height: round(height),
      };

      if (rect.width === 0 || rect.height === 0) return [];

      const own = ownMatrix(style, width, height);
      const [ox = 0, oy = 0] = style.transformOrigin.split(" ").map(px);
      const origin = [round(rect.x + ox), round(rect.y + oy)] as const;

      return [
        draw(style, { tag: which, part: which, rect, own, origin, kids: [], animations, base }),
      ];
    }

    const { text, url, notes } = contentOf(el, style);

    // The stand-in may draw nothing at all (an empty span has no box), so the host carries what its content could not say.
    sink.push(...notes.map((note) => `${which} ${note}`));

    // Read everything off the pseudo-element before it is switched off.
    const worn: [string, string][] = [];

    for (const name of Array.from(style))
      if (!INERT.test(name)) worn.push([name, style.getPropertyValue(name)]);

    const standIn = document.createElement(url === undefined ? "span" : "img");

    standIn.style.cssText = "all:initial;animation:none;transition:none;";

    for (const [name, value] of worn) standIn.style.setProperty(name, value);

    if (standIn instanceof HTMLImageElement) standIn.src = url!;
    else standIn.textContent = text;

    const root = el.getRootNode();
    const scope = root instanceof ShadowRoot ? root : document;
    const off = new CSSStyleSheet();

    off.replaceSync(`[${MARK}="${which}"]${which}{content:none !important}`);

    const adopted = [...scope.adoptedStyleSheets];

    el.setAttribute(MARK, which);
    scope.adoptedStyleSheets = [...adopted, off];

    try {
      if (which === "::before") el.insertBefore(standIn, el.firstChild);
      else el.append(standIn);

      return element(standIn, a, stand);
    } finally {
      standIn.remove();
      scope.adoptedStyleSheets = adopted;
      el.removeAttribute(MARK);
    }
  };

  // ------------------------------------------------------------------- walk

  /** `a` carries the transforms of every ancestor, from layout space to the page. */
  const children = (el: Element, a: DOMMatrix): (ElementNode | TextNode)[] => {
    const out: (ElementNode | TextNode)[] = [];

    for (const child of el.childNodes) {
      if (child instanceof Text) {
        const text = textOf(child, el, a);

        if (text) out.push(text);
      } else if (child instanceof Element) out.push(...element(child, a));
    }

    return out;
  };

  /** What `element` draws a pseudo-element's stand-in as: its pseudo-element's tag and animations. */
  interface Stand {
    tag: Pseudo;
    animations: Animation[];
    base?: Record<string, string>;
  }

  const element = (el: Element, a: DOMMatrix, stand?: Stand): (ElementNode | TextNode)[] => {
    const style = getComputedStyle(el);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    )
      return [];

    if (style.display === "contents")
      return [
        ...pseudo(el, "::before", a, []),
        ...children(el, a),
        ...pseudo(el, "::after", a, []),
      ];

    const box = pageRect(el);
    const inline = style.display === "inline" && !(el instanceof HTMLImageElement);

    const sized = (value: string, fallback: number, edges: string[]) => {
      const n = parseFloat(value);

      if (Number.isNaN(n)) return fallback;

      return style.boxSizing === "border-box"
        ? n
        : n + edges.reduce((sum, e) => sum + px(style.getPropertyValue(e)), 0);
    };

    const own = inline ? new DOMMatrix() : ownMatrix(style, box.width, box.height);
    const flat = isPlain(own) && isPlain(a);

    const width = flat
      ? box.width
      : sized(style.width, box.width, [
          "padding-left",
          "padding-right",
          "border-left-width",
          "border-right-width",
        ]);

    const height = flat
      ? box.height
      : sized(style.height, box.height, [
          "padding-top",
          "padding-bottom",
          "border-top-width",
          "border-bottom-width",
        ]);

    const [ox = 0, oy = 0] = style.transformOrigin.split(" ").map(px);
    const kx = ox - width / 2;
    const ky = oy - height / 2;
    let cx = box.left + box.width / 2;
    let cy = box.top + box.height / 2;

    if (!flat && invertible(a)) {
      // The page center is A(own(center)). With k the origin's offset from the center and L own's linear part,
      // own(center) = center + k + t - L k, so the untransformed center comes back by undoing A and that shift.
      const page = a.inverse().transformPoint(new DOMPoint(cx, cy));

      cx = page.x - (kx + own.e - (own.a * kx + own.c * ky));
      cy = page.y - (ky + own.f - (own.b * kx + own.d * ky));
    }

    const rect = {
      x: round(cx - width / 2),
      y: round(cy - height / 2),
      width: round(width),
      height: round(height),
    };

    const origin = [round(cx + kx), round(cy + ky)] as const;
    const inner = within(a, own, origin);
    const form = formOf(el, style, rect);
    const leaf = el instanceof SVGElement || el instanceof HTMLImageElement;

    // The real children come first: a pseudo-element's stand-in is inserted next to them afterwards, so it cannot restyle them.
    const real = form?.kids ?? (leaf ? [] : children(el, inner));
    const host = { rect, style };

    const notes: string[] = [];

    const kids =
      form || leaf || stand
        ? real
        : [
            ...pseudo(el, "::before", inner, notes, host),
            ...real,
            ...pseudo(el, "::after", inner, notes, host),
          ];

    if ((box.width === 0 || box.height === 0) && kids.length === 0) return [];

    const image =
      el instanceof HTMLImageElement
        ? {
            src: el.currentSrc || el.src,
            width: el.naturalWidth,
            height: el.naturalHeight,
            objectFit: style.objectFit,
            objectPosition: style.objectPosition,
          }
        : undefined;

    const drawn = stand ?? animationsOf(el);

    const node = draw(style, {
      tag: stand?.tag ?? el.localName,
      rect,
      own,
      origin,
      kids,
      animations: drawn.animations,
      notes,
      ...(drawn.base && { base: drawn.base }),
      ...(stand ? { part: stand.tag } : { el }),
      bare: form?.native === true,
      ...(form?.clip && { clip: true }),
      ...(image && { image }),
      ...(el instanceof SVGSVGElement && { svg: svgOf(el)! }),
      ...(form?.control && { control: form.control }),
    });

    return [node];
  };

  const [top] = element(root, new DOMMatrix());

  if (top?.type !== "element")
    throw new Error("capture(root): the root is not rendered (display: none, hidden or empty).");

  const fonts: WebFont[] = [];

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;

    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet without CORS hides its rules.
      continue;
    }

    const base = sheet.href ?? document.baseURI;

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;

      const url = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/.exec(
        rule.style.getPropertyValue("src"),
      );

      const src = url && (url[1] ?? url[2] ?? url[3]);
      const weight = rule.style.getPropertyValue("font-weight").trim();

      if (!src) continue;

      fonts.push({
        family: rule.style
          .getPropertyValue("font-family")
          .trim()
          .replace(/^["']|["']$/g, ""),
        weight: weight === "bold" ? 700 : parseFloat(weight) || 400,
        italic: /^(italic|oblique)/.test(rule.style.getPropertyValue("font-style").trim()),
        src: new URL(src, base).href,
      });
    }
  }

  return {
    version: 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    ...(fonts.length > 0 && { fonts }),
    root: top,
  };
};

/**
 * `capture`'s source, as a JavaScript expression that evaluates to the function.
 * Hand it to any driver: `page.evaluate(`(${captureScript})(document.body)`)`.
 * It relies on `capture` being one self-contained function, so do not run it through a bundler that adds helpers to functions.
 */
export const captureScript = `(${capture.toString()})`;
