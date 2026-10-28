import { backendOf, formatValue, laneOf, spec, valueOf, type Backend, type Channel, type Target, type TargetValue, type TargetValues } from "./channels";
import { BASE_TIMING, baseRule, classBody, cssKeyframes, freezeRule, seconds, type Emit } from "./css";
import { isRef, refNode, refTag, type AnyRef, type DefTag } from "./defs";
import { fontFaceRule, fontFaces, isFontValue, type Font, type FontValue } from "./font/font";
import { num } from "./format";
import { isCss, isProperty, propertyRule, type Css, type Property } from "./properties";
import { keysOf, snapPeriod, valueAt, type Key } from "./keys";
import { EPSILON, dataOf, type Motion } from "./motion";
import { animate } from "./smil";
import { element, type AttrValue, type Element, type SvgNode } from "./svg";

export interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  /** Playback rate. Every emitted duration is divided by it; the timeline stays in scene seconds. */
  readonly speed: number;
  readonly stillAt?: number;
  /** False plays once and holds the last frame. */
  readonly loop: boolean;
}

interface Lane {
  readonly key: string;
  readonly backend: Backend;
  readonly channels: readonly Target[];
  readonly keys: readonly Key[];
  readonly period: number;
  readonly snapped: number;
  readonly nest: boolean;
  /** `visibility` for a hard 0/1 cut; `dash` or `value` once an outer element or shell toggles visibility, which a descendant's `visible` would override. */
  readonly emit: Emit;
  readonly label?: string;
}

interface State {
  readonly canvas: Canvas;
  readonly ids: Map<AnyRef, string>;
  readonly blurs: Map<string, string>;
  readonly properties: Map<Property, string>;
  readonly registrations: string[];
  /** Embedded faces by family name, weight and style, so two different files never claim one slot. */
  readonly fonts: Map<string, Font>;
  readonly faces: { readonly name: string; readonly font: Font }[];
  /** Every run of text in the scene, so embedded fonts can be cut down to the glyphs it uses. */
  readonly texts: string[];
  readonly counters: Map<string, number>;
  readonly defs: SvgNode[];
  readonly keyframes: Map<string, string>;
  readonly classes: Map<string, string>;
  readonly rules: string[];
  readonly stills: string[];
  pivot: boolean;
}

const MAX_KEYS = 2000;

const PREFIX: Record<DefTag, string> = {
  filter: "f",
  linearGradient: "g",
  radialGradient: "g",
  pattern: "p",
  clipPath: "c",
  mask: "m",
  marker: "k",
  symbol: "s",
};

const REGION = ["filterUnits", "x", "y", "width", "height"];

const nextName = (state: State, prefix: string): string => {
  const count = (state.counters.get(prefix) ?? 0) + 1;
  state.counters.set(prefix, count);
  return `${prefix}${count}`;
};

const hasSmil = (node: SvgNode): boolean =>
  node.kind === "element" ? node.tag === "animate" || node.children.some(hasSmil) : node.kind === "fragment" && node.children.some(hasSmil);

const withoutSmil = (node: Element): Element => ({
  ...node,
  children: node.children.filter((child) => !(child.kind === "element" && child.tag === "animate")).map((child) => (child.kind === "element" ? withoutSmil(child) : child)),
});

/** Emit a def. A filter animated by SMIL gets a still twin that reduced motion swaps in, since CSS cannot pause SMIL. */
const addDef = (state: State, def: Element): void => {
  state.defs.push(def);
  if (state.canvas.stillAt === undefined || def.tag !== "filter" || !hasSmil(def)) return;
  const id = String(def.attrs.id);
  state.defs.push({ ...(withoutSmil(def)), attrs: { ...def.attrs, id: `${id}s` } });
  state.stills.push(`[filter="url(#${id})"]{filter:url(#${id}s)}`);
};

const canvasRegion = ({ width, height }: Canvas): Record<string, string> => ({
  filterUnits: "userSpaceOnUse",
  x: "0",
  y: "0",
  width: num(width),
  height: num(height),
});

