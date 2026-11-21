import { expect, test } from "bun:test";
import { join } from "node:path";

import { isSourceLookup, metrics, parseStream, svjeezCommand, type ToolInput } from "./parse.ts";

const ctx = { root: "/repo", dir: "examples/bench/x/orrery-haiku-1" };
const stream = parseStream(await Bun.file(join(import.meta.dir, "fixtures/trivial.jsonl")).text());

test("parses every line of a recorded stream", () => {
  expect(stream.map((event) => event.type)).toEqual([
    "system",
    "assistant",
    "assistant",
    "user",
    "assistant",
    "user",
    "assistant",
    "user",
    "assistant",
    "user",
    "assistant",
    "result",
  ]);
});

test("skips lines that are not JSON events", () => {
  expect(parseStream('warning: noise\n{"type":"result"}\n\n[1]\n')).toHaveLength(1);
});

test("counts the recorded run's tools, errors, checks and source lookups", () => {
  const m = metrics(stream, ctx);

  expect(m.finished).toBe(true);
  expect(m.isError).toBe(false);
  expect(m.tools).toEqual({ Read: 2, Bash: 1, Grep: 1 });
  expect(m.toolCalls).toBe(4);
  expect(m.toolErrors).toBe(1);
  expect(m.checkRuns).toBe(1);
  expect(m.frameLooks).toBe(0);
  // The missing examples/ file and the grep over packages/ are lookups; bench/tasks and the check are not.
  expect(m.sourceLookups).toBe(2);
  expect(m.turns).toBeGreaterThan(0);
  expect(m.costUsd).toBeGreaterThan(0);
  expect(m.durationMs).toBeGreaterThan(0);
  expect(m.report.length).toBeGreaterThan(0);
});

test("a stream cut off before its result event is not finished", () => {
  const m = metrics(
    stream.filter((event) => event.type !== "result"),
    ctx,
  );

  expect(m.finished).toBe(false);
  expect(m.isError).toBe(true);
  expect(m.toolCalls).toBe(4);
  expect(m.turns).toBeGreaterThan(0);
});

test("recognises the svjeez commands an agent runs", () => {
  expect(svjeezCommand("bun run scene check examples/a/index.tsx --json")).toBe("check");
  expect(svjeezCommand("bun run scene frames a --sheet")).toBe("frames");
  expect(svjeezCommand("bunx svjeez svg a.tsx")).toBe("svg");
  expect(svjeezCommand("bun run scene dev a")).toBeUndefined();
  expect(svjeezCommand("ls examples/checks")).toBeUndefined();
});

test("source lookups are library or other-example paths, not the run's own files", () => {
  expect(isSourceLookup("/repo/packages/svjeez/src/index.ts", ctx)).toBe(true);
  expect(isSourceLookup("examples/pendulum/index.tsx", ctx)).toBe(true);
  expect(isSourceLookup("/repo/examples/bench/x/orrery-haiku-1/index.tsx", ctx)).toBe(false);
  expect(isSourceLookup("/repo/.claude/skills/svjeez/SKILL.md", ctx)).toBe(false);
  expect(isSourceLookup("/repo/packages/svjeez/skills/svjeez/references/a.md", ctx)).toBe(false);
  expect(isSourceLookup("/elsewhere/x.ts", ctx)).toBe(false);
  expect(isSourceLookup("examples/theme.ts", ctx)).toBe(false);
  expect(isSourceLookup("examples/fonts/faces.ts", ctx)).toBe(false);
});

test("counts reads of PNGs as frame looks and shell reads as lookups", () => {
  const call = (name: string, input: ToolInput, id: string) => ({
    type: "assistant",
    message: { id, content: [{ type: "tool_use", id, name, input }] },
  });

  const m = metrics(
    [
      call("Read", { file_path: "/repo/out/sheet.png" }, "1"),
      call("Bash", { command: "rg frames packages | head" }, "2"),
      call("Bash", { command: "cat examples/bench/x/orrery-haiku-1/index.tsx" }, "3"),
      call("Grep", { pattern: "enter" }, "4"),
      call(
        "Bash",
        { command: "bun run scene frames examples/bench/x/orrery-haiku-1/index.tsx --sheet" },
        "5",
      ),
    ],
    ctx,
  );

  expect(m.frameLooks).toBe(1);
  expect(m.frameRuns).toBe(1);
  expect(m.sourceLookups).toBe(2);
});
