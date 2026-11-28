import { SceneError } from "../model/scene-error";
import { formatValue, spec, valueOf, type Backend, type Channel } from "./channels";
import { baseRule, classBody, cssDeclarations, cssGroups, freezeRule, type Emit } from "./css";
import { fontFaces, isFontValue, type Font, type FontValue } from "../font/font";
import {
  UNKNOWN_FONT,
  faceRules,
  fontOf,
  newFontUse,
  noteCss,
  noteText,
  slotOf,
  type FontCtx,
  type FontUse,
} from "../font/usage";
import { channelsAt, moving, type Key } from "./keys";
import { animate, windowEnd } from "./smil";
import type { Stretch } from "../model/dark";
import { num } from "../model/format";
import type { Seconds } from "../model/time";
import { element, type AttrValue, type Element, type SvgNode } from "./tree";

export interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly playbackRate: number;
  readonly prefix: string;
  readonly stillAt?: number;
  readonly loop: boolean;
}

export interface Lane {
  readonly key: string;
  readonly backend: Backend;
  readonly channels: readonly Channel[];
  readonly keys: readonly Key[];
  readonly period: number;
  readonly snapped: number;
  readonly emit: Emit;
  /** A drawn closed shape: its dashes drop once the stroke is whole, so it keeps its join. */
  readonly joins?: boolean;
}

interface State {
  readonly canvas: Canvas;
  readonly fonts: Map<string, Font>;
  readonly faces: { readonly name: string; readonly font: Font }[];
  readonly fontUse: FontUse;
  readonly counters: Map<string, number>;
  readonly keyframes: Map<string, string>;
  readonly classes: Map<string, string>;
  readonly rules: string[];
  readonly stills: string[];
  pivot: boolean;
}

const nextName = (state: State, base: string, lead = ""): string => {
  const count = (state.counters.get(lead + base) ?? 0) + 1;
  state.counters.set(lead + base, count);

  return `${lead}${state.canvas.prefix}${base}${count}`;
};

const withoutSmil = ({ still, ...node }: Element): Element => ({
  ...node,
  attrs: { ...node.attrs, ...still },
  children: node.children
    .filter(
      (child) =>
        !(child.kind === "element" && ["animate", "set", "animateTransform"].includes(child.tag)),
    )
    .map((child) => (child.kind === "element" ? withoutSmil(child) : child)),
});

const fontFamily = (state: State, value: FontValue): string => {
  const { prefix } = state.canvas;
  const { family, faces: named } = fontFaces(value, prefix);
  const faces = named.map((face) => ({ ...face, name: prefix + face.name }));

  for (const { name, font } of faces) {
    if (font.format === "system") continue;
    const slot = slotOf(name, font);
    const taken = state.fonts.get(slot);

    if (taken && taken.href === font.href) {
      if (taken.subset && !font.subset) {
        state.fonts.set(slot, font);
        state.faces.splice(
          state.faces.findIndex((face) => face.font === taken && face.name === name),
          1,
          { name, font },
        );
      }

      continue;
    }

    if (taken)
      throw new SceneError(
        `Two different fonts claim ${slot}. Give one of them another family name with font(bytes, { family }).`,
      );
    state.fonts.set(slot, font);
    state.faces.push({ name, font });
  }

  return family;
};

const resolveAttrs = (state: State, attrs: Element["attrs"]): Record<string, AttrValue> =>
  Object.fromEntries(
    Object.entries(attrs).map(([name, value]) => [
      name,
      isFontValue(value) ? fontFamily(state, value) : value,
    ]),
  );

const keyframesName = (state: State, body: string): string => {
  const known = state.keyframes.get(body);

  if (known) return known;
  const name = nextName(state, "k");
  state.keyframes.set(body, name);
  state.rules.push(`@keyframes ${name}{${body}}`);

  return name;
};

const className = (state: State, lanes: readonly Lane[]): string => {
  const groups = cssGroups(lanes);

  const body = classBody(
    state.canvas,
    groups,
    groups.map(({ body }) => keyframesName(state, body)),
    groups.map((group) => group.timing),
  );

  const known = state.classes.get(body);

  if (known) return known;
  const name = nextName(state, "m");
  state.classes.set(body, name);
  state.rules.push(`.${name}{${body}}`);

  return name;
};

const local = (state: State, lane: Lane): number => {
  const at = state.canvas.stillAt ?? 0;

  return ((at % lane.snapped) / lane.snapped) * lane.period;
};

