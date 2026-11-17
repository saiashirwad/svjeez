import { type Point } from "svjeez";
import { restyle } from "svjeez/page";
import type { Schema } from "svjeez/params";
import { createCompiler, latestWins } from "./client.ts";
import type { Compiled, SceneSize, SourceError } from "./compile.ts";
import { valuesOf, type Settable, type Value } from "./controls.ts";
import { measureMove, type Move } from "./probe.ts";
import {
  apply,
  decimalsOf,
  linesOf,
  parse,
  write,
  type Edit,
  type Line,
  type Literal,
  type Source,
} from "./source.ts";

export interface PictureState {
  readonly url: string;
  readonly scene: SceneSize;
  /** The compiled file and the source it came from. A picture made at build time has neither until the first compile. */
  readonly svg?: string;
  readonly text?: string;
}

export type CompiledFile = Required<Omit<PictureState, "url">>;

/**
 * A handle on the picture for a number: where it sat when the value was `from`, and how far it moves per unit of the
 * value.
 */
export interface GripState extends Move {
  readonly from: number;
  readonly declared: boolean;
}

export interface PictureStats {
  readonly gzip: number;
  readonly keyframes: number;
  readonly scriptBytes: number;
  /** Milliseconds the compile took, or null for the stats of a picture built ahead of time. */
  readonly ms: number | null;
}

/** The scene's clock. Playing, it read 0 at page time `origin`, in milliseconds; paused, it holds `at` seconds. */
export type Clock =
  | { readonly playing: true; readonly origin: number }
  | { readonly playing: false; readonly at: number };

export interface State {
  readonly text: string;
  readonly source: Source;
  readonly values: readonly Value[];
  readonly lines: readonly Line[];
  readonly schema: Schema;
  readonly selected: string | null;
  readonly picture: PictureState | null;
  readonly compiled: CompiledFile | null;
  readonly stats: PictureStats | null;
  readonly grips: { readonly [key: string]: GripState };
  readonly error: SourceError | null;
  readonly clock: Clock;
  readonly history: { readonly past: readonly string[]; readonly future: readonly string[] };
}

type Valued = {
  [K in Value["kind"]]: { readonly key: string; readonly value: Settable[K] };
}[Value["kind"]];

export type Msg =
  /** Writes a value into the file. `continues` marks a step of a drag already under way, so undo takes the drag whole. */
  | ({ readonly type: "set"; readonly continues?: boolean } & Valued)
  | { readonly type: "replace"; readonly text: string }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "select"; readonly key: string | null; readonly now: number }
  | { readonly type: "play"; readonly now: number }
  | { readonly type: "pause"; readonly now: number }
  | { readonly type: "seek"; readonly at: number; readonly now: number }
  | {
      readonly type: "compiled";
      readonly text: string;
      readonly result: Compiled;
      readonly now: number;
    }
  | { readonly type: "shown"; readonly picture: PictureState; readonly now: number }
  | {
      readonly type: "probed";
      readonly key: string;
      readonly text: string;
      readonly grip: GripState | null;
    };

export type Cmd =
  | { readonly type: "compile"; readonly text: string }
  | {
      readonly type: "show";
      readonly svg: string;
      readonly at: number;
      readonly playing: boolean;
      readonly picture: Omit<PictureState, "url">;
    }
  | {
      readonly type: "probe";
      readonly key: string;
      readonly text: string;
      readonly svg: string;
      readonly nudged: string;
      readonly from: number;
      readonly by: number;
      readonly at: number;
    };

/** Where the clock reads at page time `now`, in seconds. */
export const timeAt = (clock: Clock, now: number): number =>
  clock.playing ? Math.max(0, (now - clock.origin) / 1000) : clock.at;

export const valueOf = (state: State, key: string): Value | undefined =>
  state.values.find((v) => v.key === key);

export const handleAt = (grip: GripState, v: number): Point => ({
  x: grip.at.x + grip.way.x * (v - grip.from),
  y: grip.at.y + grip.way.y * (v - grip.from),
});

const placesOf = (v: number) => Math.min(6, decimalsOf(String(v)));

/**
 * The edit that writes `v` into `value`'s literal, as the editor's `set` message does. Undefined for what has no
 * code: a non-finite number, or an ease that is neither named nor a bezier.
 */
