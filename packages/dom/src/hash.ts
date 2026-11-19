import { createHash } from "node:crypto";

const REFERENCE = /\b(?:src|href)="([^"#]+)"/g;

/** A hash of the page at `url` and every same-origin asset it references, as the server serves them. */
export const hashPage = async (url: string): Promise<string> => {
  const page = await (await fetch(url)).text();
  const hash = createHash("sha256").update(page);

  for (const [, reference] of page.matchAll(REFERENCE)) {
    const asset = new URL(reference!, url);

    if (asset.origin === new URL(url).origin)
      hash.update(Buffer.from(await (await fetch(asset)).arrayBuffer()));
  }

  return hash.digest("hex");
};
