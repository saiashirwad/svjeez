import { rosette } from "./lib/rosette";

// Tall cut for phones: the flower on top, a hairline, then the code in a narrower measure so it stays readable at 358 wide.
export default () => rosette({ width: 358, height: 560, fontSize: 11, code: { x: 20, y: 344 }, flower: { x: 179, y: 160, scale: 0.85 }, rule: { x1: 20, y1: 316, x2: 338, y2: 316 } });