export const editFor = <V extends Value>(
  value: V,
  v: Settable[V["kind"]],
  { step = true }: { readonly step?: boolean } = {},
): Edit | undefined => {
  if (value.kind === "number" && !Number.isFinite(v)) return undefined;

  // SAFETY: `v` is typed by the value's kind, and `kind` names that same kind on the literal.
  const literal = { ...value.literal, value: v } as Literal;

  const places =
    value.kind === "number"
      ? Math.max(
          placesOf(Number(v)),
          step ? placesOf(value.param.step) : 0,
          decimalsOf(value.literal.text),
        )
      : undefined;

  try {
    return { range: value.literal.range, text: write(literal, places) };
  } catch {
    return undefined;
  }
};

const isEditable = (literal: Literal, values: readonly Value[]) =>
  values.some((v) => v.literal === literal);

const read = (state: Omit<State, "source" | "values" | "lines">): State => {
  const source = parse(state.text);
  const values = valuesOf(source, state.schema);

  const selected =
    state.selected && values.some((v) => v.key === state.selected) ? state.selected : null;

  return {
    ...state,
    source,
    values,
    lines: linesOf(source, (l) => isEditable(l, values)),
    selected,
  };
};

/**
 * A picture made at build time, as a `?svjeez` import gives it, to show until the first compile. With its `duration`
 * the transport works before then too.
 */
export interface First {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly title: string;
  readonly duration?: number;
  readonly stats?: Omit<PictureStats, "ms">;
}

export interface Init {
  readonly text: string;
  readonly first?: First;
  /** Page time now, in milliseconds. */
  readonly now: number;
}

export const init = ({ text, first, now }: Init): [State, Cmd[]] => [
  read({
    text,
    schema: {},
    selected: null,
    picture: first
      ? {
          url: first.src,
          scene: {
            width: first.width,
            height: first.height,
            duration: first.duration ?? 0,
            title: first.title,
          },
        }
      : null,
    compiled: null,
    stats: first?.stats ? { ...first.stats, ms: null } : null,
    grips: {},
    error: null,
    clock: { playing: true, origin: now },
    history: { past: [], future: [] },
  }),
  [{ type: "compile", text }],
];

const edited = (state: State, text: string, continues = false): [State, Cmd[]] => {
  if (text === state.text) return [state, []];
  const past = continues ? state.history.past : [...state.history.past, state.text];

  return [read({ ...state, text, history: { past, future: [] } }), [{ type: "compile", text }]];
};

const showOf = (picture: CompiledFile, clock: Clock, now: number): Cmd => ({
  type: "show",
  svg: picture.svg,
  at: timeAt(clock, now),
  playing: clock.playing,
  picture,
});

const reshown = (state: State, clock: Clock, now: number): [State, Cmd[]] => {
  const next = { ...state, clock };
  const { compiled } = state;

  return [next, compiled ? [showOf(compiled, clock, now)] : []];
};

const declaredGrips = (text: string, handles: { readonly [key: string]: Move } = {}) => {
  const keys = Object.keys(handles);

  if (!keys.length) return {};
  const literals = parse(text).literals;

  return Object.fromEntries(
    keys.flatMap((key): [string, GripState][] => {
      const literal = literals.find((l) => l.key === `params.${key}`);

      return literal?.kind === "number"
        ? [[literal.key, { ...handles[key]!, from: literal.value, declared: true }]]
        : [];
    }),
  );
};

const onlyDeclared = (grips: State["grips"]) =>
  Object.fromEntries(Object.entries(grips).filter(([, g]) => g.declared));

const withDeclared = (grips: State["grips"], declared: State["grips"]) => ({
  ...Object.fromEntries(Object.entries(grips).filter(([, g]) => !g.declared)),
  ...declared,
});

const probeOf = (state: State, now: number): Cmd[] => {
  const value = state.selected ? valueOf(state, state.selected) : undefined;
  const { picture } = state;

  if (value?.kind !== "number" || state.grips[value.key]?.declared) return [];

  if (!picture?.svg || picture.text !== state.text) return [];
  const from = value.literal.value;
  const by = Math.max(value.param.step, (value.param.max - value.param.min) / 200);
  const nudged = { ...value.literal, value: from + by };

  return [
    {
      type: "probe",
      key: value.key,
      text: state.text,
      svg: picture.svg,
      nudged: apply(state.text, [
        { range: value.literal.range, text: write(nudged, placesOf(from + by)) },
      ]),
      from,
      by,
      at: timeAt(state.clock, now),
    },
  ];
};

const measures = (state: State, key: string, text: string) => {
  const now = valueOf(state, key)?.literal;

  if (!now) return false;

  if (text === state.text) return true;
  const then = parse(text).literals.find((l) => l.key === key);

  return !!then && apply(state.text, [{ range: now.range, text: then.text }]) === text;
};

