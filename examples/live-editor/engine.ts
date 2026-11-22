import { Denied, Hooks, Session, browserRunner, defaultAllowlist, defineEdit } from "@svjeez/live";
import type {
  CompileError,
  Edit,
  EditError,
  JsonObject,
  ParseError,
  RawInput,
  Rejected,
  RenderError,
  State,
} from "@svjeez/live";
import { Effect, Layer, ManagedRuntime, Result, SubscriptionRef } from "effect";
import { font } from "svjeez";
import type { StandardSchemaV1 } from "svjeez";
import geistUrl from "./Geist-400.ttf?url";
import { isString } from "./guards.ts";
import { ENTRY, FONT_MODULE, INITIAL_FILES } from "./sample.ts";

export type Failure = EditError | Denied | Rejected | CompileError | ParseError | RenderError;

export type Outcome<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly message: string };

/** Every failure a session can report, as one line a person can read. */
export const messageOf = (failure: Failure): string => {
  switch (failure._tag) {
    case "Denied":
      return `Denied: ${failure.reason}`;
    case "Rejected":
      return `Rejected: ${failure.reason}`;
    case "InvalidValue":
      return `InvalidValue: ${failure.target}${failure.prop ? `.${failure.prop}` : ""}: ${failure.issue}`;
    case "NotEditable":
      return `NotEditable: ${failure.target}.${failure.prop} is read-only (${failure.reason}).`;
    case "DuplicateId":
      return `DuplicateId: "${failure.id}" is already used in this scope.`;
    case "UnknownId":
      return `UnknownId: nothing has the id "${failure.target}".`;
    case "StaleSource":
      return `StaleSource: ${failure.file} changed since the edit was planned.`;
    case "CompileError":
      return `CompileError: ${failure.file}:${failure.line}:${failure.col} ${failure.message}`;
    case "ParseError":
      return `ParseError: ${failure.file}:${failure.line}:${failure.col} ${failure.message}`;
    case "RenderError":
      return `RenderError: ${failure.message}${failure.node ? ` (at ${failure.node})` : ""}`;
  }
};

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

export interface Engine {
  /** The session's state: it changes whenever a batch is kept. */
  readonly state: SubscriptionRef.SubscriptionRef<State>;
  readonly apply: (edits: readonly Edit[]) => Promise<Outcome<State>>;
  readonly recolor: (from: string, to: string) => Promise<Outcome<State>>;
  readonly render: (params: JsonObject) => Promise<Outcome<string>>;
  readonly dispose: () => Promise<void>;
}

const touchesSeal = (edit: Edit): boolean => "target" in edit && edit.target === "seal";

/**
 * Opens a session on the sample files. The runner is the browser's (`new Function`); the font reaches the scene as an
 * extra library, since a browser cannot load one by name. `isLocked` is asked on every edit; `onDiff` hears the diff of
 * every batch the session keeps.
 */
export const boot = async (
  isLocked: () => boolean,
  onDiff: (diff: string) => void,
): Promise<Engine> => {
  const bytes = new Uint8Array(await (await fetch(geistUrl)).arrayBuffer());
  const sans = font(bytes);

  const hooks = Layer.succeed(
    Hooks,
    Hooks.of({
      beforeEdit: (edit) =>
        isLocked() && touchesSeal(edit)
          ? Effect.fail(new Denied({ reason: "policy: the seal is locked." }))
          : Effect.succeed(edit),
      afterEdit: (change) => Effect.sync(() => onDiff(change.diff)),
    }),
  );

  const layer = Session.layer({
    files: INITIAL_FILES,
    entry: ENTRY,
    compile: { modules: (name) => name === FONT_MODULE || defaultAllowlist(name) },
  }).pipe(Layer.provide(Layer.mergeAll(browserRunner({ [FONT_MODULE]: { sans } }), hooks)));

  const runtime = ManagedRuntime.make(layer);

  const attempt = async <A>(effect: Effect.Effect<A, Failure, Session>): Promise<Outcome<A>> => {
    const result = await runtime.runPromise(Effect.result(effect));

    return Result.isSuccess(result)
      ? { ok: true, value: result.success }
      : { ok: false, message: messageOf(result.failure) };
  };

  // Building the layer opens the session, so a scene that does not compile fails here.
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
    render: (params) => attempt(Session.use((session) => session.render(params))),
    dispose: () => runtime.dispose(),
  };
};
