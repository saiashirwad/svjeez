import { describe, expect, test } from "bun:test";
import { render } from "svjeez";

describe("output", () => {
  const wellFormed = (svg: string) =>
    Bun.spawnSync(["xmllint", "--noout", "-"], { stdin: Buffer.from(svg) }).exitCode === 0;

  test.skipIf(!Bun.which("xmllint"))(
    "style text that is not XML-safe still makes a well-formed file",
    () => {
      const css = `@property --x{syntax:'<angle>';inherits:true;initial-value:0deg}\n.q::after{content:"]]>"}`;
      expect(
        wellFormed(
          render(
            { width: 10, height: 10, duration: 1, title: "T", css },
            <rect width={1} height={1} />,
          ),
        ),
      ).toBe(true);
    },
  );
});
