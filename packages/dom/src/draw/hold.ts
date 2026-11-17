import {
  motion,
  render,
  show,
  span,
  type ChannelValues,
  type Ease,
  type Motion,
  type SvgNode,
} from "svjeez";

// A recording of many states draws one picture per transition, and most of each picture is what the one before drew:
// the sidebar, the columns, every card that didn't move. `hold` merges the pictures so a part drawn the same in a run
// of transitions is written once and shown across all of them, and only what changes is drawn per transition.

type Element = Extract<SvgNode, { kind: "element" }>;

// Interned keys: a node's key is a small number, so comparing two subtrees never walks either.
const interned = new Map<string, number>();
const keys = new WeakMap<SvgNode, number | null>();
// Refs, fonts and Css values by identity: the painter makes one per distinct def, so equal defs are the same object.

type AttrValue = Element["attrs"][string];

/** An attribute that isn't text: a def's ref, a font, a CSS value. */
type Shared = Exclude<AttrValue, string>;

const isText = (value: AttrValue): value is string => typeof value === "string";

const identities = new WeakMap<Shared, number>();
let objects = 0;

const identity = (value: Shared): number => {
  let id = identities.get(value);

  if (id === undefined) {
    id = ++objects;
    identities.set(value, id);
  }

  return id;
};

const intern = (text: string): number => {
  let id = interned.get(text);

  if (id === undefined) {
    id = interned.size;
    interned.set(text, id);
  }

  return id;
};

/** Nothing that runs: no motions, and none of the flags that change how motions below run. */
const still = (node: Element): boolean =>
  node.motions.length === 0 && !node.once && !node.ambient && !node.still;

/** The attributes as one string, refs and other objects by identity. */
const attrsKey = (node: Element): string =>
  node.tag +
  JSON.stringify(
    Object.entries(node.attrs)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, isText(v) ? v : identity(v)]),
  );

/**
 * A number two nodes share exactly when they draw the same and nothing in them moves, or undefined for a node that
 * moves (its times belong to one transition) or that compile treats specially.
 */
export const keyOf = (node: SvgNode): number | undefined => {
  const known = keys.get(node);

  if (known !== undefined) return known ?? undefined;

  let key: number | undefined;

  if (node.kind === "text") key = intern(`t${node.value}`);
  else if (node.kind === "raw") key = intern(`r${node.value}`);
  else if (node.kind === "fragment" || node.kind === "element") {
    const kids = node.children.map(keyOf);

    if (kids.every((k) => k !== undefined) && (node.kind === "fragment" || still(node)))
      key = intern(`${node.kind === "fragment" ? "f" : attrsKey(node)}[${kids.join(",")}]`);
  }

  keys.set(node, key ?? null);

  return key;
};

/** One tween of a moving node's attributes. */
/** The attributes a recipe moves: a path's outline and fill, or a translation. */
export type Values = ChannelValues<"d" | "fill" | "x" | "y">;

export interface Step {
  readonly to: Values;
  readonly at: number;
  readonly over: number;
  readonly ease: Ease;
}

/**
 * How a moving node is drawn from its attributes' first values and a motion through its steps, so that two moves of
 * one node in consecutive transitions can be drawn as one node with both steps.
 */
export interface Recipe {
  readonly from: Values;
  readonly steps: readonly Step[];
  readonly draw: (from: Values, animation: Motion<"d" | "fill" | "x" | "y">) => SvgNode;
  /**
   * Where the node sits when its `x` and `y` channels are 0, for a node that moves by translating. A later move
   * drawn from another place chains by shifting its steps by the difference.
   */
  readonly origin?: { readonly x: number; readonly y: number };
}

/** A recipe drawn: its first values, then each step in turn. */
/** Motions that `cook` made which run two animations, SMIL for the shape and CSS for the color. */
const smil = new WeakSet<Motion>();

/** What a clip or mask the painter defined holds, so the animations inside it count where it is used. */
const contents = new WeakMap<Shared, readonly SvgNode[]>();

/** Records what a def holds. */
export const defines = <R extends Shared>(ref: R, content: readonly SvgNode[]): R => {
  contents.set(ref, content);

  return ref;
};

