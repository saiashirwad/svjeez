import { describe, expect, test } from "bun:test";
import { choice, count } from "svjeez/params";
import { valuesOf } from "../../src/controls";
import { parse } from "../../src/source";

describe("valuesOf", () => {
  const scene = `export const params = {
  look: choice("circle", ["circle", "square"]),
  n: count(3, { min: 1, max: 9 }),
};
export default () => <rect fill="#3EE6D6" opacity={0.5} label="hi" animation={enter({ at: 1 }, {}, ease.pop)} />;
`;

  const schema = {
    look: choice("circle", ["circle", "square"]),
    n: count(3, { min: 1, max: 9 }),
  };

  test("every number, color and ease is a value, a choice's string is one, other strings and options are not", () => {
    expect(valuesOf(parse(scene), schema).map((v) => [v.key, v.kind])).toEqual([
      ["params.look", "choice"],
      ["params.n", "number"],
      ["default#0", "color"],
      ["default#1", "number"],
      ["default#3", "number"],
      ["default#4", "ease"],
    ]);
  });

  test("a choice lists its options", () => {
    expect(valuesOf(parse(scene), schema)[0]).toMatchObject({ options: ["circle", "square"] });
  });

  test("a choice string is plain text until the schema says it is a choice", () => {
    expect(valuesOf(parse(scene)).some((v) => v.kind === "choice")).toBe(false);
  });
});
