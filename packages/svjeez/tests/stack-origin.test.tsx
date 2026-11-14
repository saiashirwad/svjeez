import { describe, expect, test } from "bun:test";
import { ease, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";

const origin = { transformOrigin: "0 0", transformBox: "view-box" } as const;
const turn = (degrees: number) => motion({ rotate: 0 }).to({ rotate: degrees }, 1, ease.linear);

const scene = (animation: readonly ReturnType<typeof turn>[]) =>
  render(
    { width: 40, height: 40, duration: 2, title: "Turn", reducedMotion: false },
    <g transform="translate(20 20)">
      <rect x={4} y={-2} width={14} height={4} style={origin} animation={animation} />
    </g>,
  );

describe("a stack split into wrapper groups", () => {
  test("every wrapper keeps the element's transform-box and transform-origin instead of turning about its centre", () => {
    const svg = scene([turn(45), turn(45)]);

    expect(svg).toMatch(/<g style="transform-origin:0 0;transform-box:view-box" class="a m\d+">/);
    expect(svg).not.toContain("fb");
  });

  test("two 45 degree layers land where one 90 degree turn does", async () => {
    const { frames } = await renderFrames(scene([turn(45), turn(45)]), { times: [1.5] });
    const [single] = (await renderFrames(scene([turn(90)]), { times: [1.5] })).frames;
    expect(Buffer.from(frames[0]!.png).equals(Buffer.from(single!.png))).toBe(true);
  });
});
