import { Context, Effect, Layer } from "effect";
import type { Denied, Rejected, StorageError } from "./errors.ts";
import type { State } from "./session.ts";
import type { Change, Edit } from "./types.ts";

/** What `afterEdit` is told about the batch beyond its edits. */
export interface EditMeta {
  /** The `requestId` the batch was applied with. A host that persists can use it as an idempotency key. */
  readonly requestId?: string;
}

/**
 * What a host adds around every edit: `beforeEdit` may deny or rewrite one, `validate` may refuse the state the edits
 * produce (after compiling, before it is kept), and `afterEdit` takes what was kept, to persist it or broadcast it.
 * Failing `afterEdit` (with `StorageError`, `Denied` or `Rejected`) keeps the old state. Once it has started the
 * session finishes the batch, whatever interrupts the call, so a host that has stored the change has it published.
 */
export class Hooks extends Context.Service<
  Hooks,
  {
    readonly beforeEdit: (edit: Edit, state: State) => Effect.Effect<Edit, Denied>;
    readonly validate?: (state: State) => Effect.Effect<void, Rejected>;
    readonly afterEdit: (
      change: Change,
      edits: readonly Edit[],
      meta: EditMeta,
    ) => Effect.Effect<void, Denied | Rejected | StorageError>;
  }
>()("@svjeez/live/Hooks") {}

/** Every edit goes through as written, and nothing watches. */
export const NoHooks: Layer.Layer<Hooks> = Layer.succeed(Hooks, {
  beforeEdit: (edit) => Effect.succeed(edit),
  afterEdit: () => Effect.void,
});
