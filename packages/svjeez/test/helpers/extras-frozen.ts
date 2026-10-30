import { rect, render } from "svjeez";
import { Marker } from "svjeez/extras";

/** The value of `prop` that the CSS freeze shows at `percent`, read from the element's keyframes. */
export const frozen = (svg: string, element: RegExp, prop: string, percent: number): string => {
  const cls = svg.match(element)?.[1];
  const names = svg.match(new RegExp(`\\.${cls}\\{animation-name:([\\w,-]+)`))![1]!.split(",");

  for (const name of names) {
    const body = svg.match(new RegExp(`@keyframes ${name}\\{(.*)\\}$`, "m"))![1]!;

    const keys = [...body.matchAll(/([\d.%,]+)\{([^}]*)\}/g)].flatMap(([, at, block]) =>
      at!.split(",").map((p) => ({
        at: parseFloat(p),
        value: block!.match(new RegExp(`(?:^|;)${prop}:([^;]+)`))?.[1],
      })),
    );

    const sorted = keys.sort((a, b) => a.at - b.at);
    const before = sorted.findLast((k) => k.at <= percent);
    const after = sorted.find((k) => k.at >= percent);

    if (before?.value !== undefined && before.value === after?.value) return before.value;
  }

  throw new Error(`${prop} is not holding at ${percent}%`);
};

export const frozenMarker = (): string =>
  render(
    { width: 100, height: 100, duration: 6, title: "Marker", reducedMotion: { at: 4 } },
    Marker({
      stops: [
        { during: { at: 0, over: 1 }, target: rect(0, 0, 10, 20) },
        { during: { at: 2, over: 1 }, target: rect(10, 10, 30, 40) },
      ],
    }),
  );
