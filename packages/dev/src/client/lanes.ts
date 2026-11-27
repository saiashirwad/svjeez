import type { LaneView } from "../workspace.ts";

/*
 * Names for lanes a person can read. A lane's key is the path the compiler gave its node, "#2/ray-0" or "#1/#3";
 * the name is the node's own id when it has one, otherwise what the line that wrote it says: the binding a map
 * gives it, the variable it is, the tag, and the component it sits in.
 */

export interface Row {
  readonly lane: LaneView;
  /** "ray-0", "north › bar", "Chain". */
  readonly name: string;
}

/** Lanes under one name stripped of its number: the rays of a map, the links of a chain. */
export interface LaneGroup {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly Row[];
  /** The properties its lanes move, in order of first use: "opacity", "translate". */
  readonly props: readonly string[];
  readonly line?: number;
}

const BINDING = /\.map\(\s*\(?\s*[{[]?\s*([A-Za-z_$][\w$]*)/;
const DECLARED = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/;
const TAG = /<([A-Za-z][\w.]*)/;

const OWNER =
  /^\s*(?:export\s+)?(?:const\s+([A-Z][a-z]\w*)\s*=\s*(?:\(|async\b|[\w$]+\s*=>)|function\s+([A-Z]\w*))/;

/** The names in a key, each without the "#n" the compiler numbers repeats with. */
const namesIn = (key: string): string[] =>
  key
    .split("/")
    .map((part) => part.replace(/#\d+$/, ""))
    .filter((part) => part !== "" && !part.startsWith("#"));

/** The component a line sits in: the nearest capitalised const or function above it, unless a top-level block closes first. */
const ownerOf = (lines: readonly string[], index: number): string | undefined => {
  for (let i = index; i >= Math.max(0, index - 60); i--) {
    const match = OWNER.exec(lines[i] ?? "");
    const found = match?.[1] ?? match?.[2];

    if (found) return found;

    if (/^[)}\]]/.test(lines[i] ?? "")) return undefined;
  }

  return undefined;
};

const fromLine = (lines: readonly string[], line: number | undefined): string | undefined => {
  if (line === undefined) return undefined;
  const here = lines[line - 1] ?? "";
  const tagged = TAG.exec(here);
  const binding = BINDING.exec(here);

  // A map that opens the line names what it draws; one inside a tag's props, `rotate={steps.map((s) => …)}`, or
  // one whose name is a single letter, does not.
  if (binding?.[1] && binding[1].length > 1 && (!tagged || binding.index < tagged.index))
    return binding[1];

  const declared = DECLARED.exec(here)?.[1];

  if (declared && !tagged) return declared;

  if (!tagged && /\bscene\(/.test(here)) return "scene";

  // A lane is often reported on the line that opens its JSX expression, `{items.map((i) => (`, above its tag.
  const tag =
    tagged?.[1] ?? TAG.exec(lines[line] ?? "")?.[1] ?? TAG.exec(lines[line + 1] ?? "")?.[1];

  const owner = ownerOf(lines, line - 2);

  if (tag) return owner && owner !== tag ? owner + " › " + tag : tag;

  return owner;
};

/** The name a person would call a lane by. */
export const nameOf = (lane: LaneView, lines: readonly string[]): string => {
  const names = namesIn(lane.key);

  const written = () =>
    fromLine(lines, lane.line) ?? (lane.line === undefined ? "lane" : "line " + lane.line);

  const [head, last] = names.slice(-2);

  if (head === undefined) return written();

  if (last === undefined) return /^\d+$/.test(head) ? written() + " " + head : head;

  return /^\d+$/.test(last) ? head + " " + last : head + " › " + last;
};

/** A name without the number that tells its repeats apart: "ray-3" and "ray 3" are both "ray". */
const baseOf = (name: string): string =>
  name
    .split(" › ")
    .map((part) => part.replace(/[\s_-]*\d+$/, "") || part)
    .join(" › ");

/** The lanes in groups, each in the order its first lane comes. */
export const groupLanes = (lanes: readonly LaneView[], source: string): LaneGroup[] => {
  const lines = source.split("\n");

  const groups = new Map<
    string,
    { name: string; rows: Row[]; props: Set<string>; line?: number }
  >();

  for (const lane of lanes) {
    const name = nameOf(lane, lines);
    const base = baseOf(name);
    const id = base;

    const group = groups.get(id) ?? {
      name: base,
      rows: [],
      props: new Set<string>(),
      ...(lane.line !== undefined && { line: lane.line }),
    };

    group.rows.push({ lane, name });
    group.props.add(lane.lane);
    groups.set(id, group);
  }

  return [...groups].map(([id, group]) => ({
    id,
    name: group.name,
    rows: group.rows,
    props: [...group.props],
    ...(group.line !== undefined && { line: group.line }),
  }));
};
