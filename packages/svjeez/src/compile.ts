import {
  backendOf,
  formatValue,
  laneOf,
  spec,
  valueOf,
  type Backend,
  type Channel,
  type Target,
  type TargetValue,
  type TargetValues,
} from "./channels";
import {
  baseRule,
  classBody,
  cssDeclarations,
  cssKeyframes,
  freezeRule,
  onceRule,
  type Emit,
} from "./css";
import { isRef, refNode, refTag, type AnyRef, type DefTag } from "./defs";
import { fontFaces, isFontValue, type Font, type FontValue } from "./font/font";
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
} from "./font/usage";
import { num } from "./format";
import {
  isCss,
  isProperty,
  propertyRule,
  type Css,
  type CssPart,
  type Property,
} from "./properties";
import { MAX_KEYS, keysOf, moving, rotateKeys, snapPeriod, valueAt, type Key } from "./keys";
import { EPSILON, dataOf, type Motion, type Step } from "./motion";
import { commandsOf } from "./paths";
import { resolveSteps } from "./resolve";
import { animate } from "./smil";
import { sourceOf } from "./sources";
import type { TimelineTrack } from "./traced";
import { element, type AttrValue, type Element, type SvgNode } from "./svg";

export interface Canvas {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  /** Playback rate. Every emitted duration is divided by it; the timeline stays in scene seconds. */
  readonly playbackRate: number;
  /** Put in front of every generated id, class, keyframe name, custom property and font family. */
  readonly prefix: string;
  readonly stillAt?: number;
  /** False plays once and holds the last frame. */
  readonly loop: boolean;
}

export interface Lane {
  readonly key: string;
  readonly backend: Backend;
  readonly channels: readonly Target[];
  readonly keys: readonly Key[];
  readonly period: number;
  readonly snapped: number;
  readonly nest: boolean;
  readonly emit: Emit;
  readonly label?: string;
}

interface ClipFrame {
  readonly label: string;
  readonly start: number;
  readonly end: number;
  readonly open: boolean;
}

interface Clock {
  readonly offset: number;
  readonly end: number;
  readonly clips: readonly ClipFrame[];
}

interface State {
  readonly canvas: Canvas;
  readonly timeline?: TimelineTrack[];
  readonly ids: Map<AnyRef, Map<number, string>>;
  clock: Clock;
  readonly blurs: Map<string, string>;
  readonly properties: Map<Property, string>;
  readonly registrations: string[];
  readonly fonts: Map<string, Font>;
  readonly faces: { readonly name: string; readonly font: Font }[];
  readonly fontUse: FontUse;
  readonly counters: Map<string, number>;
  readonly defs: SvgNode[];
  readonly keyframes: Map<string, string>;
  readonly classes: Map<string, string>;
  readonly rules: string[];
  readonly styles: string[];
  readonly stills: string[];
  pivot: boolean;
  once: boolean;
}

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

const nextName = (state: State, base: string, lead = ""): string => {
  const count = (state.counters.get(lead + base) ?? 0) + 1;
  state.counters.set(lead + base, count);

  return `${lead}${state.canvas.prefix}${base}${count}`;
};

const hasSmil = (node: SvgNode): boolean =>
  node.kind === "element"
    ? node.tag === "animate" || node.children.some(hasSmil)
    : (node.kind === "fragment" || node.kind === "clip") && node.children.some(hasSmil);

const withoutSmil = ({ still, ...node }: Element): Element => ({
  ...node,
  attrs: { ...node.attrs, ...still },
  children: node.children
    .filter((child) => !(child.kind === "element" && ["animate", "set"].includes(child.tag)))
    .map((child) => (child.kind === "element" ? withoutSmil(child) : child)),
});

const addDef = (state: State, def: Element): void => {
  state.defs.push(def);

  if (state.canvas.stillAt === undefined || def.tag !== "filter" || !hasSmil(def)) return;
  const id = String(def.attrs.id);
  state.defs.push({ ...withoutSmil(def), attrs: { ...def.attrs, id: `${id}s` } });
  state.stills.push(`[filter="url(#${id})"]{filter:url(#${id}s)}`);
};

