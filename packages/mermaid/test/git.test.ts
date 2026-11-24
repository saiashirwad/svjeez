import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawGit, parseGit, type GitDoc } from "../src/git.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): GitDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "g.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseGit(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseGit() did not throw");
};

const FULL = `gitGraph LR:
  commit id: "ZERO"
  branch develop
  branch release order: 3
  commit id: "A" tag: "v0.1" tag: "rc"
  checkout main
  commit id: "ONE" type: HIGHLIGHT
  checkout develop
  commit id: "B" type: REVERSE
  checkout main
  merge develop id: "MERGE" tag: "v1.0"
  commit
  checkout release
  cherry-pick id: "MERGE" parent: "B"
  switch main
  merge release`;

describe("parse git", () => {
  test("reads branches, commits, merges and cherry-picks into a commit list", () => {
    const doc = parse(FULL);

    expect(doc.kind).toBe("git");
    expect(doc.direction).toBe("LR");
    expect(doc.branches).toEqual(["main", "develop", "release"]);
    expect(doc.commits.map((c) => [c.id, c.branch, c.kind, c.parents])).toEqual([
      ["ZERO", "main", "normal", []],
      ["A", "release", "normal", ["ZERO"]],
      ["ONE", "main", "highlight", ["ZERO"]],
      ["B", "develop", "reverse", ["ZERO"]],
      ["MERGE", "main", "merge", ["ONE", "B"]],
      [expect.stringMatching(/^5-[0-9a-f]{7}$/), "main", "normal", ["MERGE"]],
      [expect.stringMatching(/^6-[0-9a-f]{7}$/), "release", "cherry-pick", ["A", "MERGE"]],
      [
        expect.stringMatching(/^7-[0-9a-f]{7}$/),
        "main",
        "merge",
        [expect.any(String), expect.any(String)],
      ],
    ]);
    expect(doc.commits[1]!.tags).toEqual(["v0.1", "rc"]);
    expect(doc.commits[6]!.tags).toEqual(["cherry-pick:MERGE|parent:B"]);
    expect(doc.commits[0]!.named).toBe(true);
    expect(doc.commits[5]!.named).toBe(false);
  });

  test("makes the same ids every time, and a branch off no commits starts a root", () => {
    expect(parse(FULL).commits.map((c) => c.id)).toEqual(parse(FULL).commits.map((c) => c.id));

    const doc = parse("gitGraph\n branch dev\n commit\n checkout main\n commit");

    expect(doc.commits.map((c) => c.parents)).toEqual([[], []]);
    expect(doc.branches).toEqual(["main", "dev"]);
  });

  test("accepts every header spelling, and a quoted branch name with a slash", () => {
    for (const header of ["gitGraph", "gitGraph:", "gitGraph LR", "gitGraph LR:"])
      expect(parse(`${header}\n commit`).direction).toBe("LR");
    expect(parse("gitGraph\n commit\n branch feature/login\n commit").branches).toEqual([
      "main",
      "feature/login",
    ]);
  });

  test("reads TB and BT orientations and a title, keeping commit ids the same", () => {
    const [lr, tb, bt] = ["gitGraph", "gitGraph TB:", "gitGraph BT:"].map((h) =>
      parse(`${h}\ntitle  Release flow\ncommit\nbranch dev\ncommit`),
    );

    expect([tb!.direction, bt!.direction]).toEqual(["TB", "BT"]);
    expect(tb!.title).toBe("Release flow");
    expect(tb!.commits.map((c) => c.id)).toEqual(lr!.commits.map((c) => c.id));
  });

  test("errors name the line and say how to fix it", () => {
    expect(message("gitGraph RL:\ncommit")).toContain("cannot read the gitGraph header");
    expect(message("gitGraph\ncheckout dev")).toContain('there is no branch "dev"');
    expect(message("gitGraph\nbranch main")).toContain("already exists");
    expect(message("gitGraph\ncommit\nbranch a\ncommit\nmerge a")).toContain("itself");
    expect(message("gitGraph\nbranch a\ncheckout main\ncommit\nmerge a")).toContain(
      "no commits to merge",
    );
    expect(message("gitGraph\ncommit\nbranch a\ncheckout main\nmerge a")).toContain(
      "nothing to merge",
    );
    expect(message('gitGraph\ncommit id: "A"\ncommit id: "A"')).toContain("already used");
    expect(message("gitGraph\ncommit type: ODD")).toContain("not known");
    expect(message("gitGraph\ncommit colour: red")).toContain("not an option here");
    expect(message('gitGraph\ncherry-pick id: "Z"')).toContain("no commit");
    expect(message("gitGraph\naccTitle: Hi\ncommit")).toContain("not supported");
    expect(message("gitGraph\ntitle\ncommit")).toContain("needs text");
    expect(message("gitGraph\nrebase main")).toContain("cannot read this line");
  });

  test("cherry-picks need a side for merges, and a commit from another branch", () => {
    const base =
      'gitGraph\ncommit id: "A"\nbranch b\ncommit id: "B"\ncheckout main\ncommit id: "C"\nmerge b id: "M"\nbranch c\ncommit id: "D"\n';

    expect(message(`${base}cherry-pick id: "M"`)).toContain("is a merge");
    expect(message(`${base}cherry-pick id: "M" parent: "A"`)).toContain("not a parent");
    expect(message(`${base}cherry-pick id: "D"`)).toContain("already on");
  });
});

describe("draw git", () => {
  test("draws a doc, keeping ids that have a slash drawable", () => {
    const doc = parse(
      'gitGraph\n commit id: "a/b"\n branch feature/x\n commit\n checkout main\n merge feature/x id: "m"',
    );

    const graph = drawGit(doc, { font: mono, reveal: span(0, 0.2) });

    const out = svg.emit(
      scene({ size: [900, 400], duration: 4, title: "Git", loop: false }, () => graph.node),
    );

    expect(out).toContain(">feature/x<");
    expect(out).toContain(">a/b<");
    expect(graph.when("main")?.start).toBe(0);
    expect(graph.when("a∕b")?.start).toBe(0.2);
    expect(graph.when("feature∕x")).toBeDefined();
  });
});
