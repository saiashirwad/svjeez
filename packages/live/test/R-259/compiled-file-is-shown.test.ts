import { describe, expect, test } from "bun:test";
import { play, ok, scene } from "../helpers/live-editor";

describe("update", () => {
  test("a compiled file is shown from where the clock is, and a failed one keeps the last picture", () => {
    const shown = play([{ type: "compiled", text: scene, result: ok("<svg/>"), now: 2500 }]);
    expect(shown.cmds).toEqual([
      expect.objectContaining({ type: "show", svg: "<svg/>", at: 2.5, playing: true }),
    ]);

    const [show] = shown.cmds;

    if (show?.type !== "show") throw new Error("a compiled file is shown");
    const picture = { ...show.picture, url: "blob:1" };

    const failed = play(
      [
        { type: "shown", picture, now: 2500 },
        {
          type: "compiled",
          text: scene,
          result: { ok: false, error: { kind: "runtime", message: "boom" }, ms: 1 },
          now: 3000,
        },
      ],
      shown.state,
    ).state;

    expect(failed.picture?.url).toBe("blob:1");
    expect(failed.error?.message).toBe("boom");
  });
});