const refId = (state: State, ref: AnyRef): string => {
  const known = state.ids.get(ref);
  if (known) return known;
  const def = refNode(ref);
  const id = nextName(state, PREFIX[refTag(ref)]);
  state.ids.set(ref, id);
  const region = def.tag === "filter" && !REGION.some((name) => name in def.attrs) ? canvasRegion(state.canvas) : {};
  addDef(state, walk(state, { ...def, attrs: { id, ...region, ...def.attrs } }) as Element);
  return id;
};

const propertyName = (state: State, key: Property): string => {
  const known = state.properties.get(key);
  if (known) return known;
  const name = nextName(state, "--p");
  state.properties.set(key, name);
  state.registrations.push(propertyRule(name, key));
  return name;
};

/** Embed each face the first time a family uses it, whole if any font with its bytes asks to, and return the `font-family` value. */
const fontFamily = (state: State, value: FontValue): string => {
  const { family, faces } = fontFaces(value);
  for (const { name, font } of faces) {
    const slot = `'${name}' ${font.weight} ${font.style}`;
    const taken = state.fonts.get(slot);
    if (taken?.href === font.href) {
      if (taken.subset && !font.subset) {
        state.fonts.set(slot, font);
        state.faces.splice(state.faces.findIndex((face) => face.font === taken && face.name === name), 1, { name, font });
      }
      continue;
    }
    if (taken) throw new Error(`Two different fonts claim ${slot}. Give one of them another family name with font(bytes, { family }).`);
    state.fonts.set(slot, font);
    state.faces.push({ name, font });
  }
  return family;
};

const resolveCss = (state: State, text: Css): string =>
  text.parts.map((part) => (typeof part === "string" ? part : propertyName(state, part.property))).join("");

const resolveAttrs = (state: State, attrs: Element["attrs"]): Record<string, AttrValue> =>
  Object.fromEntries(
    Object.entries(attrs).map(([name, value]) => {
      if (isCss(value)) return [name, resolveCss(state, value)];
      if (isFontValue(value)) return [name, fontFamily(state, value)];
      if (!isRef(value)) return [name, value];
      const id = refId(state, value);
      return [name, name === "href" ? `#${id}` : `url(#${id})`];
    }),
  );

const startValue = (el: Element, channel: Target, backend: Backend, given: TargetValue | undefined): TargetValue => {
  const row = spec(channel);
  if (given !== undefined) return given;
  if (backend !== "smil" && row.identity !== undefined) return row.identity;
  const attr = row.attr && el.attrs[row.attr];
  if (typeof attr === "string") return typeof row.value === "number" ? Number(attr) : (attr as TargetValue);
  throw new Error(`${channel} on <${el.tag}> has no starting value. Pass it to motion({ ${channel}: … }) or set the attribute.`);
};

const isDiscrete = (keys: readonly Key[], channel: Target): boolean =>
  keys.every((key, index) => {
    const value = valueOf(key.values, channel);
    if (value !== 0 && value !== 1) return false;
    const next = keys[index + 1];
    return next === undefined || valueOf(next.values, channel) === value || (key.ease.kind === "steps" && key.ease.count === 1);
  });

const lanesOf = (state: State, el: Element, value: Motion): Lane[] => {
  const data = dataOf(value);
  const { duration } = state.canvas;
  const period = data.period ?? duration;
  const snapped = data.period === undefined ? duration : snapPeriod(data.period, duration);
  const touched = [...new Set([...Object.keys(data.initial), ...data.steps.flatMap((step) => Object.keys(step.values))])] as Target[];
  const groups = new Map<string, Target[]>();
  for (const channel of touched) {
    if (!(spec(channel).tags as readonly string[]).includes(el.tag)) throw new Error(`<${el.tag}> cannot animate ${channel}.`);
    const key = laneOf(el.tag, channel);
    groups.set(key, [...(groups.get(key) ?? []), channel]);
  }
  return [...groups].map(([key, channels]) => {
    const backend = backendOf(el.tag, channels[0]!);
    const pick = (values: TargetValues) => Object.fromEntries(channels.filter((c) => c in values).map((c) => [c, valueOf(values, c)])) as TargetValues;
    const initial = Object.fromEntries(channels.map((c) => [c, startValue(el, c, backend, valueOf(data.initial, c))])) as TargetValues;
    const segments = data.steps.filter((step) => channels.some((c) => c in step.values)).map((step) => ({ ...step, values: pick(step.values) }));
    const last = Math.max(0, ...segments.map((step) => step.start + step.over));
    if (last > period + EPSILON) throw new Error(`A motion on <${el.tag}> runs until ${num(last)}s, past the ${num(duration)}s scene.`);
    const keys = keysOf(initial, segments.sort((a, b) => a.start - b.start), period);
    if (keys.length > MAX_KEYS) throw new Error(`${key} on <${el.tag}> has ${keys.length} keys; the cap is ${MAX_KEYS}.`);
    return {
      key,
      backend,
      channels,
      keys,
      period,
      snapped,
      nest: backend !== "smil" && spec(channels[0]!).composition === "nest",
      emit: spec(channels[0]!).toggles?.every((name) => el.attrs[name] === undefined) && isDiscrete(keys, channels[0]!) ? "visibility" : "value",
      label: data.label,
    };
  });
};

