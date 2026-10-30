import { readFileSync } from "node:fs";

export const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

export const zeroDurationScene = `import { motion, render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" }, <rect width={1} height={1} animation={motion({ x: 0 }).to({ x: 1 }, 0)} />);`;
