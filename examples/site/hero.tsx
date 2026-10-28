import { rosette } from "./lib/rosette";

// Wide cut: code on columns 1 to 6, the scene on 7 to 12 of the site's grid.
export default () => rosette({ name: "wide", width: 1056, height: 392, fontSize: 13, code: { x: 0, y: 66 }, panel: { x: 540, y: 0, w: 516, h: 392 }, scale: 1 });
