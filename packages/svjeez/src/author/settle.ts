import type { Names } from "./names";
import { SceneError, located, placeOf } from "../model/scene-error";

import { EPSILON, type Seconds } from "../model/time";
import type { Animated, Box, Layer, SceneNode, Source, Vec } from "../model/ir";
import { atRest, isLane } from "../model/lane";
import { isDerived } from "./derived";
import { isAnchor, type Anchor, type ById, type Place, type Ref } from "./refs";
import { mixGeometry } from "../model/geometry";
import { blendNumber, blendVec, breaksOf, follow, laneFrom, valueAt } from "../model/sample";
import { isTrack } from "./track";
import { lookOf, paintedBoxOf } from "../model/painted";
import { PLACE_LIST, PLACES, homed, homeOf, pinned, type TextAnchorPlace } from "./pin";

const laidOut = <T>(names: Names, key: string, run: () => T): T => {
  try {
    return run();
  } catch (error) {
    throw error instanceof Error ? located(error, names.whereOf(key)) : error;
  }
};

export interface Size {
  readonly width?: number;
  readonly height?: number;
}

export interface ChildMeta {
  readonly name: string;
  readonly baseline?: number;
}

export type Arrange = (
  boxes: readonly Box[],
  where: string,
  meta?: readonly ChildMeta[],
) => {
  readonly slots: readonly Vec[];
  readonly box: Box;
  readonly sizes?: readonly (Size | undefined)[];
};

export type Connect = (
  ends: readonly Animated<Vec>[],
  children: readonly SceneNode[],
  duration: Seconds,
) => SceneNode[];

export type Settle =
  | {
      readonly kind: "arrange";
      readonly label: string;
      readonly arrange: Arrange;
      readonly resize?: (size: Size) => Arrange;
    }
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
  readonly framed?: true;
  readonly still?: true;
  readonly kind: Kind;
  readonly pin?: TextAnchorPlace;
  readonly pinned?: true;
  readonly origin: Origin | undefined;
  readonly settle?: Settle;
  readonly backdrop?: BackdropOf;
}

export type BackdropOf = (box: Box) => SceneNode;

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
  /** The node key of each `id` written in the scene, by its scoped id. */
  readonly ids: Map<string, { readonly key: string; readonly source?: Source }>;
  readonly aims: Map<string, Aim>;
  readonly onAnchor: Set<string>;
  readonly resized: Set<string>;
  readonly names: Names;
}

export const notes = (names: Names): Notes => ({
  nodes: new Map(),
  refs: new Map(),
  ids: new Map(),
  aims: new Map(),
  onAnchor: new Set(),
  resized: new Set(),
  names,
});

const where = (source: Source | undefined): string =>
  source ? placeOf(source) : "an unknown place";

/** Records the id a node was written with. Two nodes with one id in a scope is an error, and nothing renames either. */
export const noteId = (into: Notes, id: string, key: string, source: Source | undefined): void => {
  const taken = into.ids.get(id);

  // The same node lowered again, as in each state of a morph(), is not a second one.
  if (taken !== undefined && taken.key !== key)
    throw new SceneError(
      `Two nodes have the id "${id}": ${into.names.named(taken.key)} at ${where(taken.source)} and ${into.names.named(key)} at ${where(source)}.`,
      "Give each an id of its own; ids inside a component with an id are scoped by it.",
      into.names.whereOf(key),
    );
  into.ids.set(id, { key, ...(source && { source }) });
};

export const noteResized = (
  into: Notes,
  merged: readonly SceneNode[],
  states: readonly (readonly SceneNode[])[],
): void => {
  for (const { key } of merged) {
    const boxes = states.flatMap((state) =>
      state.filter((node) => node.key === key).map((node) => node.box),
    );

    if (boxes.length < states.length || boxes.some((box) => !sameBox(box, boxes[0]!)))
      into.resized.add(key);
  }
};

