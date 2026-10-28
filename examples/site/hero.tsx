import { day } from "./lib/day";

// Wide cut: one editor window split down the middle, the code centered in the left half and inset like the traffic lights, the sky filling the right.
export default () => day({ name: "wide", width: 1056, height: 432, fontSize: 13, lineHeight: 1.7, code: { x: 20 }, panel: { x: 528, y: 40, w: 528, h: 392 }, horizon: 0.8, scale: 1 });
