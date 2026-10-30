import { describe, expect, test } from "bun:test";
import { choice } from "svjeez/params";
import { valueOf } from "../../src/editor";
import { ok, play, scene } from "../helpers/live-editor";

describe("update", () => {
  test("a choice param becomes a control once a compile of the file declares it", () => {
    const before = play([]).state;

    const after = play([
      {
        type: "compiled",
        text: scene,
        result: ok("<svg/>", { params: { look: choice("circle", ["circle", "square"]) } }),
        now: 0,
      },
    ]).state;

    expect(valueOf(before, "params.look")).toBeUndefined();
    expect(valueOf(after, "params.look")).toMatchObject({
      kind: "choice",
      options: ["circle", "square"],
    });
  });
});
