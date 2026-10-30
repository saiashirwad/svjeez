import { describe, expect, test } from "bun:test";
import { rect, render } from "svjeez";
import {
  Arrow,
  Brace,
  Callout,
  Marker,
  Underline,
  defaultDark,
  flow,
  tomorrow,
} from "svjeez/extras";

describe("accent color", () => {
  const scene = (node: ReturnType<typeof Marker>) =>
    render({ width: 100, height: 100, duration: 4, title: "accent" }, node);

  const [span, box] = [{ at: 0, over: 2 }, rect(10, 10, 30, 20)];

  const items = {
    Marker: (theme) => Marker({ theme, stops: [{ during: span, target: box }] }),
    Arrow: (theme) => Arrow({ theme, from: { x: 0, y: 0 }, to: { x: 50, y: 50 }, during: span }),
    Callout: (theme) => Callout({ theme, target: box, during: span, children: "hi" }),
    Brace: (theme) => Brace({ theme, target: box, during: span }),
    Underline: (theme) => Underline({ theme, target: box, during: span }),
    flow: (theme) =>
      flow(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        { theme, at: 0 },
      ).node,
  } satisfies Record<string, (theme?: typeof tomorrow) => ReturnType<typeof Marker>>;

  for (const [name, make] of Object.entries(items)) {
    test(`${name} takes its default color from the theme's base09`, () => {
      expect(scene(make(undefined))).toContain(defaultDark.base09);
      expect(scene(make(tomorrow))).toContain(tomorrow.base09);
      expect(scene(make(tomorrow))).not.toContain("#f6c96b");
    });
  }
});
