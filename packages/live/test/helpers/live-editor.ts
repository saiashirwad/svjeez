import type { Compiled } from "../../src/compile";
import { init, update, valueOf, type Cmd, type Msg, type State } from "../../src/editor";

export const scene = `export const params = { look: choice("circle", ["circle", "square"]) };
export default () => (
  <circle cx={40} r={8} fill="#3EE6D6" animation={enter({ at: 1.2, over: 0.5 }, {}, ease.pop)} />
);
`;

export const SIZE = { width: 200, height: 120, duration: 4, title: "t" };

export const ok = (
  svg: string,
  extra: Partial<Extract<Compiled, { ok: true }>> = {},
): Compiled => ({
  ok: true,
  svg,
  scene: SIZE,
  stats: { bytes: 0, gzip: 0, keyframes: 0, scriptBytes: 0 },
  ms: 1,
  ...extra,
});

/** Runs messages through `update` from a fresh state, returning the last state and every command asked for. */
export const play = (msgs: readonly Msg[], from = init({ text: scene, now: 0 })[0]) => {
  const cmds: Cmd[] = [];
  let state: State = from;

  for (const msg of msgs) {
    const [next, asked] = update(state, msg);
    state = next;
    cmds.push(...asked);
  }

  return { state, cmds };
};

export const cx = (state: State) => valueOf(state, "default#0")!.literal.value;

/** Effects that compile and show on demand, so a test decides when each finishes. */
export const manual = () => {
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

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A state that has compiled `text` and shown its picture, ready to select a value. */
export const compiled = (text: string, extra: Partial<Extract<Compiled, { ok: true }>> = {}) => {
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
