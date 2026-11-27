import { BunHttpServer } from "@effect/platform-bun";
import { Cause, Duration, Effect, Schema, Stream } from "effect";
import type { Scope } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { HttpServerError } from "effect/http/HttpServerError";
import { messageOf } from "./workspace.ts";
import type { Failure, WorkspaceShape } from "./workspace.ts";

const Value = Schema.Union([
  Schema.Finite,
  Schema.String,
  Schema.Boolean,
  Schema.Struct({ start: Schema.Finite, over: Schema.Finite }),
  Schema.Tuple([Schema.Finite, Schema.Finite]),
]);

const SetBody = Schema.Struct({ key: Schema.String, value: Value });
const KeyBody = Schema.Struct({ key: Schema.String });
const OpenBody = Schema.Struct({ file: Schema.String });
const ExtractBody = Schema.Struct({ key: Schema.String, name: Schema.String });

const NO_STORE = { "cache-control": "no-store" };

const json = (body: Parameters<typeof HttpServerResponse.jsonUnsafe>[0], status = 200) =>
  HttpServerResponse.jsonUnsafe(body, { status, headers: NO_STORE });

type Handler = Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Failure | HttpServerError | Schema.SchemaError,
  HttpServerRequest.HttpServerRequest
>;

/** Server-sent events: every build and every change to the scene list, with a comment every 15 seconds to keep it open. */
const events = (workspace: WorkspaceShape) =>
  HttpServerResponse.stream(
    Stream.encodeText(
      Stream.concat(
        Stream.make(": connected\n\n"),
        Stream.merge(
          Stream.fromPubSub(workspace.events).pipe(
            Stream.map((event) => "data: " + JSON.stringify(event) + "\n\n"),
          ),
          Stream.tick(Duration.seconds(15)).pipe(Stream.map(() => ": ping\n\n")),
        ),
      ),
    ),
    { contentType: "text/event-stream", headers: { ...NO_STORE, connection: "keep-alive" } },
  );

/**
 * The dev server's routes. Every failure becomes a JSON `{ failure }` the page shows, never a crash: a scene that does
 * not build is a state the page draws, not an error of the server.
 */
export const app = (workspace: WorkspaceShape, page: string, client: string) => {
  const body = HttpServerRequest.schemaBodyJson;

  const routes = new Map<string, Handler>([
    ["GET /", Effect.succeed(HttpServerResponse.html(page))],
    [
      "GET /client.js",
      Effect.succeed(
        HttpServerResponse.text(client, { contentType: "text/javascript", headers: NO_STORE }),
      ),
    ],
    ["GET /api/state", Effect.map(workspace.state, (state) => json(state))],
    [
      "GET /api/svg",
      Effect.map(workspace.svg, (svg) =>
        HttpServerResponse.text(svg, { contentType: "image/svg+xml", headers: NO_STORE }),
      ),
    ],
    ["GET /api/events", Effect.sync(() => events(workspace))],
    [
      "POST /api/open",
      Effect.flatMap(body(OpenBody), ({ file }) =>
        Effect.map(workspace.open(file), (state) => json(state)),
      ),
    ],
    [
      "POST /api/preview",
      Effect.flatMap(body(SetBody), ({ key, value }) =>
        Effect.map(workspace.preview(key, value), (preview) => json(preview)),
      ),
    ],
    [
      "POST /api/commit",
      Effect.flatMap(body(SetBody), ({ key, value }) =>
        Effect.map(workspace.commit(key, value), (state) => json(state)),
      ),
    ],
    [
      "POST /api/extract",
      Effect.flatMap(body(ExtractBody), ({ key, name }) =>
        Effect.map(workspace.extract(key, name), (state) => json(state)),
      ),
    ],
    [
      "POST /api/variants",
      Effect.flatMap(body(KeyBody), ({ key }) =>
        Effect.map(workspace.variants(key), (variants) => json({ variants })),
      ),
    ],
    ["POST /api/undo", Effect.map(workspace.undo, (state) => json(state))],
    ["POST /api/redo", Effect.map(workspace.redo, (state) => json(state))],
  ]);

  return Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const { pathname } = new URL(request.url, "http://localhost");
    const handler = routes.get(request.method + " " + pathname);

    if (!handler) return HttpServerResponse.text("Not found", { status: 404 });

    const refused = (failure: Failure) =>
      Effect.succeed(json({ failure: messageOf(failure) }, 400));

    return yield* handler.pipe(
      Effect.catchTags({
        Refused: refused,
        BuildFailed: refused,
        InvalidValue: refused,
        StaleSource: refused,
      }),
      Effect.catch((error) => Effect.succeed(json({ failure: String(error) }, 400))),
    );
  }).pipe(
    Effect.catchCause((cause) => Effect.succeed(json({ failure: Cause.pretty(cause) }, 500))),
  );
};

/** A server on `port`, or on the next free one of the 20 after it. */
export const listen = (
  port: number,
  tries = 20,
): Effect.Effect<Effect.Success<ReturnType<typeof BunHttpServer.make>>, never, Scope.Scope> =>
  BunHttpServer.make({ port }).pipe(
    Effect.catch((error) =>
      tries > 0 && port !== 0 ? listen(port + 1, tries - 1) : Effect.die(error),
    ),
  );
