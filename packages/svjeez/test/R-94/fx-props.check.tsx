import { fx } from "svjeez";

export const invalid = [
  // @ts-expect-error duotone takes hex colors, not named ones
  fx.duotone({ dark: "red", light: "#fff" }),
];
