import { Context, Effect, Layer, Semaphore, SubscriptionRef } from "effect";
import type { Stream } from "effect";
import { compile } from "./compile.ts";
import type { CompileOptions } from "./compile.ts";
import { describe } from "./describe.ts";
import { edit } from "./edit.ts";
import { Denied, RenderError, StaleSource } from "./errors.ts";
import type { CompileError, EditError, ParseError, Rejected, StorageError } from "./errors.ts";
import type { Hooks } from "./hooks.ts";
import { checkEdits } from "./props-check.ts";
import { Runner } from "./runner.ts";
import { parse } from "./source.ts";
import type { Description, Edit, Files, JsonObject, Parsed } from "./types.ts";
import type { Program, Rendered } from "./program.ts";

/** Everything a host reads after an edit lands: the source, what it parses to, what it compiles to, and the form for it. */
export interface State {
  readonly files: Files;
  readonly parsed: Parsed;
  readonly program: Program;
  readonly describe: Description;
  /** 0 for the files a session opened with, plus one for every edit batch kept. */
  readonly revision: number;
  /** The most recent request ids applied, oldest first, at most 1024. */
  readonly requestIds: readonly string[];
}

/** Ceilings that keep a hostile or runaway client in check. A call over one fails with `Denied`, or `RenderError` for `maxSvgBytes`. */
export interface Limits {
  /** Total UTF-8 bytes of all files. */
  readonly maxSourceBytes?: number;
  readonly maxFiles?: number;
  /** Elements with an id. */
  readonly maxNodes?: number;
  readonly maxTreeDepth?: number;
  readonly maxSvgBytes?: number;
  /** Edit batches a session keeps before it refuses more. */
  readonly maxRevisions?: number;
  /** Edits in one call to `apply`. Each one reparses the source, so this bounds the work a call can ask for. */
  readonly maxBatchEdits?: number;
}

export interface ApplyOptions {
  /** A batch with a `requestId` already applied returns the state it made, so a client can retry safely. */
  readonly requestId?: string;
  /** The `parsed.hashes` the edits were planned against; a mismatch fails with `StaleSource`. */
  readonly hashes?: Readonly<Record<string, string>>;
}

export interface SessionOptions {
  readonly files: Files;
  /** The file the scene renders from: a key of `files`. */
  readonly entry: string;
  readonly compile?: Omit<CompileOptions, "entry">;
  readonly limits?: Limits;
  /** From a saved `State`, to resume where it left off. */
  readonly revision?: number;
  readonly requestIds?: readonly string[];
}

const bytes = (text: string): number => new TextEncoder().encode(text).length;

const denyAbove = (
  what: string,
  count: number,
  max: number | undefined,
): Effect.Effect<void, Denied> =>
  max !== undefined && count > max
    ? Effect.fail(new Denied({ reason: `${what}: ${count} is over the limit of ${max}.` }))
    : Effect.void;

/** An upper bound on how many bytes an edit adds to the source, from the edit alone. */
const growth = (e: Edit, parsed: Parsed): number => {
  switch (e.op) {
    case "set":
    case "insert":
    case "replaceFile":
      return bytes(JSON.stringify(e));
    case "rename":
      return bytes(e.to) * (1 + parsed.refs.length);
    case "unset":
    case "remove":
    case "move":
      return 0;
  }
};

/**
 * One scene under edit. It holds the current `State`, applies edit batches one at a time through the host's hooks,
 * and keeps a batch only if the result parses, compiles and passes `validate`.
 */
export class Session extends Context.Service<
  Session,
  {
    readonly state: SubscriptionRef.SubscriptionRef<State>;
    /** The current state, then each state a kept batch makes. */
    readonly changes: Stream.Stream<State>;
    readonly apply: (
      edits: readonly Edit[],
      opts?: ApplyOptions,
    ) => Effect.Effect<
      State,
      EditError | Denied | Rejected | StorageError | CompileError | ParseError
    >;
    readonly render: (params?: JsonObject) => Effect.Effect<Rendered, RenderError>;
  }
>()("@svjeez/live/Session") {
  static layer = <R = never>(
    options: SessionOptions & { readonly hooks?: Hooks<R> },
  ): Layer.Layer<Session, ParseError | CompileError | Denied, Runner | R> =>
    Layer.effect(Session, makeSession(options));
}

