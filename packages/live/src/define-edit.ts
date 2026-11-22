import { Effect } from "effect";
import type { StandardSchemaV1 } from "svjeez";
import { InvalidValue } from "./errors.ts";
import { issueText } from "./props-check.ts";
import type { Denied } from "./errors.ts";
import type { State } from "./session.ts";
import type { Edit } from "./types.ts";

/** Whatever a client sent, before the input schema has checked it. */
export type RawInput = {} | null | undefined;

/** An edit a host defines on top of the primitives: named, validated, and expanded into primitive edits. */
export interface CustomEdit<Input = unknown, Output = Input, Failure = never> {
  readonly name: string;
  readonly input: StandardSchemaV1<Input, Output>;
  /** Checks `raw` against `input`, then expands it against the state it will apply to. */
  readonly expand: (
    raw: RawInput,
    state: State,
  ) => Effect.Effect<readonly Edit[], InvalidValue | Denied | Failure>;
}

/**
 * Defines an edit from a Standard Schema (Effect Schema, Zod, Valibot) and a function that turns the checked input into
 * primitive edits. Pass `expand`'s result to `session.apply`, so hooks, limits and validation see only primitives.
 */
export const defineEdit = <
  Input,
  Output,
  Failure extends InvalidValue | Denied = never,
>(definition: {
  readonly name: string;
  readonly input: StandardSchemaV1<Input, Output>;
  readonly expand: (value: Output, state: State) => Effect.Effect<readonly Edit[], Failure>;
}): CustomEdit<Input, Output, Failure> => ({
  name: definition.name,
  input: definition.input,
  expand: (raw, state) => {
    const invalid = (issue: string) =>
      new InvalidValue({ target: definition.name, prop: "", issue });

    const message = (thrown: Error | string) =>
      invalid(thrown instanceof Error ? thrown.message : thrown);

    return Effect.try({
      try: () => definition.input["~standard"].validate(raw),
      catch: (thrown) => message(thrown instanceof Error ? thrown : String(thrown)),
    }).pipe(
      // A schema may answer at once or with a promise: both end up as one result.
      Effect.flatMap((result) =>
        result instanceof Promise
          ? Effect.tryPromise({
              try: () => result,
              catch: (thrown) => message(thrown instanceof Error ? thrown : String(thrown)),
            })
          : Effect.succeed(result),
      ),
      Effect.flatMap((result): Effect.Effect<readonly Edit[], InvalidValue | Failure> =>
        result.issues
          ? Effect.fail(invalid(result.issues.map(issueText).join("; ")))
          : definition.expand(result.value, state),
      ),
    );
  },
});
