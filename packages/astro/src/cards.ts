import { existsSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const EXTENSIONS = ["tsx", "ts", "jsx", "js"];

const first = (candidates: string[]) => candidates.find((candidate) => existsSync(candidate));

/**
 * A page's card: the file beside it (`_<page>.og.tsx`), else the nearest `_default.og.tsx` in its folder or a parent
 * folder, up to `pages`.
 */
export const cardBeside = (file: string, pages: string): string | undefined => {
  const name = basename(file, extname(file));
  const top = resolve(pages);
  let dir = resolve(dirname(file));

  const own = first(
    EXTENSIONS.flatMap((extension) => [`_${name}.og.${extension}`, `${name}.og.${extension}`]).map(
      (candidate) => join(dir, candidate),
    ),
  );

  if (own) return own;

  const inside = relative(top, dir);

  if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return undefined;

  for (;;) {
    const fallback = first(EXTENSIONS.map((extension) => join(dir, `_default.og.${extension}`)));

    if (fallback || dir === top) return fallback;
    dir = dirname(dir);
  }
};
