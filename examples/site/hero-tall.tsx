import { day } from "./lib/day";

// Tall cut for phones: the sky on top, the code under it, with the long lines broken so it stays readable at 358 wide.
export default () => day({ name: "tall", width: 358, height: 640, fontSize: 11.5, code: { x: 12, y: 296 }, panel: { x: 0, y: 0, w: 358, h: 272 }, horizon: 0.8, scale: 0.7 });
