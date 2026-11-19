import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { SNAPSHOT_VERSION, type Json } from "./schema.ts";

const isFields = (value: Json): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON with sorted keys, so equal inputs hash equal. */
const stable = (value: Json): string =>
  JSON.stringify(value, (_, one: Json) =>
    isFields(one)
      ? Object.fromEntries(Object.entries(one).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : one,
  ) ?? "null";

const hash = (inputs: Json): string => createHash("sha256").update(stable(inputs)).digest("hex");

interface Stored<T> {
  readonly version: number;
  readonly inputs: string;
  readonly value: T;
}

/**
 * Runs `fn` once per `inputs`: the result is kept in `file` as JSON and reused while `inputs` (anything JSON-able:
 * a URL, a selector, a script's source) and the Snapshot version are unchanged. `SVJEEZ_DOM_REFRESH=1` runs `fn` again.
 */
export const cached = async <T>(
  file: string,
  inputs: Json,
  fn: () => T | Promise<T>,
): Promise<T> => {
  const key = hash(inputs);

  if (process.env.SVJEEZ_DOM_REFRESH !== "1")
    try {
      const stored: Stored<T> = JSON.parse(await readFile(file, "utf8"));

      if (stored.version === SNAPSHOT_VERSION && stored.inputs === key) return stored.value;
    } catch {
      // Missing or unreadable: record it again.
    }

  const value = await fn();
  const stored: Stored<T> = { version: SNAPSHOT_VERSION, inputs: key, value };

  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(stored));

  return value;
};

/**
 * Where the cache file for a film lives: `true` is `<film file without extension>.states.json`, a relative path is
 * relative to the film file's directory, an absolute path is kept.
 */
export const cachePath = (cache: true | string, film: string | undefined): string => {
  if (cache !== true && isAbsolute(cache)) return cache;

  if (!film)
    throw new Error(
      "film: could not tell which file called film(), so `cache` needs an absolute path (or run the film file through Bun or runFilm).",
    );

  return cache === true
    ? `${film.slice(0, film.length - extname(film).length)}.states.json`
    : resolve(dirname(film), cache);
};