const pin = (attrs: Record<string, AttrValue>, el: Element, lane: Lane): void => {
  for (const channel of lane.channels) {
    for (const [name, value] of Object.entries(spec(channel).pins ?? {})) {
      const own = attrs[name];

      if (own !== undefined && own !== value)
        throw new Error(
          `${channel} needs ${name}="${value}"; this <${el.tag}> sets ${name}="${String(own)}".`,
        );
      attrs[name] = value;
    }
  }
};

const isHeld = (lane: Lane): boolean =>
  lane.backend === "css" &&
  lane.emit === "value" &&
  lane.key !== "draw" &&
  !lane.channels.some((channel) => spec(channel).pivot) &&
  !lane.keys.some((_, index) => moving(lane.keys, index));

const isRest = (lane: Lane): boolean =>
  lane.key === "translate" &&
  lane.channels.every(
    (channel) => formatValue(valueOf(lane.keys[0]!.values, channel) ?? 0) === "0",
  );

const emitShell = (state: State, target: Element, lanes: readonly Lane[]): SvgNode => {
  const attrs = { ...target.attrs };
  const still: Record<string, AttrValue> = {};
  const children = [...target.children];
  const held = lanes.filter(isHeld);
  const css = lanes.filter((lane) => lane.backend === "css" && !held.includes(lane));
  let animated = false;

  const pivot =
    lanes.some((lane) => lane.channels.some((channel) => spec(channel).pivot)) &&
    !/transform-(?:box|origin)/.test(String(attrs.style ?? ""));

  state.pivot ||= pivot;

  const declared = held.flatMap((lane) =>
    isRest(lane) ? [] : [cssDeclarations(lane.key, lane.emit, lane.keys[0]!.values)],
  );

  if (declared.length > 0) attrs.style = [attrs.style, ...declared].filter(Boolean).join(";");

  for (const lane of lanes) {
    pin(attrs, target, lane);

    if (lane.backend === "smil") {
      // SAFETY: a smil lane animates an SVG attribute, never a custom property, so its first target is a Channel.
      const value = formatValue(
        channelsAt(lane.keys, local(state, lane))[lane.channels[0] as Channel],
      );

      const nodes = animate(state.canvas, lane.key, lane, () => nextName(state, "w"));
      const end = windowEnd(nodes);

      animated ||= nodes.length > 0;
      attrs[lane.key] = end ?? value;

      if (end !== undefined) still[lane.key] = value;
      children.push(...nodes);
    }
  }

  const classes = [
    attrs.class,
    css.length > 0 && `${state.canvas.prefix}a`,
    css.length > 0 && className(state, css),
    pivot && `${state.canvas.prefix}fb`,
  ].filter(Boolean);

  if (classes.length > 0) attrs.class = classes.join(" ");

  const shell: Element = {
    ...element(target.tag, attrs, children),
    ...(target.drawn && { drawn: target.drawn }),
  };

  const emitted = Object.keys(still).length > 0 ? { ...shell, still } : shell;

  if (
    !animated ||
    state.canvas.stillAt === undefined ||
    target.tag.startsWith("fe") ||
    !lanes.some((lane) => lane.backend === "smil")
  )
    return emitted;

  return stillTwin(state, emitted);
};

const stillTwin = (state: State, moving: Element): SvgNode => {
  const { prefix } = state.canvas;
  const rule = `.${prefix}dm{display:none}.${prefix}ds{display:inline}`;

  if (!state.stills.includes(rule)) state.stills.push(rule);
  const plain = withoutSmil(moving);
  const { id, ...attrs } = plain.attrs;

  const classes = (name: string, own: AttrValue | undefined) =>
    [own, `${prefix}${name}`].filter(Boolean).join(" ");

  return {
    kind: "fragment",
    children: [
      { ...moving, attrs: { ...moving.attrs, class: classes("dm", moving.attrs.class) } },
      {
        ...plain,
        attrs: {
          ...(id !== undefined && String(id).startsWith(`${prefix}g`) && { id: `${id}s` }),
          ...attrs,
          class: classes("ds", attrs.class),
          display: "none",
        },
      },
    ],
  };
};

/**
 * Stops drawing `out` over `dark`: a discrete SMIL scale to 0, which browsers skip drawing, filters and all, while every
 * animation inside keeps its time (display:none would restart the CSS ones in Safari and Firefox). It goes on the group
 * itself when nothing else sets its transform, else on a group around it.
 */
