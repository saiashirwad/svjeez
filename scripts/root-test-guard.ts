import { BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { ScriptError } from "./errors.ts";

Effect.fail(
  new ScriptError({
    message:
      "Run `bun run test` at the root, or `bun test` inside a workspace such as packages/svjeez.",
  }),
).pipe(BunRuntime.runMain);
