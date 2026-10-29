import hero from "./hero";
import heroTall from "./hero-tall";
import { DEFAULT, type Feel, type Knobs, type Sky, type Speed } from "./lib/day";

// The toy controls under the home page hero. Each knob changes the numbers, eases or colors in the code the hero shows,
// and the sky it paints follows from the same values. The site builds every combination ahead of time and swaps the image.

export type { Feel, Knobs, Sky, Speed };

export { DEFAULT };

type Options<T> = readonly { readonly value: T; readonly label: string; readonly hint?: string }[];

export const KNOBS: {
  readonly [K in keyof Knobs]: { readonly label: string; readonly options: Options<Knobs[K]> };
} = {
  sky: {
    label: "Sky",
    options: [
      { value: "earth", label: "Earth", hint: "Today's sky, from peach dawn to indigo night" },
      { value: "mars", label: "Mars", hint: "Butterscotch noon, blue sunsets, a smaller sun" },
      {
        value: "sorbet",
        label: "Sorbet",
        hint: "Strawberry, mint and mango, with a cherry on top",
      },
    ],
  },
  feel: {
    label: "Feel",
    options: [
      {
        value: "smooth",
        label: "Smooth",
        hint: "The default ease: quick off the mark, gentle landing",
      },
      { value: "robot", label: "Robot", hint: "ease.linear everywhere, one constant speed" },
      { value: "bouncy", label: "Bouncy", hint: "ease.pop overshoots and springs back" },
    ],
  },
  speed: {
    label: "Speed",
    options: [
      { value: "snail", label: "Snail", hint: "Every duration doubled: a 20 second day" },
      { value: "normal", label: "Normal", hint: "A 10 second day" },
      { value: "rabbit", label: "Rabbit", hint: "Every duration halved: a 5 second day" },
    ],
  },
};

export const key = (k: Knobs): string => `${k.sky}-${k.feel}-${k.speed}`;

const all = KNOBS.sky.options.flatMap(({ value: sky }) =>
  KNOBS.feel.options.flatMap(({ value: feel }) =>
    KNOBS.speed.options.map(({ value: speed }): Knobs => ({ sky, feel, speed })),
  ),
);

export const VARIANTS: readonly {
  readonly key: string;
  readonly knobs: Knobs;
  readonly wide: () => string;
  readonly tall: () => string;
}[] = [DEFAULT, ...all.filter((k) => key(k) !== key(DEFAULT))].map((knobs) => ({
  key: key(knobs),
  knobs,
  wide: () => hero(knobs),
  tall: () => heroTall(knobs),
}));
