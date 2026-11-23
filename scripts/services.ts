import { BunCrypto, BunServices } from "@effect/platform-bun";
import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";

export const layer = Layer.mergeAll(
  BunServices.layer,
  BunCrypto.layerDigest,
  FetchHttpClient.layer,
);