const makeSession = <R>({
  hooks = {},
  ...options
}: SessionOptions & { readonly hooks?: Hooks<R> }) =>
  Effect.gen(function* () {
    const runner = yield* Runner;
    const context = yield* Effect.context<R>();
    const { limits = {} } = options;
    const lock = yield* Semaphore.make(1);

    /** Parse `files`, within the limits. Pass the parse an edit already made to skip a second one. */
    const read = (files: Files, known?: Parsed) =>
      Effect.gen(function* () {
        const names = Object.keys(files);

        yield* denyAbove("files", names.length, limits.maxFiles);
        yield* denyAbove(
          "source bytes",
          names.reduce((sum, name) => sum + bytes(files[name] ?? ""), 0),
          limits.maxSourceBytes,
        );

        const parsed = known ?? (yield* parse(files));

        yield* denyAbove("nodes", parsed.order.length, limits.maxNodes);
        // The deepest JSX nesting, so wrappers with no id count too.
        yield* denyAbove("tree depth", parsed.maxDepth, limits.maxTreeDepth);

        return parsed;
      });

    /** Compile and describe what `read` parsed. */
    const build = (files: Files, parsed: Parsed, revision: number, requestIds: readonly string[]) =>
      Effect.gen(function* () {
        const compiled = yield* compile(files, { ...options.compile, entry: options.entry }).pipe(
          Effect.provideService(Runner, runner),
        );

        const program: Program = {
          ...compiled,
          render: (params) =>
            Effect.flatMap(compiled.render(params), (rendered) =>
              limits.maxSvgBytes !== undefined && bytes(rendered.svg) > limits.maxSvgBytes
                ? Effect.fail(
                    new RenderError({
                      message: `The SVG is ${bytes(rendered.svg)} bytes, over the limit of ${limits.maxSvgBytes}.`,
                    }),
                  )
                : Effect.succeed(rendered),
            ),
        };

        return {
          files,
          parsed,
          program,
          describe: describe(parsed, program),
          revision,
          requestIds,
        } satisfies State;
      });

    const ref = yield* SubscriptionRef.make(
      yield* build(
        options.files,
        yield* read(options.files),
        options.revision ?? 0,
        options.requestIds ?? [],
      ),
    );

    const attempt = (edits: readonly Edit[], opts: ApplyOptions) =>
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(ref);

        for (const [file, expected] of Object.entries(opts.hashes ?? {})) {
          const actual = current.parsed.hashes[file];

          if (actual !== expected)
            return yield* new StaleSource({ file, expected, actual: actual ?? "" });
        }

        yield* denyAbove("revisions", current.revision + 1, limits.maxRevisions);
        yield* denyAbove("edits in a batch", edits.length, limits.maxBatchEdits);

        const rewritten: Edit[] = [];

        for (const e of edits)
          rewritten.push(
            hooks.beforeEdit
              ? yield* hooks.beforeEdit(e, current).pipe(Effect.provideContext(context))
              : e,
          );

        // Every edit reparses the source, so refuse a batch that could not fit before it starts.
        if (limits.maxSourceBytes !== undefined) {
          const size = Object.values(current.files).reduce((sum, text) => sum + bytes(text), 0);

          yield* denyAbove(
            "source bytes after the edits",
            rewritten.reduce((sum, e) => sum + growth(e, current.parsed), size),
            limits.maxSourceBytes,
          );
        }

        const { parsed, ...change } = yield* edit(current.parsed, rewritten);
        const candidate = yield* read(change.files, parsed);

        // The batch is checked as a whole: its props against the source it wrote, not the source each edit began from.
        yield* checkEdits(candidate, current.program, rewritten);

        const next = yield* build(
          change.files,
          candidate,
          current.revision + 1,
          opts.requestId === undefined
            ? current.requestIds
            : [...current.requestIds, opts.requestId].slice(-1024),
        );

        if (hooks.validate) yield* hooks.validate(next).pipe(Effect.provideContext(context));

        // Once the host has the change, the session must hold it too: an interrupt between the two would leave
        // storage a revision ahead of what a retry with the same `requestId` sees.
        yield* Effect.uninterruptible(
          Effect.gen(function* () {
            if (hooks.afterEdit)
              yield* hooks
                .afterEdit(next, {
                  diff: change.diff,
                  edits: rewritten,
                  ...(opts.requestId !== undefined && { requestId: opts.requestId }),
                })
                .pipe(Effect.provideContext(context));
            yield* SubscriptionRef.set(ref, next);
          }),
        );

        return next;
      });

    return Session.of({
      state: ref,
      changes: SubscriptionRef.changes(ref),
      apply: (edits, opts = {}) =>
        lock.withPermit(
          Effect.flatMap(SubscriptionRef.get(ref), (current) =>
            opts.requestId !== undefined && current.requestIds.includes(opts.requestId)
              ? Effect.succeed(current)
              : attempt(edits, opts),
          ),
        ),
      render: (params) =>
        Effect.flatMap(SubscriptionRef.get(ref), ({ program }) => program.render(params)),
    });
  });
