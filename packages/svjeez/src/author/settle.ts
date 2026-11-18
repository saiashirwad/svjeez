import { EPSILON, type Seconds } from "../model/time";
import type { Animated, Box, Layer, SceneNode, Vec } from "../model/ir";
import { atRest, isLane } from "../model/lane";
import { isDerived } from "./derived";
import { isAnchor, type Anchor, type Place, type Ref } from "./refs";
import { mixGeometry } from "../model/geometry";
import { blendNumber, blendVec, breaksOf, follow, laneFrom, valueAt } from "../model/sample";
import { isTrack } from "./track";
import { lookOf, paintedBoxOf } from "../model/painted";
import { PLACE_LIST, PLACES, homed, homeOf, pinned, type TextAnchorPlace } from "./pin";

export type Arrange = (boxes: readonly Box[]) => {
  readonly slots: readonly Vec[];
  readonly box: Box;
};

export type Connect = (
  ends: readonly Animated<Vec>[],
  children: readonly SceneNode[],
  duration: Seconds,
) => SceneNode[];

export type Settle =
  | { readonly kind: "arrange"; readonly label: string; readonly arrange: Arrange }
  | {
      readonly kind: "connect";
      readonly label: string;
      readonly ends: readonly (Vec | Anchor)[];
      readonly connect: Connect;
    };

type Kind = SceneNode["kind"];

interface Note {
  readonly anchor?: Anchor;
  readonly arranged?: true;
  readonly placed: boolean;
  readonly kind: Kind;
  readonly pin?: TextAnchorPlace;
  readonly pinned?: true;
  readonly origin: Place | Vec | undefined;
  readonly settle?: Settle;
}

export type Aim = (
  read: (anchor: Anchor) => Animated<Vec>,
  self: () => {
    readonly box: Box;
    readonly origin: Vec;
    readonly layers: readonly Layer[];
    readonly home: Vec;
  },
) => Animated<Vec>;

export interface Notes {
  readonly nodes: Map<string, Note>;
  readonly refs: Map<Ref, string>;
  readonly aims: Map<string, Aim>;
  readonly resized: Set<string>;
}

export const notes = (): Notes => ({
  nodes: new Map(),
  refs: new Map(),
  aims: new Map(),
  resized: new Set(),
});

export const noteResized = (
  into: Notes,
  merged: readonly SceneNode[],
  states: readonly (readonly SceneNode[])[],
): void => {
  for (const { key } of merged) {
    const boxes = states.flatMap((state) =>
      state.filter((node) => node.key === key).map((node) => node.box),
    );

    if (boxes.some((box) => !sameBox(box, boxes[0]!))) into.resized.add(key);
  }
};

