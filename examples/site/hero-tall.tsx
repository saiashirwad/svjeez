import { rosette } from "./lib/rosette";

// Tall cut for phones: the scene on top, the code under it, set in a narrower measure so it stays readable at 358 wide.
export default () => rosette({ name: "tall", width: 358, height: 592, fontSize: 12, code: { x: 4, y: 320 }, panel: { x: 0, y: 0, w: 358, h: 296 }, scale: 0.85 });
