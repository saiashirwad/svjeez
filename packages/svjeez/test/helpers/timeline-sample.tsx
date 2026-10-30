import { ease, motion, render } from "svjeez";
import { openScene } from "svjeez/frames";

export const slide = motion({ x: 0 }).to({ x: 10 }, 1, ease.linear);

export const stack = [
  motion({ x: 0, y: 0 }).at(0.2).to({ x: 60, y: 20 }, 1, ease.inOut).to({ x: 10 }, 0.5, ease.pop),
  motion({ opacity: 1 }).to({ opacity: 0.2 }, 0.6, ease.in).loop(0.9),
];

export const times = [0.3, 0.75, 1.1, 1.45, 2.6];

/** What the browser draws for `stack` at each of `times`. */
export const drawnAt = async () => {
  const svg = render(
    { width: 100, height: 100, duration: 3, title: "Sample" },
    <rect id="box" width={10} height={10} animation={stack} />,
  );

  const page = await openScene(svg);

  try {
    const drawn = [];

    for (const time of times) {
      await page.capture(time);

      const at = await page.evaluate(() => {
        const box = document.querySelector("#box")!;
        let opacity = 1;

        for (let at: Element | null = box; at && at.tagName !== "svg"; at = at.parentElement)
          opacity *= Number(getComputedStyle(at).opacity);

        const { x, y } = box.getBoundingClientRect();

        return { x, y, opacity };
      }, undefined);

      drawn.push({ time, ...at });
    }

    return drawn;
  } finally {
    await page.close();
  }
};
