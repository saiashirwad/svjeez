import { describe, expect, test } from "bun:test";
import { font, scene } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawKanban, parseKanban, type KanbanDoc } from "../src/kanban.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((raw, i) => ({
      file: "board.mmd",
      line: i + 1,
      text: raw.trim(),
      indent: raw.length - raw.trimStart().length,
    }))
    .filter((l) => l.text !== "" && !l.text.startsWith("%%"));

const parse = (text: string): KanbanDoc => {
  const [first, ...body] = lines(`kanban\n${text}`);

  return parseKanban(first!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;

    throw e;
  }

  throw new Error("parseKanban() did not throw");
};

describe("parse kanban", () => {
  test("reads columns and the cards indented under them", () => {
    const doc = parse(`
  todo[Todo]
    a[Write docs]
    b[Fix bug]
  done[Done]
    c[Ship it]`);

    expect(doc.columns.map((c) => [c.id, c.label, c.cards.map((k) => k.id)])).toEqual([
      ["todo", "Todo", ["a", "b"]],
      ["done", "Done", ["c"]],
    ]);
  });

  test("reads plain text and bare brackets, keeping repeated text apart", () => {
    const doc = parse(`
  Backlog
    [Plain card]
    Another card
  Next
    [Plain card]`);

    expect(doc.columns.map((c) => c.id)).toEqual(["Backlog", "Next"]);
    expect(doc.columns[0]!.cards.map((k) => [k.id, k.label])).toEqual([
      ["Plain card", "Plain card"],
      ["Another card", "Another card"],
    ]);
    expect(doc.columns[1]!.cards[0]!.id).toBe("Plain card#2");
  });

  test("reads card metadata with quoted values, commas and any case", () => {
    const doc = parse(`
  col[Col]
    a[Card]@{ ticket: MC-2037, assigned: 'K. Sveidqvist', priority: 'Very High' }
    b[Other] @{priority: low}
    c[Quoted]@{ assigned: "Lee, Sam" }`);

    const [a, b, c] = doc.columns[0]!.cards;

    expect(a).toMatchObject({
      ticket: "MC-2037",
      assigned: "K. Sveidqvist",
      priority: "very high",
    });
    expect(b).toMatchObject({ priority: "low" });
    expect(c).toMatchObject({ assigned: "Lee, Sam" });
  });

  test("takes the first indentation as the column level, whatever its width", () => {
    const doc = parse("      col\n          card\n      col2");

    expect(doc.columns.map((c) => [c.id, c.cards.length])).toEqual([
      ["col", 1],
      ["col2", 0],
    ]);
  });
});

describe("parse kanban errors", () => {
  test("rejects what svjeez does not draw, with the reason", () => {
    expect(message("col\n  a[Card]@{ icon: fa }")).toContain("icon is not supported");
    expect(message("col\n  a[Card]@{ shape: rounded }")).toContain("shape is not supported");
    expect(message("col\n  a[Card]:::urgent")).toContain(":::name");
    expect(message("col\n  a[Card]\n  ::icon(fa fa-book)")).toContain("icons are not supported");
  });

  test("rejects bad metadata, duplicate ids and misplaced lines", () => {
    expect(message("col\n  a[Card]@{ colour: red }")).toContain("unknown metadata colour");
    expect(message("col\n  a[Card]@{ priority: urgent }")).toContain("is not one of Very High");
    expect(message("col\n  a[Card]@{ nonsense }")).toContain("cannot read the metadata");
    expect(message("col\n  a[Card]@{ ticket: 'x }")).toContain("quote is never closed");
    expect(message("a[One]\n  x[Card]\nb[Two]\n  x[Again]")).toContain("already used");
    expect(message("    col\n  low")).toContain("indented less than the first column");
    expect(message("col@{ ticket: x }")).toContain("a column has no metadata");
    expect(message("[]")).toContain("needs some text");
  });

  test("reports an empty board and a bad header with file and line", () => {
    expect(() => parseKanban({ file: "b.mmd", line: 1, text: "kanban" }, [])).toThrow("no columns");
    expect(() => parseKanban({ file: "b.mmd", line: 1, text: "kanban x" }, [])).toThrow(
      /^b\.mmd:1:/,
    );
  });
});

describe("drawKanban", () => {
  test("draws columns, cards and their details as parts", () => {
    const doc = parse(`
  todo[Todo]
    a[Write docs]@{ ticket: DOC-1, assigned: mia, priority: High }`);

    const diagram = drawKanban(doc, { font: mono });

    const markup = svg.emit(
      scene({ size: [600, 400], duration: 1, title: "Board", loop: false }, () => diagram.node),
    );

    expect(() => diagram.part("todo")).not.toThrow();
    expect(() => diagram.part("a")).not.toThrow();

    for (const text of ["Todo", "Write docs", "DOC-1", "mia"]) expect(markup).toContain(text);
  });
});
