import { rosette } from "./lib/rosette";

// Wide cut: one card, the code on the left half and the flower on the right, split by a hairline.
export default () => rosette({ width: 1056, height: 392, fontSize: 14, code: { x: 56, y: 106 }, flower: { x: 816, y: 196, scale: 1 }, rule: { x1: 576, y1: 40, x2: 576, y2: 352 } });
