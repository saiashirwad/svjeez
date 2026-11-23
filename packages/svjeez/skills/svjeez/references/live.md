# Live: read, edit and run a scene's source from a program

`@svjeez/live` is for a host that edits a scene's TSX: an editor, an MCP server, a Durable Object. Everything is Effect-native and plain data (JSON-safe), and nothing in the source runs until a `Runner` runs it.

| Call | Does |
| --- | --- |
| `parse(files)` | Index of every element with a literal `id`: props, tree, refs, file hashes. Nothing runs. |
| `edit(parsed, edits, files?)` | Applies `Edit`s in order and returns `{ files, diff }`. Only the named literal changes; the rest is byte for byte. |
| `compile(files, { entry })` | Checks and compiles to a `Program` (`render(params)` gives `{ svg, warnings }`, `components`, `params`) on the `Runner` in the environment. |
| `describe(parsed, program)` | The form for a UI: each node's props as editable (`value`, JSON `schema`, every `x-*` key of the component's JSON Schema, so read hints from `schema["x-ui"]`) or read-only (`reason`: `param`, `expression`, `spread`). Effect drops unknown annotations unless asked: write the props' `jsonSchema.input` as `() => Schema.toJsonSchemaDocument(Props, { includeAnnotationKey: (k) => k === "x-ui" }).schema` (plus `definitions` as `$defs`) and annotate with `Schema.String.annotate({ "x-ui": { control: "textarea" } })`. |
| `locate(parsed, svgId)` | Source `Range` of a rendered `data-svz-id`. `elementAt(parsed, file, offset)` goes the other way. |

Edits are `set`, `unset`, `insert`, `remove`, `move`, `rename` and `replaceFile`. `replaceFile` (`{ op: "replaceFile", file, text }`) swaps or creates a whole file and goes through the same hooks, so undo and saving a component use it. `insert`'s element takes an optional `from` module: when the file does not import the component yet, `import { Name } from "from";` is added after its last import. The others are addressed by a source id: the id path through the component it is written in, `file#binding/id` (`"card.tsx#NoteCard/note"`, the `Text id="note"` inside `export const NoteCard = component(...)` in `card.tsx`; `default` for `export default component(...)`). Scene-level ids stay bare (`"note"`). That is what `parsed` and `describe` use. A node's `component` is the tag as written and `definition` is its key in `Program.components`, `module#exportName` (`/groups/a/card.tsx#Card`, `wedding#Card`); `definitionOf(parsed, element)` gives the key and scope. Two files may each define a `Card`.

A rendered `data-svz-id` is a runtime instance path instead (`"card1/note"`, from `<NoteCard id="card1">`). `locate` resolves it through the instance's component to its source. Failures are typed: `UnknownId`, `NotEditable`, `InvalidValue`, `DuplicateId`, `StaleSource`, `ParseError`, `CompileError`, `RenderError`.

## Runners

`BunRunner` and `BrowserRunner` run the source in the current realm, with its globals: use them only for source you trust. `bunRunner(libraries)` and `browserRunner(libraries)` take add-on namespaces a scene may import (Bun falls back to `import()`); `Program.components` includes the components those libraries register. `BrowserRunner` is a browser adapter (`new Function`, no `vm`), not a sandbox; it is no Web Worker unless you run it inside one. `WorkerLoaderRunner` is the boundary for untrusted source: a Cloudflare isolate with no network. Provide one as a layer. It always sends the `disallow_eval_during_startup` compatibility flag (so top-level code cannot compile strings); add more with `compatibilityFlags`. Every entry of `libraries` is shipped, so bundles may share a chunk by importing it as `/@lib/<specifier>`.

## A session

`Session.layer({ files, entry, limits?, hooks?, revision?, requestIds? })` holds the current `State` (`files`, `parsed`, `program`, `describe`, `revision`, `requestIds`) and serializes `apply`. A batch is kept only if it edits, parses, compiles and passes `validate`; otherwise the state is untouched.

```ts
import { Effect, Layer } from "effect";
import { BunRunner, Session } from "@svjeez/live";

const program = Effect.gen(function* () {
  const session = yield* Session;
  const state = yield* session.apply([{ op: "set", target: "box", prop: "fill", value: "#00ff00" }], {
    requestId: "r1",
  });

  return yield* session.render(); // { svg, warnings }
});

Effect.runPromise(
  program.pipe(
    Effect.provide(
      Session.layer({ files: { "scene.tsx": "…" }, entry: "scene.tsx" }).pipe(
        Layer.provide(BunRunner),
      ),
    ),
  ),
);
```

`apply(edits, { requestId, hashes })`: a `requestId` already applied returns the current state (safe retries; `state.requestIds` keeps the last 1024); `hashes` from `parsed.hashes` fail with `StaleSource` when the source moved on. `session.changes` (on `Session`, not on `State`) is a stream of the current state, then every kept one.

`limits`: `maxSourceBytes`, `maxFiles`, `maxNodes`, `maxTreeDepth`, `maxBatchEdits`, `maxRevisions` fail with `Denied`; `maxSvgBytes` fails `render` (and `state.program.render` in a `validate` hook) with `RenderError`.

## Hooks

`hooks` on `Session.layer` wrap every batch, all optional: `beforeEdit(edit, state)` denies (`Denied`) or rewrites an edit (`state` is the state before the batch, for every edit in it), `validate(state)` may refuse the compiled result (`Rejected`), `afterEdit(next, { diff, edits, requestId })` runs uninterruptibly once a batch compiles and validates (may fail with `StorageError`), before `Session` publishes `next` to subscribers. A hook may need services; the layer then requires them too.

```ts
import { Effect, Layer } from "effect";
import { BunRunner, Denied, Rejected, Session } from "@svjeez/live";

export const Room = Session.layer({
  files: { "scene.tsx": "…" },
  entry: "scene.tsx",
  hooks: {
    beforeEdit: (edit) =>
      edit.op === "insert" && edit.element.component === "Envelope"
        ? Effect.fail(new Denied({ reason: "no envelopes" }))
        : Effect.succeed(edit),
    validate: (state) =>
      Effect.mapError(state.program.render(), (e) => new Rejected({ reason: e.message })),
    afterEdit: (_, change) => Effect.sync(() => console.log(change.diff)),
  },
}).pipe(Layer.provide(BunRunner));
```

## Your own edits

`defineEdit({ name, input, expand })` takes a Standard Schema (Effect Schema, Zod, Valibot) and an `expand(value, state)` that returns primitive edits. `expand(raw, state)` on the result checks `raw` and fails `InvalidValue` when it is wrong; pass its edits to `session.apply`, so hooks and limits see only primitives.

## On Cloudflare: persist in `afterEdit`, run source in an isolate

```ts
import { DurableObject } from "cloudflare:workers";
import { Effect, Layer } from "effect";
import { Session, WorkerLoaderRunner } from "@svjeez/live";

export class Room extends DurableObject<{ LOADER: Parameters<typeof WorkerLoaderRunner>[0] }> {
  session = (saved: { files: Record<string, string>; revision: number; requestIds: string[] }) =>
    Session.layer({
      ...saved,
      entry: "scene.tsx",
      hooks: {
        // One write of what resumes a session; pass it back when the object wakes.
        afterEdit: ({ files, revision, requestIds }) =>
          Effect.promise(() => this.ctx.storage.put("saved", { files, revision, requestIds })),
      },
    }).pipe(Layer.provide(WorkerLoaderRunner(this.env.LOADER)));
}
```
