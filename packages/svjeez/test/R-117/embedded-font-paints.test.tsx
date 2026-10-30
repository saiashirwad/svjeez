import { describe, expect, test } from "bun:test";
import { browser } from "../helpers/frames-browser";
import { paintText, sans } from "../helpers/frames-font";
import { same } from "../helpers/frames";

describe.if(browser)("embedded fonts", () => {
  test("an embedded font paints, rather than the fallback", async () => {
    const embedded = await paintText(
      <text x={10} y={40} fontSize={28} fontFamily={sans}>
        Wave AV
      </text>,
    );

    const fallback = await paintText(
      <text x={10} y={40} fontSize={28} fontFamily="sans-serif">
        Wave AV
      </text>,
    );

    expect(same(embedded, fallback)).toBe(false);
  });
});