const sameBox = (a: Box, b: Box): boolean =>
  [a.x - b.x, a.y - b.y, a.width - b.width, a.height - b.height].every(
    (d) => Math.abs(d) <= EPSILON,
  );

interface Written {
  readonly ref?: Ref;
  readonly at?: unknown;
  readonly offset?: unknown;
  readonly still?: boolean;
  readonly anchor?: TextAnchorPlace;
  readonly origin?: Origin;
}

export const note = (
  into: Notes,
  key: string,
  props: Written,
  kind: Kind,
  settle?: Settle,
  backdrop?: BackdropOf,
): void => {
  const { ref } = props;
  const { names } = into;
  const point = props.at ?? props.offset;

  if (ref) {
    if (ref.named)
      throw new SceneError(
        `${names.named(key)} is given ref={${ref.label}}, but ref("id") finds a node by its id, never given.`,
        `Give the node id="${ref.named.id}", and use ref() for ref={…}.`,
        names.whereOf(key),
      );

    if (ref.within)
      throw new SceneError(
        `${names.named(key)} is given ref={${ref.label}}, but a part is found inside its node, never given.`,
        "Give the node a ref() of its own.",
        names.whereOf(key),
      );
    const taken = into.refs.get(ref);

    if (taken !== undefined && taken !== key)
      throw new SceneError(
        `A ref is on two nodes, ${names.namedAt(taken)} and ${names.named(key)}.`,
        "A ref names one node: make another with ref().",
        names.whereOf(key),
      );
    into.refs.set(ref, key);
  }

  into.nodes.set(key, {
    ...(isAnchor(point) && { anchor: point }),
    placed: props.at !== undefined || props.offset !== undefined,
    ...(props.offset !== undefined && { framed: true }),
    ...(props.still && { still: true }),
    kind,
    ...(props.anchor !== undefined && { pin: props.anchor }),
    origin: props.origin,
    ...(settle && { settle }),
    ...(backdrop && { backdrop }),
  });
};

const behind = (backdrop: BackdropOf | undefined, node: SceneNode, box: Box): SceneNode[] => {
  if (!backdrop) return [];
  const drawn = backdrop(box);

  return [{ ...drawn, ...(node.source && { source: node.source }) }];
};

const resizedWithin = (node: SceneNode, resized: ReadonlySet<string>): string | undefined => {
  if (resized.has(node.key)) return node.key;

  if (node.kind !== "group") return undefined;

  for (const child of node.children) {
    const found = resizedWithin(child, resized);

    if (found !== undefined) return found;
  }

  return undefined;
};

interface Draft {
  readonly node: SceneNode;
  readonly parent: Draft | undefined;
  note: Note | undefined;
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
    homed: note?.kind !== "group" || !note.placed || note.framed === true || note.pinned === true,
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

export type Origin = Place | Vec | "at" | { readonly frame: Vec };

const isOffset = (origin: Origin): origin is Vec => Array.isArray(origin);

const isFrameOrigin = (origin: Origin): origin is { readonly frame: Vec } =>
  typeof origin === "object" && origin !== null && !Array.isArray(origin) && "frame" in origin;

export const originOf = (
  names: Names,
  origin: Origin | undefined,
  box: Box,
  key: string,
  home: () => Vec,
): Vec => {
  if (origin === undefined) return [box.x + box.width / 2, box.y + box.height / 2];

  if (origin === "at") return home();

  if (isOffset(origin)) return [box.x + origin[0], box.y + origin[1]];

  if (isFrameOrigin(origin)) {
    if (!isPoint(origin.frame))
      throw new SceneError(
        `origin on ${names.named(key)} needs a finite frame point [x, y], got ${JSON.stringify(origin.frame)}.`,
        undefined,
        names.whereOf(key),
      );

    return origin.frame;
  }

  if (!Object.hasOwn(PLACES, origin))
    throw new SceneError(
      `origin on ${names.named(key)} takes a place, one of ${PLACE_LIST}, a point measured from its box's top-left, such as [20, 0], { frame: [x, y] } in its parent's coordinates, or "at" for the point its at places, got ${JSON.stringify(origin)}.`,
      undefined,
      names.whereOf(key),
    );
  const [u, v] = PLACES[origin];

  return [box.x + box.width * u, box.y + box.height * v];
};

const turns = (layer: Layer): boolean =>
  isLane(layer.rotate) ||
  isLane(layer.scale) ||
  isLane(layer.skew) ||
  layer.skew !== 0 ||
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
    const lean = Math.tan(valueAt(layer.skew, t, blendNumber) * DEG);
    const [ox, oy] = valueAt(layer.offset, t, blendVec);
    const [px, py] = [x - origin[0], y - origin[1]];
    const [dx, dy] = [(px + lean * py) * sx, py * sy];

