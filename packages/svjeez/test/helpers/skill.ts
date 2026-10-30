import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const root = join(import.meta.dir, "../../skills/svjeez");

export const docs = [
  "SKILL.md",
  ...readdirSync(join(root, "references")).map((name) => `references/${name}`),
];

export const read = (file: string): string => readFileSync(join(root, file), "utf8");
