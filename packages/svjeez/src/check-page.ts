// Functions `checkScene()` runs inside the page. Each is serialized on its own, so it can use only its argument, the page's
// globals and the helpers declared inside it. `setup` leaves its state on `window` for the others.

/** What `setup` learns once about each element it measures. */
export interface PageElement {
  readonly tag: string;
  readonly source?: string;
  /** The text an element shows, cut short, for a `<text>`. */
  readonly text?: string;
  /** Paint order: a lower number is painted first, underneath. */
  readonly order: number;
  /** Under a `mask`, which can hide any part of it, so its opacity says little about what shows. */
  readonly masked?: boolean;
  /** Painted only with a gradient: a shadow or a glow, whose edge is often transparent. */
  readonly soft?: boolean;
  /**
   * Scene seconds of one cycle, when it or an ancestor runs a stepped CSS animation (a `hold` wiggle, a `steps` ease)
   * on repeat: its value jumps at every step by design, so the jump where the loop restarts is one more of them when
   * the cycle divides the loop.
   */
  readonly cycle?: number;
}

export interface PageSetup {
  readonly width: number;
  readonly height: number;
  /** Leaves: every shape, text, image and use outside `<defs>`, as `measure` returns them. */
  readonly leaves: readonly PageElement[];
  /** Every element carrying a CSS animation or a SMIL target, as `sweep` returns them. */
  readonly animated: readonly PageElement[];
}

/**
 * One leaf at one time, in viewBox units: its box after any `clip-path` around it (x0, y0, x1, y1), its opacity times
 * every ancestor's, whether it paints at all (1 or 0), whether it holds still (1) or moves or fades (0) over the short
 * step before, and the middle and size of its own box (cx, cy, size). The page box of a turned element is the box
 * around its turned box, so it swells and shrinks as a gear turns; the middle and size do not, which is what lets the
 * loop seam ignore a wheel that is back at an equal angle.
 */
export type PageBox = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** One animated element over a sweep of the loop. */
export interface PageSeries {
  /** Whether any animated value differs from its value at the first step, or between its keyframes. */
  readonly changes: boolean;
  /** Its own opacity at each step. */
  readonly opacity: readonly number[];
  /** Its stroke drawn, from 0 to 1, at each step, when a dash pattern draws it. */
  readonly drawn: readonly number[];
  /** Opacity times every ancestor's at the first step. */
  readonly shown: number;
  /** Whether it paints a fill at the first step, and the fill is not itself animated. */
  readonly filled: boolean;
  /**
   * When its opacity, shown at the first step, first cuts to hidden: how long it stays hidden before it starts back up,
   * read at a hundredth of a second. Undefined when that is longer than `within` or never happens.
   */
  readonly hold?: number;
  /** Whether its animations move nothing but `visibility`, and it stays visible: a `show` that spans the loop. */
  readonly shownThroughout: boolean;
  /** Whether it is drawn, outside `<defs>` and the like, yet has no box at any step: an animation on nothing. */
  readonly empty: boolean;
}

interface State {
  readonly seek: (time: number) => void;
  readonly svg: SVGSVGElement;
  readonly leaves: readonly Element[];
  readonly animated: readonly {
    readonly el: Element;
    readonly css: readonly string[];
    readonly smil: readonly string[];
    /** Whether its CSS keyframes hold more than one value for a property. A step shorter than a sweep's can miss it. */
    readonly keyed: boolean;
  }[];
}

/** Where `setup` leaves its state, for `measure` and `sweep`. */
interface Scope {
  readonly document: Document;
  __svjeezCheck?: State;
}

