import { elementAt, locate } from "@svjeez/live";
import type { Edit, Json, JsonObject, State } from "@svjeez/live";
import { Atom, AsyncResult } from "effect/reactivity";
import type { AtomRegistry } from "effect/reactivity";
import { Effect, Option, Stream, SubscriptionRef } from "effect";
import { boot, freshId } from "./engine.ts";
import type { Engine, Outcome, Rendered } from "./engine.ts";
import { isObject } from "./guards.ts";

export interface Selection {
  readonly id: string;
  /** The `data-svz-id` that was clicked, if the selection came from the stage. */
  readonly svgId?: string;
}

export const lockedAtom = Atom.make(false);
export const selectionAtom = Atom.make<Selection | undefined>(undefined);
export const paramsAtom = Atom.make<JsonObject>({});
export const fileAtom = Atom.make("design.tsx");
export const diffAtom = Atom.make("");
export const problemAtom = Atom.make<string | undefined>(undefined);
export const renameToAtom = Atom.make("");
export const recolorFromAtom = Atom.make("");
export const recolorToAtom = Atom.make("#ef4444");
export const replayAtom = Atom.make(0);

/** The session. Refreshing it closes the old one and opens a fresh one on the sample files. */
export const engineAtom = Atom.make((get) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: () =>
        boot(
          () => get.registry.get(lockedAtom),
          () => get.registry.get(valuesAtom),
          (diff) => get.registry.set(diffAtom, diff),
        ),
      catch: (thrown) => (thrown instanceof Error ? thrown.message : String(thrown)),
    }),
    (engine) => Effect.promise(() => engine.dispose()),
  ),
);

/** The session's state, following the session as it changes. */
const sessionStateAtom = Atom.make((get) =>
  Stream.unwrap(
    get
      .result(engineAtom, { suspendOnWaiting: true })
      .pipe(Effect.map((engine) => SubscriptionRef.changes(engine.state))),
  ),
);

/** The state, or nothing while a session is opening. A stream stays "waiting" for as long as it runs, so only the session's own waiting counts. */
export const stateAtom = Atom.make((get): State | undefined =>
  AsyncResult.isWaiting(get(engineAtom))
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(get(sessionStateAtom))),
);

/** The defaults a scene's params schema declares, which the stage renders with until a control changes one. */
const defaultsOf = (schema: JsonObject): JsonObject => {
  const properties = schema["properties"];

  if (!isObject(properties)) return {};

  return Object.fromEntries(
    Object.entries(properties).flatMap(([name, property]): [string, Json][] =>
      isObject(property) && property["default"] !== undefined ? [[name, property["default"]]] : [],
    ),
  );
};

export const valuesAtom = Atom.make((get): JsonObject => {
  const state = get(stateAtom);

  return { ...defaultsOf(state?.describe.params ?? {}), ...get(paramsAtom) };
});

/** The scene drawn again whenever the source or a param changes; a failure keeps the last good drawing. */
export const svgAtom = Atom.make((get) => {
  const values = get(valuesAtom);

  return Effect.gen(function* () {
    const engine = yield* get.result(engineAtom, { suspendOnWaiting: true });
    const out = yield* Effect.promise(() => engine.render(values));

    return yield* out.ok ? Effect.succeed(out.value) : Effect.fail(out.message);
  });
});

/** The drawing on the stage, with the revision that produced it. */
export const renderedAtom = Atom.map(svgAtom, (result): Rendered | undefined =>
  Option.getOrUndefined(AsyncResult.value(result)),
);

/** The render failure the person has not dismissed yet. */
const dismissedAtom = Atom.make<AsyncResult.AsyncResult<Rendered, string> | undefined>(undefined);

/** One line for the banner: a refused edit, a session that would not open, or a scene that would not draw. */
export const bannerAtom = Atom.make((get): string | undefined => {
  const render = get(svgAtom);
  const engine = get(engineAtom);

  return (
    get(problemAtom) ??
    Option.getOrUndefined(AsyncResult.error(engine)) ??
    (get(dismissedAtom) === render ? undefined : Option.getOrUndefined(AsyncResult.error(render)))
  );
});

