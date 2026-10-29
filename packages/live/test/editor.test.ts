import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { choice } from "svjeez/params";
import { nudge } from "../src/controls";
import type { Compiled } from "../src/compile";
import {
  createEditor,
  init,
  timeAt,
  update,
  valueOf,
  type Cmd,
  type Msg,
  type State,
} from "../src/editor";

const scene = `export const params = { look: choice("circle", ["circle", "square"]) };
export default () => (
  <circle cx={40} r={8} fill="#3EE6D6" animation={enter({ at: 1.2, over: 0.5 }, {}, ease.pop)} />
);
`;

const SIZE = { width: 200, height: 120, duration: 4, title: "t" };

const ok = (svg: string, extra: Partial<Extract<Compiled, { ok: true }>> = {}): Compiled => ({
  ok: true,
  svg,
  scene: SIZE,
  stats: { bytes: 0, gzip: 0, keyframes: 0, scriptBytes: 0 },
  ms: 1,
  ...extra,
});

/** Runs messages through `update` from a fresh state, returning the last state and every command asked for. */
const play = (msgs: readonly Msg[], from = init({ text: scene, now: 0 })[0]) => {
  const cmds: Cmd[] = [];
  let state: State = from;

  for (const msg of msgs) {
    const [next, asked] = update(state, msg);
    state = next;
    cmds.push(...asked);
  }

  return { state, cmds };
};

const cx = (state: State) => valueOf(state, "default#0")!.literal.value;

describe("update", () => {
  test("setting a value rewrites only its literal and asks for a compile of the new file", () => {
    const { state, cmds } = play([{ type: "set", key: "default#0", value: 64.5 }]);

    expect(state.text).toBe(scene.replace("cx={40}", "cx={64.5}"));
    expect(cmds).toEqual([{ type: "compile", text: state.text }]);
  });

  test("a color, an ease and a number each go back as code", () => {
    const { state } = play([
      { type: "set", key: "default#2", value: "#FF0000" },
      { type: "set", key: "default#5", value: ease.bezier(0.1, 0.2, 0.3, 1.4) },
    ]);

    expect(state.text).toContain('fill="#FF0000"');
    expect(state.text).toContain("ease.bezier(0.1, 0.2, 0.3, 1.4)");
  });

  test("arrow keys keep a number's decimals, through a whole number and back", () => {
    let [state] = init({ text: `const k = 0.5;\nexport default () => k;\n`, now: 0 });

    const step = (by: 1 | -1) => {
      const v = valueOf(state, "k");

      if (v?.kind !== "number") throw new Error("k is a number");
      [state] = update(state, {
        type: "set",
        key: "k",
        value: nudge(v.param, v.literal.value, by),
      });
    };

    for (let i = 0; i < 5; i++) step(1);
    expect(state.text).toContain("const k = 1.0;");

    for (let i = 0; i < 2; i++) step(1);

    for (let i = 0; i < 3; i++) step(-1);
    expect(state.text).toContain("const k = 0.9;");
  });

  test("a drag is one undo step, and redo puts it back", () => {
    const drag = play([
      { type: "set", key: "default#0", value: 41 },
      { type: "set", key: "default#0", value: 42, continues: true },
      { type: "set", key: "default#0", value: 43, continues: true },
    ]).state;

    const undone = play([{ type: "undo" }], drag).state;
    expect(cx(undone)).toBe(40);
    expect(cx(play([{ type: "redo" }], undone).state)).toBe(43);
  });

  test("a rewrite keeps the selected value when its key survives, and drops it when it does not", () => {
    const selected = play([{ type: "select", key: "default#1", now: 0 }]).state;
    const kept = play([{ type: "replace", text: `const pad = 2;\n${scene}` }], selected).state;
    const gone = play([{ type: "replace", text: "export default () => <g />;" }], selected).state;

    expect(kept.selected).toBe("default#1");
    expect(gone.selected).toBeNull();
  });

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

  test("pausing holds the time, seeking moves it, and playing goes on from there", () => {
    const paused = play([{ type: "pause", now: 1500 }]).state;
    expect(timeAt(paused.clock, 9000)).toBe(1.5);

    const sought = play([{ type: "seek", at: 3, now: 9000 }], paused).state;
    expect(timeAt(sought.clock, 9999)).toBe(3);

    const playing = play([{ type: "play", now: 10_000 }], sought).state;
    expect(timeAt(playing.clock, 11_000)).toBe(4);
  });
});