const culled = (state: State, out: SvgNode, dark: readonly Stretch[], skews: boolean): SvgNode => {
  const { duration, playbackRate, loop } = state.canvas;
  const [start] = dark;

  if (!start) return out;
  const points: [Seconds, string][] = [[0, start[0] === 0 ? "0" : "1"]];

  for (const [from, to] of dark) {
    if (from > 0) points.push([from, "0"]);

    if (to < duration) points.push([to, "1"]);
  }

  const toggle = element("animateTransform", {
    attributeName: "transform",
    type: "scale",
    values: points.map(([, value]) => value).join(";"),
    keyTimes: points.map(([t]) => num(t / duration, 5)).join(";"),
    calcMode: "discrete",
    dur: `${num(duration / playbackRate)}s`,
    ...(loop ? { repeatCount: "indefinite" } : { fill: "freeze" }),
  });

  const own =
    out.kind === "element" &&
    out.tag === "g" &&
    out.attrs.transform === undefined &&
    !/(?:^|;)\s*transform\s*:/.test(String(out.attrs.style ?? "")) &&
    !skews;

  return own ? { ...out, children: [toggle, ...out.children] } : element("g", {}, [toggle, out]);
};

const veil = (shells: readonly Lane[][], veiled: boolean): Lane[][] =>
  shells.map((lanes, index) => {
    const outer =
      veiled ||
      shells.slice(index + 1).some((shell) => shell.some((lane) => lane.emit === "visibility"));

    return outer
      ? lanes.map((lane): Lane => ({ ...lane, emit: lane.key === "draw" ? "dash" : "value" }))
      : lanes;
  });

const walk = (
  state: State,
  node: SvgNode,
  veiled = false,
  font: FontCtx = UNKNOWN_FONT,
): SvgNode => {
  switch (node.kind) {
    case "text":
      noteText(state.fontUse, node.value, font);

      return node;
    case "raw":
      return node;
    case "fragment":
      return { ...node, children: node.children.map((child) => walk(state, child, veiled, font)) };
    case "element": {
      const bare = element(node.tag, resolveAttrs(state, node.attrs), []);
      const shells = veil(node.lanes ? [[...node.lanes]] : [], veiled);

      const hides =
        veiled || shells.some((shell) => shell.some((lane) => lane.emit === "visibility"));

      if (node.tag === "style")
        for (const child of node.children)
          if (child.kind === "text") noteCss(state.fontUse, child.value);

      const inherited = fontOf(state.canvas.prefix, node.attrs, bare.attrs, font);

      const el = {
        ...bare,
        children: node.children.map((child) => walk(state, child, hides, inherited)),
        ...(node.drawn && { drawn: node.drawn }),
      };

      const [first, ...rest] = shells;

      const done = (out: SvgNode) =>
        node.cull
          ? culled(
              state,
              out,
              node.cull,
              shells.flat().some((lane) => lane.key === "skew"),
            )
          : out;

      if (!first) return done(el);
      const pivot = String(bare.attrs.style ?? "").match(/transform-(?:box|origin)\s*:[^;]*/g);
      const wrapper: Record<string, AttrValue> = pivot ? { style: pivot.join(";") } : {};

      return done(
        rest.reduce<SvgNode>(
          (inner, lanes) => emitShell(state, element("g", wrapper, [inner]), lanes),
          emitShell(state, el, first),
        ),
      );
    }
  }
};

export interface Compiled {
  readonly body: readonly SvgNode[];
  readonly css: string;
  readonly root: Readonly<Record<string, AttrValue>>;
}

export const compile = (
  content: readonly SvgNode[],
  canvas: Canvas,
  author = "",
  rootAttrs: Element["attrs"] = {},
): Compiled => {
  const state: State = {
    canvas,
    fonts: new Map(),
    faces: [],
    fontUse: newFontUse(),
    counters: new Map(),
    keyframes: new Map(),
    classes: new Map(),
    rules: [],
    stills: [],
    pivot: false,
  };

  const root = resolveAttrs(state, rootAttrs);
  const font = fontOf(canvas.prefix, rootAttrs, root, UNKNOWN_FONT);
  const body = content.map((node) => walk(state, node, false, font));
  const authored = author.trim();

  noteCss(state.fontUse, authored);
  const fontRules = faceRules(state.fontUse, state.faces);

  const generated = [
    ...fontRules,
    state.rules.length > 0 && baseRule(canvas),
    state.pivot && `.${canvas.prefix}fb{transform-box:fill-box;transform-origin:center}`,
    ...state.rules,
    freezeRule(canvas, state.rules.length > 0, state.stills),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    body,
    css: [authored, generated].filter(Boolean).join("\n\n"),
    root,
  };
};
