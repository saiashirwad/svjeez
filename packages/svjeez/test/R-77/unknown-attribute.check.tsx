import { el } from "svjeez";

export const invalid = [
  // @ts-expect-error misspelled attribute
  <path strokeLineCap="round" />,
  // @ts-expect-error misspelled attribute through el
  el.path({ strokeLineCap: "round" }),
];
