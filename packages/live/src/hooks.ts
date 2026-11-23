import type { Effect } from "effect";
import type { Denied, Rejected, StorageError } from "./errors.ts";
import type { State } from "./session.ts";
import type { Edit } from "./types.ts";

/**
 * What a host adds around every edit: `beforeEdit` may deny or rewrite one, `validate` may refuse the state the edits
 * produce (after compiling, before it is kept), and `afterEdit` takes what was kept, to persist it or broadcast it.
 * Failing `afterEdit` (with `StorageError`, `Denied` or `Rejected`) keeps the old state. Once it has started the
 * session finishes the batch, whatever interrupts the call, so a host that has stored the change has it published.
 * Hooks may need services (`R`); `Session.layer` asks for them once and provides them to every call.
 */
export interface Hooks<R = never> {
  readonly beforeEdit?: (edit: Edit, state: State) => Effect.Effect<Edit, Denied, R>;
  readonly validate?: (state: State) => Effect.Effect<void, Rejected, R>;
  /** `next` carries `files`, `revision` and `requestIds`: store them together and pass them back as `SessionOptions`. */
  readonly afterEdit?: (
    next: State,
    change: { readonly diff: string; readonly edits: readonly Edit[]; readonly requestId?: string },
  ) => Effect.Effect<void, Denied | Rejected | StorageError, R>;
}
