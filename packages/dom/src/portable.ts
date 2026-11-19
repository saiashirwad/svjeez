import { relative, resolve } from "node:path";
import type { State } from "./record.ts";

/** The origin a cached snapshot's URLs are kept under: the server's port changes every run. */
export const ORIGIN = "http://svjeez-dom.invalid";

/** Cached files name a server file as `<ORIGIN>/@base/<path relative to the base>`; live, Vite serves it at `/@fs/<absolute path>`. */
const BASE = "/@base/";
const FS = "/@fs";

/** What follows `/@fs` in a URL: the absolute path, up to the end of the URL. */
const FS_PATH = /\/@fs(\/[^"'()\s?#\\]*)/g;

/**
 * The snapshots as they are kept in a cache file: the server's origin becomes a placeholder, and Vite's `/@fs/<absolute path>`
 * URLs (files outside its root) become paths relative to `base`, so the file is the same on every machine and checkout.
 * Throws if the absolute `base` is still in there (a leak that is not a `/@fs` URL).
 */
export const toPortable = (states: State[], origin: string, base: string): State[] => {
  const text = JSON.stringify(states)
    .replaceAll(`${origin}${FS}`, `${ORIGIN}${FS}`)
    .replaceAll(origin, ORIGIN)
    .replace(FS_PATH, (_, path: string) => `${BASE}${relative(base, path)}`);

  if (base.length > 1 && text.includes(base))
    throw new Error(
      `film: the recorded page leaks the absolute path ${base} into the cache file. Cached states must not hold absolute paths.`,
    );

  return JSON.parse(text);
};

/** The inverse of `toPortable`: this run's origin, and live `/@fs/<absolute path>` URLs. */
export const fromPortable = (states: State[], origin: string, base: string): State[] =>
  JSON.parse(
    JSON.stringify(states)
      .replace(
        new RegExp(`${ORIGIN}${BASE}([^"'()\\s?#\\\\]*)`, "g"),
        (_, path: string) => `${origin}${FS}${resolve(base, path)}`,
      )
      .replaceAll(ORIGIN, origin),
  );