const sameBox = (a: Box, b: Box): boolean =>
  [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every(
    (d) => Math.abs(d) <= EPSILON,
  );

interface Written {
  readonly ref?: Ref;
  readonly at?: unknown;
  readonly anchor?: TextAnchorPlace;
  readonly origin?: Place | Vec;
}

export const note = (
  into: Notes,
  key: string,
  props: Written,
  kind: Kind,
  settle?: Settle,
): void => {
  const { ref } = props;

  if (ref) {
    if (ref.within)
      throw new Error(
        `"${key}" is given ref={${ref.label}}, but a part is found inside its node, never given. Give the node a ref() of its own.`,
      );
    const taken = into.refs.get(ref);

    if (taken !== undefined && taken !== key)
      throw new Error(
        `The ref "${ref.key}" is on two nodes, "${taken}" and "${key}". A ref names one node: make another with ref().`,
      );
    into.refs.set(ref, key);
  }

  into.nodes.set(key, {
    ...(isAnchor(props.at) && { anchor: props.at }),
    placed: props.at !== undefined,
    kind,
    ...(props.anchor !== undefined && { pin: props.anchor }),
    origin: props.origin,
    ...(settle && { settle }),
  });
};

interface Draft {
  readonly node: SceneNode;
  readonly parent: Draft | undefined;
  readonly note: Note | undefined;
  children: Draft[];
  at: Animated<Vec>;
  box: Box;
  origin: Vec;
  homed: boolean;
  placing: 0 | 1 | 2;
  measuring: 0 | 1 | 2;
}

const draft = (node: SceneNode, parent: Draft | undefined, nodes: Notes["nodes"]): Draft => {
  const note = nodes.get(node.key);

  const own: Draft = {
    node,
    parent,
    note,
    children: [],
    at: node.at,
    box: node.box,
    origin: node.origin,
    homed: note?.kind !== "group" || note.pin === undefined || note.pinned === true,
    placing: 0,
    measuring: node.kind === "group" ? 0 : 2,
  };

  if (node.kind === "group") own.children = node.children.map((child) => draft(child, own, nodes));

  return own;
};

export const around = (
  children: readonly { readonly at: Animated<Vec>; readonly box: Box }[],
): Box => {
  if (children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs: number[] = [];
  const ys: number[] = [];

  for (const { at, box } of children) {
    const [x, y] = atRest(at);

    xs.push(x + box.x, x + box.x + box.width);
    ys.push(y + box.y, y + box.y + box.height);
  }

  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const isOffset = (origin: Place | Vec): origin is Vec => Array.isArray(origin);

export const originOf = (origin: Note["origin"], box: Box, key: string): Vec => {
  if (origin === undefined) return [box.x + box.width / 2, box.y + box.height / 2];

  if (isOffset(origin)) return [box.x + origin[0], box.y + origin[1]];

  if (!Object.hasOwn(PLACES, origin))
    throw new Error(
      `origin on "${key}" takes a place, one of ${PLACE_LIST}, or a point measured from its box's top-left, such as [20, 0], got ${JSON.stringify(origin)}.`,
    );
  const [u, v] = PLACES[origin];

  return [box.x + box.width * u, box.y + box.height * v];
};

const turns = (layer: Layer): boolean =>
  isLane(layer.rotate) ||
  isLane(layer.scale) ||
  layer.rotate !== 0 ||
  layer.scale[0] !== 1 ||
  layer.scale[1] !== 1;

const DEG = Math.PI / 180;

export const outward = (
  p: Vec,
  at: Vec,
  origin: Vec,
  layers: readonly Layer[],
  t: Seconds,
): Vec => {
  let [x, y] = p;

  for (const layer of [...layers].reverse()) {
    const [sx, sy] = valueAt(layer.scale, t, blendVec);
    const angle = valueAt(layer.rotate, t, blendNumber) * DEG;
    const [ox, oy] = valueAt(layer.offset, t, blendVec);
    const [dx, dy] = [(x - origin[0]) * sx, (y - origin[1]) * sy];

    x = origin[0] + ox + dx * Math.cos(angle) - dy * Math.sin(angle);
    y = origin[1] + oy + dx * Math.sin(angle) + dy * Math.cos(angle);
  }

  return [x + at[0], y + at[1]];
};

const inward = (
  p: Vec,
  at: Vec,
  origin: Vec,
  layers: readonly Layer[],
  t: Seconds,
  key: string,
): Vec => {
  let [x, y] = [p[0] - at[0], p[1] - at[1]];

  for (const layer of layers) {
    const [sx, sy] = valueAt(layer.scale, t, blendVec);
    const angle = -valueAt(layer.rotate, t, blendNumber) * DEG;
    const [ox, oy] = valueAt(layer.offset, t, blendVec);
    const [dx, dy] = [x - origin[0] - ox, y - origin[1] - oy];

    if (Math.abs(sx) < EPSILON || Math.abs(sy) < EPSILON)
      throw new Error(
        `An anchor is resolved inside "${key}", which is scaled to 0 at ${t}s, so no point maps into it. Attach to a node outside it.`,
      );

    x = origin[0] + (dx * Math.cos(angle) - dy * Math.sin(angle)) / sx;
    y = origin[1] + (dx * Math.sin(angle) + dy * Math.cos(angle)) / sy;
  }

  return [x, y];
};

const TOLERANCE = 0.05;

const isPoint = (end: unknown): end is Vec =>
  Array.isArray(end) && end.length === 2 && end.every((n) => Number.isFinite(n));

export const settle = <G extends SceneNode & { readonly kind: "group" }>(
  root: G,
  { nodes, refs, aims, resized }: Notes,
  duration: Seconds,
): G => {
  const top = draft(root, undefined, nodes);
  const byKey = new Map<string, Draft>();

  const index = (d: Draft): void => {
    byKey.set(d.node.key, d);
    d.children.forEach(index);
  };

  index(top);
  top.placing = 2;
  top.measuring = 2;

  const loop = (d: Draft, what: string): never => {
    throw new Error(
      `"${d.node.key}" can't be placed: its ${what} depends on itself, through an anchor or a container. Anchor it to a node outside it, or give a node that turns or scales an origin.`,
    );
  };

  const target = (anchor: Anchor): Draft => {
    if (anchor.of === "canvas") return top;
    const { within } = anchor.of;
    const owner = within?.ref ?? anchor.of;
    const key = refs.get(owner);

    if (key === undefined)
      throw new Error(
        `${anchor.label} names the ref "${owner.key}", which is on no node. Give one node ref={…} with it.`,
      );

    if (!within) return byKey.get(key)!;
    const found = byKey.get(`${key}/${within.path.join("/")}`);

    if (found) return found;

    const near = byKey.get(key)!.children.map((child) => child.node.key.slice(key.length + 1));

    throw new Error(
      `${anchor.label} names no node: "${key}" has no part "${within.path.join("/")}".${near.length > 0 ? ` The parts right inside it are ${near.map((name) => `"${name}"`).join(", ")}.` : " It has none."}`,
    );
  };

  const folds = (d: Draft): boolean =>
    d.note?.settle?.kind === "arrange" &&
    !d.note.anchor &&
    d.note.placed &&
    !isLane(d.node.at) &&
    d.node.clip === undefined &&
    d.node.mask === undefined;

  const measure = (d: Draft): void => {
    if (d.measuring === 2) return;

    if (d.measuring === 1) loop(d, "box");
    d.measuring = 1;
    const { settle: asked } = d.note ?? {};

    if (asked?.kind === "connect") {
      const ends = asked.ends.map((end, i) => {
        if (isAnchor(end)) return resolve(end, d);

        if (!isPoint(end))
          throw new Error(
            `The ${asked.label} "${d.node.key}" is given ${isTrack(end) || isDerived(end) ? "a track" : String(end)} for its ${i === 0 ? "from" : "to"}, but an end is a point or an anchor. To move an end, attach it to a ref's anchor, as in ${i === 0 ? "from" : "to"}={card.left}, and move the node it is attached to.`,
          );

        return end;
      });

      d.children = asked
        .connect(
          ends,
          d.children.map((child) => child.node),
          duration,
        )
        .map((child) => ({ ...draft(child, d, nodes), placing: 2, measuring: 2 }));
      d.children.forEach(index);
      d.box = around(d.children);
    } else if (asked?.kind === "arrange") {
      for (const child of d.children) {
        if (resized.has(child.node.key))
          throw new Error(
            `The ${asked.label} "${d.node.key}" lays out "${child.node.key}", whose box a morph() changes, but layout reads each box at rest, so it would not make room. Put the ${asked.label} inside the morph's states instead, so each state is laid out on its own.`,
          );

        placedInside(child.node.key, child.note, asked.label);
        measure(child);
      }

      const { slots, box } = asked.arrange(d.children.map((child) => child.box));
      const folded = folds(d);

      const home =
        folded && !d.homed ? pinned(d.note?.pin, box, `"${d.node.key}"`) : ([0, 0] as const);

      const [x, y] = folded ? [atRest(d.at)[0] - home[0], atRest(d.at)[1] - home[1]] : [0, 0];

      if (folded) d.homed = true;

      d.children.forEach((child, i) => {
        child.at = [x + slots[i]![0] - child.box.x, y + slots[i]![1] - child.box.y];
        child.placing = 2;
      });
      d.box = { ...box, x: box.x + x, y: box.y + y };

      if (folded) d.at = [0, 0];
    } else {
      for (const child of d.children) {
        place(child);
        measure(child);
      }

      d.box = d.note?.arranged ? d.node.box : around(d.children);
    }

    d.origin = originOf(d.note?.origin, d.box, d.node.key);
    d.measuring = 2;
  };

  const place = (d: Draft): void => {
    if (d.placing === 2) return;

    if (d.placing === 1) loop(d, "place");
    d.placing = 1;

    if (folds(d)) measure(d);
    else if (d.parent?.note?.settle?.kind === "arrange") {
      measure(d.parent);

      return;
    }

    const { anchor } = d.note ?? {};

    const aim = aims.get(d.node.key);

    const home = (): Vec => {
      measure(d);

      return homeOf(d.note?.kind ?? d.node.kind, d.node, d.note?.pin, d.box);
    };

    if (anchor) d.at = homed(resolve(anchor, d.parent!), home());
    else if (aim)
      d.at = homed(
        aim(
          (to) => resolve(to, d.parent!),
          () => {
            measure(d);

            return { box: d.box, origin: d.origin, layers: d.node.layers, home: home() };
          },
        ),
        home(),
      );
    else if (!d.homed) d.at = homed(d.at, home());
    d.homed = true;
    d.placing = 2;
  };

  const ready = (d: Draft): void => {
    place(d);

    if (d.node.layers.some(turns)) measure(d);
  };

  const chain = (from: Draft, to: Draft | undefined): Draft[] => {
    const out: Draft[] = [];

    for (let d: Draft | undefined = from; d && d !== to; d = d.parent) out.push(d);

    return out;
  };

  const resolve = (anchor: Anchor, frame: Draft): Animated<Vec> => {
    const node = target(anchor);

    measure(node);
    const point = anchor.on(node.box);
    const shape = node.node;
    const outline = shape.kind === "shape" && isLane(shape.geometry) ? shape.geometry : undefined;
    const look = shape.kind === "shape" ? lookOf(shape) : undefined;

    const pointAt = (t: Seconds): Vec =>
      outline
        ? anchor.on(
            paintedBoxOf(
              valueAt(outline, t, (a, b, u) => mixGeometry(a, b, u, `"${shape.key}"`)),
              look,
            ),
          )
        : point;

    const above = new Set(chain(frame, undefined));
    const common = chain(node, undefined).find((d) => above.has(d));
    const up = chain(node, common);
    const down = chain(frame, common).reverse();

    for (const d of [...up, ...down]) ready(d);

    const at = (t: Seconds): Vec => {
      let p = pointAt(t);

      for (const d of up) p = outward(p, valueAt(d.at, t, blendVec), d.origin, d.node.layers, t);

      for (const d of down)
        p = inward(p, valueAt(d.at, t, blendVec), d.origin, d.node.layers, t, d.node.key);

      return p;
    };

    const moving: Animated<unknown>[] = [
      ...(outline ? [outline] : []),
      ...[...up, ...down].flatMap((d) => [
        d.at,
        ...d.node.layers.flatMap((layer) => [layer.offset, layer.rotate, layer.scale]),
      ]),
    ];

    if (!moving.some(isLane)) return at(0);

    return laneFrom(
      follow(at, breaksOf(moving, duration), TOLERANCE, [], moving, true),
      ([x, y]): Vec => [x!, y!],
    );
  };

  for (const d of byKey.values()) {
    place(d);
    measure(d);
  }

  const build = (d: Draft): SceneNode => {
    const placed = { ...d.node, at: d.at, box: d.box, origin: d.origin };

    return placed.kind === "group" ? { ...placed, children: d.children.map(build) } : placed;
  };

  // SAFETY: the root is drafted from a group and built back from that draft, so it is still the same kind of group.
  return build(top) as G;
};

export const outsider = (node: SceneNode, notes: Notes): string | undefined => {
  const own = notes.nodes.get(node.key);

  if (own?.anchor || own?.settle?.kind === "connect" || notes.aims.has(node.key)) return node.key;

  if (node.kind !== "group") return undefined;

  for (const child of node.children) {
    const found = outsider(child, notes);

    if (found !== undefined) return found;
  }

  return undefined;
};

export const arrangeState = (list: readonly SceneNode[], into: Notes): SceneNode[] => {
  const arranged = (node: SceneNode): SceneNode => {
    if (node.kind !== "group") return node;
    const children = node.children.map(arranged);
    const note = into.nodes.get(node.key);
    const asked = note?.settle;

    const pin = (box: Box): Animated<Vec> => {
      if (note?.pin === undefined || outsider(node, into) !== undefined) return node.at;
      into.nodes.set(node.key, { ...into.nodes.get(node.key)!, pinned: true });

      return homed(node.at, pinned(note.pin, box, `"${node.key}"`));
    };

    if (asked?.kind !== "arrange") {
      const box = around(children);

      return {
        ...node,
        children,
        box,
        at: pin(box),
        origin: originOf(note?.origin, box, node.key),
      };
    }

    for (const child of children) {
      placedInside(child.key, into.nodes.get(child.key), asked.label);
      const inside = outsider(child, into);

      if (inside !== undefined)
        throw new Error(
          `A ${asked.label} in a morph() state holds "${inside}", which is placed by an anchor, a timeline's move to an anchor, or as an arrow's end. A morph arranges each state on its own, before anchors are known: attach it outside the ${asked.label}, or outside the morph.`,
        );
    }

    const { slots, box } = asked.arrange(children.map((child) => child.box));

    const { settle: _arranged, ...kept } = note!;

    into.nodes.set(node.key, { ...kept, arranged: true });

    return {
      ...node,
      box,
      at: pin(box),
      origin: originOf(note!.origin, box, node.key),
      children: children.map((child, i) => ({
        ...child,
        at: [slots[i]![0] - child.box.x, slots[i]![1] - child.box.y],
      })),
    };
  };

  return list.map(arranged);
};

const placedInside = (key: string, note: Note | undefined, label: string): void => {
  if (note?.placed)
    throw new Error(
      `"${key}" has an at of its own, but the ${label} it sits in places it. Drop its at; to nudge it, give it a motion layer with an offset.`,
    );

  if (note?.pin !== undefined)
    throw new Error(
      `"${key}" has anchor=${JSON.stringify(note.pin)}, but the ${label} it sits in lines up its box itself. Drop anchor, and say where children sit with the ${label}'s own align, justify or place.`,
    );
};

const placing = (anchor: Anchor | undefined): string =>
  anchor ? `at ${anchor.label}` : "at a point";

export const sameAnchors = (
  list: readonly SceneNode[],
  { nodes }: Notes,
  seen: Map<string, Anchor | undefined>,
): void => {
  const visit = (node: SceneNode): void => {
    const anchor = nodes.get(node.key)?.anchor;

    if (seen.has(node.key)) {
      const before = seen.get(node.key);

      const alike =
        before === anchor || (before?.of === anchor?.of && before?.label === anchor?.label);

      if (!alike)
        throw new Error(
          `"${node.key}" is placed ${placing(before)} in one morph() state and ${placing(anchor)} in another. A morph blends points, not anchors: place it the same way in every state, or put it in a <Group> placed at the anchor in every state and move it inside.`,
        );
    } else seen.set(node.key, anchor);

    if (node.kind === "group") node.children.forEach(visit);
  };

  list.forEach(visit);
};
