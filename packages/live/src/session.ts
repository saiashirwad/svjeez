import { Clock, Context, Effect, Layer, Semaphore, SubscriptionRef } from "effect";
import type { Stream } from "effect";
import { compile } from "./compile.ts";
import type { CompileOptions } from "./compile.ts";
import { describe } from "./describe.ts";
import { edit } from "./edit.ts";
import { Denied, RenderError, StaleSource } from "./errors.ts";
import type { CompileError, EditError, ParseError, Rejected } from "./errors.ts";
import { Hooks } from "./hooks.ts";
import { checkEdit } from "./props-check.ts";
import { Runner } from "./runner.ts";
import { parse } from "./source.ts";
import type { Description, Edit, Files, JsonObject, Parsed } from "./types.ts";
import type { Program } from "./program.ts";

/** Everything a host reads after an edit lands: the source, what it parses to, what it compiles to, and the form for it. */
export interface State {
  readonly files: Files;
  readonly parsed: Parsed;
  readonly program: Program;
  readonly describe: Description;
  /** 0 for the files a session opened with, plus one for every edit batch kept. */
  readonly revision: number;
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
  /** At most `maxEdits` calls to `apply` in any `windowMs`. */
  readonly rateLimit?: { readonly maxEdits: number; readonly windowMs: number };
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
}

/** How many request ids a session remembers. */
const REMEMBERED = 1024;

const bytes = (text: string): number => new TextEncoder().encode(text).length;

const denyAbove = (
  what: string,
  count: number,
  max: number | undefined,
): Effect.Effect<void, Denied> =>
  max !== undefined && count > max
    ? Effect.fail(new Denied({ reason: `${what}: ${count} is over the limit of ${max}.` }))
    : Effect.void;

const depthOf = (parsed: Parsed): number => {
  const depth = (id: string): number => {
    const parent = parsed.elements[id]?.parent;

    return parent === undefined ? 1 : 1 + depth(parent);
  };

  return Math.max(0, ...parsed.order.map(depth));
};

/**
 * One scene under edit. It holds the current `State`, applies edit batches one at a time through the host's `Hooks`,
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
    ) => Effect.Effect<State, EditError | Denied | Rejected | CompileError | ParseError>;
    readonly render: (params?: JsonObject) => Effect.Effect<string, RenderError>;
  }
>()("@svjeez/live/Session") {
  static layer = (
    options: SessionOptions,
  ): Layer.Layer<Session, ParseError | CompileError | Denied, Runner | Hooks> =>
    Layer.effect(Session, makeSession(options));
}

const makeSession = (options: SessionOptions) =>
  Effect.gen(function* () {
    const runner = yield* Runner;
    const hooks = yield* Hooks;
    const { limits = {} } = options;
    const lock = yield* Semaphore.make(1);

    /** Parse, compile and describe `files`, within the limits. */
    const derive = (files: Files, revision: number) =>
      Effect.gen(function* () {
        const names = Object.keys(files);

        yield* denyAbove("files", names.length, limits.maxFiles);
        yield* denyAbove(
          "source bytes",
          names.reduce((sum, name) => sum + bytes(files[name] ?? ""), 0),
          limits.maxSourceBytes,
        );

        const parsed = yield* parse(files);

        yield* denyAbove("nodes", parsed.order.length, limits.maxNodes);
        yield* denyAbove("tree depth", depthOf(parsed), limits.maxTreeDepth);

        const program = yield* compile(files, { ...options.compile, entry: options.entry }).pipe(
          Effect.provideService(Runner, runner),
        );

        return {
          files,
          parsed,
          program,
          describe: describe(parsed, program),
          revision,
        } satisfies State;
      });

    const ref = yield* SubscriptionRef.make(yield* derive(options.files, 0));
    const answered = new Map<string, State>();
    const attempts: number[] = [];

    const checkRate = Effect.gen(function* () {
      const { rateLimit } = limits;

      if (!rateLimit) return;
      const now = yield* Clock.currentTimeMillis;

      while (attempts.length > 0 && now - attempts[0]! >= rateLimit.windowMs) attempts.shift();

      yield* denyAbove("edits in the window", attempts.length + 1, rateLimit.maxEdits);
      attempts.push(now);
    });

    const remember = (requestId: string | undefined, state: State) => {
      if (requestId === undefined) return;
      answered.set(requestId, state);

      if (answered.size > REMEMBERED) answered.delete(answered.keys().next().value!);
    };

    const attempt = (edits: readonly Edit[], opts: ApplyOptions) =>
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.get(ref);

        for (const [file, expected] of Object.entries(opts.hashes ?? {})) {
          const actual = current.parsed.hashes[file];

          if (actual !== expected)
            return yield* new StaleSource({ file, expected, actual: actual ?? "" });
        }

        yield* denyAbove("revisions", current.revision + 1, limits.maxRevisions);
        yield* checkRate;

        const rewritten: Edit[] = [];

        for (const e of edits) {
          const allowed = yield* hooks.beforeEdit(e, current);

          yield* checkEdit(current.parsed, current.program, allowed);
          rewritten.push(allowed);
        }

        const change = yield* edit(current.parsed, rewritten);
        const next = yield* derive(change.files, current.revision + 1);

        yield* hooks.validate?.(next) ?? Effect.void;
        // Observers see the state only once `afterEdit` has taken it, so a host that fails to persist keeps the old one.
        yield* hooks.afterEdit(change, rewritten);
        yield* SubscriptionRef.set(ref, next);
        remember(opts.requestId, next);

        return next;
      });

    return Session.of({
      state: ref,
      changes: SubscriptionRef.changes(ref),
      apply: (edits, opts = {}) =>
        lock.withPermit(
          Effect.suspend(() => {
            const seen = opts.requestId === undefined ? undefined : answered.get(opts.requestId);

            return seen ? Effect.succeed(seen) : attempt(edits, opts);
          }),
        ),
      render: (params) =>
        Effect.gen(function* () {
          const { program } = yield* SubscriptionRef.get(ref);
          const svg = yield* program.render(params);

          if (limits.maxSvgBytes !== undefined && bytes(svg) > limits.maxSvgBytes)
            return yield* new RenderError({
              message: `The SVG is ${bytes(svg)} bytes, over the limit of ${limits.maxSvgBytes}.`,
            });

          return svg;
        }),
    });
  });
