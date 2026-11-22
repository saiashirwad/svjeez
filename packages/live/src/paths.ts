const EXTENSIONS = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  "/index.tsx",
  "/index.ts",
  "/index.jsx",
  "/index.js",
];

/** A file name as the canonical path of a module: one leading `/`, no `./`. */
export const canonical = (name: string): string => `/${name.replace(/^(?:\.?\/)+/, "")}`;

/** `./a/../b` from `/x` as `/x/b`, or undefined when it climbs out of the root. */
const joined = (from: string, relative: string): string | undefined => {
  const parts = from.split("/").slice(0, -1);

  for (const part of relative.split("/")) {
    if (part === "..") {
      if (parts.length <= 1) return undefined;
      parts.pop();
    } else if (part !== "." && part !== "") parts.push(part);
  }

  return parts.join("/");
};

export const isRelative = (name: string): boolean =>
  name.startsWith("./") || name.startsWith("../");

/** The canonical path a relative import from `from` reaches, with or without its extension, or undefined when no file is there. */
export const resolveRelative = (
  has: (path: string) => boolean,
  from: string,
  specifier: string,
): string | undefined => {
  const base = joined(from, specifier);

  return base === undefined
    ? undefined
    : [base, ...EXTENSIONS.map((e) => base + e)].find((path) => has(path));
};
