import { describe, expect, test } from "bun:test";
import { motion, nest, prefixed, render } from "svjeez";
import { renderFrames } from "svjeez/frames";

const fade = () =>
  render(
    { width: 20, height: 20, duration: 2, title: "Fade", reducedMotion: false },
    <rect
      width={20}
      height={20}
      fill="#000"
      animation={motion({ opacity: 0 }).at(0.5).to({ opacity: 1 }, 1)}
    />,
  );

describe("prefixed", () => {
  test("gives every render inside it the prefix, and an explicit one wins", () => {
    expect(prefixed("b", fade)).toContain(".ba{animation-duration");
    expect(
      prefixed("b", () =>
        render({ width: 1, height: 1, duration: 1, title: "T", prefix: "c" }, <rect />),
      ),
    ).toContain('id="ct"');
  });

  test("restores the outer prefix after a throw", () => {
    expect(() =>
      prefixed("b", () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(fade()).toContain(".a{animation-duration");
  });
});

describe("nest", () => {
  test("throws on a scene rendered without a prefix", () => {
    expect(() => nest(fade())).toThrow("nest() needs a scene rendered with a prefix");
  });

  test("draws the scene as a child svg at the size asked for", () => {
    const outer = render(
      { width: 100, height: 40, duration: 2, title: "Pair" },
      <>{nest(prefixed("b", fade), { x: 50, width: 40 })}</>,
    );

    expect(outer).toContain('<svg x="50" y="0" width="40" height="40" viewBox="0 0 20 20">');
  });

  test("two copies side by side both keep animating", async () => {
    const pair = render(
      { width: 40, height: 20, duration: 2, title: "Pair" },
      <>
        {nest(prefixed("l", fade))}
        {nest(prefixed("r", fade), { x: 20 })}
      </>,
    );
    const { frames } = await renderFrames(pair, { times: [0, 1.8], background: "#fff" });

    // A nested SVG that froze would draw the same white square at both times.
    expect(frames[0]!.png).not.toEqual(frames[1]!.png);
  });
});
