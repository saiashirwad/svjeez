import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { docs, read, root } from "../helpers/skill";

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sources(join(dir, entry.name))
      : entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
        ? [join(dir, entry.name)]
        : [],
  );

describe("skill docs", () => {
  test("every examples/ and references/ path they mention exists", () => {
    const mentioned = docs.flatMap((file) =>
      [...read(file).matchAll(/\b(examples|references)\/([\w-]+\.[\w]+)/g)].map(
        ([, dir, name]) => `${dir}/${name}`,
      ),
    );

    expect(mentioned.length).toBeGreaterThan(10);
    expect(mentioned.filter((path) => !existsSync(join(root, path)))).toEqual([]);
  });

  test("every reference is routed from SKILL.md", () => {
    const skill = read("SKILL.md");
    expect(docs.filter((file) => file !== "SKILL.md" && !skill.includes(file))).toEqual([]);
  });

  test("every runtime error in the error table is thrown somewhere in src", () => {
    const section = /\nRuntime errors[^\n]*\n([\s\S]*?)\n## /.exec(read("SKILL.md"))?.[1] ?? "";

    // `…` stands for a value the message fills in. A message with backticks is wrapped in double backticks.
    const quoted = [...section.matchAll(/^\| (`+) ?(.+?) ?\1 \|/gm)].flatMap((match) =>
      match[2] === "Message" ? [] : [match[2]!],
    );

    expect(quoted.length).toBeGreaterThan(10);

    const lines = sources(join(import.meta.dir, "../../src")).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .map((line) => line.replaceAll("\\`", "`")),
    );

    const missing = quoted.filter((message) => {
      const parts = message.split("…").filter(Boolean);

      return !lines.some((line) => parts.every((part) => line.includes(part)));
    });

    expect(missing).toEqual([]);
  });
});
