import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// docs/CRITERIA.md lists the criteria; each automated row owns packages/<package>/test/<ID>/.
const root = join(import.meta.dir, "../../../..");
const packages = join(root, "packages");

const rows = readFileSync(join(root, "docs/CRITERIA.md"), "utf8")
  .split("\n")
  .flatMap((line) => {
    const cells = line.match(/^\| ([RUX]-\d+) \|.*\| ([^|]+) \|$/);

    return cells ? [{ id: cells[1]!, instrument: cells[2]!.trim() }] : [];
  });

const ruleDirs = readdirSync(packages).flatMap((name) => {
  const dir = join(packages, name, "test");

  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[RUX]-\d+$/.test(entry.name))
    .map((entry) => ({ id: entry.name, path: join(dir, entry.name) }));
});

const automated = new Set(
  rows.filter((row) => row.instrument === "automated").map((row) => row.id),
);

const isTest = (file: string) => /\.(test|check)\.tsx?$/.test(file);

describe("CRITERIA.md", () => {
  test("lists rows", () => {
    expect(rows.length).toBeGreaterThan(100);
  });

  test("gives each ID one row", () => {
    const seen = new Set<string>();
    const repeated = rows.filter((row) => seen.size === seen.add(row.id).size).map((row) => row.id);

    expect(repeated).toEqual([]);
  });

  test("states every instrument in one of the four forms", () => {
    const valid = (instrument: string) =>
      ["automated", "not yet covered", "retired"].includes(instrument) ||
      /^manual — \S/.test(instrument);

    expect(rows.filter((row) => !valid(row.instrument))).toEqual([]);
  });

  test("gives every automated row a test directory with a test in it", () => {
    const covered = new Set(
      ruleDirs.filter((dir) => readdirSync(dir.path).some(isTest)).map((dir) => dir.id),
    );

    expect([...automated].filter((id) => !covered.has(id))).toEqual([]);
  });

  test("has a test directory only for automated rows", () => {
    expect(
      ruleDirs
        .filter((dir) => !automated.has(dir.id))
        .map((dir) => dir.path.slice(root.length + 1)),
    ).toEqual([]);
  });
});