    x = origin[0] + ox + dx * Math.cos(angle) - dy * Math.sin(angle);
    y = origin[1] + oy + dx * Math.sin(angle) + dy * Math.cos(angle);
  }

  return [x + at[0], y + at[1]];
};

const inward = (
  names: Names,
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
    const lean = Math.tan(valueAt(layer.skew, t, blendNumber) * DEG);
    const [ox, oy] = valueAt(layer.offset, t, blendVec);
    const [dx, dy] = [x - origin[0] - ox, y - origin[1] - oy];

    if (Math.abs(sx) < EPSILON || Math.abs(sy) < EPSILON)
      throw new SceneError(
        `An anchor is resolved inside ${names.named(key)}, which is scaled to 0 at ${t}s, so no point maps into it.`,
        "Attach to a node outside it.",
        names.whereOf(key),
      );

    const v = (dx * Math.sin(angle) + dy * Math.cos(angle)) / sy;

    x = origin[0] + (dx * Math.cos(angle) - dy * Math.sin(angle)) / sx - lean * v;
    y = origin[1] + v;
  }

  return [x, y];
};

const TOLERANCE = 0.05;

const isPoint = (end: unknown): end is Vec =>
  Array.isArray(end) && end.length === 2 && end.every((n) => Number.isFinite(n));

