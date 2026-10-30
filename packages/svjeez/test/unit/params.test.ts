import { describe, expect, test } from "bun:test";
import { choice, defaults, number, type Handles } from "svjeez/params";

describe("params", () => {
  test("handles are typed by the schema: only number params, read from every value", () => {
    const schema = {
      length: number(100, { min: 50, max: 200 }),
      fur: choice("ginger", ["ginger", "grey"]),
    };

    const handles: Handles<typeof schema> = (p) => ({ length: { x: 0, y: p.length } });

    // @ts-expect-error a choice has no handle
    const wrong: Handles<typeof schema> = () => ({ fur: { x: 0, y: 0 } });

    expect(handles(defaults(schema)).length).toEqual({ x: 0, y: 100 });
    expect(wrong).toBeFunction();
  });
});
