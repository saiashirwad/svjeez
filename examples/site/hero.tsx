import { day } from "./lib/day";

// Wide cut: the code on columns 1 to 6, the sky on 7 to 12 of the site's grid.
export default () => day({ name: "wide", width: 1056, height: 392, fontSize: 13, code: { x: 8, y: 41 }, panel: { x: 540, y: 0, w: 516, h: 392 }, horizon: 0.8, scale: 1 });
