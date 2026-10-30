import { describe, expect, test } from "bun:test";
import { terminal } from "svjeez/extras";

describe("terminal", () => {
  const metrics = { x: 10, y: 20, fontSize: 10, lineHeight: 2, advance: 6 };

  test("a session stacks each command and its output, and ends after the last command types", () => {
    const shell = terminal([{ cmd: "ls", output: ["a", "b"] }, { cmd: "pwd" }], {
      ...metrics,
      at: 1,
      cps: 10,
      think: 0.5,
      gap: 0.5,
    });

    expect(shell.bounds).toMatchObject({ x: 10, y: 20, h: 80 });
    expect(shell.end).toBeCloseTo(1 + 0.4 + 0.5 + 0.12 + 0.5 + 0.5 + 0.5, 5);
    expect(() => terminal([])).toThrow();
  });
});

describe("errors name the call, the constraint and the value", () => {
  test.each([["terminal", () => terminal([]), "terminal() needs at least one command, got none."]])(
    "%s",
    (_, make, message) => {
      expect(make).toThrow(message);
    },
  );
});
