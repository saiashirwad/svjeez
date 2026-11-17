import { compile } from "@tailwindcss/node";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const decode = (text: string) =>
  text.replace(
    /&(amp|gt|lt|quot|#x27|#39);/g,
    (_, e: string) => ({ amp: "&", gt: ">", lt: "<", quot: '"', "#x27": "'", "#39": "'" })[e]!,
  );

export const tailwind = async (html: readonly string[]): Promise<string> => {
  const dir = dirname(fileURLToPath(import.meta.url));

  const compiler = await compile(readFileSync(join(dir, "theme.css"), "utf8"), {
    base: dir,
    onDependency: () => {},
  });

  const candidates = new Set(
    html.flatMap((page) =>
      [...page.matchAll(/class="([^"]*)"/g)].flatMap((m) => decode(m[1]!).split(/\s+/)),
    ),
  );

  return compiler.build([...candidates]);
};
