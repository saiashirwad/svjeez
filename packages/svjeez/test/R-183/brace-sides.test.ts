import { expect, test } from "bun:test";
import { rect, render } from "svjeez";
import { Brace } from "svjeez/extras";

test("a brace runs along the bottom or top of a target, and centers its label there", () => {
  const target = rect(100, 50, 80, 30);

  const draw = (side: "above" | "below") =>
    render(
      { width: 300, height: 200, duration: 4, title: "brace" },
      Brace({ target, side, label: "term", during: { at: 1, over: 2 } }),
    );

  const [below, above] = [draw("below"), draw("above")];
  expect(below).toContain('d="M100 88q0 8 8 8H132');
  expect(above).toContain('d="M100 42q0 -8 8 -8H132');
  expect(below).toMatch(/<text[^>]*x="140"[^>]*y="110"[^>]*>term/);
  expect(above).toMatch(/<text[^>]*x="140"[^>]*y="26"[^>]*>term/);
});
