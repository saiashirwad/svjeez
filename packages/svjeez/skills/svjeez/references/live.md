# Live: read, edit and run a scene's source from a program

`@svjeez/live` is for a host that edits a scene's TSX: an editor, an MCP server, a Durable Object. Everything is Effect-native and plain data (JSON-safe), and nothing in the source runs until a `Runner` runs it.

| Call | Does |
| --- | --- |
| `parse(files)` | Index of every element with a literal `id`: props, tree, refs, file hashes. Nothing runs. |
| `edit(parsed, edits, files?)` | Applies `Edit`s in order and returns `{ files, diff }`. Only the named literal changes; the rest is byte for byte. |
| `compile(files, { entry })` | Checks and compiles to a `Program` (`render(params)`, `components`, `params`) on the `Runner` in the environment. |
| `describe(parsed, program)` | The form for a UI: each node's props as editable (`value`, JSON `schema`, `ui` from `x-ui`) or read-only (`reason`: `param`, `expression`, `spread`). |
| `locate(parsed, svgId)` | Source `Range` of a rendered `data-svz-id`. `elementAt(parsed, file, offset)` goes the other way. |

Edits are `set`, `unset`, `insert`, `remove`, `move` and `rename`, each addressed by a source id: the id path through the components it is written in (`"NoteCard/note"`, the `Text id="note"` inside `component({ name: "NoteCard" })`). That is what `parsed` and `describe` use.

A rendered `data-svz-id` is a runtime instance path instead (`"card1/note"`, from `<NoteCard id="card1">`). `locate` resolves it through the instance's component to its source. Failures are typed: `UnknownId`, `NotEditable`, `InvalidValue`, `DuplicateId`, `StaleSource`, `ParseError`, `CompileError`, `RenderError`.

## Runners

`BunRunner` runs in this process (source you trust). `BrowserRunner` runs in a worker, `WorkerLoaderRunner` in a Cloudflare isolate. Provide one as a layer.

## A session

`Session.layer({ files, entry, limits? })` holds the current `State` (`files`, `parsed`, `program`, `describe`, `revision`) and serializes `apply`. A batch is kept only if it edits, parses, compiles and passes `validate`; otherwise the state is untouched.

```ts
import { Effect, Layer } from "effect";
import { BunRunner, NoHooks, Session } from "@svjeez/live";

const program = Effect.gen(function* () {
  const session = yield* Session;
  const state = yield* session.apply([{ op: "set", target: "box", prop: "fill", value: "#00ff00" }], {
    requestId: "r1",
  });

  return yield* session.render();
});

Effect.runPromise(
  program.pipe(
    Effect.provide(
      Session.layer({ files: { "scene.tsx": "…" }, entry: "scene.tsx" }).pipe(
        Layer.provide(Layer.mergeAll(BunRunner, NoHooks)),
      ),
    ),
  ),
);
```

`apply(edits, { requestId, hashes })`: a replayed `requestId` returns the earlier state (safe retries); `hashes` from `parsed.hashes` fail with `StaleSource` when the source moved on. `state.changes` is a stream of every kept state.

`limits`: `maxSourceBytes`, `maxFiles`, `maxNodes`, `maxTreeDepth`, `maxRevisions`, `rateLimit: { maxEdits, windowMs }` fail with `Denied`; `maxSvgBytes` fails `render` with `RenderError`.

## Hooks

`Hooks` wraps every batch: `beforeEdit(edit, state)` denies (`Denied`) or rewrites an edit (`state` is the state before the batch, for every edit in it), `validate(state)` may refuse the compiled result (`Rejected`), `afterEdit(change, edits)` runs after a batch is kept. `NoHooks` passes everything.

```ts
import { Effect, Layer } from "effect";
import { Denied, Hooks, Rejected } from "@svjeez/live";

export const Room = Layer.succeed(
  Hooks,
  Hooks.of({
    beforeEdit: (edit) =>
      edit.op === "insert" && edit.element.component === "Envelope"
        ? Effect.fail(new Denied({ reason: "no envelopes" }))
        : Effect.succeed(edit),
    validate: (state) =>
      Effect.mapError(state.program.render(), (e) => new Rejected({ reason: e.message })),
    afterEdit: (change) => Effect.sync(() => console.log(change.diff)),
  }),
);
```

## Your own edits

`defineEdit({ name, input, expand })` takes a Standard Schema (Effect Schema, Zod, Valibot) and an `expand(value, state)` that returns primitive edits. `expand(raw, state)` on the result checks `raw` and fails `InvalidValue` when it is wrong; pass its edits to `session.apply`, so hooks and limits see only primitives.
