import { EPSILON, type Seconds } from "../motion";
import type { Animated, Box, Layer, SceneNode, Vec } from "./ir";
import { isLane } from "./lane";
import { isAnchor, type Anchor, type Ref } from "./refs";
import { blendNumber, blendVec, breaksOf, follow, laneFrom, valueAt } from "./sample";

/**
 * The second pass of lowering. The first lowers every node where it stands; this one places what could only be placed
 * once everything was lowered: children of layout containers, nodes whose `at` is an anchor, and connectors, whose
 * ends are anchors. An anchor may name any node in the scene, so each is resolved on demand, after whatever it
 * depends on, and a loop between two is an error that names them.
 */

/** Where each child's box goes, its top-left corner in the container's frame, and the box the container takes. */
export type Arrange = (boxes: readonly Box[]) => {
  readonly slots: readonly Vec[];
  readonly box: Box;
};

/** Redraws a connector's children once its ends are known, in its own frame, on the scene's clock. */
export type Connect = (
  ends: readonly Animated<Vec>[],
  children: readonly SceneNode[],
  duration: Seconds,
) => SceneNode[];

/** What a group element asks of the second pass. */
export type Settle =
  | { readonly kind: "arrange"; readonly label: string; readonly arrange: Arrange }
  | {
      readonly kind: "connect";
      readonly label: string;
      readonly ends: readonly (Vec | Anchor)[];
      readonly connect: Connect;
    };

/** What the first pass noted about how a node was written. */
interface Note {
  readonly anchor?: Anchor;
  /** Whether the node was given an `at` of its own. */
  readonly placed: boolean;
  readonly origin: "center" | "top-left" | Vec | undefined;
  readonly settle?: Settle;
}

export interface Notes {
  readonly nodes: Map<string, Note>;
  readonly refs: Map<Ref, string>;
}

export const notes = (): Notes => ({ nodes: new Map(), refs: new Map() });

interface Written {
  readonly ref?: Ref;
  readonly at?: unknown;
  readonly origin?: "center" | "top-left" | Vec;
}

/** Notes a node as the first pass lowers it, and the ref it carries. */
export const note = (into: Notes, key: string, props: Written, settle?: Settle): void => {
  const { ref } = props;

  if (ref) {
    if (ref.within)
      throw new Error(
        `"${key}" is given ref={${ref.label}}, but a part is found inside its node, never given. Give the node a ref() of its own.`,
      );
    const taken = into.refs.get(ref);

    if (taken !== undefined)
      throw new Error(
        `The ref "${ref.key}" is on two nodes, "${taken}" and "${key}". A ref names one node: make another with ref().`,
      );
    into.refs.set(ref, key);
  }

  into.nodes.set(key, {
    ...(isAnchor(props.at) && { anchor: props.at }),
    placed: props.at !== undefined,
    origin: props.origin,
    ...(settle && { settle }),
  });
};

/** A node while the second pass works on it. */
interface Draft {
  readonly node: SceneNode;
  readonly parent: Draft | undefined;
  readonly note: Note | undefined;
  children: Draft[];
  at: Animated<Vec>;
  box: Box;
  origin: Vec;
  /** 0 not yet, 1 under way, 2 done: one under way that is asked for again is a loop. */
  placing: 0 | 1 | 2;
  measuring: 0 | 1 | 2;
}

const draft = (node: SceneNode, parent: Draft | undefined, nodes: Notes["nodes"]): Draft => {
  const own: Draft = {
    node,
    parent,
    note: nodes.get(node.key),
    children: [],
    at: node.at,
    box: node.box,
    origin: node.origin,
    placing: 0,
    measuring: node.kind === "group" ? 0 : 2,
  };

  if (node.kind === "group") own.children = node.children.map((child) => draft(child, own, nodes));

  return own;
};

const rest = <T>(value: Animated<T>): T => (isLane(value) ? value.keys[0].value : value);

