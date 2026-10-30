import { describe, expect, test } from "bun:test";
import { flow, streamlines } from "svjeez/extras";
import { bounds } from "../helpers/field";

describe("fieldFlow", () => {
  const { lines } = streamlines(() => [1, 0], { bounds, spacing: 50 });

  test("flow rejects a loop shorter than the trip", () => {
    expect(() => flow(lines[0]!, { at: 0, over: 3, style: "comet", loop: 2 })).toThrow(
      "flow() needs a loop period past",
    );
    expect(() => flow(lines[0]!, { at: 0, style: "trace", loop: 4 })).toThrow(
      "flow() loops a dot, comet or packet.",
    );
  });
});