export const cook = (recipe: Recipe): SvgNode => {
  let m: Motion<"d" | "fill" | "x" | "y"> = motion(recipe.from);

  for (const s of recipe.steps) m = m.to(s.to, span(s.at, s.over), s.ease);

  // A path with a fill runs a CSS animation for the color as well.
  if ("d" in recipe.from && Object.keys(recipe.from).length > 1) smil.add(m);

  return recipe.draw(recipe.from, m);
};

interface Ends {
  readonly start: number | undefined;
  readonly end: number | undefined;
  readonly recipe?: Recipe;
}

/** What a moving node looks like before its motion starts and after it ends, by key. */
const ends = new WeakMap<SvgNode, Ends>();

/** The same attributes move in both, so their steps chain. */
const chains = (a: Recipe, b: Recipe): boolean => {
  const x = Object.keys(a.from).sort().join();

  // Paths tween only between the same commands, so every outline in one motion must share them.
  const outlines = [a.from, ...a.steps.map((s) => s.to), b.from, ...b.steps.map((s) => s.to)].map(
    (v) => (v.d === undefined ? "" : v.d.replace(/[^A-Za-z]/g, "")),
  );

  return (
    outlines.every((c) => c === outlines[0]) &&
    !a.origin === !b.origin &&
    x === Object.keys(b.from).sort().join() &&
    b.steps.every((s) => Object.keys(s.to).sort().join() === x)
  );
};

/** `b`'s steps after `a`'s, moved to `a`'s origin. */
const chain = (a: Recipe, b: Recipe): Recipe => {
  const dx = (b.origin?.x ?? 0) - (a.origin?.x ?? 0);
  const dy = (b.origin?.y ?? 0) - (a.origin?.y ?? 0);

  const moved = b.steps.map((s) =>
    a.origin ? { ...s, to: { ...s.to, x: Number(s.to.x) + dx, y: Number(s.to.y) + dy } } : s,
  );

  return { ...a, steps: [...a.steps, ...moved] };
};

/**
 * Marks `node`, which moves in one transition, as drawing `start` before its motion and `end` after it (either
 * left out when it draws nothing nameable there). `hold` then lets it stand in for those still drawings in the
 * transitions around its own, so a box that slides once is one element with one motion rather than three drawings
 * cut into each other.
 */
export const settles = <N extends SvgNode>(
  node: N,
  start?: SvgNode,
  end?: SvgNode,
  recipe?: Recipe,
): N => {
  ends.set(node, { start: start && keyOf(start), end: end && keyOf(end), recipe });

  return node;
};

/** A node drawn from `recipe`, still as `start` before and as `end` after, which can chain with the next move. */
export const moving = (recipe: Recipe, start: SvgNode | undefined, end: SvgNode): SvgNode =>
  settles(cook(recipe), start, end, recipe);

/** Children with fragments spliced in, as the SVG draws them. */
const flat = (nodes: readonly SvgNode[]): SvgNode[] =>
  nodes.flatMap((n) => (n.kind === "fragment" ? flat(n.children) : [n]));

/** A plain group, whose children can be held one by one. */
const isGroup = (node: SvgNode): node is Element =>
  node.kind === "element" && node.tag === "g" && still(node);

/** Whether `h` drew the same all through its run: a leaf, or a group none of whose children came or went. */
const whole = (h: Held): boolean =>
  h.key === h.first && h.kids.every((kid) => kid.from === h.from && kid.to === h.to && whole(kid));

/** A node over a run of transitions: a leaf drawn the same in all of them, or a group whose children are held. */
interface Held {
  node: SvgNode;
  /** What it draws at the end of its run: its key, or a moving node's end. */
  key: number | undefined;
  /** What it draws at the start of its run, for a group that may give way to a moving node. */
  readonly first: number | undefined;
  /** Carries a motion, so it can't take on another unless both chain through `recipe`. */
  moving: boolean;
  recipe: Recipe | undefined;
  group: string | undefined;
  readonly kids: Held[];
  /** What each transition of the run drew here, so a group can be drawn whole per transition instead. */
  readonly versions: SvgNode[];
  readonly from: number;
  to: number;
}

