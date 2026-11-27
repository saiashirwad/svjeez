#!/usr/bin/env bun
import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Data, Duration, Effect, FileSystem, Path, Stream } from "effect";
import { app, listen } from "./server.ts";
import { page } from "./page.ts";
import { Workspace } from "./workspace.ts";
import { DRAFT } from "./builder.ts";

const USAGE = `usage:
  svjeez-dev <scene.tsx> [--port 5173]   open one scene
  svjeez-dev [dir] [--port 5173]         pick from the scenes under dir (default: here)`;

class Usage extends Data.TaggedError("Usage")<{ readonly message: string }> {}

interface Args {
  readonly target: string;
  readonly port: number;
}

const argsOf = (argv: readonly string[]): Effect.Effect<Args, Usage> => {
  let target = ".";
  let port = 5173;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";

    if (arg === "--help" || arg === "-h") return Effect.fail(new Usage({ message: USAGE }));

    if (arg === "--port") {
      port = Number(argv[++i]);

      if (!(Number.isInteger(port) && port >= 0 && port < 65536))
        return Effect.fail(
          new Usage({ message: "--port needs a whole number from 0 to 65535.\n\n" + USAGE }),
        );
    } else if (arg.startsWith("-"))
      return Effect.fail(new Usage({ message: "Unknown flag " + arg + ".\n\n" + USAGE }));
    else target = arg;
  }

  return Effect.succeed({ target, port });
};

/** Changes nobody needs a rebuild for: dependencies, build output, dot files (the preview copies among them). */
const IGNORED = /(?:^|\/)(?:node_modules|dist|package-dist|\.[^/]*)(?:\/|$)|\.svg$/;

/** The client script, bundled for the browser from source each time the server starts. */
const bundle = Effect.tryPromise({
  try: async () => {
    const result = await Bun.build({
      entrypoints: [import.meta.dir + "/client/main.ts"],
      target: "browser",
      conditions: ["@svjeez/source"],
      sourcemap: "inline",
    });

    const [output] = result.outputs;

    if (!result.success || !output) throw new Error(result.logs.map(String).join("\n"));

    return output.text();
  },
  catch: (error) => new Usage({ message: "Could not bundle the page script: " + String(error) }),
});

/** The directory svjeez's own packages sit in, whose modules a rebuild must not import twice. */
const packagesDir = (path: Path.Path): string =>
  path.dirname(path.dirname(path.dirname(new URL(import.meta.resolve("svjeez/tools")).pathname)));

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const args = yield* argsOf(Bun.argv.slice(2));
  const target = path.resolve(args.target);

  const info = yield* fs
    .stat(target)
    .pipe(
      Effect.mapError(
        () => new Usage({ message: "No such file or directory: " + target + "\n\n" + USAGE }),
      ),
    );

  const project = info.type === "Directory";
  const root = project ? target : path.dirname(target);

  const client = yield* bundle;

  yield* serve(
    args.port,
    root,
    project ? path.basename(root) + "/" : path.basename(target),
    client,
  ).pipe(
    Effect.provide(
      Workspace.layer({
        root,
        mode: project ? "project" : "file",
        ...(!project && { file: target }),
        keep: packagesDir(path),
      }),
    ),
  );
});

/** Serves the workspace and rebuilds it when a file under the root changes. Runs until the process is stopped. */
const serve = (port: number, root: string, title: string, client: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const workspace = yield* Workspace;
    const server = yield* listen(port);
    const html = page(title);

    yield* server.serve(app(workspace, html, client));

    const changed = new Set<string>();

    yield* fs.watch(root, { recursive: true }).pipe(
      Stream.map((event) => path.resolve(root, event.path)),
      Stream.filter((file) => !IGNORED.test(path.relative(root, file)) && !file.includes(DRAFT)),
      Stream.tap((file) => Effect.sync(() => changed.add(file))),
      Stream.debounce(Duration.millis(80)),
      Stream.runForEach(() => {
        const paths = [...changed];

        changed.clear();

        return workspace.changed(paths);
      }),
      Effect.catch((error) => Effect.logWarning("Stopped watching " + root + ": " + error.message)),
      Effect.forkScoped,
    );

    const address = server.address;
    const bound = "port" in address ? address.port : port;

    yield* Effect.log("svjeez dev: " + root + " at http://localhost:" + bound);

    return yield* Effect.never;
  });

const program = main.pipe(
  Effect.catchTag("Usage", (usage) => Effect.sync(() => console.error(usage.message))),
  Effect.scoped,
  Effect.provide(BunServices.layer),
);

BunRuntime.runMain(program);
