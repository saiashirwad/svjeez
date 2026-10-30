import { describe, expect, test } from "bun:test";
import { matchPaths } from "svjeez";
import { commands } from "../helpers/paths";

describe("matchPaths", () => {
  test("grows a missing subpath from a point", () => {
    const [one, two] = matchPaths(["M0 0H10V10Z", "M0 0H10V10ZM20 20H30V30Z"]);

    expect(one!.match(/M/g)).toHaveLength(2);
    expect(commands(one!)).toBe(commands(two!));
    expect(one!).toContain("M25 25");
  });
});