const collides = (el: Element, lane: Lane): boolean =>
  lane.channels.some((channel) => {
    const row = spec(channel);
    return row.collidesWith?.some((name) => name in el.attrs) || (row.wrapsOn as readonly string[] | undefined)?.includes(el.tag);
  });

const placeLanes = (el: Element, layers: readonly Lane[][]): Lane[][] => {
  const shells: Lane[][] = [[]];
  const taken = (shell: Lane[], key: string) => shell.some((lane) => lane.key === key);
  for (const lane of layers.flat().filter((lane) => !lane.nest)) {
    if (taken(shells[0]!, lane.key)) throw new Error(`Two motions both animate \`${lane.key}\` on <${el.tag}>: put them in one motion().`);
    shells[0]!.push(lane);
  }
  for (const layer of [...layers].reverse()) {
    const nest = layer.filter((lane) => lane.nest);
    if (nest.length === 0) continue;
    const index = shells.length - 1;
    if (!nest.every((lane) => !taken(shells[index]!, lane.key) && (index > 0 || !collides(el, lane)))) shells.push([]);
    shells.at(-1)!.push(...nest);
  }
  return shells;
};

const keyframesName = (state: State, body: string, label?: string): string => {
  const known = state.keyframes.get(body);
  if (known) return known;
  const name = nextName(state, `${label ? `${label}-` : ""}k`);
  state.keyframes.set(body, name);
  state.rules.push(`@keyframes ${name}{${body}}`);
  return name;
};

const className = (state: State, lanes: readonly Lane[]): string => {
  const frames = lanes.map((lane) => cssKeyframes(isProperty(lane.key) ? propertyName(state, lane.key) : lane.key, lane.emit, lane.keys, lane.period));
  const names = frames.map(({ body }, index) => keyframesName(state, body, lanes[index]!.label));
  const body = classBody(state.canvas, lanes, names, frames.map((frame) => frame.timing));
  const known = state.classes.get(body);
  if (known) return known;
  const label = lanes.find((lane) => lane.label)?.label;
  const name = nextName(state, `${label ? `${label}-` : ""}m`);
  state.classes.set(body, name);
  state.rules.push(`.${name}{${body}}`);
  return name;
};

const local = (state: State, lane: Lane): number => {
  const at = state.canvas.stillAt ?? 0;
  return ((at % lane.snapped) / lane.snapped) * lane.period;
};

const blurFilter = (state: State, lane: Lane): string => {
  const signature = `blur|${JSON.stringify(lane.keys)}|${lane.snapped}`;
  const known = state.blurs.get(signature);
  if (known) return known;
  const id = nextName(state, "f");
  state.blurs.set(signature, id);
  const still = formatValue(valueAt(lane.keys, local(state, lane)).blur);
  const blur = element("feGaussianBlur", { stdDeviation: still }, [animate(state.canvas, "stdDeviation", lane)]);
  addDef(state, element("filter", { id, ...canvasRegion(state.canvas) }, [blur]));
  return id;
};

