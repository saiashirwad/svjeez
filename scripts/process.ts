import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner, CommandLine } from "effect/process";
import { ScriptError } from "./errors";

export const run = Effect.fn("run")(function* (command: ChildProcess.StandardCommand) {
  const handle = yield* (yield* ChildProcessSpawner.ChildProcessSpawner).spawn(command);

  const [stdout, stderr, code] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
      handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
      handle.exitCode,
    ],
    { concurrency: "unbounded" },
  );

  if (code !== 0)
    return yield* new ScriptError({
      message: `"${CommandLine.display([command.command, ...command.args])}" exited with ${code}. ${stderr}`,
    });

  return stdout.trim();
}, Effect.scoped);