/** Finds what to measure, and keeps it on `window` with a way to seek. */
export const setup = (): PageSetup => {
  const svg = document.querySelector("svg");

  if (!svg) throw new Error("checkScene() found no <svg> in the page.");

  // `seek` from svjeez/page, again: a page function can import nothing, and the page holds no copy of its own.
  const seek = (time: number): void => {
    const rate = parseFloat(svg.getAttribute("data-playback-rate") ?? "") || 1;

    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = (time / rate) * 1000;
    }

    svg.pauseAnimations();
    svg.setCurrentTime(time / rate);
  };

  const UNPAINTED = new Set([
    "defs",
    "clippath",
    "mask",
    "pattern",
    "marker",
    "symbol",
    "lineargradient",
    "radialgradient",
    "filter",
    "title",
    "desc",
    "style",
    "script",
    "metadata",
    "foreignobject",
  ]);

  const LEAF = new Set([
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "image",
    "use",
  ]);

  const painted = (el: Element): boolean => {
    for (let at: Element | null = el.parentElement; at && at !== svg; at = at.parentElement)
      if (UNPAINTED.has(at.localName.toLowerCase()) || at.localName === "text") return false;

    return true;
  };

  const all = [...svg.querySelectorAll("*")];
  const order = new Map(all.map((el, index) => [el, index]));

  const describe = (el: Element): PageElement => {
    const source = el.closest("[data-source]")?.getAttribute("data-source") ?? undefined;

    const text =
      el.localName === "text"
        ? (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)
        : undefined;

    let masked = false;

    for (let at: Element | null = el; at && at !== svg && !masked; at = at.parentElement)
      masked = getComputedStyle(at).mask !== "none" && getComputedStyle(at).mask !== "";

    const paint = getComputedStyle(el);
    const soft = paint.fill.startsWith("url(") && paint.stroke === "none";
    const rate = parseFloat(svg.getAttribute("data-playback-rate") ?? "") || 1;
    let cycle: number | undefined;

    for (let at: Element | null = el; at && at !== svg; at = at.parentElement)
      for (const animation of at.getAnimations()) {
        const effect = animation.effect;
        const timing = effect?.getTiming();
        const length = Number(timing?.duration) || 0;
        const keys = effect instanceof KeyframeEffect ? effect.getKeyframes() : [];

        // Every keyframe but the last eases to the next with a step: a CSS animation-timing-function lands on each.
        const stepped =
          keys.length > 1 &&
          keys.slice(0, -1).every((key) => /^steps?\(|^step-/.test(String(key.easing)));

        if (
          stepped &&
          timing?.iterations === Infinity &&
          length > 0 &&
          // Started on a whole cycle, so each cycle is the same as the last from the first.
          Math.abs((((timing.delay ?? 0) / length) % 1) * length) < 1
        )
          cycle = Math.min(cycle ?? Infinity, (length / 1000) * rate);
      }

    return {
      tag: el.localName,
      order: order.get(el) ?? 0,
      ...(source && { source }),
      ...(text !== undefined && { text }),
      ...(masked && { masked }),
      ...(soft && { soft }),
      ...(cycle !== undefined && { cycle }),
    };
  };

  const leaves = all.filter((el) => LEAF.has(el.localName) && painted(el));
  const targets = new Map<Element, { css: Set<string>; smil: Set<string>; keyed: boolean }>();

  const entry = (el: Element) => {
    const found = targets.get(el) ?? {
      css: new Set<string>(),
      smil: new Set<string>(),
      keyed: false,
    };

    targets.set(el, found);

    return found;
  };

  const SKIP = new Set(["offset", "easing", "composite", "computedOffset"]);

  // Chromium leaves custom properties out of getKeyframes(), so read a CSS animation's properties from its rule too, and
  // whether any of them takes more than one value.
  const declared = new Map<string, Set<string>>();
  const varies = new Set<string>();

  const scan = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSKeyframesRule) {
        const names = declared.get(rule.name) ?? new Set<string>();
        declared.set(rule.name, names);

        const seen = new Map<string, string>();

        for (const frame of rule.cssRules)
          if (frame instanceof CSSKeyframeRule)
            for (let i = 0; i < frame.style.length; i++) {
              const property = frame.style.item(i);
              const value = frame.style.getPropertyValue(property).trim();
              names.add(property);

              if (property === "animation-timing-function") continue;

              if (seen.has(property) && seen.get(property) !== value) varies.add(rule.name);
              seen.set(property, value);
            }
      } else if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) scan(rule.cssRules);
    }
  };

  for (const sheet of document.styleSheets) scan(sheet.cssRules);

  for (const el of all) {
    for (const animation of el.getAnimations()) {
      const effect = animation.effect;

      if (!(effect instanceof KeyframeEffect) || effect.target !== el) continue;
      const css = entry(el).css;

      for (const frame of effect.getKeyframes())
        for (const key of Object.keys(frame)) if (!SKIP.has(key)) css.add(key);

      if (animation instanceof CSSAnimation && varies.has(animation.animationName))
        entry(el).keyed = true;

      if (animation instanceof CSSAnimation)
        for (const key of declared.get(animation.animationName) ?? [])
          if (key !== "animation-timing-function") css.add(key);
    }
  }

  // Whether a SMIL animation takes more than one value: its values, from and to, or to against the attribute it sets.
  const moves = (animation: Element, target: Element, name: string): boolean => {
    const values = animation.getAttribute("values");

    if (values !== null) return new Set(values.split(";").map((value) => value.trim())).size > 1;

    if (animation.localName === "animateMotion" || animation.hasAttribute("by")) return true;

    const to = animation.getAttribute("to");
    const from = animation.getAttribute("from") ?? target.getAttribute(name);

    return to !== null && to.trim() !== from?.trim();
  };

  for (const animation of svg.querySelectorAll("animate, animateTransform, animateMotion, set")) {
    const href = animation.getAttribute("href") ?? animation.getAttribute("xlink:href");
    const target = href ? document.getElementById(href.slice(1)) : animation.parentElement;

    if (!target) continue;

    const name =
      animation.localName === "animateMotion"
        ? "transform"
        : (animation.getAttribute("attributeName") ?? "transform");

    const found = entry(target);
    found.smil.add(name);

    if (moves(animation, target, name)) found.keyed = true;
  }

  const animated = [...targets].map(([el, { css, smil, keyed }]) => ({
    el,
    css: [...css],
    smil: [...smil],
    keyed,
  }));

  const scope: Scope = window;
  scope.__svjeezCheck = { seek, svg, leaves, animated };
  const box = svg.viewBox.baseVal;

  return {
    width: box && box.width > 0 ? box.width : svg.getBoundingClientRect().width,
    height: box && box.height > 0 ? box.height : svg.getBoundingClientRect().height,
    leaves: leaves.map(describe),
    animated: animated.map(({ el }) => describe(el)),
  };
};

