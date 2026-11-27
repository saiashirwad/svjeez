import { describe, expect, test } from "bun:test";
import { groupLanes, nameOf } from "../src/client/lanes.ts";
import type { LaneView } from "../src/workspace.ts";

const lane = (key: string, line?: number, prop = "opacity"): LaneView => ({
  key,
  lane: prop,
  backend: "css",
  ...(line !== undefined && { line }),
  spans: [{ start: 0, over: 1 }],
});

const source = [
  "const Chain = ({ from }: { from: number }) => (",
  "  <Group rotate={steps.map((s) => s * 2)}>",
  "    <Chain from={from + 1} />",
  "  </Group>",
  ");",
  "{RAYS.map((ray, i) => (",
  "  <Shape key={String(i)} />",
  "))}",
  "export default scene(",
  "{[0, 1, 2].map((i) => (",
  "  <Shape key={String(i)} />",
  "))}",
].join("\n");

const lines = source.split("\n");

describe("lane names", () => {
  test("a lane with an id is called by it, without the compiler's numbering", () => {
    expect(nameOf(lane("#2/take_while1#0"), lines)).toBe("take_while1");
    expect(nameOf(lane("#2/north/bar"), lines)).toBe("north › bar");
    expect(nameOf(lane("#2/quarter/0"), lines)).toBe("quarter 0");
  });

  test("a lane without one is called by the line that wrote it", () => {
    expect(nameOf(lane("#1/#0", 3), lines)).toBe("Chain");
    expect(nameOf(lane("#1/#0", 2), lines)).toBe("Chain › Group");
    expect(nameOf(lane("#1", 6), lines)).toBe("ray");
    expect(nameOf(lane("#1", 9), lines)).toBe("scene");
  });

  test("a key that is only a number takes the tag it was written with", () => {
    expect(nameOf(lane("#2/0", 6), lines)).toBe("ray 0");
    expect(nameOf(lane("#2/1", 7), lines)).toBe("Shape 1");
    expect(nameOf(lane("#2/1", 10), lines)).toBe("Shape 1");
  });

  test("repeats group under the name they share", () => {
    const groups = groupLanes(
      [lane("#2/ray-0"), lane("#2/ray-1", undefined, "scale"), lane("#2/sun")],
      source,
    );

    expect(groups.map((group) => [group.name, group.rows.length, group.props])).toEqual([
      ["ray", 2, ["opacity", "scale"]],
      ["sun", 1, ["opacity"]],
    ]);
  });
});
