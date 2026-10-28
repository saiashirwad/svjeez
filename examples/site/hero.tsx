import { day } from "./lib/day";

// Wide cut: one editor window, the code on the left and the sky filling the right of its body.
export default () => day({ name: "wide", width: 1056, height: 432, fontSize: 13, code: { x: 36, y: 81 }, panel: { x: 528, y: 40, w: 528, h: 392 }, horizon: 0.8, scale: 1 });
