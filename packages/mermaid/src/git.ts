import { gitGraph, type DiagramOptions, type GitGraph } from "@svjeez/diagrams";
import type { Span } from "svjeez";
import { clean, fail, sourceOf, type Line } from "./errors.ts";
import type { Place } from "./types.ts";

export type GitCommitKind = "normal" | "reverse" | "highlight" | "merge" | "cherry-pick";

export interface GitCommitDoc {
  /** Written in the source, or made as `<n>-<7 hex digits>`, the same for the same text. */
  readonly id: string;
  /** True when the id came from the source rather than being made. */
  readonly named: boolean;
  readonly branch: string;
  readonly kind: GitCommitKind;
  readonly tags: readonly string[];
  /** Commit ids: the previous commit on the branch, then the merged or cherry-picked one. */
  readonly parents: readonly string[];
  readonly source: Place;
}

export interface GitDoc {
  readonly kind: "git";
  readonly source: Place;
  readonly direction: "LR";
  /** Branch names in lane order, top to bottom. */
  readonly branches: readonly string[];
  /** Oldest first. */
  readonly commits: readonly GitCommitDoc[];
}

const SUPPORTED =
  'Supported: `commit` with `id: "x"`, `tag: "v1"` and `type: NORMAL|REVERSE|HIGHLIGHT`, `branch name` (with `order: n`), `checkout name` or `switch name`, `merge name` (with `id`, `tag`, `type`) and `cherry-pick id: "x"` (with `parent: "p"`, `tag`).';

const HEADER = /^gitGraph(?:\s+(LR|TB|BT))?\s*:?$/;
const UNSUPPORTED = /^(title|accTitle|accDescr)\b/;
const OPTION = /([A-Za-z][\w-]*)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;

const TYPES = new Map<string, GitCommitKind>([
  ["NORMAL", "normal"],
  ["REVERSE", "reverse"],
  ["HIGHLIGHT", "highlight"],
]);

type Options = Map<string, string[]>;

const hash = (text: string): string => {
  let h = 0x811c9dc5;

  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193) >>> 0;

  return h.toString(16).padStart(8, "0").slice(0, 7);
};

const options = (l: Line, rest: string, allowed: readonly string[]): Options => {
  const found: Options = new Map();

  const left = rest.replace(OPTION, (_, key: string, a?: string, b?: string, c?: string) => {
    if (!allowed.includes(key))
      return fail(
        l,
        `${JSON.stringify(key)} is not an option here. This line takes ${allowed.map((k) => `\`${k}:\``).join(", ")}.`,
      );
    found.set(key, [...(found.get(key) ?? []), a ?? b ?? c ?? ""]);

    return "";
  });

  if (left.trim() !== "")
    return fail(l, `cannot read ${JSON.stringify(left.trim())}. ${SUPPORTED}`);

  return found;
};

const single = (l: Line, found: Options, key: string): string | undefined => {
  const values = found.get(key);

  if (values && values.length > 1) return fail(l, `\`${key}:\` is given twice. Write it once.`);

  return values?.[0];
};

const kindOf = (l: Line, found: Options): GitCommitKind | undefined => {
  const given = single(l, found, "type");

  if (given === undefined) return undefined;

  return (
    TYPES.get(given.toUpperCase()) ??
    fail(l, `the type ${JSON.stringify(given)} is not known. Use NORMAL, REVERSE or HIGHLIGHT.`)
  );
};

const NAME = /^("[^"]+"|'[^']+'|[^\s":]+)\s*(.*)$/;

