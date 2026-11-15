import { describe, expect, test } from "bun:test";
import { given, message, story, timed } from "../src/story.ts";

type Msg = { type: "add"; by: number } | { type: "noop" } | { type: "saved"; n: number };

type Cmd = { type: "save"; n: number };

type Model = { n: number; saved: number };

// A counter that asks to save after each add; the save answers with a message, as a runtime would.
const counter = {
  update: (m: Model, msg: Msg): [Model, Cmd[]] =>
    msg.type === "add"
      ? [{ ...m, n: m.n + msg.by }, [{ type: "save", n: m.n + msg.by }]]
      : msg.type === "saved"
        ? [{ ...m, saved: msg.n }, []]
        : [m, []],
  view: (m: Model) => `<p>${m.n} (saved ${m.saved})</p>`,
  resolve: (cmd: Cmd): Msg[] => [{ type: "saved", n: cmd.n }],
};

describe("story", () => {
  test("the first view mounts, and each changed view is an html() and a snap()", async () => {
    const { html, flow, model } = await story(counter, [
      given({ n: 0, saved: 0 }),
      message<Msg>({ type: "add", by: 2 }),
      timed(message<Msg>({ type: "add", by: 3 }), { over: 1, hold: 0.5 }),
    ]);

    expect(html).toBe("<p>0 (saved 0)</p>");
    expect(flow).toEqual([
      { snap: true },
      { html: "<p>2 (saved 2)</p>" },
      { snap: true },
      { html: "<p>5 (saved 5)</p>" },
      { snap: true, over: 1 },
      { wait: 0.5 },
    ]);
    expect(model).toEqual({ n: 5, saved: 5 });
  });

  test("a message that changes nothing on screen adds nothing, not even its hold", async () => {
    const { flow } = await story(
      counter,
      [given({ n: 0, saved: 0 }), message<Msg>({ type: "noop" }), { wait: 1 }],
      { hold: 0.3 },
    );

    expect(flow).toEqual([{ snap: true }, { wait: 0.3 }, { wait: 1 }]);
  });

  test("a given's commands run before its view is read", async () => {
    const { html } = await story(counter, [given({ n: 1, saved: 0 }, [{ type: "save", n: 1 }])]);

    expect(html).toBe("<p>1 (saved 1)</p>");
  });

  test("a message needs a model to start from", async () => {
    await expect(story(counter, [message<Msg>({ type: "noop" })])).rejects.toThrow(
      "story(): a message comes before any given(model).",
    );
  });
});
