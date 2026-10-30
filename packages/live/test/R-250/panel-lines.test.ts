import { describe, expect, test } from "bun:test";
import { linesOf, parse } from "../../src/source";
import { meadow } from "../helpers/live-source";

describe("panel lines", () => {
  test("lines put the text back together, with live literals as pieces of their own", () => {
    const source = parse(meadow);
    const lines = linesOf(source, (l) => l.kind !== "string" && !l.param?.option);

    expect(lines.map((l) => l.pieces.map((p) => p.text).join("")).join("\n")).toBe(meadow);

    const flowers = lines.find((l) =>
      l.pieces
        .map((p) => p.text)
        .join("")
        .includes("flowers: count"),
    )!;

    expect(flowers.pieces.filter((p) => p.kind === "literal").map((p) => p.text)).toEqual(["5"]);
    expect(flowers.pieces.find((p) => p.text === "count")?.kind).toBe("fn");
    expect(lines[0]!.pieces[0]).toMatchObject({ kind: "keyword", text: "import" });
  });
});
