import { wiggle } from "svjeez";

export const invalid = [
  // @ts-expect-error wiggle needs a seed
  wiggle({ x: 2 }, { rate: 8 }),
];