const held = (node: SvgNode, k: number): Held => {
  const group = isGroup(node) ? attrsKey(node) : undefined;
  const settled = ends.get(node);
  const key = settled ? settled.end : keyOf(node);

  const out: Held = {
    node,
    key,
    first: key,
    moving: !!settled,
    recipe: settled?.recipe,
    group,
    kids: [],
    versions: [node],
    from: k,
    to: k,
  };

  if (isGroup(node)) add(out.kids, k, node.children);

  return out;
};

/**
 * Adds transition `k`'s children to `list`, which holds those of the transitions before it. What is drawn the same
 * as in transition `k - 1` is extended, groups with the same attributes hold their children in turn, and the rest is
 * inserted where it draws. Items alive at `k` keep the order transition `k` draws them in; items that ended before
 * never show with them, so where those sit doesn't matter.
 */
const add = (list: Held[], k: number, children: readonly SvgNode[]): void => {
  const news = flat(children);
  const alive = list.filter((h) => h.to === k - 1);
  const keysOf = news.map(keyOf);
  const starts = news.map((n) => ends.get(n)?.start);
  const groups = news.map((n) => (isGroup(n) ? attrsKey(n) : undefined));

  /** Whether `h`, still since its run began, gives way to new child `j`, which moves from what `h` draws. */
  const yields = (h: Held, j: number): boolean =>
    !h.moving && h.key !== undefined && h.key === starts[j] && whole(h);

  /** Whether `h` moved in an earlier transition and new child `j` moves on from where it ended, the same way. */
  const goesOn = (h: Held, j: number): boolean => {
    const next = ends.get(news[j]!)?.recipe;

    if (!h.recipe || !next || h.key === undefined || h.key !== starts[j] || !chains(h.recipe, next))
      return false;

    // Moves that change a color don't chain: a fill keyed across several moves came out wrong between them.
    const fills = [
      h.recipe.from,
      ...h.recipe.steps.map((s) => s.to),
      ...next.steps.map((s) => s.to),
    ];

    return fills.every((v) => v.fill === h.recipe!.from.fill);
  };

  // What pairing an old item with a new child is worth: most for the same drawing, some for the same group.
  const worth = (i: number, j: number): number => {
    const h = alive[i]!;

    if (h.key !== undefined && h.key === keysOf[j]) return 3;

    if (yields(h, j) || goesOn(h, j)) return 3;

    return h.group !== undefined && h.group === groups[j] ? 2 : 0;
  };

  const n = alive.length;
  const m = news.length;
  const best = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));

  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) {
      const w = worth(i, j);

      best[i]![j] = Math.max(
        w > 0 ? best[i + 1]![j + 1]! + w : 0,
        best[i + 1]![j]!,
        best[i]![j + 1]!,
      );
    }

  let i = 0;
  let j = 0;
  // Where the next new child goes: after the last item it drew over, or first.
  let at = 0;

  while (j < m) {
    const w = i < n ? worth(i, j) : 0;

    if (w > 0 && best[i]![j] === best[i + 1]![j + 1]! + w) {
      const h = alive[i++]!;
      const now = news[j]!;
      // Decided before `h` grows, since whether it drew the same all through reads its run.
      const same = h.key !== undefined && h.key === keysOf[j];
      const yielded = !same && yields(h, j);
      const goes = !same && !yielded && goesOn(h, j);

      h.to = k;
      h.versions.push(now);

      if (same) {
        // The same drawing: a moving node holds its end, a group's children all carry on.
        if (h.group !== undefined && isGroup(now)) add(h.kids, k, now.children);
      } else if (yielded) {
        // The moving node starts as `h` drew, so it is drawn alone across both runs.
        h.node = now;
        h.key = ends.get(now)!.end;
        h.moving = true;
        h.recipe = ends.get(now)!.recipe;
        h.group = undefined;
        h.kids.length = 0;
      } else if (goes) {
        // It moves again: one node with both moves' steps.
        const next = ends.get(now)!;

        h.recipe = chain(h.recipe!, next.recipe!);
        h.node = cook(h.recipe);
        h.key = next.end;
      } else {
        // A group with the same attributes: what is in it is held in turn.
        if (isGroup(now)) add(h.kids, k, now.children);

        h.key = keysOf[j];
      }

      j++;
      at = list.indexOf(h) + 1;
    } else if (i < n && best[i + 1]![j]! >= best[i]![j + 1]!) i++;
    else list.splice(at++, 0, held(news[j++]!, k));
  }
};

