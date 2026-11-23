import { Data, Runtime } from "effect";

export class ScriptError extends Data.TaggedError("ScriptError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class Exited extends Data.TaggedError("Exited")<{ readonly code: number }> {
  override get [Runtime.errorExitCode]() {
    return this.code;
  }

  readonly [Runtime.errorReported] = false;
}