const pin = (attrs: Record<string, AttrValue>, el: Element, lane: Lane): void => {
  for (const channel of lane.channels) {
    for (const [name, value] of Object.entries(spec(channel).pins ?? {})) {
      const own = attrs[name];
      if (own !== undefined && own !== value) throw new Error(`${channel} needs ${name}="${value}"; this <${el.tag}> sets ${name}="${String(own)}".`);
      attrs[name] = value;
    }
  }
};

const emitShell = (state: State, target: Element, lanes: readonly Lane[]): Element => {
  const attrs: Record<string, AttrValue> = { ...target.attrs };
  const children = [...target.children];
  const css = lanes.filter((lane) => lane.backend === "css");
  const pivot =
    lanes.some((lane) => lane.channels.some((channel) => spec(channel).pivot)) && !/transform-(?:box|origin)/.test(String(attrs.style ?? ""));
  state.pivot ||= pivot;
  for (const lane of lanes) {
    pin(attrs, target, lane);
    if (lane.backend === "blur") attrs.filter = `url(#${blurFilter(state, lane)})`;
    if (lane.backend === "smil") {
      attrs[lane.key] = formatValue(valueAt(lane.keys, local(state, lane))[lane.channels[0] as Channel]);
      children.push(animate(state.canvas, lane.key, lane));
    }
  }
  const classes = [attrs.class, css.length > 0 && "a", css.length > 0 && className(state, css), pivot && "fb"].filter(Boolean);
  if (classes.length > 0) attrs.class = classes.join(" ");
  return element(target.tag, attrs, children);
};

/**
 * A hard 0/1 opacity cut compiles to `visibility`, which a descendant's `visibility:visible` overrides.
 * Inside an element or shell that toggles visibility, cuts fall back to opacity and draw keeps only its dash.
 */
const veil = (shells: readonly Lane[][], veiled: boolean): Lane[][] =>
  shells.map((lanes, index) => {
    const outer = veiled || shells.slice(index + 1).some((shell) => shell.some((lane) => lane.emit === "visibility"));
    return outer ? lanes.map((lane): Lane => ({ ...lane, emit: lane.key === "draw" ? "dash" : "value" })) : lanes;
  });

const walk = (state: State, node: SvgNode, veiled = false): SvgNode => {
  switch (node.kind) {
    case "text":
      state.texts.push(node.value);
      return node;
    case "raw":
      return node;
    case "fragment":
      return { ...node, children: node.children.map((child) => walk(state, child, veiled)) };
    case "element": {
      const bare = element(node.tag, resolveAttrs(state, node.attrs), []);
      const shells = veil(node.motions.length > 0 ? placeLanes(bare, node.motions.map((value) => lanesOf(state, bare, value))) : [], veiled);
      const hides = veiled || shells.some((shell) => shell.some((lane) => lane.emit === "visibility"));
      const el = { ...bare, children: node.children.map((child) => walk(state, child, hides)) };
      return shells.reduce<Element>((inner, lanes, index) => emitShell(state, index === 0 ? inner : element("g", {}, [inner]), lanes), el);
    }
  }
};

export interface Compiled {
  readonly body: readonly SvgNode[];
  readonly defs: readonly SvgNode[];
  readonly css: string;
}

export const compile = (content: readonly SvgNode[], canvas: Canvas, author: string | Css = ""): Compiled => {
  const state: State = {
    canvas,
    ids: new Map(),
    blurs: new Map(),
    properties: new Map(),
    registrations: [],
    fonts: new Map(),
    faces: [],
    texts: [],
    counters: new Map(),
    defs: [],
    keyframes: new Map(),
    classes: new Map(),
    rules: [],
    stills: [],
    pivot: false,
  };
  const body = content.map((node) => walk(state, node));
  const authored = (isCss(author) ? resolveCss(state, author) : author).trim();
  const fontRules = state.faces.map(({ name, font }) => fontFaceRule(name, font, state.texts));
  const generated = [...fontRules, ...state.registrations, state.rules.length > 0 && baseRule(canvas), state.pivot && ".fb{transform-box:fill-box;transform-origin:center}", ...state.rules, freezeRule(canvas, state.rules.length > 0, state.stills)].filter(Boolean).join("\n");
  return { body, defs: state.defs, css: [authored, generated].filter(Boolean).join("\n\n") };
};