/**
 * The animations a drawing asks the browser to run on every frame, as `examples/scripts/cost.ts` counts them in the
 * compiled file: each CSS animation of each element, and each SMIL one for the share of the loop it covers.
 */
const costOf = (nodes: readonly SvgNode[], length: number): number => {
  const svg = render(
    { width: 1, height: 1, duration: length, title: "cost" },
    { kind: "fragment", children: nodes },
  );

  const styles = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n");
  const tracks = new Map<string, number>();

  for (const m of styles.matchAll(/\.([\w-]+)\{animation-name:([^;}]*)/g))
    tracks.set(m[1]!, m[2]!.split(",").length);

  let n = 0;

  for (const m of svg.matchAll(/<\w+\s[^>]*\bclass="([^"]*)"/g))
    for (const name of m[1]!.split(/\s+/)) n += tracks.get(name) ?? 0;

  for (const m of svg.matchAll(/<(?:animate|set|animateTransform)\s[^>]*>/g)) {
    const dur = parseFloat(/\sdur="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const loop = parseFloat(/\sdata-loop="([^"]*)"/.exec(m[0])?.[1] ?? "");

    n +=
      /repeatCount="indefinite"/.test(m[0]) || !(dur > 0) || !(loop > 0)
        ? 1
        : Math.min(1, dur / loop);
  }

  return n;
};

/** When a run of transitions shows, from the cut before its first to the cut after its last. */
export type Window = (
  from: number,
  to: number,
) => { readonly at: number; readonly over?: number } | undefined;

/** A node and the transitions it shows in. */
interface Piece {
  readonly node: SvgNode;
  readonly from: number;
  readonly to: number;
}

/**
 * How many animations a drawing asks the browser to run: every motion on every element, cuts included. The browser
 * ticks each one on every frame whether or not it is shown, so this is what holding must not raise.
 */
const running = (nodes: readonly SvgNode[], seen = new Set<object>()): number =>
  nodes.reduce((n, node) => {
    if (node.kind === "fragment" || node.kind === "clip") return n + running(node.children, seen);

    if (node.kind !== "element") return n;

    // A path tweened through SMIL runs about all the time, `<animate>` while it moves and `<set>` holding it after,
    // and one with a fill runs a CSS animation for the color too.
    let own = node.motions.reduce((k, m) => k + (smil.has(m) ? 2 : 1), 0);

    // A clip or mask runs what moves inside it once, however many elements use it.
    for (const value of Object.values(node.attrs)) {
      if (isText(value)) continue;
      const content = contents.get(value);

      if (content && !seen.has(value)) {
        seen.add(value);
        own += running(content, seen);
      }
    }

    return n + own + running(node.children, seen);
  }, 0);

/** The versions of a group per transition, one piece for each run of them that draws the same. */
const versions = (h: Held): Piece[] => {
  const out: Piece[] = [];

  h.versions.forEach((node, i) => {
    const last = out.at(-1);
    const key = keyOf(node);

    if (last && key !== undefined && keyOf(last.node) === key)
      out[out.length - 1] = { ...last, to: h.from + i };
    else out.push({ node, from: h.from + i, to: h.from + i });
  });

  return out;
};

const cut = (window: Window, piece: Piece) => show(window(piece.from, piece.to)!, { fade: 0 });

/**
 * Pieces in drawing order as nodes shown from `from` through `to`: neighbors that show over the same transitions
 * share one cut, and a plain group alone in its window carries the cut itself.
 */
const place = (pieces: readonly Piece[], from: number, to: number, window: Window): SvgNode[] => {
  const out: SvgNode[] = [];

  for (let i = 0; i < pieces.length;) {
    let j = i + 1;

    while (
      j < pieces.length &&
      pieces[j]!.from === pieces[i]!.from &&
      pieces[j]!.to === pieces[i]!.to
    )
      j++;
    const run = pieces.slice(i, j);
    const own = run[0]!;
    const node = own.node;

    if (own.from === from && own.to === to) out.push(...run.map((p) => p.node));
    else if (run.length === 1 && isGroup(node)) out.push({ ...node, motions: [cut(window, own)] });
    else
      out.push({
        kind: "element",
        tag: "g",
        attrs: {},
        children: run.map((p) => p.node),
        motions: [cut(window, own)],
      });

    i = j;
  }

  return out;
};

/** About how many bytes a node writes, to weigh holding a group against drawing it whole. */
const weights = new WeakMap<SvgNode, number>();

const weight = (node: SvgNode): number => {
  let w = weights.get(node);

  if (w !== undefined) return w;

  if (node.kind === "element")
    w =
      node.tag.length * 2 +
      5 +
      Object.entries(node.attrs).reduce(
        (n, [k, v]) => n + k.length + 4 + (isText(v) ? v.length : 12),
        0,
      ) +
      node.motions.length * 80 +
      node.children.reduce((n, c) => n + weight(c), 0);
  else if (node.kind === "text" || node.kind === "raw") w = node.value.length;
  else if (node.kind === "fragment" || node.kind === "clip")
    w = node.children.reduce((n, c) => n + weight(c), 0);
  else w = 0;

  weights.set(node, w);

  return w;
};

/**
 * The pieces of `list`. A group is held, drawn once around its children's pieces, or drawn whole per transition,
 * whichever costs less: bytes, plus `price` for every animation it runs. Holding pays in bytes; the price keeps it
 * from paying for them with work the browser does on every frame.
 */
const pieces = (list: readonly Held[], window: Window, price: number): Piece[] =>
  list.flatMap((h): Piece[] => {
    const g = h.node;

    if (h.group === undefined || !isGroup(g)) return [{ node: g, from: h.from, to: h.to }];

    const kids = place(pieces(h.kids, window, price), h.from, h.to, window);
    const held: Piece = { node: { ...g, children: kids }, from: h.from, to: h.to };

    const whole = versions(h);

    if (whole.length === 1) return [held];

    const cost = (ps: readonly Piece[], cuts: number) =>
      ps.reduce((n, p) => n + weight(p.node), 0) + price * (running(ps.map((p) => p.node)) + cuts);

    return cost(whole, whole.length) < cost([held], 0) ? whole : [held];
  });

const emit = (
  list: readonly Held[],
  from: number,
  to: number,
  window: Window,
  price: number,
): SvgNode[] => place(pieces(list, window, price), from, to, window);

/**
 * One drawing per transition, merged: what is the same in consecutive transitions is drawn once and shown across them,
 * and the rest is cut in and out where its transition starts and ends. `window(from, to)` is when transitions `from`
 * through `to` show.
 */
export const hold = (
  drawings: readonly SvgNode[],
  plain: readonly SvgNode[],
  window: Window,
  length: number,
  ceiling: readonly SvgNode[] = plain,
): SvgNode[] => {
  const list: Held[] = [];

  drawings.forEach((d, k) => add(list, k, [d]));

  const last = drawings.length - 1;

  const one = (nodes: readonly SvgNode[]) =>
    place(
      nodes.map((node, k) => ({ node, from: k, to: k })),
      0,
      last,
      window,
    );

  // Never more animations than the plain drawings run. The count above steers the search; the compiled file, which
  // knows how long each SMIL animation runs, decides.
  const before = one(plain);
  const most = one(ceiling);
  const budget = Math.max(running(before), running(most));
  const real = (nodes: readonly SvgNode[]) => costOf(nodes, length);
  const limit = Math.max(real(before), real(most));
  const at = (price: number) => emit(list, 0, last, window, price);
  let price = 0;
  let best = at(price);

  if (running(best) > budget) {
    let low = 0;
    let high = 1;

    for (best = at(high); running(best) > budget && high < 1e7; best = at(high))
      [low, high] = [high, high * 4];

    for (let i = 0; i < 10 && running(best) <= budget; i++) {
      const mid = (low + high) / 2;
      const tried = at(mid);

      if (running(tried) <= budget) [high, best] = [mid, tried];
      else low = mid;
    }

    price = high;
  }

  for (; real(best) > limit; best = at(price)) {
    if (price > 1e7) return before;

    price = Math.max(1, price * 4);
  }

  return best;
};
