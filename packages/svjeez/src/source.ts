const readLocal = async (file: string | URL): Promise<Uint8Array> => {
  let fs: typeof import("node:fs/promises");

  try {
    fs = await import("node:fs/promises");
  } catch {
    throw new Error(
      `Cannot read ${file}: this runtime has no file system. Pass the bytes, or an http(s) URL.`,
    );
  }

  return fs.readFile(file);
};

export const readSource = async (source: string | URL): Promise<Uint8Array> => {
  if (!(source instanceof URL) && !/^[a-z][a-z0-9+.-]*:\/\//i.test(source)) {
    return readLocal(source);
  }

  const url = source instanceof URL ? source : new URL(source);

  if (url.protocol === "http:" || url.protocol === "https:") {
    const response = await fetch(url);

    if (!response.ok)
      throw new Error(`Could not load ${url}: ${response.status} ${response.statusText}`.trim());

    return new Uint8Array(await response.arrayBuffer());
  }

  if (url.protocol !== "file:")
    throw new Error(`Cannot load ${url}. Use an http(s) or file: URL, or a path.`);

  return readLocal(url);
};
