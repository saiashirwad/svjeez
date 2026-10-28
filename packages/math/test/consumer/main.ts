import { tex, type Glyph, type Tex } from "@svjeez/math";
import { render, type Rect } from "svjeez";
import { morph } from "svjeez/extras";

const square: Tex = tex(String.raw`(a+b)^2`, { x: 20, y: 20, fontSize: 40 });
const expanded: Tex = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, { x: 20, y: 20, fontSize: 40 });
const first: Glyph | undefined = expanded.words[0];

export const svg: string = render({ width: 400, height: 120, duration: 4, title: "Math" }, [
  morph([square, expanded], { at: [1], over: 1 }).node,
]);

export const cross: Rect = expanded.get("mid");
export const key: string | undefined = first?.text;
