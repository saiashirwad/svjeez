import { expect, test } from "bun:test";
import { openScene } from "svjeez/frames";
import { Shape, rect, scene, span, track } from "svjeez";
import { isLane, svg, valueAt, type Model } from "svjeez/tools";

const lowered = scene({ size: [40, 40], duration: 2, title: "Default ease" }, () => (
  <Shape key="box" geometry={rect(40, 40)} fill="#000000" opacity={track(0).to(1, span(0, 2))} />
));

const { root } = lowered;

if (root.kind !== "group" || root.children[0]?.kind !== "shape")
  throw new Error("expected a shape");

const box = root.children[0];
const [layer] = box.layers;

if (!layer || !isLane(layer.opacity)) throw new Error("expected an opacity lane");

const { ease: _, ...bare } = layer.opacity.keys[1];

const opacity: Model.Lane<number> = {
  ...layer.opacity,
  keys: [layer.opacity.keys[0], bare],
};

const model: Model.Scene = {
  ...lowered,
  root: { ...root, children: [{ ...box, layers: [{ ...layer, opacity }] }] },
};

const times = [0.2, 0.5, 1, 1.5];

const drawn = await openScene(svg.emit(model)).then(
  async (opened) => {
    try {
      return await opened.evaluate((at: readonly number[]) => {
        const shape = document.querySelector("svg rect, svg path")!;

        return at.map((t) => {
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = t * 1000;
          }

          let seen = 1;

          for (let el: Element | null = shape; el && el.tagName !== "svg"; el = el.parentElement)
            seen *= Number(getComputedStyle(el).opacity);

          return seen;
        });
      }, times);
    } finally {
      await opened.close();
    }
  },
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping the default ease frame test: ${error.message.split("\n")[0]}`);

    return undefined;
  },
);

test.skipIf(!drawn)("a key with no ease samples as it is drawn", () => {
  times.forEach((t, i) => {
    expect(valueAt(opacity, t, (a, b, u) => a + (b - a) * u)).toBeCloseTo(drawn![i]!, 2);
  });
});
