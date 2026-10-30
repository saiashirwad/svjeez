import { render, type Motion } from "svjeez";

export const scene = (animation: Motion<"d">, reducedMotion?: false) =>
  render(
    { width: 100, height: 100, duration: 4, title: "Test", reducedMotion },
    <path d="M0 0H10V10Z" animation={animation} />,
  );

export const commands = (d: string) => d.replace(/[^A-Za-z]/g, "");