export const update = (state: State, msg: Msg): [State, Cmd[]] => {
  switch (msg.type) {
    case "set": {
      const value = valueOf(state, msg.key);

      // SAFETY: a message's value is typed by its key's kind, which is the kind of the value found by that key.
      const edit = value && editFor(value, msg.value as Settable[typeof value.kind]);

      return edit ? edited(state, apply(state.text, [edit]), msg.continues) : [state, []];
    }

    case "replace":
      return edited(state, msg.text);
    case "undo": {
      const text = state.history.past.at(-1);

      if (text === undefined) return [state, []];

      const history = {
        past: state.history.past.slice(0, -1),
        future: [state.text, ...state.history.future],
      };

      return [read({ ...state, text, history }), [{ type: "compile", text }]];
    }

    case "redo": {
      const [text, ...future] = state.history.future;

      if (text === undefined) return [state, []];
      const history = { past: [...state.history.past, state.text], future };

      return [read({ ...state, text, history }), [{ type: "compile", text }]];
    }

    case "select": {
      if (msg.key === state.selected) return [state, []];

      if (msg.key !== null && !valueOf(state, msg.key)) return [state, []];
      const selected = { ...state, selected: msg.key, grips: onlyDeclared(state.grips) };

      return [selected, probeOf(selected, msg.now)];
    }

    case "play":
      return state.clock.playing
        ? [state, []]
        : reshown(state, { playing: true, origin: msg.now - state.clock.at * 1000 }, msg.now);
    case "pause":
      return state.clock.playing
        ? reshown(state, { playing: false, at: timeAt(state.clock, msg.now) }, msg.now)
        : [state, []];
    case "seek": {
      if (Number.isNaN(msg.at)) return [state, []];
      const at = Math.max(0, msg.at);

      return reshown(
        state,
        state.clock.playing
          ? { playing: true, origin: msg.now - at * 1000 }
          : { playing: false, at },
        msg.now,
      );
    }

    case "compiled": {
      if (!msg.result.ok)
        return msg.text === state.text ? [{ ...state, error: msg.result.error }, []] : [state, []];

      const { svg, scene, params = {}, handles } = msg.result;
      const current = msg.text === state.text;

      const compiled = {
        scene: scene ?? state.picture?.scene ?? { width: 0, height: 0, duration: 0, title: "" },
        svg,
        text: msg.text,
      };

      const next = read({
        ...state,
        schema: current ? params : state.schema,
        grips: withDeclared(state.grips, declaredGrips(msg.text, handles)),
        error: null,
        compiled,
        stats: {
          gzip: msg.result.stats.gzip,
          keyframes: msg.result.stats.keyframes,
          scriptBytes: msg.result.stats.scriptBytes,
          ms: msg.result.ms,
        },
      });

      return [next, [showOf(compiled, state.clock, msg.now)]];
    }

    case "shown": {
      const shown = { ...state, picture: msg.picture };

      return [shown, msg.picture.text === state.text ? probeOf(shown, msg.now) : []];
    }

    case "probed": {
      if (msg.key !== state.selected || !measures(state, msg.key, msg.text)) return [state, []];
      const grips = onlyDeclared(state.grips);

      return [{ ...state, grips: msg.grip ? { ...grips, [msg.key]: msg.grip } : grips }, []];
    }
  }
};

/** What a page can send: any message but the runtime's own, with the clock's `now` stamped on arrival. */
export type Input =
  Exclude<Msg, { type: "compiled" | "shown" | "probed" }> extends infer M
    ? M extends { readonly now: number }
      ? Omit<M, "now">
      : M
    : never;

/** The work the runtime does for `update`. A page swaps one out to compile elsewhere, or a test to run without a browser. */
export interface Effects {
  /**
   * Compiles the file. `stop` is called whenever the editor goes idle, and a compile after a stop must start the
   * compiler again, which `createCompiler` alone does not.
   */
  readonly compile: ((text: string) => Promise<Compiled>) & { readonly stop?: () => void };
  /** An image URL for `svg` started `at` seconds in, playing on or held, once it is ready to draw. */
  readonly show: (svg: string, at: number, playing: boolean) => Promise<string>;
  readonly release: (url: string) => void;
  readonly measure: (
    before: string,
    after: string,
    by: number,
    at: number,
  ) => Promise<Move | undefined>;
  readonly now: () => number;
}

