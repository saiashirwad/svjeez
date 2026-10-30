import { Once, def, ease, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";

export const restyleScene = (reducedMotion?: { at: number }) =>
  render(
    { width: 40, height: 20, duration: 4, title: "Restyle", reducedMotion },
    <>
      <rect
        width={40}
        height={20}
        fill="#3EE6D6"
        animation={motion({ opacity: 0 }).to({ opacity: 1 }, 4, ease.linear)}
      />
      <rect
        x={10}
        width={10}
        height={10}
        fill="#E64"
        animation={motion({ blur: 0 }).to({ blur: 4 }, 2, ease.linear)}
      />
    </>,
  );

export const paintAt = async (svg: string, time: number) =>
  (await renderFrames(svg, { times: [time], colorScheme: "light" })).frames[0]!.png;

/** Screenshots of the SVG shown as an `<img>`, the way a page shows it, after each wait in milliseconds. */
export const asImage = async (
  svg: string,
  waits: readonly number[],
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) => {
  const { chromium } = await import("playwright-core");
  const chrome = await chromium.launch();

  try {
    const page = await chrome.newPage({ viewport: { width: 40, height: 20 }, reducedMotion });
    const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    await page.setContent(`<style>body{margin:0}img{display:block}</style><img src="${src}">`);
    await page.evaluate(() => document.querySelector("img")!.decode());
    const shots: Uint8Array[] = [];

    for (const wait of waits) {
      await page.waitForTimeout(wait);
      shots.push(new Uint8Array(await page.screenshot()));
    }

    return shots;
  } finally {
    await chrome.close();
  }
};

const blurFilter = def.filter(
  { filterUnits: "userSpaceOnUse", x: 0, y: 0, width: 40, height: 20 },
  <feGaussianBlur stdDeviation={4} />,
);

export const onceScene = () => {
  const fade = (over: number) => motion({ opacity: 0 }).to({ opacity: 1 }, over, ease.linear);
  const blur = motion({ blur: 0 }).to({ blur: 4 }, 2, ease.linear);

  return render(
    { width: 40, height: 20, duration: 2, title: "Once" },
    <>
      <rect width={20} height={20} fill="#3EE6D6" animation={fade(2)} />
      <Once>
        <rect x={20} width={20} height={10} fill="#E64" animation={fade(1)} />
        <rect x={25} y={12} width={10} height={6} fill="#246" animation={blur} />
      </Once>
    </>,
  );
};

export const onceDrawn = (loop: number, once: number, deviation: number) =>
  render(
    { width: 40, height: 20, duration: 2, title: "Drawn" },
    <>
      <rect width={20} height={20} fill="#3EE6D6" opacity={loop} />
      <rect x={20} width={20} height={10} fill="#E64" opacity={once} />
      <rect
        x={25}
        y={12}
        width={10}
        height={6}
        fill="#246"
        filter={def.filter(
          { filterUnits: "userSpaceOnUse", x: 0, y: 0, width: 40, height: 20 },
          <feGaussianBlur stdDeviation={deviation} />,
        )}
      />
    </>,
  );

export const playsOnce = () =>
  render(
    { width: 40, height: 20, duration: 4, title: "Once", loop: false },
    <rect width={10} height={10} animation={motion({ blur: 0 }).to({ blur: 4 }, 4, ease.linear)} />,
  );

export const playsOnceEnded = () =>
  render(
    { width: 40, height: 20, duration: 4, title: "Ended" },
    <rect width={10} height={10} filter={blurFilter} />,
  );
