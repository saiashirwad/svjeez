import { Context, Effect, Layer } from "effect";
import type { Denied, Rejected } from "./errors.ts";
import type { State } from "./session.ts";
import type { Change, Edit } from "./types.ts";

/**
 * What a host adds around every edit: `beforeEdit` may deny or rewrite one, `validate` may refuse the state the edits
 * produce (after compiling, before it is kept), and `afterEdit` observes what was kept, to persist it or broadcast it.
 */
export class Hooks extends Context.Service<
  Hooks,
  {
    readonly beforeEdit: (edit: Edit, state: State) => Effect.Effect<Edit, Denied>;
    readonly validate?: (state: State) => Effect.Effect<void, Rejected>;
    readonly afterEdit: (change: Change, edits: readonly Edit[]) => Effect.Effect<void>;
  }
>()("@svjeez/live/Hooks") {}

/** Every edit goes through as written, and nothing watches. */
export const NoHooks: Layer.Layer<Hooks> = Layer.succeed(Hooks, {
  beforeEdit: (edit) => Effect.succeed(edit),
  afterEdit: () => Effect.void,
});
