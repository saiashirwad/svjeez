import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { browser, type Browser, type BrowserOptions } from "./browser.ts";
import type { Snapshot } from "./tree.ts";

/** Bump when the shape of a Snapshot changes, so stale files are read again. */
const FORMAT = 1;

export interface SnapshotsOptions extends BrowserOptions {
  /** Everything the snapshots depend on: the markup, the CSS, the actions. A new value reads the page again. */
  readonly inputs: unknown;
}

const version = async (): Promise<string> =>
  (
    JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      version: string;
    }
  ).version;

/**
 * Snapshots kept in `file` as JSON, so a build without changes never starts Chromium. `run` gets a browser only
 * when `inputs` (or this package) changed since the file was written. `SVJEEZ_DOM_REFRESH=1` reads again anyway.
 */
export const snapshots = async <T extends Record<string, Snapshot | Snapshot[]>>(
  file: string,
  { inputs, ...options }: SnapshotsOptions,
  run: (dom: Browser) => Promise<T>,
): Promise<T> => {
  const hash = createHash("sha256")
    .update(JSON.stringify([inputs, await version(), FORMAT]))
    .digest("hex");

  if (!process.env.SVJEEZ_DOM_REFRESH) {
    const saved = await readFile(file, "utf8").then(
      (text) => JSON.parse(text) as { hash?: string; data?: T },
      () => undefined,
    );

    if (saved?.hash === hash && saved.data) return saved.data;
  }

  const dom = await browser(options);

  try {
    const data = await run(dom);

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ hash, data }));

    return data;
  } finally {
    await dom.close();
  }
};