const nameOf = (l: Line, rest: string, what: string): [string, string] => {
  const m = NAME.exec(rest.trim());

  if (!m) return fail(l, `${what} needs a branch name. ${SUPPORTED}`);

  return [m[1]!.replace(/^["']|["']$/g, ""), m[2]!];
};

export const parseGit = (header: Line, body: readonly Line[]): GitDoc => {
  const head = HEADER.exec(header.text);

  if (!head)
    return fail(header, `cannot read the gitGraph header. Write \`gitGraph\` or \`gitGraph LR:\`.`);

  if (head[1] === "TB" || head[1] === "BT")
    return fail(
      header,
      "svjeez draws a gitGraph left to right. Write `gitGraph` or `gitGraph LR:`.",
    );
  const order = new Map<string, number>([["main", 0]]);
  const heads = new Map<string, string | undefined>([["main", undefined]]);
  const made: GitCommitDoc[] = [];
  const names = new Set<string>();
  let current = "main";

  const add = (
    l: Line,
    kind: GitCommitKind,
    given: string | undefined,
    tags: readonly string[],
    parents: readonly string[],
  ) => {
    const seq = made.length;

    const id =
      given ?? `${seq}-${hash(`${seq} ${current} ${parents.join(" ")} ${kind} ${tags.join(" ")}`)}`;

    if (names.has(id) || heads.has(id))
      return fail(
        l,
        `the id ${JSON.stringify(id)} is already used. Give each commit and branch its own name.`,
      );
    names.add(id);
    made.push({
      id,
      named: given !== undefined,
      branch: current,
      kind,
      tags,
      parents,
      source: sourceOf(l),
    });
    heads.set(current, id);
  };

  const branchNamed = (l: Line, name: string): string => {
    if (!heads.has(name))
      return fail(
        l,
        `there is no branch ${JSON.stringify(name)}. Branches so far: ${[...heads.keys()].join(", ")}. Make it first with \`branch ${name}\`.`,
      );

    return name;
  };

  for (const l of body) {
    const word = /^[A-Za-z][\w-]*/.exec(l.text)?.[0];
    const rest = l.text.slice(word?.length ?? 0);

    if (word && UNSUPPORTED.test(word))
      return fail(l, `${word} is not supported in a gitGraph. ${SUPPORTED}`);

    if (word === "commit") {
      const bare = /^\s*"([^"]*)"/.exec(rest);

      const found = options(l, bare ? rest.slice(bare[0].length) : rest, [
        "id",
        "tag",
        "type",
        "msg",
      ]);

      const id = single(l, found, "id");
      add(
        l,
        kindOf(l, found) ?? "normal",
        id,
        found.get("tag") ?? [],
        heads.get(current) ? [heads.get(current)!] : [],
      );
    } else if (word === "branch") {
      const [name, tail] = nameOf(l, rest, "branch");
      const found = options(l, tail, ["order"]);

      if (heads.has(name))
        return fail(
          l,
          `the branch ${JSON.stringify(name)} already exists. Use \`checkout ${name}\` to return to it.`,
        );
      const n = single(l, found, "order");

      if (n !== undefined && !/^-?\d+$/.test(n))
        return fail(l, `order must be a whole number, got ${JSON.stringify(n)}.`);
      heads.set(name, heads.get(current));
      order.set(name, n === undefined ? order.size : Number(n));
      current = name;
    } else if (word === "checkout" || word === "switch") {
      const [name, tail] = nameOf(l, rest, word);

      if (tail.trim() !== "") return fail(l, `${word} takes only a branch name.`);
      current = branchNamed(l, name);
    } else if (word === "merge") {
      const [name, tail] = nameOf(l, rest, "merge");
      const found = options(l, tail, ["id", "tag", "type"]);
      const other = branchNamed(l, name);
      const [mine, theirs] = [heads.get(current), heads.get(other)];

      if (other === current)
        return fail(
          l,
          `cannot merge ${JSON.stringify(name)} into itself. Check out another branch first.`,
        );

      if (!mine)
        return fail(
          l,
          `the current branch ${JSON.stringify(current)} has no commits to merge into. Commit first.`,
        );

      if (!theirs)
        return fail(
          l,
          `the branch ${JSON.stringify(name)} has no commits to merge. Commit on it first.`,
        );

      if (mine === theirs)
        return fail(
          l,
          `the branches ${JSON.stringify(current)} and ${JSON.stringify(name)} are at the same commit, so there is nothing to merge.`,
        );
      add(l, kindOf(l, found) ?? "merge", single(l, found, "id"), found.get("tag") ?? [], [
        mine,
        theirs,
      ]);
    } else if (word === "cherry-pick") {
      const found = options(l, rest, ["id", "parent", "tag"]);
      const id = single(l, found, "id");
      const via = single(l, found, "parent");

      if (id === undefined)
        return fail(l, 'cherry-pick needs the commit to copy, as in `cherry-pick id: "A"`.');
      const source = made.find((c) => c.id === id);

      if (!source)
        return fail(
          l,
          `there is no commit ${JSON.stringify(id)} to cherry-pick. Commits so far: ${made.map((c) => c.id).join(", ") || "none"}.`,
        );

      if (source.branch === current)
        return fail(
          l,
          `the commit ${JSON.stringify(id)} is already on ${JSON.stringify(current)}. Check out another branch to cherry-pick it there.`,
        );

      if (!heads.get(current))
        return fail(
          l,
          `the branch ${JSON.stringify(current)} has no commits yet, so it cannot take a cherry-pick. Commit first.`,
        );

      if (source.parents.length > 1 && via === undefined)
        return fail(
          l,
          `${JSON.stringify(id)} is a merge, so say which side to copy: \`parent: "${source.parents[0]}"\`.`,
        );

      if (via !== undefined && !source.parents.includes(via))
        return fail(
          l,
          `${JSON.stringify(via)} is not a parent of ${JSON.stringify(id)}. Its parents are ${source.parents.map((p) => JSON.stringify(p)).join(", ") || "none"}.`,
        );

      const tags = found.get("tag") ?? [
        `cherry-pick:${id}${via === undefined ? "" : `|parent:${via}`}`,
      ];

      add(l, "cherry-pick", undefined, tags, [heads.get(current)!, id]);
    } else {
      return fail(l, `cannot read this line (${clean(word ?? l.text)}). ${SUPPORTED}`);
    }
  }

  const branches = [...heads.keys()]
    .map((name, i) => ({ name, i }))
    .sort((a, b) => order.get(a.name)! - order.get(b.name)! || a.i - b.i)
    .map((b) => b.name);

  return { kind: "git", source: sourceOf(header), direction: "LR", branches, commits: made };
};

const safe = (name: string): string => name.replaceAll("/", "\u2215");

const laneKey = (name: string, i: number): string =>
  /^\d+$/.test(name) ? `branch-${i + 1}` : safe(name);

export const drawGit = (
  doc: GitDoc,
  options: DiagramOptions & { readonly reveal?: Span },
): GitGraph => {
  const keys = new Map(doc.branches.map((b, i) => [b, laneKey(b, i)]));

  return gitGraph(
    {
      branches: Object.fromEntries(doc.branches.map((b) => [keys.get(b)!, b])),
      commits: doc.commits.map((c) => ({
        id: safe(c.id),
        branch: keys.get(c.branch)!,
        kind: c.kind,
        parents: c.parents.map(safe),
        tags: c.tags,
        label: c.kind === "cherry-pick" || (c.kind === "merge" && !c.named) ? undefined : c.id,
      })),
    },
    options,
  );
};
