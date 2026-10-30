import { describe, expect, test } from "bun:test";
import { browser } from "../helpers/frames-browser";
import { paintText, sans } from "../helpers/frames-font";
import { same } from "../helpers/frames";

describe.if(browser)("embedded fonts", () => {
  test("measure() matches the browser's layout, kerning included", async () => {
    const whole = await paintText(
      <text x={10} y={40} fontSize={28} fontFamily={sans}>
        To AVA
      </text>,
    );

    const split = await paintText(
      <>
        <text x={10} y={40} fontSize={28} fontFamily={sans}>
          To AV
        </text>
        <text
          x={10 + sans.measure("To AVA", 28) - sans.measure("A", 28)}
          y={40}
          fontSize={28}
          fontFamily={sans}
        >
          A
        </text>
      </>,
    );

    const unkerned = await paintText(
      <>
        <text x={10} y={40} fontSize={28} fontFamily={sans}>
          To AV
        </text>
        <text x={10 + sans.measure("To AV", 28)} y={40} fontSize={28} fontFamily={sans}>
          A
        </text>
      </>,
    );

    expect(same(whole, split)).toBe(true);
    expect(same(whole, unkerned)).toBe(false);
  });
});
