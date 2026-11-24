import { BunHttpServer } from "@effect/platform-bun";
import { Effect, Scope } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { ScriptError } from "../../../scripts/errors.ts";

export interface StandIn {
  readonly url: string;
  /** The paths asked for so far. */
  readonly asked: () => readonly string[];
}

/** Serves `files` as the GitHub release does, under any /v<version>/ path, so a launcher pointed at `url` downloads from here. */
export const standIn = (
  files: Readonly<Record<string, Uint8Array>>,
): Effect.Effect<StandIn, ScriptError, Scope.Scope> =>
  Effect.gen(function* () {
    const asked: string[] = [];

    const { serve, address } = yield* BunHttpServer.make({
      hostname: "127.0.0.1",
      port: 0,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new ScriptError({ message: "The stand-in for the release could not start.", cause }),
      ),
    );

    if (!("port" in address))
      return yield* new ScriptError({ message: "The stand-in for the release has no port." });

    yield* serve(
      Effect.gen(function* () {
        const { url } = yield* HttpServerRequest.HttpServerRequest;
        const body = files[url.slice(url.lastIndexOf("/") + 1)];

        asked.push(url);

        return body === undefined
          ? HttpServerResponse.empty({ status: 404 })
          : HttpServerResponse.uint8Array(body);
      }),
    );

    return { url: `http://${address.address}:${address.port}`, asked: () => asked };
  });