const around = (children: readonly Draft[]): Box => {
  if (children.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs: number[] = [];
  const ys: number[] = [];

  for (const { at, box } of children) {
    const [x, y] = rest(at);

    xs.push(x + box.x, x + box.x + box.width);
    ys.push(y + box.y, y + box.y + box.height);
  }

  const [x, y] = [Math.min(...xs), Math.min(...ys)];

  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const originOf = (origin: Note["origin"], box: Box): Vec => {
  if (origin === undefined || origin === "center")
    return [box.x + box.width / 2, box.y + box.height / 2];

  return origin === "top-left" ? [box.x, box.y] : origin;
};

const turns = (layer: Layer): boolean =>
  isLane(layer.rotate) ||
  isLane(layer.scale) ||
  layer.rotate !== 0 ||
  layer.scale[0] !== 1 ||
  layer.scale[1] !== 1;

const DEG = Math.PI / 180;

/** A point in a node's frame, in its parent's: the rule at the top of ir.ts. */
const outward = (p: Vec, at: Vec, origin: Vec, layers: readonly Layer[], t: Seconds): Vec => {
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

/** A point in a node's parent's frame, in the node's own. */
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

/** How far a followed point may stray from where it really is, in px. */
const TOLERANCE = 0.05;

/** Places every node the first pass could not, and gives the scene's root back with every box and `at` final. */
export const settle = <G extends SceneNode & { readonly kind: "group" }>(
  root: G,
  { nodes, refs }: Notes,
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

  /**
   * Whether `d` is a container whose `at` is written as a still point. That point is folded into its children's, so
   * layout adds no transform: the container's frame is its parent's, and its box sits where `at` put it.
   */
  const folds = (d: Draft): boolean =>
    d.note?.settle?.kind === "arrange" && !d.note.anchor && d.note.placed && !isLane(d.node.at);

  const measure = (d: Draft): void => {
    if (d.measuring === 2) return;

    if (d.measuring === 1) loop(d, "box");
    d.measuring = 1;
    const { settle: asked } = d.note ?? {};

    if (asked?.kind === "connect") {
      const ends = asked.ends.map((end) => (isAnchor(end) ? resolve(end, d) : end));

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
        if (child.note?.placed)
          throw new Error(
            `"${child.node.key}" has an at of its own, but the ${asked.label} it sits in places it. Drop its at; to nudge it, give it a motion layer with an offset.`,
          );
        measure(child);
      }

      const { slots, box } = asked.arrange(d.children.map((child) => child.box));
      const folded = folds(d);
      const [x, y] = folded ? rest(d.at) : [0, 0];

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

      d.box = around(d.children);
    }

    d.origin = originOf(d.note?.origin, d.box);
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

    if (anchor) d.at = resolve(anchor, d.parent!);
    d.placing = 2;
  };

  /** What moving a point out of `d`'s frame needs: its `at`, and its origin when a layer turns or scales around it. */
  const ready = (d: Draft): void => {
    place(d);

    if (d.node.layers.some(turns) && !Array.isArray(d.note?.origin)) measure(d);
  };

  const chain = (from: Draft, to: Draft | undefined): Draft[] => {
    const out: Draft[] = [];

    for (let d: Draft | undefined = from; d && d !== to; d = d.parent) out.push(d);

    return out;
  };

  /** `anchor` in `frame`'s own frame: a point, or a lane when anything between the two moves. */
  const resolve = (anchor: Anchor, frame: Draft): Animated<Vec> => {
    const node = target(anchor);

    measure(node);
    const point = anchor.on(node.box);
    const above = new Set(chain(frame, undefined));
    const common = chain(node, undefined).find((d) => above.has(d));
    const up = chain(node, common);
    const down = chain(frame, common).reverse();

    for (const d of [...up, ...down]) ready(d);

    const at = (t: Seconds): Vec => {
      let p = point;

      for (const d of up) p = outward(p, valueAt(d.at, t, blendVec), d.origin, d.node.layers, t);

      for (const d of down)
        p = inward(p, valueAt(d.at, t, blendVec), d.origin, d.node.layers, t, d.node.key);

      return p;
    };

    const moving = [...up, ...down].flatMap((d) => [
      d.at,
      ...d.node.layers.flatMap((layer) => [layer.offset, layer.rotate, layer.scale]),
    ]);

    if (!moving.some(isLane)) return at(0);

    return laneFrom(follow(at, breaksOf(moving, duration), TOLERANCE), ([x, y]): Vec => [x!, y!]);
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
