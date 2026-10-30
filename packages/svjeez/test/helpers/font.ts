import { font, render, type Child } from "svjeez";

export const fixture = (name: string) => new URL(`../fixtures/${name}.ttf`, import.meta.url);
export const sans = await font.load(fixture("ABeeZee-Regular"));
export const italic = await font.load(fixture("ABeeZee-Italic"));
export const mono = await font.load(fixture("SpaceMono-Regular"));
export const monoBold = await font.load(fixture("SpaceMono-Bold"));
export const black = await font.load(fixture("ArchivoBlack-Regular"));
export const jetbrains = await font.load(fixture("JetBrainsMono"));

export const scene = (child: Child) =>
  render({ width: 200, height: 100, duration: 1, title: "Fonts" }, child);

export const faces = (svg: string) =>
  [
    ...svg.matchAll(/@font-face\{font-family:([^;]+);[^}]*font-weight:(\d+);font-style:(\w+)\}/g),
  ].map((m) => `${m[1]} ${m[2]} ${m[3]}`);
