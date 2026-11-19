import type {
  Animation,
  Background,
  Control,
  Corner,
  ElementNode,
  Font,
  Run,
  Shadow,
  Side,
  Snapshot,
  Stop,
  SvgNode,
  TextNode,
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

  const layer = (value: string, width: number, height: number): Background | undefined => {
    const url = /^url\((.*)\)$/.exec(value)?.[1];

    if (url !== undefined) return { kind: "image", src: url.replace(/^["']|["']$/g, "") };

    const call = /^(linear|radial)-gradient\((.*)\)$/s.exec(value);

    if (!call) return undefined;
    const args = split(call[2]!, ",");

    const config = /^(to\s|[-\d.]+(deg|grad|rad|turn)$)/.test(args[0] ?? "")
      ? args.shift()
      : /^(circle|ellipse|closest|farthest|at\s)/.test(args[0] ?? "")
        ? args.shift()
        : undefined;

    if (call[1] === "linear") {
      const angle = config === undefined ? 180 : angleOf(config, width, height);
      const rad = (angle * Math.PI) / 180;
      const length = Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad));

      return { kind: "linear", angle: round(angle), stops: stopsOf(args, length) };
    }

    const [shapeAndSize = "", position = ""] = (config ?? "").split(/\bat\b/).map((s) => s.trim());
    const [px0 = "center", py0 = "center"] = position ? words(position) : [];

    const place = (word: string, of: number, start: string, end: string) =>
      word === start
        ? 0
        : word === end
          ? of
          : word === "center"
            ? of / 2
            : word.endsWith("%")
              ? (parseFloat(word) / 100) * of
              : px(word);

    const at = [place(px0, width, "left", "right"), place(py0, height, "top", "bottom")] as const;
    const shape = /\bcircle\b/.test(shapeAndSize) ? "circle" : "ellipse";
    const size = /(closest|farthest)-(side|corner)/.exec(shapeAndSize)?.[0] ?? "farthest-corner";
    const far = Math.max(at[0], width - at[0]);

    const ray =
      shape === "circle" ? Math.hypot(far, Math.max(at[1], height - at[1])) : far * Math.SQRT2;

    return {
      kind: "radial",
      shape,
      size,
      at: [round(at[0]), round(at[1])],
      stops: stopsOf(args, ray),
    };
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

  const NO_SIZE = new Set(["auto", "auto auto"]);

  /** The CSS an element has that the Snapshot cannot represent, as short phrases, for `notes`. */
  const unsupported = (style: CSSStyleDeclaration, d: Draw): string[] => {
    const out: string[] = [];
    const get = (name: string) => style.getPropertyValue(name).trim();
    const set = (name: string) => !["", "none", "normal"].includes(get(name));
    const hasText = d.kids.some((kid) => kid.type === "text");

    if (d.bare !== true) {
      let layers = 0;

      for (const one of split(style.backgroundImage, ",")) {
        if (one === "none") continue;

        if (layer(one, d.rect.width, d.rect.height)) layers++;
        else out.push(`${/^[\w-]+/.exec(one)?.[0] ?? "background-image"}() is not drawn`);
      }

      if (layers > 0) {
        if (!split(style.backgroundSize, ",").every((size) => NO_SIZE.has(size)))
          out.push("background-size is not drawn");

        if (!split(style.backgroundPosition, ",").every((at) => at === "0% 0%" || at === "0px 0px"))
          out.push("background-position is not drawn");

        if (!split(style.backgroundRepeat, ",").every((repeat) => repeat === "repeat"))
          out.push("background-repeat is not drawn");
      }

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

    if (set("filter")) out.push("filter is not drawn");

    if (set("backdrop-filter")) out.push("backdrop-filter is not drawn");

    if (set("clip-path")) out.push("clip-path is not drawn");

    if (set("mask-image") || set("-webkit-mask-image")) out.push("mask-image is not drawn");

    if (hasText && set("text-shadow")) out.push("text-shadow is not drawn");

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

    const backgrounds = bare
      ? []
      : split(style.backgroundImage, ",").flatMap(
          (one) => layer(one, rect.width, rect.height) ?? [],
        );

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
