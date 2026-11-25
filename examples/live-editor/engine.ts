import {
  Denied,
  Rejected,
  Session,
  browserRunner,
  defaultAllowlist,
  defineEdit,
} from "@svjeez/live";
import type {
  CompileError,
  Edit,
  EditError,
  JsonObject,
  ParseError,
  RawInput,
  RenderError,
  State,
  StorageError,
} from "@svjeez/live";
import { Effect, Layer, ManagedRuntime, Match, Result, SubscriptionRef } from "effect";
import { font } from "svjeez";
import type { StandardSchemaV1 } from "svjeez";
import { isString } from "./guards.ts";
import { ENTRY, FONT_MODULE, INITIAL_FILES } from "./sample.ts";

export type Failure =
  | EditError
  | Denied
  | Rejected
  | StorageError
  | CompileError
  | ParseError
  | RenderError;

export type Outcome<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly message: string };

/** Every failure a session can report, as one line a person can read. */
export const messageOf = (failure: Failure): string =>
  Match.value(failure).pipe(
    Match.tagsExhaustive({
      Denied: (failure) => `Denied: ${failure.reason}`,
      Rejected: (failure) => `Rejected: ${failure.reason}`,
      StorageError: (failure) => `StorageError: ${failure.reason}`,
      InvalidValue: (failure) =>
        `InvalidValue: ${failure.target}${failure.prop ? `.${failure.prop}` : ""}: ${failure.issue}`,
      NotEditable: (failure) =>
        `NotEditable: ${failure.target}.${failure.prop} is read-only (${failure.reason}).`,
      DuplicateId: (failure) => `DuplicateId: "${failure.id}" is already used in this scope.`,
      UnknownId: (failure) => `UnknownId: nothing has the id "${failure.target}".`,
      StaleSource: (failure) => `StaleSource: ${failure.file} changed since the edit was planned.`,
      CompileError: (failure) =>
        `CompileError: ${failure.file}:${failure.line}:${failure.col} ${failure.message}`,
      ParseError: (failure) =>
        `ParseError: ${failure.file}:${failure.line}:${failure.col} ${failure.message}`,
      RenderError: (failure) =>
        `RenderError: ${failure.message}${failure.node ? ` (at ${failure.node})` : ""}`,
    }),
  );

const HEX = /^#[0-9a-f]{6}$/i;

interface RecolorInput {
  readonly from: string;
  readonly to: string;
}

const isRecolor = (value: RawInput): value is RecolorInput =>
  typeof value === "object" &&
  value !== null &&
  "from" in value &&
  "to" in value &&
  typeof value.from === "string" &&
  typeof value.to === "string" &&
  HEX.test(value.from) &&
  HEX.test(value.to);

const recolorInput: StandardSchemaV1<RecolorInput> = {
  "~standard": {
    version: 1,
    vendor: "example",
    validate: (value) =>
      isRecolor(value)
        ? { value }
        : { issues: [{ message: "from and to must be #rrggbb colors" }] },
  },
};

/** A custom edit: swap one hex color for another on every editable prop in the scene, in one batch. */
export const recolor = defineEdit({
  name: "recolor",
  input: recolorInput,
  expand: ({ from, to }, state) =>
    Effect.succeed(
      Object.values(state.describe.nodes).flatMap((node) =>
        Object.entries(node.props).flatMap(([prop, p]): Edit[] =>
          p.editable && isString(p.value) && p.value.toLowerCase() === from.toLowerCase()
            ? [{ op: "set", target: node.id, prop, value: to }]
            : [],
        ),
      ),
    ),
});

/** The distinct hex colors written as literals anywhere in the scene. */
export const colorsIn = (state: State): readonly string[] => {
  const found = new Set<string>();

  for (const node of Object.values(state.describe.nodes))
    for (const p of Object.values(node.props))
      if (p.editable && isString(p.value) && HEX.test(p.value)) found.add(p.value.toLowerCase());

  return [...found];
};

/** `note2`, `note3`, … the first id nothing uses yet. */
export const freshId = (state: State, base: string): string => {
  let n = 2;

  while (state.describe.nodes[`${base}${n}`]) n++;

  return `${base}${n}`;
};

/** A drawing and the session revision that produced it. */
export interface Rendered {
  readonly svg: string;
  readonly revision: number;
}

export interface Engine {
  /** The session's state: it changes whenever a batch is kept. */
  readonly state: SubscriptionRef.SubscriptionRef<State>;
  readonly apply: (edits: readonly Edit[]) => Promise<Outcome<State>>;
  readonly recolor: (from: string, to: string) => Promise<Outcome<State>>;
  readonly render: (params: JsonObject) => Promise<Outcome<Rendered>>;
  readonly dispose: () => Promise<void>;
}

const touchesSeal = (edit: Edit): boolean => "target" in edit && edit.target === "seal";

/**
 * Opens a session on the sample files. The runner is the browser's (`new Function`); the font reaches the scene as an
 * extra library, since a browser cannot load one by name. `isLocked` is asked on every edit; `paramsNow` gives the
 * params the stage renders with, so an edit that would leave the scene unrenderable is rejected before it is kept;
 * `onDiff` hears the diff of every batch the session keeps.
 */
export const boot = async (
  isLocked: () => boolean,
  paramsNow: () => JsonObject,
  onDiff: (diff: string) => void,
): Promise<Engine> => {
  const sans = await font.load(
    "https://cdn.jsdelivr.net/fontsource/fonts/geist@5.3.0/latin-400-normal.ttf",
  );

  const layer = Session.layer({
    files: INITIAL_FILES,
    entry: ENTRY,
    compile: { modules: (name) => name === FONT_MODULE || defaultAllowlist(name) },
    hooks: {
      beforeEdit: (edit) =>
        isLocked() && touchesSeal(edit)
          ? Effect.fail(new Denied({ reason: "policy: the seal is locked." }))
          : Effect.succeed(edit),
      validate: (next) =>
        next.program.render(paramsNow()).pipe(
          Effect.asVoid,
          Effect.mapError(
            (error) => new Rejected({ reason: `the scene would not render: ${messageOf(error)}` }),
          ),
        ),
      afterEdit: (_, change) => Effect.sync(() => onDiff(change.diff)),
    },
  }).pipe(Layer.provide(browserRunner({ [FONT_MODULE]: { sans } })));

  const runtime = ManagedRuntime.make(layer);

  const attempt = async <A>(effect: Effect.Effect<A, Failure, Session>): Promise<Outcome<A>> => {
    const result = await runtime.runPromise(Effect.result(effect));

    return Result.isSuccess(result)
      ? { ok: true, value: result.success }
      : { ok: false, message: messageOf(result.failure) };
  };

  const state = await runtime.runPromise(Session.use((session) => Effect.succeed(session.state)));

  return {
    state,
    apply: (edits) => attempt(Session.use((session) => session.apply(edits))),
    recolor: (from, to) =>
      attempt(
        Effect.gen(function* () {
          const session = yield* Session;
          const state = yield* SubscriptionRef.get(session.state);
          const edits = yield* recolor.expand({ from, to }, state);

          return yield* session.apply(edits);
        }),
      ),
    render: (params) =>
      attempt(
        Effect.gen(function* () {
          const session = yield* Session;
          const { program, revision } = yield* SubscriptionRef.get(session.state);
          const { svg } = yield* program.render(params);

          return { svg, revision };
        }),
      ),
    dispose: () => runtime.dispose(),
  };
};