/** Every leaf's box at `time`, and whether it holds still since `before`. */
export const measure = ({ time, before }: { time: number; before: number }): PageBox[] => {
  const scope: Scope = window;
  const state = scope.__svjeezCheck;

  if (!state) throw new Error("checkScene() measured a page it had not set up.");
  const { seek, svg, leaves } = state;
  const frame = svg.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const sx = view && view.width > 0 ? view.width / frame.width : 1;
  const sy = view && view.height > 0 ? view.height / frame.height : 1;
  const ox = view && view.width > 0 ? view.x : 0;
  const oy = view && view.height > 0 ? view.y : 0;

  const snapshot = () => {
    const styles = new Map<Element, CSSStyleDeclaration>();

    const style = (el: Element) => {
      let found = styles.get(el);

      if (!found) {
        found = getComputedStyle(el);
        styles.set(el, found);
      }

      return found;
    };

    // The region a `clip-path: url(#id)` keeps, in page pixels. Unknown shapes keep everything.
    const clipOf = (el: Element): DOMRect | undefined => {
      const id = /url\(["']?#([^"')]+)/.exec(style(el).clipPath)?.[1];
      const clip = id ? document.getElementById(id) : null;

      if (
        !(clip instanceof SVGClipPathElement) ||
        clip.clipPathUnits.baseVal !== 1 ||
        !(el instanceof SVGGraphicsElement)
      )
        return undefined;
      const ctm = el.getScreenCTM();

      if (!ctm) return undefined;

      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;

      for (const child of clip.children) {
        if (!(child instanceof SVGGraphicsElement)) continue;
        const b = child.getBBox();
        const own = child.transform.baseVal.consolidate()?.matrix;
        const m = own ? ctm.multiply(own) : ctm;

        for (const [x, y] of [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ] as const) {
          const p = new DOMPoint(x, y).matrixTransform(m);
          x0 = Math.min(x0, p.x);
          y0 = Math.min(y0, p.y);
          x1 = Math.max(x1, p.x);
          y1 = Math.max(y1, p.y);
        }
      }

      return x0 <= x1 ? new DOMRect(x0, y0, x1 - x0, y1 - y0) : undefined;
    };

    const clips = new Map<Element, DOMRect | null>();

    return leaves.map((el): PageBox => {
      let opacity = 1;
      let r = el.getBoundingClientRect();

      let x0 = r.left,
        y0 = r.top,
        x1 = r.right,
        y1 = r.bottom;

      for (let at: Element | null = el; at && at !== svg; at = at.parentElement) {
        const s = style(at);
        opacity *= parseFloat(s.opacity) || 0;

        if (s.clipPath === "none") continue;
        let clip = clips.get(at);

        if (clip === undefined) {
          clip = clipOf(at) ?? null;
          clips.set(at, clip);
        }

        if (clip) {
          x0 = Math.max(x0, clip.left);
          y0 = Math.max(y0, clip.top);
          x1 = Math.min(x1, clip.right);
          y1 = Math.min(y1, clip.bottom);
        }
      }

      const s = style(el);

      const paints =
        s.visibility !== "hidden" &&
        s.display !== "none" &&
        r.width + r.height > 0 &&
        // A clip that has not opened yet leaves a sliver.
        x1 - x0 > 0.5 &&
        y1 - y0 > 0.5 &&
        (el.localName === "image" ||
          el.localName === "use" ||
          s.fill !== "none" ||
          s.stroke !== "none");

      r = new DOMRect(
        (x0 - frame.left) * sx + ox,
        (y0 - frame.top) * sy + oy,
        Math.max(0, x1 - x0) * sx,
        Math.max(0, y1 - y0) * sy,
      );
      let middle = [(r.left + r.right) / 2, (r.top + r.bottom) / 2, Math.sqrt(r.width * r.height)];

      if (el instanceof SVGGraphicsElement) {
        const own = el.getBBox();
        const m = el.getScreenCTM();

        if (m) {
          const p = new DOMPoint(own.x + own.width / 2, own.y + own.height / 2).matrixTransform(m);
          const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
          middle = [
            (p.x - frame.left) * sx + ox,
            (p.y - frame.top) * sy + oy,
            Math.sqrt(own.width * own.height) * scale * sx,
          ];
        }
      }

      return [
        r.left,
        r.top,
        r.right,
        r.bottom,
        opacity,
        paints ? 1 : 0,
        1,
        middle[0] ?? 0,
        middle[1] ?? 0,
        middle[2] ?? 0,
      ];
    });
  };

  seek(before);
  const then = snapshot();
  seek(time);
  const now = snapshot();

  return now.map((box, index) => {
    const old = then[index] ?? box;

    const still =
      box.slice(0, 4).every((v, i) => Math.abs(v - (old[i] ?? v)) < 0.5) &&
      Math.abs(box[4] - old[4]) < 0.02 &&
      box[5] === old[5];

    return [box[0], box[1], box[2], box[3], box[4], box[5], still ? 1 : 0, box[7], box[8], box[9]];
  });
};

/** Each animated element across `steps` evenly spaced times of one loop. */
export const sweep = ({
  duration,
  steps,
  within,
}: {
  duration: number;
  steps: number;
  within: number;
}): PageSeries[] => {
  const scope: Scope = window;
  const state = scope.__svjeezCheck;

  if (!state) throw new Error("checkScene() measured a page it had not set up.");
  const { seek, svg, animated } = state;

  // A SMIL value: the element's place for a motion or a transform, else the attribute's computed value. A filter
  // primitive's attribute has none, and `setup` has already read whether its values differ.
  const smilValue = (el: Element, name: string, style: CSSStyleDeclaration): string => {
    if (name !== "transform" || !(el instanceof SVGGraphicsElement))
      return style.getPropertyValue(name);
    const m = el.getCTM();

    return m ? [m.a, m.b, m.c, m.d, m.e, m.f].map((v) => v.toFixed(3)).join(",") : "";
  };

  const signatures: string[][] = animated.map(() => []);
  const opacity: number[][] = animated.map(() => []);
  const drawn: number[][] = animated.map(() => []);
  const shown: number[] = [];
  const filled: boolean[] = [];

  const UNPAINTED = [
    "defs",
    "clipPath",
    "mask",
    "pattern",
    "marker",
    "symbol",
    "linearGradient",
    "radialGradient",
    "filter",
  ];

  const rendered = animated.map(({ el }) => !UNPAINTED.some((tag) => el.closest(tag)));
  const boxed = animated.map(() => false);

  for (let step = 0; step < steps; step++) {
    seek((step * duration) / steps);
    animated.forEach(({ el, css, smil }, index) => {
      const style = getComputedStyle(el);
      signatures[index]?.push(
        [
          ...css.map((name) =>
            style.getPropertyValue(
              name.startsWith("--") ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
            ),
          ),
          ...smil.map((name) => smilValue(el, name, style)),
        ].join("|"),
      );
      opacity[index]?.push(parseFloat(style.opacity) || 0);
      const rect = el.getBoundingClientRect();

      if (rect.width > 0 || rect.height > 0) boxed[index] = true;
      const dash = parseFloat(style.strokeDasharray.split(/[\s,]+/)[0] ?? "");
      const offset = parseFloat(style.strokeDashoffset);
      drawn[index]?.push(
        dash > 0 && Number.isFinite(offset) ? Math.max(0, Math.min(1, 1 - offset / dash)) : 1,
      );

      if (step > 0) return;
      let product = style.visibility === "hidden" ? 0 : 1;

      for (let at: Element | null = el; at && at !== svg; at = at.parentElement)
        product *= parseFloat(getComputedStyle(at).opacity) || 0;
      // Nothing of it on the canvas is nothing shown.
      const box = el.getBoundingClientRect();
      const frame = svg.getBoundingClientRect();

      const onCanvas =
        box.right > frame.left &&
        box.left < frame.right &&
        box.bottom > frame.top &&
        box.top < frame.bottom &&
        box.width + box.height > 0;

      shown.push(onCanvas ? product : 0);
      filled.push(
        style.fill !== "none" &&
          (parseFloat(style.fillOpacity) || 0) > 0 &&
          el.localName !== "g" &&
          !css.includes("fill"),
      );
    });
  }

  // A cut found between two steps, read finely: how long the element stays hidden after it.
  const holds = animated.map(({ el }, index) => {
    const values = opacity[index] ?? [];

    const cut = values.findIndex(
      (value, i) => i > 0 && value <= 0.05 && (values[i - 1] ?? 0) > 0.5,
    );

    if (
      (values[0] ?? 0) <= 0.5 ||
      cut <= 0 ||
      values.slice(0, cut).some((value) => Math.abs(value - (values[0] ?? 0)) > 0.01)
    )
      return undefined;

    const valueAt = (time: number) => {
      seek(time);

      return parseFloat(getComputedStyle(el).opacity) || 0;
    };

    // The cut lies between the step before and the step that found it hidden. A fine scan can step over a hidden
    // instant, so the step that found it stands in when none does.
    const found = (cut * duration) / steps;
    let hidden = found;

    for (let time = ((cut - 1) * duration) / steps; time < found; time += 0.01)
      if (valueAt(time) <= 0.05) {
        hidden = time;
        break;
      }

    for (let time = found; time <= found + within; time += 0.01)
      if (valueAt(time) > 0.05) return time - hidden;

    return undefined;
  });

  return animated.map((_, index) => {
    const series = signatures[index] ?? [];
    const hold = holds[index];

    const only =
      animated[index]?.css.every((name) => name === "visibility") &&
      animated[index]?.smil.length === 0;

    return {
      shownThroughout: Boolean(only) && series[0] === "visible",
      empty: Boolean(rendered[index]) && !boxed[index],
      ...(hold !== undefined && { hold }),
      changes: Boolean(animated[index]?.keyed) || series.some((value) => value !== series[0]),
      opacity: opacity[index] ?? [],
      drawn: drawn[index] ?? [],
      shown: shown[index] ?? 0,
      filled: filled[index] ?? false,
    };
  });
};