export interface Editor {
  readonly getState: () => State;
  /**
   * Calls `listener` after every change; returns the call that stops it. Nothing compiles until the first subscriber,
   * so a server render starts no worker.
   */
  readonly subscribe: (listener: (state: State) => void) => () => void;
  readonly send: (input: Input) => void;
  /**
   * Stops the compiler and frees every URL, for good. Unsubscribing the last listener only pauses; the next subscribe
   * picks up again.
   */
  readonly destroy: () => void;
}

const showInBrowser = async (svg: string, at: number, playing: boolean) => {
  const url = URL.createObjectURL(
    new Blob([restyle(svg, { at, paused: !playing })], { type: "image/svg+xml" }),
  );

  const img = new Image();
  img.src = url;
  await img.decode().catch(() => undefined);

  return url;
};

const lazyCompiler = (): Effects["compile"] => {
  let compiler: ReturnType<typeof createCompiler> | undefined;

  return Object.assign((text: string) => (compiler ??= createCompiler())(text), {
    stop: () => {
      compiler?.stop();
      compiler = undefined;
    },
  });
};

export interface EditorOptions {
  readonly first?: First;
  readonly effects?: Partial<Effects>;
}

/** A store for editing `text`: state, a way to send messages, and the compiles and pictures they ask for. */
export const createEditor = (
  { text, first }: Omit<Init, "now">,
  effects: Partial<Effects> = {},
): Editor => {
  const run: Effects = {
    compile: effects.compile ?? lazyCompiler(),
    show: effects.show ?? showInBrowser,
    release: effects.release ?? ((url) => URL.revokeObjectURL(url)),
    measure: effects.measure ?? measureMove,
    now: effects.now ?? (() => performance.now()),
  };

  const listeners = new Set<(state: State) => void>();
  const made = new Set<string>();
  let waiting: Cmd[] | null = [];
  let alive = true;
  let epoch = 0;

  const compiling = async (text: string): Promise<Compiled> => {
    try {
      return await run.compile(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return { ok: false, error: { kind: "runtime", message }, ms: 0 };
    }
  };

  const release = (url: string) => {
    if (made.delete(url)) run.release(url);
  };

  const compile = latestWins(async (text: string) => {
    const started = epoch;
    const result = waiting ? undefined : await compiling(text);

    if (result && started === epoch) dispatch({ type: "compiled", text, result, now: run.now() });
    else perform({ type: "compile", text });
  });

  const show = latestWins(async (cmd: Extract<Cmd, { type: "show" }>) => {
    const url = await run.show(cmd.svg, cmd.at, cmd.playing);
    made.add(url);

    if (!alive) return release(url);
    dispatch({ type: "shown", picture: { ...cmd.picture, url }, now: run.now() });
  });

  const probe = latestWins(async (cmd: Extract<Cmd, { type: "probe" }>) => {
    const started = epoch;
    const after = waiting ? undefined : await compiling(cmd.nudged);

    if (!after || started !== epoch) return perform(cmd);
    const move = after.ok ? await run.measure(cmd.svg, after.svg, cmd.by, cmd.at) : undefined;
    const grip = move ? { ...move, from: cmd.from, declared: false } : null;
    dispatch({ type: "probed", key: cmd.key, text: cmd.text, grip });
  });

  const perform = (cmd: Cmd) => {
    if (!alive) return;

    if (waiting) waiting.push(cmd);
    else if (cmd.type === "compile") compile(cmd.text);
    else if (cmd.type === "show") show(cmd);
    else probe(cmd);
  };

  const [initial, cmds] = init({ text, first, now: run.now() });
  let state = initial;
  cmds.forEach(perform);

  const dispatch = (msg: Msg) => {
    if (!alive) return;
    const [next, cmds] = update(state, msg);

    if (msg.type === "shown" && state.picture && state.picture.url !== next.picture?.url)
      release(state.picture.url);

    if (next !== state) {
      state = next;
      listeners.forEach((listener) => listener(state));
    }

    cmds.forEach(perform);
  };

  const stamp = (input: Input): Msg => {
    switch (input.type) {
      case "play":
      case "pause":
      case "seek":
      case "select":
        return { ...input, now: run.now() };
      default:
        return input;
    }
  };

  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);

      if (waiting && alive) {
        const queued = waiting;
        waiting = null;
        queued.forEach(perform);
      }

      return () => {
        if (!listeners.delete(listener) || listeners.size || waiting) return;
        waiting = [];
        epoch++;
        run.compile.stop?.();
      };
    },
    send: (input) => dispatch(stamp(input)),
    destroy: () => {
      alive = false;
      listeners.clear();
      run.compile.stop?.();
      [...made].forEach(release);
    },
  };
};