export const settle = <G extends SceneNode & { readonly kind: "group" }>(
  root: G,
  { nodes, refs, ids, aims, resized, names }: Notes,
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
    throw new SceneError(
      `${names.named(d.node.key)} can't be placed: its ${what} depends on itself, through an anchor or a container.`,
      "Anchor it to a node outside it, or give a node that turns or scales an origin.",
      names.whereOf(d.node.key),
    );
  };

  const attached = new Map<Draft, string[]>();

  const keyOfId = ({ id, scope }: ById, label: string, source: Source | undefined): string => {
    // The innermost scope that holds the id wins, so ref("note") in a component finds its own note first.
    for (let depth = scope.length; depth >= 0; depth--) {
      const found = ids.get([...scope.slice(0, depth), id].join("/"));

      if (found) return found.key;
    }

    const known = [...ids.keys()];

    throw new SceneError(
      `${label} names the id "${id}", but no node has it.${known.length > 0 ? ` The ids written are ${known.map((each) => `"${each}"`).join(", ")}.` : " No node has an id."}`,
      `Give a node id="${id}", or ref an id that is written.`,
      source && { source },
    );
  };

  const target = (anchor: Anchor): Draft => {
    if (anchor.of === "canvas") return top;
    const { within } = anchor.of;
    const owner = within?.ref ?? anchor.of;
    const key = owner.named ? keyOfId(owner.named, anchor.label, owner.source) : refs.get(owner);

    if (key === undefined)
      throw new SceneError(
        `${anchor.label} is a ref that is on no node.`,
        "Give one node ref={…} with it.",
        owner.source && { source: owner.source },
      );

    if (!within) return byKey.get(key)!;
    const found = byKey.get(`${key}/${within.path.join("/")}`);

    if (found) return found;

    const near = byKey.get(key)!.children.map((child) => child.node.key.slice(key.length + 1));

    throw new SceneError(
      `${names.named(key)} has no part "${within.path.join("/")}", but ${anchor.label} asks for it.${near.length > 0 ? ` The parts right inside it are ${near.map((name) => `"${name}"`).join(", ")}.` : " It has none."}`,
      undefined,
      names.whereOf(key),
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
    let pivot: Vec | undefined;

    if (asked?.kind === "connect") {
      const ends = asked.ends.map((end, i) => {
        if (isAnchor(end)) return resolve(end, d);

        if (!isPoint(end))
          throw new SceneError(
            `${names.named(d.node.key)} is given ${isTrack(end) || isDerived(end) ? "a track" : String(end)} for its ${i === 0 ? "from" : "to"}, but an end is a point or an anchor.`,
            `To move an end, attach it to a ref's anchor, as in ${i === 0 ? "from" : "to"}={card.left}, and move the node it is attached to.`,
            names.whereOf(d.node.key),
          );

        return end;
      });

      attached.set(
        d,
        asked.ends.flatMap((end) =>
          isAnchor(end) && end.of !== "canvas" ? [target(end).node.key] : [],
        ),
      );
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
        const changing = resizedWithin(child.node, resized);

        if (changing !== undefined)
          throw new SceneError(
            `${names.named(d.node.key)} lays out ${names.named(changing)}, which a morph() resizes, brings in or takes away inside a <Sequence>, so the ${asked.label} can't make room for it.`,
            `Put the ${asked.label} inside the <Sequence>, or inside the morph's states, so each state is laid out on its own.`,
            names.whereOf(d.node.key),
          );

        placedInside(names, child.node.key, child.note, asked.label);
        measure(child);
      }

      const meta: ChildMeta[] = d.children.map((child) => ({
        name: names.named(child.node.key),
        ...(child.node.kind === "text" &&
          child.node.lines[0] !== undefined && {
            baseline: child.node.lines[0].at[1] - child.box.y,
          }),
      }));

      const { slots, box, sizes } = laidOut(names, d.node.key, () =>
        asked.arrange(
          d.children.map((child) => child.box),
          names.named(d.node.key),
          meta,
        ),
      );

      d.children.forEach((child, i) => {
        const want = sizes?.[i];
        const own = child.note?.settle;

        if (!want || own?.kind !== "arrange" || !own.resize) return;
        child.note = { ...child.note!, settle: { ...own, arrange: own.resize(want) } };
        child.children = child.children.filter((each) => !each.node.authored?.backdrop);
        child.measuring = 0;
        measure(child);
      });

      const folded = folds(d);

      const home =
        folded && !d.homed
          ? pinned(d.note?.pin, box, `${names.named(d.node.key)}`)
          : ([0, 0] as const);

      const [x, y] = folded ? [atRest(d.at)[0] - home[0], atRest(d.at)[1] - home[1]] : [0, 0];

      if (folded) {
        d.homed = true;
        pivot = [x + home[0], y + home[1]];
      }

      d.children.forEach((child, i) => {
        child.at = [x + slots[i]![0] - child.box.x, y + slots[i]![1] - child.box.y];
        child.placing = 2;
      });
      d.box = { ...box, x: box.x + x, y: box.y + y };

      const backdrops = behind(d.note?.backdrop, d.node, d.box).map((node) => ({
        ...draft(node, d, nodes),
        placing: 2 as const,
        measuring: 2 as const,
      }));

      backdrops.forEach(index);
      d.children = [...backdrops, ...d.children];

      if (folded) d.at = [0, 0];
    } else {
      for (const child of d.children) {
        place(child);
        measure(child);
      }

      d.box =
        d.note?.arranged || d.node.authored?.count || d.node.authored?.frame
          ? d.node.box
          : around(d.children);
    }

    d.origin = originOf(
      names,
      d.note?.origin,
      d.box,
      d.node.key,
      () =>
        pivot ??
        homeOf(names, d.note?.kind ?? d.node.kind, d.node, d.note?.pin, d.box, unmoved(d.note)),
    );
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

      return homeOf(
        names,
        d.note?.kind ?? d.node.kind,
        d.node,
        d.note?.pin,
        d.box,
        unmoved(d.note),
      );
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
        p = inward(names, p, valueAt(d.at, t, blendVec), d.origin, d.node.layers, t, d.node.key);

      return p;
    };

    const moving: Animated<unknown>[] = [
      ...(outline ? [outline] : []),
      ...[...up, ...down].flatMap((d) => [
        d.at,
        ...d.node.layers.flatMap((layer) => [layer.offset, layer.rotate, layer.scale, layer.skew]),
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

  const contains = (d: Draft | undefined): boolean =>
    d?.note?.settle?.kind === "arrange" || d?.note?.arranged === true;

  const flattens = (d: Draft): d is Draft & { at: Vec } =>
    contains(d) &&
    contains(d.parent) &&
    !isLane(d.at) &&
    (d.at[0] !== 0 || d.at[1] !== 0) &&
    d.node.layers.length === 0 &&
    d.node.effects.length === 0 &&
    d.node.clip === undefined &&
    d.node.mask === undefined;

  const build = (d: Draft): SceneNode => {
    const ends = attached.get(d);

    const frameOrigin =
      d.note?.origin && isFrameOrigin(d.note.origin) ? d.note.origin.frame : undefined;

    const settledAt = atRest(d.at);

    const origin: Vec = frameOrigin
      ? [frameOrigin[0] - settledAt[0], frameOrigin[1] - settledAt[1]]
      : d.origin;

    const placed = {
      ...d.node,
      at: d.at,
      box: d.box,
      origin,
      ...(ends && ends.length > 0 && { authored: { ...d.node.authored, ends } }),
    };

    if (placed.kind !== "group") return placed;
    const children = d.children.map(build);

    if (!flattens(d)) return { ...placed, children };
    const [x, y] = d.at;

    return {
      ...placed,
      at: [0, 0],
      box: { ...d.box, x: d.box.x + x, y: d.box.y + y },
      origin: [d.origin[0] + x, d.origin[1] + y],
      children: children.map((child) => ({ ...child, at: homed(child.at, [-x, -y]) })),
    };
  };

  // SAFETY: the root is drafted from a group and built back from that draft, so it is still the same kind of group.
  return build(top) as G;
};

export const outsider = (node: SceneNode, notes: Notes): string | undefined => {
  const own = notes.nodes.get(node.key);

  if (own?.anchor || own?.settle?.kind === "connect" || notes.onAnchor.has(node.key))
    return node.key;

  if (node.kind !== "group") return undefined;

  for (const child of node.children) {
    const found = outsider(child, notes);

    if (found !== undefined) return found;
  }

  return undefined;
};

export const arrangeState = (list: readonly SceneNode[], into: Notes): SceneNode[] => {
  const { names } = into;
  const first = new Map<string, Note | undefined>();

  const arranged = (node: SceneNode, size?: Size): SceneNode => {
    if (node.kind !== "group") return node;

    if (!first.has(node.key)) first.set(node.key, into.nodes.get(node.key));
    const note = first.get(node.key);
    const given = note?.settle;

    const asked =
      size && given?.kind === "arrange" && given.resize
        ? { ...given, arrange: given.resize(size) }
        : given;

    const children = (
      asked?.kind === "arrange"
        ? node.children.filter((child) => !child.authored?.backdrop)
        : node.children
    ).map((child) => arranged(child));

    const pin = (box: Box): Animated<Vec> => {
      if (
        note?.kind !== "group" ||
        !note.placed ||
        note.framed ||
        note.pinned ||
        note.anchor ||
        outsider(node, into) !== undefined
      )
        return node.at;

      into.nodes.set(node.key, { ...into.nodes.get(node.key)!, pinned: true });

      return homed(node.at, pinned(note?.pin, box, `${names.named(node.key)}`));
    };

    if (asked?.kind !== "arrange") {
      const box = node.authored?.count || node.authored?.frame ? node.box : around(children);

      return {
        ...node,
        children,
        box,
        at: pin(box),
        origin: originOf(names, note?.origin, box, node.key, () =>
          homeOf(names, node.kind, node, note?.pin, box, unmoved(note)),
        ),
      };
    }

    for (const child of children) {
      placedInside(names, child.key, into.nodes.get(child.key), asked.label);
      const inside = outsider(child, into);

      if (inside !== undefined)
        throw new SceneError(
          `A ${asked.label} in a morph() state holds ${names.named(inside)}, which is placed by an anchor, a track going to an anchor, or as an arrow's end. A morph arranges each state on its own, before anchors are known.`,
          `Attach it outside the ${asked.label}, or outside the morph.`,
          names.whereOf(inside),
        );
    }

    const { slots, box, sizes } = laidOut(names, node.key, () =>
      asked.arrange(
        children.map((child) => child.box),
        names.named(node.key),
      ),
    );

    const { settle: _arranged, backdrop, ...kept } = note!;

    into.nodes.set(node.key, { ...kept, arranged: true });

    const placed = children.map((child, i) => {
      const want = sizes?.[i];

      return want
        ? arranged(
            node.children.find((raw) => raw.key === child.key)!,
            want,
          )
        : child;
    });

    return {
      ...node,
      box,
      at: pin(box),
      origin: originOf(names, note!.origin, box, node.key, () =>
        homeOf(names, node.kind, node, note!.pin, box, unmoved(note)),
      ),
      children: [
        ...behind(backdrop, node, box),
        ...placed.map((child, i) => ({
          ...child,
          at: [slots[i]![0] - child.box.x, slots[i]![1] - child.box.y] as const,
        })),
      ],
    };
  };

  return list.map((node) => arranged(node));
};

const unmoved = (note: Note | undefined): boolean => note?.framed === true || note?.still === true;

const placedInside = (names: Names, key: string, note: Note | undefined, label: string): void => {
  if (note?.placed) {
    const prop = note.framed ? "offset" : "at";

    throw new SceneError(
      `${names.named(key)} has its own ${prop}, but the ${label} it sits in places it.`,
      `Drop its ${prop}; to nudge it, give it a motion layer with an offset.`,
      names.whereOf(key),
    );
  }

  if (note?.pin !== undefined)
    throw new SceneError(
      `${names.named(key)} has anchor=${JSON.stringify(note.pin)}, but the ${label} it sits in lines up its box itself.`,
      `Drop anchor, and say where children sit with the ${label}'s own align, justify or place.`,
      names.whereOf(key),
    );
};

const placing = (
  names: Names,
  anchor: Anchor | undefined,
  refs: ReadonlyMap<Ref, string>,
): string => {
  if (!anchor) return "at a point";
  const owner = anchor.of === "canvas" ? undefined : refs.get(anchor.of.within?.ref ?? anchor.of);

  return `at ${owner === undefined ? anchor.label : anchor.label.replace(/^ref\(\)/, names.named(owner))}`;
};

export const sameAnchors = (
  list: readonly SceneNode[],
  { nodes, refs, names }: Notes,
  seen: Map<string, Anchor | undefined>,
): void => {
  const visit = (node: SceneNode): void => {
    const anchor = nodes.get(node.key)?.anchor;

    if (seen.has(node.key)) {
      const before = seen.get(node.key);

      const alike =
        before === anchor || (before?.of === anchor?.of && before?.label === anchor?.label);

      if (!alike)
        throw new SceneError(
          `${names.named(node.key)} is placed ${placing(names, before, refs)} in one morph() state and ${placing(names, anchor, refs)} in another. A morph blends points, not anchors.`,
          "Place it the same way in every state, or put it in a <Group> placed at the anchor in every state and move it inside.",
          names.whereOf(node.key),
        );
    } else seen.set(node.key, anchor);

    if (node.kind === "group") node.children.forEach(visit);
  };

  list.forEach(visit);
};