/** Effects that compile and show on demand, so a test decides when each finishes. */
const manual = () => {
  const compiles: { text: string; finish: (result: Compiled) => void }[] = [];
  const released: string[] = [];
  let n = 0;

  return {
    compiles,
    released,
    effects: {
      compile: (text: string) => new Promise<Compiled>((finish) => compiles.push({ text, finish })),
      show: async () => `blob:${++n}`,
      release: (url: string) => released.push(url),
      now: () => 0,
    },
  };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createEditor", () => {
  test("nothing compiles until something subscribes", async () => {
    const { compiles, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    await settle();
    expect(compiles).toHaveLength(0);

    editor.subscribe(() => {});
    await settle();
    expect(compiles.map((c) => c.text)).toEqual([scene]);
  });

  test("while a compile runs, only the newest edit waits to compile next", async () => {
    const { compiles, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    editor.subscribe(() => {});

    for (const v of [41, 42, 43, 44])
      editor.send({ type: "set", key: "default#0", value: v, continues: true });
    compiles[0]!.finish(ok("<svg/>"));
    await settle();

    expect(compiles.map((c) => /cx=\{(\d+)\}/.exec(c.text)![1])).toEqual(["40", "44"]);
  });

  test("each new picture frees the one before it, and destroy frees the last", async () => {
    const { compiles, released, effects } = manual();
    const editor = createEditor({ text: scene }, effects);
    editor.subscribe(() => {});
    compiles[0]!.finish(ok("<svg/>"));
    await settle();
    editor.send({ type: "set", key: "default#0", value: 50 });
    await settle();
    compiles[1]!.finish(ok("<svg id='2'/>"));
    await settle();

    expect(editor.getState().picture?.url).toBe("blob:2");
    expect(released).toEqual(["blob:1"]);
    editor.destroy();
    expect(released).toEqual(["blob:1", "blob:2"]);
  });
});

describe("grips", () => {
  const compiled = (text: string, extra: Partial<Extract<Compiled, { ok: true }>> = {}) => {
    const after = play(
      [{ type: "compiled", text, result: ok("<svg id='a'/>", extra), now: 0 }],
      init({ text, now: 0 })[0],
    );

    const [show] = after.cmds;

    if (show?.type !== "show") throw new Error("a compiled file is shown");

    return play(
      [{ type: "shown", picture: { ...show.picture, url: "blob:a" }, now: 0 }],
      after.state,
    );
  };

  test("selecting a number asks to measure what it moves, with the file nudged a little past it", () => {
    const { state } = compiled(scene);
    const { cmds } = play([{ type: "select", key: "default#0", now: 0 }], state);

    expect(cmds).toEqual([
      expect.objectContaining({ type: "probe", key: "default#0", svg: "<svg id='a'/>", from: 40 }),
    ]);
    const [probe] = cmds;

    if (probe?.type !== "probe") throw new Error("a probe was asked for");
    expect(probe.nudged).toContain(`cx={${40 + probe.by}}`);
  });

  test("a measured grip sits where it was measured and moves with its value", () => {
    const selected = play(
      [{ type: "select", key: "default#0", now: 0 }],
      compiled(scene).state,
    ).state;

    const grip = { at: { x: 40, y: 60 }, way: { x: 1, y: 0 }, from: 40, declared: false };
    const { state } = play([{ type: "probed", key: "default#0", text: scene, grip }], selected);

    expect(state.grips["default#0"]).toEqual(grip);
    expect(play([{ type: "select", key: "default#0", now: 0 }], state).state.grips).toEqual(
      state.grips,
    );
    expect(play([{ type: "select", key: "default#1", now: 0 }], state).state.grips).toEqual({});
  });

  test("a measurement of an older file is kept only when the measured number is all that changed since", () => {
    const selected = play(
      [{ type: "select", key: "default#0", now: 0 }],
      compiled(scene).state,
    ).state;

    const grip = { at: { x: 40, y: 60 }, way: { x: 1, y: 0 }, from: 40, declared: false };
    const probed: Msg = { type: "probed", key: "default#0", text: scene, grip };

    const dragged = play([{ type: "set", key: "default#0", value: 55 }, probed], selected).state;
    expect(dragged.grips["default#0"]).toEqual(grip);

    const elsewhere = play([{ type: "set", key: "default#1", value: 12 }, probed], selected).state;
    expect(elsewhere.grips["default#0"]).toBeUndefined();
  });

  test("a scene's declared handles are grips, keyed by their params, and are never probed", () => {
    const pendulum = `export const params = { swing: number(30, { min: 10, max: 50 }) };\nexport default () => null;\n`;

    const { state } = compiled(pendulum, {
      handles: { swing: { at: { x: 1, y: 2 }, way: { x: 3, y: 4 } } },
    });

    expect(state.grips).toEqual({
      "params.swing": { at: { x: 1, y: 2 }, way: { x: 3, y: 4 }, from: 30, declared: true },
    });
    expect(play([{ type: "select", key: "params.swing", now: 0 }], state).cmds).toEqual([]);
  });
});

describe("createEditor when things go wrong", () => {
  test("a compile that throws shows as the file's error, and the next edit still compiles", async () => {
    const texts: string[] = [];

    const editor = createEditor(
      { text: scene },
      {
        compile: async (text) => {
          texts.push(text);

          if (texts.length === 1) throw new Error("network down");

          return ok("<svg/>");
        },
        show: async () => "blob:1",
        release: () => {},
        now: () => 0,
      },
    );

    editor.subscribe(() => {});
    await settle();
    expect(editor.getState().error?.message).toContain("network down");

    editor.send({ type: "set", key: "default#0", value: 50 });
    await settle();
    expect(texts).toHaveLength(2);
    expect(editor.getState().error).toBeNull();
    editor.destroy();
  });

  test("pausing while a new picture is still being drawn keeps the new picture", async () => {
    let n = 0;
    let draw: (() => void) | undefined;

    const editor = createEditor(
      { text: "export default () => 1;" },
      {
        compile: async (text) => ok(`<svg>${text}</svg>`),
        show: (svg) =>
          new Promise((resolve) => {
            const url = `blob:${++n}:${svg}`;

            if (n === 2) draw = () => resolve(url);
            else resolve(url);
          }),
        release: () => {},
        now: () => 0,
      },
    );

    editor.subscribe(() => {});
    await settle();
    editor.send({ type: "replace", text: "export default () => 2;" });
    await settle();
    editor.send({ type: "pause" });
    await settle();
    draw?.();
    await settle();
    await settle();

    expect(editor.getState().picture?.text).toBe("export default () => 2;");
    expect(editor.getState().picture?.svg).toContain("() => 2");
    editor.destroy();
  });
});
