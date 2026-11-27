# `@svjeez/live`

Headless, Effect v4 toolkit for building visual editors, MCP servers, or CLIs that parse TSX scene source by `id`, apply minimal-diff literal edits, and compile/render in a pluggable runner. (For tool builders, not scene authors.)

## Setup

```sh
npm install @svjeez/live svjeez effect
```

- Single entry `@svjeez/live`; every operation returns an `Effect` (`effect ^4.1`) with tagged errors (`Data.TaggedError`).
- Provide a `Runner` layer:
  - `BunRunner` / `bunRunner(libs)`: in-process `node:vm` (trusted code: tests, CLIs).
  - `BrowserRunner` / `browserRunner(libs)`: in-realm `new Function` (trusted worker/browser; pass library namespaces explicitly).
  - `WorkerLoaderRunner(options)`: Cloudflare Worker Loader isolate with no network (untrusted code).

## Mental model

- **Source is the model:** Pass a `Files` map (`{ "scene.tsx": source }`). No `/** @jsxImportSource svjeez */` pragma is needed—`compile()` injects it.
- **Addressable by literal `id="..."`:** `parse(files)` uses Lezer without executing code. Only JSX elements with a literal `id` are indexed (scoped as `file#Binding/id` inside `component()`). Rendered SVGs include `data-svz-id` by default (`ids: false` strips it); `locate(parsed, svgId)` and `elementAt(parsed, file, offset)` map between preview clicks and source ranges.
- **Minimal-diff literal edits:** Props are either `{ editable: true, value, schema, range }` (literals) or `{ editable: false, reason: "param" | "expression" | "spread" }`. `edit(parsed, edits, currentFiles?)` rewrites only the changed spans and returns `{ files, diff }`. Ops: `set`, `unset`, `insert`, `remove`, `move`, `rename`, `replaceFile`.
- **Compile allowlist & guards:** `compile(files, { entry, modules?, maxLoopIterations?, ids? })` allows `svjeez`, drawing add-ons (`@svjeez/charts|code|diagrams|fonts|geo|icons|math|mermaid`), and relative files in `Files` (blocks `node:*`, `process`, `globalThis`, `__proto__`, and infra packages `@svjeez/live|bin|vite|astro|video|og|dom`), plus loop-iteration guards. Returns `Program { render(params?), components, params }`.
- **Sessions, hooks, limits, composite edits:**
  - `Session.layer({ files, entry, compile?, limits?, hooks?, revision?, requestIds? })` serializes batches via a semaphore, deduplicates by `requestId`, checks `hashes` (`StaleSource`), and exposes `state` (`SubscriptionRef`), `changes` (`Stream`), `apply()`, and `render()`.
  - **Important:** `session.apply()` validates by *compiling* (and checking Standard Schemas on `component()` props), not by calling `render()`. Add a `validate: (state) => state.program.render().pipe(Effect.asVoid)` hook to reject bad built-in prop literals before committing a revision.
  - `defineEdit({ name, input, expand })` validates and expands a composite edit into primitive `Edit[]` for `session.apply()`.

## API map

| Category | Exports |
|---|---|
| Parse & edit | `parse(files)`, `edit(parsed, edits, current?)`, `locate`, `elementAt`, `elementOf`, `definitionOf`, `describe(parsed, program)`, `defineEdit` |
| Compile & run | `compile(files, opts)`, `defaultAllowlist`, `Session` (`Session.layer`), `Runner`, `BunRunner`, `bunRunner`, `BrowserRunner`, `browserRunner`, `WorkerLoaderRunner` |
| Tagged errors | `ParseError`, `CompileError`, `RenderError`, `UnknownId`, `NotEditable`, `InvalidValue`, `DuplicateId`, `StaleSource`, `Denied`, `Rejected`, `StorageError` |

## Verified snippet

```ts
import { BunRunner, Session, edit, parse } from "@svjeez/live";
import { Effect, Layer } from "effect";

const SOURCE = `import { Group, Shape, ease, rect, scene, span, track } from "svjeez";
export default scene({ size: [200, 100], duration: 2, title: "Live", loop: false }, () => (
  <Group id="all">
    <Shape id="box" geometry={rect(40, 30)} fill="#D1242F" at={[10, 10]}
      motion={{ rotate: track(0).to(10, span(0, 1), ease.inOut) }} />
  </Group>
));`;

// 1. Pure parse + minimal-diff edit (no code executed)
const parsed = await Effect.runPromise(parse({ "scene.tsx": SOURCE }));
const change = await Effect.runPromise(edit(parsed, [{ op: "set", target: "box", prop: "fill", value: "#0A6CFF" }]));
console.log(change.diff);

// 2. Session with BunRunner
const program = Effect.gen(function* () {
  const session = yield* Session;
  yield* session.apply([{ op: "set", target: "box", prop: "at", value: [30, 20] }]);
  const { svg, warnings } = yield* session.render();
  return { bytes: svg.length, warnings: warnings.length };
});

const out = await Effect.runPromise(
  program.pipe(Effect.provide(Session.layer({ files: { "scene.tsx": SOURCE }, entry: "scene.tsx" }).pipe(Layer.provide(BunRunner)))),
);
console.log(out);
```

## Gotchas

- `UnknownId` → Add a literal `id="..."` to the target JSX element (inside a `component()`, address as `file#Binding/id`).
- `NotEditable { reason: "expression" }` → Only literal props are editable with `set`; rewrite expressions with `replaceFile`.
- `StaleSource` → Re-read `state.parsed.hashes` and pass the current hashes to `apply()`.
- Bad literal on a built-in prop (`at: "nope"`) succeeds in `apply()` and fails later in `render()` → Add a `validate` hook that calls `state.program.render()`.
- `"node:fs" is not available to scenes` → Pass `compile: { modules }` to widen the allowlist, or provide libraries via `browserRunner({ name: mod })`.
- `data-svz-id` attributes appear in exported SVG → Pass `compile: { ids: false }` for clean final output.
- Treating `BunRunner` / `BrowserRunner` as a security sandbox → Both run trusted code in-realm; use `WorkerLoaderRunner` or an isolated Worker for untrusted input.
