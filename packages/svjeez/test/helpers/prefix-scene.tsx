import { def, motion, render } from "svjeez";

export const scene = (prefix?: string) =>
  render(
    {
      width: 100,
      height: 100,
      duration: 4,
      title: "P",
      desc: "D",
      prefix,
      reducedMotion: { at: 1 },
    },
    <>
      <rect
        width={10}
        height={10}
        fill={def.linearGradient({}, [<stop offset={0} stopColor="#fff" />])}
        animation={motion({ opacity: 0, rotate: 0 }).at(1).to({ opacity: 1, rotate: 90 }, 1)}
      />
      <circle r={4} animation={motion({ blur: 0 }).at(2).to({ blur: 4 }, 1)} />
      <circle r={4} animation={motion({ scale: 1 }).at(2).to({ scale: 2 }, 1)} />
    </>,
  );

export const names = (svg: string) => {
  const source = svg.replace(/xmlns="[^"]*"/, "");
  const classes = [...source.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1]!.split(" "));

  const others = [
    ...source.matchAll(/(?:id="|url\(#|href="#|@keyframes |\.)([A-Za-z][\w-]*)/g),
  ].map((match) => match[1]!);

  const animationNames = [...source.matchAll(/animation-name:([^;}]*)/g)].flatMap((match) =>
    match[1]!.split(","),
  );

  return new Set([...classes, ...others, ...animationNames]);
};