export const dismissBanner = (registry: AtomRegistry.AtomRegistry) => {
  registry.set(problemAtom, undefined);
  registry.set(dismissedAtom, registry.get(svgAtom));
};

/** Back to the sample on a fresh session, with every control as it started. */
export const reset = (registry: AtomRegistry.AtomRegistry) => {
  Atom.batch(() => {
    registry.set(paramsAtom, {});
    registry.set(selectionAtom, undefined);
    registry.set(diffAtom, "");
    registry.set(problemAtom, undefined);
    registry.refresh(engineAtom);
  });
};

/** The session, once it is open; nothing while a fresh one is opening. */
const engineOf = (registry: AtomRegistry.AtomRegistry): Engine | undefined => {
  const result = registry.get(engineAtom);

  return AsyncResult.isWaiting(result)
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(result));
};

/**
 * Runs an edit; a kept batch becomes the new state, a refused one becomes the banner and leaves the source alone. An
 * answer from a session that has since been replaced (Reset) is dropped.
 */
const commit = async (
  registry: AtomRegistry.AtomRegistry,
  run: (engine: Engine) => Promise<Outcome<State>>,
  after?: (state: State) => void,
) => {
  const engine = engineOf(registry);

  if (!engine) return;

  const out = await run(engine);

  if (engineOf(registry) !== engine) return;

  if (!out.ok) return registry.set(problemAtom, out.message);
  registry.set(problemAtom, undefined);
  after?.(out.value);
};

export const apply = (
  registry: AtomRegistry.AtomRegistry,
  edits: readonly Edit[],
  after?: (state: State) => void,
) => commit(registry, (engine) => engine.apply(edits), after);

export const recolor = (registry: AtomRegistry.AtomRegistry, from: string, to: string) =>
  commit(registry, (engine) => engine.recolor(from, to));

/** Renames a node, then selects it under its new id: a scoped id keeps its scope (`NoteCard/note` → `NoteCard/caption`). */
export const rename = (registry: AtomRegistry.AtomRegistry, id: string, to: string) =>
  commit(
    registry,
    (engine) => engine.apply([{ op: "rename", target: id, to }]),
    (state) => {
      const scope = id.slice(0, id.lastIndexOf("/") + 1);
      const renamed = [scope + to, to].find((candidate) => state.describe.nodes[candidate]);

      registry.set(selectionAtom, renamed === undefined ? undefined : { id: renamed });
      registry.set(renameToAtom, "");
    },
  );

/** Selects what was clicked on the stage and opens its file. */
export const pick = (registry: AtomRegistry.AtomRegistry, state: State, svgId: string) => {
  const where = locate(state.parsed, svgId);
  const id = where && elementAt(state.parsed, where.file, where.from);

  if (!where || !id) return registry.set(problemAtom, `Nothing in the source matches "${svgId}".`);
  registry.set(problemAtom, undefined);
  registry.set(selectionAtom, { id, svgId });
  registry.set(fileAtom, where.file);
};

/** Selects a node from the list and opens its file. */
export const select = (
  registry: AtomRegistry.AtomRegistry,
  state: State | undefined,
  id: string,
) => {
  registry.set(selectionAtom, { id });
  const where = state?.describe.nodes[id]?.range;

  if (where) registry.set(fileAtom, where.file);
};

export const insertNote = (registry: AtomRegistry.AtomRegistry, state: State) => {
  const root = state.describe.root;
  const id = freshId(state, "note");

  return apply(
    registry,
    [
      {
        op: "insert",
        parent: root,
        at: state.describe.nodes[root]?.children.length ?? 0,
        element: {
          component: "NoteCard",
          id,
          props: { note: "A new note", width: 200, accent: "#10b981", reveal: "wipe" },
        },
      },
    ],
    () => registry.set(selectionAtom, { id }),
  );
};
