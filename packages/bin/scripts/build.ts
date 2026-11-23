import { BunRuntime } from "@effect/platform-bun";
import { Console, Duration, Effect, FileSystem, Path } from "effect";
import { Command, Flag } from "effect/cli";
import { Digest } from "effect/crypto";
import { read } from "../../../scripts/package-manifest.ts";
import { compile, pack, TARGETS } from "./binary.ts";
import * as Services from "../../../scripts/services.ts";

Command.make(
  "build",
  {
    target: Flag.Literals("target", TARGETS).pipe(Flag.atLeast(0)),
    all: Flag.Boolean("all").pipe(Flag.withDefault(false)),
    outdir: Flag.String("outdir").pipe(Flag.withDefault(`${import.meta.dirname}/../dist`)),
  },
  Effect.fn(function* ({ target, all, outdir }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const digest = yield* Digest.Digest;
    const out = path.resolve(outdir);
    const version = (yield* read(path.join(import.meta.dirname, "../../svjeez"))).version;
    const [packed] = yield* Effect.timed(pack(version));

    yield* Console.log(
      `packed types, libs and the skill in ${Duration.toSeconds(packed).toFixed(1)}s`,
    );

    const sums = yield* Effect.forEach(
      all ? TARGETS : target.length > 0 ? target : [undefined],
      Effect.fn(function* (target) {
        const outfile = yield* compile(version, target, out);
        const bytes = yield* fs.readFile(outfile);

        yield* Console.log(
          `✓ ${path.relative(path.resolve(), outfile) || path.basename(outfile)}  ${(bytes.length / 1024 / 1024).toFixed(1)} MB`,
        );

        return `${yield* digest.digestHex(Digest.sha256, bytes)}  ${path.basename(outfile)}`;
      }),
      { concurrency: 1 },
    );

    yield* fs.writeFileString(path.join(out, "svjeez-checksums.txt"), `${sums.join("\n")}\n`);
  }),
).pipe(Command.run({ version: "internal" }), Effect.provide(Services.layer), BunRuntime.runMain);
