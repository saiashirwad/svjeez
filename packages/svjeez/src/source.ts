/** The bytes at an http(s) URL, fetched, or at a path or file: URL, read from disk. */
export const readSource = async (source: string | URL): Promise<Uint8Array> => {
  const url = source instanceof URL ? source : /^[a-z][a-z0-9+.-]*:\/\//i.test(source) ? new URL(source) : undefined;
  if (url?.protocol === "http:" || url?.protocol === "https:") {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`.trim());
    return new Uint8Array(await response.arrayBuffer());
  }
  const { readFile } = await import("node:fs/promises");
  if (!url) return readFile(source as string);
  if (url.protocol !== "file:") throw new Error(`Cannot load ${url}. Use an http(s) or file: URL, or a path.`);
  const { fileURLToPath } = await import("node:url");
  return readFile(fileURLToPath(url));
};