const canvasRegion = ({ width, height }: Canvas) => ({
  filterUnits: "userSpaceOnUse",
  x: "0",
  y: "0",
  width: num(width),
  height: num(height),
});

const refId = (state: State, ref: AnyRef): string => {
  const { offset } = state.clock;
  const known = state.ids.get(ref)?.get(offset);

  if (known) return known;
  const def = refNode(ref);
  const id = nextName(state, PREFIX[refTag(ref)]);
  state.ids.set(ref, (state.ids.get(ref) ?? new Map()).set(offset, id));

  const region =
    def.tag === "filter" && !REGION.some((name) => name in def.attrs)
      ? canvasRegion(state.canvas)
      : {};

  // SAFETY: walk returns an element for an element node, since emitShell and element() build an Element.
  addDef(state, walk(state, { ...def, attrs: { id, ...region, ...def.attrs } }) as Element);

  return id;
};

const propertyName = (state: State, key: Property): string => {
  const known = state.properties.get(key);

  if (known) return known;
  const name = nextName(state, "p", "--");
  state.properties.set(key, name);
  state.registrations.push(propertyRule(name, key));

  return name;
};

const fontFamily = (state: State, value: FontValue): string => {
  const { family: plain, faces: named } = fontFaces(value);
  const { prefix } = state.canvas;
  const faces = named.map((face) => ({ ...face, name: prefix + face.name }));
  const family = `'${prefix}${plain.slice(1)}`;

  for (const { name, font } of faces) {
    const slot = slotOf(name, font);
    const taken = state.fonts.get(slot);

    if (taken?.href === font.href) {
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
      throw new Error(
        `Two different fonts claim ${slot}. Give one of them another family name with font(bytes, { family }).`,
      );
    state.fonts.set(slot, font);
    state.faces.push({ name, font });
  }

  return family;
};

const isHole = (part: CssPart): part is Exclude<CssPart, string> => typeof part !== "string";

const resolveCss = (state: State, text: Css): string =>
  text.parts.map((part) => (isHole(part) ? propertyName(state, part.property) : part)).join("");

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

const isNumeric = (value: TargetValue): value is number => typeof value === "number";

const isAttrText = (value: AttrValue | undefined): value is string => typeof value === "string";

const startValue = (
  el: Element,
  channel: Target,
  backend: Backend,
  given: TargetValue | undefined,
): TargetValue => {
  const row = spec(channel);

  if (given !== undefined) return given;

  if (backend !== "smil" && row.identity !== undefined) return row.identity;
  const attr = row.attr && el.attrs[row.attr];

  if (isAttrText(attr)) {
    // SAFETY: a channel whose value is not a number takes a color, and a color is written as text, so the attribute is a TargetValue.
    return isNumeric(row.value) ? Number(attr) : (attr as TargetValue);
  }

  throw new Error(
    `${channel} on <${el.tag}> has no starting value. Pass it to motion({ ${channel}: … }) or set the attribute.`,
  );
};

const isDiscrete = (keys: readonly Key[], channel: Target): boolean =>
  keys.every((key, index) => {
    const value = valueOf(key.values, channel);

    if (value !== 0 && value !== 1) return false;
    const next = keys[index + 1];

    return (
      next === undefined ||
      valueOf(next.values, channel) === value ||
      (key.ease.kind === "steps" && key.ease.count === 1)
    );
  });

const lanesOf = (state: State, el: Element, value: Motion): Lane[] => {
  const data = dataOf(value);
  const { duration } = state.canvas;
  const { clock } = state;
  const period = data.period ?? duration;
  const offset = data.period === undefined ? clock.offset : 0;
  const clockEnd = data.period === undefined ? clock.end - clock.offset : period;
  const snapped = data.period === undefined ? duration : snapPeriod(data.period, duration);

  // SAFETY: each key is a channel or property that motion() validated, so it is a Target name.
  const touched = [
    ...new Set([
      ...Object.keys(data.initial),
      ...data.steps.flatMap((step) => Object.keys(step.values)),
    ]),
  ] as Target[];

  const groups = new Map<string, Target[]>();

  for (const channel of touched) {
    // SAFETY: tags lists tag names and includes only compares them with el.tag, a string, so the widened readonly string[] is correct.
    if (!(spec(channel).tags as readonly string[]).includes(el.tag))
      throw new Error(`<${el.tag}> cannot animate ${channel}.`);
    const key = laneOf(el.tag, channel);
    groups.set(key, [...(groups.get(key) ?? []), channel]);
  }

  return [...groups].map(([key, channels]) => {
    const backend = backendOf(el.tag, channels[0]!);

    // SAFETY: the entries are the lane's own channels, each read from a TargetValues, so the result is a TargetValues.
    const pick = (values: TargetValues) =>
      Object.fromEntries(
        channels.filter((c) => c in values).map((c) => [c, valueOf(values, c)]),
      ) as TargetValues;

    // SAFETY: the entries are the lane's own channels, each paired with a TargetValue from startValue, so the result is a TargetValues.
    const initial = Object.fromEntries(
      channels.map((c) => [c, startValue(el, c, backend, valueOf(data.initial, c))]),
    ) as TargetValues;

    const mine = (c: Target) => channels.includes(c);

    const pickStep = (step: Step): Step => {
      const values = pick(step.values);

      return step.restore
        ? { ...step, values, restore: step.restore.filter(mine) }
        : { ...step, values };
    };

    const picked = data.steps
      .filter((step) =>
        step.restore ? step.restore.some(mine) : channels.some((c) => c in step.values),
      )
      .map(pickStep);

    const segments = resolveSteps(initial, picked, data.rewind, clockEnd, `<${el.tag}>`);
    const last = Math.max(0, ...segments.map((step) => step.start + step.over));
    reach(el, clock, data.period === undefined, offset + last, duration, period);

    let keys = keysOf(
      initial,
      segments.map((step) => ({ ...step, start: step.start + offset })),
      period,
    );

    if (data.period !== undefined && clock.offset > 0)
      keys = rotateKeys(
        keys,
        ((clock.offset % snapped) / snapped) * period,
        period,
        `A loop on <${el.tag}> inside ${clock.clips.at(-1)?.label ?? "a clip"}`,
      );

    if (keys.length > MAX_KEYS)
      throw new Error(
        `${key} on <${el.tag}> has ${keys.length} keys; the cap is ${MAX_KEYS}.${data.repeated ? " repeat() unrolls every pass, so use .loop(period) for a motion that never stops." : ""}`,
      );

    if (key === "d") {
      const commands = new Set(keys.map((k) => commandsOf(String(k.values.d))));

      if (commands.size > 1)
        throw new Error(
          "d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first.",
        );
    }

    return {
      key,
      backend,
      channels,
      keys,
      period,
      snapped,
      nest: backend !== "smil" && spec(channels[0]!).composition === "nest",
      emit:
        spec(channels[0]!).toggles?.every((name) => el.attrs[name] === undefined) &&
        isDiscrete(keys, channels[0]!)
          ? "visibility"
          : "value",
      label: data.label,
    };
  });
};

const reach = (
  el: Element,
  clock: Clock,
  onClock: boolean,
  until: number,
  duration: number,
  period: number,
): void => {
  if (!onClock) {
    if (until > period + EPSILON)
      throw new Error(
        `A motion on <${el.tag}> runs until ${num(until)}s, past the ${num(duration)}s scene.`,
      );

    return;
  }

  for (const clip of [...clock.clips].reverse()) {
    if (!clip.open && until > clip.end + EPSILON)
      throw new Error(
        `A motion on <${el.tag}> runs until ${num(until - clip.start)}s, past the ${num(clip.end - clip.start)}s ${clip.label}.`,
      );
  }

  if (until > duration + EPSILON) {
    const inside = clock.clips.at(-1);

    throw new Error(
      `A motion on <${el.tag}> runs until ${num(until)}s${inside ? ` (${num(until - clock.offset)}s into ${inside.label})` : ""}, past the ${num(duration)}s scene.`,
    );
  }
};

const collides = (el: Element, lane: Lane): boolean =>
  lane.channels.some((channel) => {
    const row = spec(channel);

    // SAFETY: wrapsOn lists tag names and includes compares them with el.tag, a string, so the widened readonly string[] is correct.
    return (
      row.collidesWith?.some((name) => name in el.attrs) ||
      (row.wrapsOn as readonly string[] | undefined)?.includes(el.tag)
    );
  });

const placeLanes = (el: Element, layers: readonly Lane[][]): Lane[][] => {
  const shells: Lane[][] = [[]];
  const taken = (shell: Lane[], key: string) => shell.some((lane) => lane.key === key);

  for (const lane of layers.flat().filter((lane) => !lane.nest)) {
    if (taken(shells[0]!, lane.key))
      throw new Error(
        `Two motions both animate \`${lane.key}\` on <${el.tag}>: put them in one motion().`,
      );
    shells[0]!.push(lane);
  }

  for (const layer of [...layers].reverse()) {
    const nest = layer.filter((lane) => lane.nest);

    if (nest.length === 0) continue;
    const index = shells.length - 1;

    if (
      !nest.every((lane) => !taken(shells[index]!, lane.key) && (index > 0 || !collides(el, lane)))
    )
      shells.push([]);
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

const canvasOf = (state: State, once: boolean): Canvas =>
  once ? { ...state.canvas, loop: false } : state.canvas;

const ONCE_ATTR = "data-once";

const AMBIENT_ATTR = "data-ambient";

interface Within {
  readonly once: boolean;
  readonly ambient: boolean;
}

const NOWHERE: Within = { once: false, ambient: false };

const windowEnd = (nodes: readonly SvgNode[]): string | undefined => {
  const first = nodes[0];

  return first?.kind === "element" && first.attrs["data-loop"] !== undefined
    ? String(first.attrs.values).split(";").at(-1)
    : undefined;
};

const animateOn = (state: State, attribute: string, lane: Lane, within: Within): SvgNode[] => {
  const nodes = animate(canvasOf(state, within.once), attribute, lane, () => nextName(state, "w"));

  const marks = {
    ...(within.once && { [ONCE_ATTR]: "" }),
    ...(within.ambient && { [AMBIENT_ATTR]: "" }),
  };

  return within.once || within.ambient
    ? nodes.map((node) =>
        node.kind === "element" ? { ...node, attrs: { ...node.attrs, ...marks } } : node,
      )
    : nodes;
};

const className = (state: State, lanes: readonly Lane[], once: boolean): string => {
  const frames = lanes.map((lane) =>
    cssKeyframes(
      isProperty(lane.key) ? propertyName(state, lane.key) : lane.key,
      lane.emit,
      lane.keys,
      lane.period,
    ),
  );

  const names = frames.map(({ body }, index) => keyframesName(state, body, lanes[index]!.label));

  const body = classBody(
    canvasOf(state, once),
    lanes,
    names,
    frames.map((frame) => frame.timing),
  );

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

const blurFilter = (state: State, lane: Lane, within: Within): string => {
  const signature = `blur|${JSON.stringify(lane.keys)}|${lane.snapped}|${within.once}|${within.ambient}`;
  const known = state.blurs.get(signature);

  if (known) return known;
  const id = nextName(state, "f");
  state.blurs.set(signature, id);
  const still = formatValue(valueAt(lane.keys, local(state, lane)).blur);

  const nodes = animateOn(state, "stdDeviation", lane, within);
  const end = windowEnd(nodes);

  const blur = element("feGaussianBlur", { stdDeviation: end ?? still }, nodes);

  addDef(
    state,
    element("filter", { id, ...canvasRegion(state.canvas) }, [
      end === undefined ? blur : { ...blur, still: { stdDeviation: still } },
    ]),
  );

  return id;
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
  !isProperty(lane.key) &&
  !lane.channels.some((channel) => spec(channel).pivot) &&
  !lane.keys.some((_, index) => moving(lane.keys, index));

const isRest = (lane: Lane): boolean =>
  lane.key === "translate" &&
  lane.channels.every(
    (channel) => formatValue(valueOf(lane.keys[0]!.values, channel) ?? 0) === "0",
  );

const emitShell = (
  state: State,
  target: Element,
  lanes: readonly Lane[],
  within: Within,
): SvgNode => {
  const { once, ambient } = within;
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
  state.once ||= once && css.length > 0;

  const declared = held.flatMap((lane) =>
    isRest(lane) ? [] : [cssDeclarations(lane.key, lane.emit, lane.keys[0]!.values)],
  );

  if (declared.length > 0) attrs.style = [attrs.style, ...declared].filter(Boolean).join(";");

  for (const lane of lanes) {
    pin(attrs, target, lane);

    if (lane.backend === "blur") attrs.filter = `url(#${blurFilter(state, lane, within)})`;

    if (lane.backend === "smil") {
      // SAFETY: a smil lane animates an SVG attribute, never a custom property, so its first target is a Channel.
      const value = formatValue(
        valueAt(lane.keys, local(state, lane))[lane.channels[0] as Channel],
      );

      const nodes = animateOn(state, lane.key, lane, within);
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
    css.length > 0 && once && `${state.canvas.prefix}o`,
    css.length > 0 && ambient && `${state.canvas.prefix}c`,
    css.length > 0 && className(state, css, once),
    pivot && `${state.canvas.prefix}fb`,
  ].filter(Boolean);

  if (classes.length > 0) attrs.class = classes.join(" ");

  const shell = element(target.tag, attrs, children);
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
  const { id: _, ...attrs } = plain.attrs;

  const classes = (name: string, own: AttrValue | undefined) =>
    [own, `${prefix}${name}`].filter(Boolean).join(" ");

  return {
    kind: "fragment",
    children: [
      { ...moving, attrs: { ...moving.attrs, class: classes("dm", moving.attrs.class) } },
      {
        ...plain,
        attrs: { ...attrs, class: classes("ds", attrs.class), display: "none" },
      },
    ],
  };
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

const clipLabel = ({ at, over }: { readonly at: number; readonly over?: number }): string =>
  `<Clip at={${num(at)}}${over === undefined ? "" : ` over={${num(over)}}`}>`;

const timelineOf = (node: Element, lanes: readonly Lane[]): TimelineTrack[] => {
  const source = sourceOf(node) ?? String(node.attrs["data-source"] ?? "");
  const name = node.attrs["data-part"] ?? node.attrs.id ?? `<${node.tag}>`;

  return lanes
    .filter((lane) => !isHeld(lane))
    .flatMap((lane) => {
      const scale = lane.snapped / lane.period;

      const spans = lane.keys.flatMap((key, index) => {
        if (!moving(lane.keys, index)) return [];
        const next = lane.keys[index + 1]!;
        const at = (key.ease.kind === "steps" && key.ease.count === 1 ? next.t : key.t) * scale;

        return [{ at, over: Math.max(0, next.t * scale - at) }];
      });

      if (spans.length === 0) return [];

      return [
        {
          label: lane.label ?? `${name} · ${lane.key}`,
          ...(source && { source }),
          spans,
          period: lane.snapped,
        },
      ];
    });
};

const walk = (
  state: State,
  node: SvgNode,
  veiled = false,
  within: Within = NOWHERE,
  font: FontCtx = UNKNOWN_FONT,
): SvgNode => {
  switch (node.kind) {
    case "text":
      noteText(state.fontUse, node.value, font);

      return node;
    case "raw":
      return node;
    case "style": {
      const rule = isCss(node.css) ? resolveCss(state, node.css) : node.css;

      noteCss(state.fontUse, rule);

      if (rule.trim()) state.styles.push(rule.trim());

      return { kind: "fragment", children: [] };
    }

    case "fragment":
      return {
        ...node,
        children: node.children.map((child) => walk(state, child, veiled, within, font)),
      };
    case "clip": {
      const parent = state.clock;
      const start = parent.offset + node.at;
      const end = node.over === undefined ? parent.end : start + node.over;
      const label = clipLabel(node);

      if (start > parent.end + EPSILON || end > parent.end + EPSILON) {
        const around = parent.clips.at(-1);

        throw new Error(
          `A ${label} runs until ${num(end - parent.offset)}s, past the ${num(parent.end - parent.offset)}s ${around ? around.label : "scene"}.`,
        );
      }

      state.timeline?.push({ label, spans: [{ at: start, over: end - start }] });
      state.clock = {
        offset: start,
        end,
        clips: [...parent.clips, { label, start, end, open: node.over === undefined }],
      };

      try {
        return {
          kind: "fragment",
          children: node.children.map((child) => walk(state, child, veiled, within, font)),
        };
      } finally {
        state.clock = parent;
      }
    }

    case "element": {
      const bare = element(node.tag, resolveAttrs(state, node.attrs), []);

      const inside: Within = {
        once: within.once || node.once === true,
        ambient: within.ambient || node.ambient === true,
      };

      const shells = veil(
        node.lanes
          ? [[...node.lanes]]
          : node.motions.length > 0
            ? placeLanes(
                bare,
                node.motions.map((value) => lanesOf(state, bare, value)),
              )
            : [],
        veiled,
      );

      if (state.timeline)
        for (const shell of shells) state.timeline.push(...timelineOf(node, shell));

      const hides =
        veiled || shells.some((shell) => shell.some((lane) => lane.emit === "visibility"));

      if (node.tag === "style")
        for (const child of node.children)
          if (child.kind === "text") noteCss(state.fontUse, child.value);

      const inherited = fontOf(state.canvas.prefix, node.attrs, bare.attrs, font);

      const el = {
        ...bare,
        children: node.children.map((child) => walk(state, child, hides, inside, inherited)),
      };

      const pivot = String(bare.attrs.style ?? "").match(/transform-(?:box|origin)\s*:[^;]*/g);
      const wrapper: Record<string, AttrValue> = pivot ? { style: pivot.join(";") } : {};

      return shells.reduce<SvgNode>(
        (inner, lanes, index) =>
          // SAFETY: only the first shell can carry `d` and come back as a fragment, and every later shell wraps it in a <g>.
          emitShell(
            state,
            index === 0 ? (inner as Element) : element("g", wrapper, [inner]),
            lanes,
            inside,
          ),
        el,
      );
    }
  }
};

export interface Compiled {
  readonly body: readonly SvgNode[];
  readonly defs: readonly SvgNode[];
  readonly css: string;
  /** `rootAttrs` resolved, for the root `<svg>`. */
  readonly root: Readonly<Record<string, AttrValue>>;
}

export const compile = (
  content: readonly SvgNode[],
  canvas: Canvas,
  author: string | Css = "",
  timeline?: TimelineTrack[],
  rootAttrs: Element["attrs"] = {},
): Compiled => {
  const state: State = {
    canvas,
    timeline,
    ids: new Map(),
    clock: { offset: 0, end: canvas.duration, clips: [] },
    blurs: new Map(),
    properties: new Map(),
    registrations: [],
    fonts: new Map(),
    faces: [],
    fontUse: newFontUse(),
    counters: new Map(),
    defs: [],
    keyframes: new Map(),
    classes: new Map(),
    rules: [],
    styles: [],
    stills: [],
    pivot: false,
    once: false,
  };

  // Every element inherits the root's font properties, so a family written there embeds and reaches every text.
  const root = resolveAttrs(state, rootAttrs);
  const font = fontOf(canvas.prefix, rootAttrs, root, UNKNOWN_FONT);
  const body = content.map((node) => walk(state, node, false, NOWHERE, font));
  const authored = (isCss(author) ? resolveCss(state, author) : author).trim();

  noteCss(state.fontUse, authored);
  const fontRules = faceRules(state.fontUse, state.faces);

  const generated = [
    ...fontRules,
    ...state.registrations,
    state.rules.length > 0 && baseRule(canvas),
    state.once && onceRule(canvas),
    state.pivot && `.${canvas.prefix}fb{transform-box:fill-box;transform-origin:center}`,
    ...state.rules,
    freezeRule(canvas, state.rules.length > 0, state.stills),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    body,
    defs: state.defs,
    css: [authored, ...state.styles, generated].filter(Boolean).join("\n\n"),
    root,
  };
};
