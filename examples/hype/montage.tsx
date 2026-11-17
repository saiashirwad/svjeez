import { timeline } from "svjeez";
import { CODE } from "./editor";
import { dataShot } from "./data";
import { Shot } from "./kit";
import { mapShot } from "./map";
import { pipelineShot } from "./pipeline";
import { springShot } from "./spring";

/** Four shots, each composing two or more packages in one frame. */
export const SHOTS = timeline(
  { map: 5, pipeline: 5.2, spring: 4.6, data: 4.6 },
  { at: CODE.at + CODE.over },
);

export const MONTAGE = SHOTS.map.until(SHOTS.end);

export const montage = (
  <>
    <Shot {...SHOTS.map} enter="zoom" exit="rise">
      {mapShot(SHOTS.map.over)}
    </Shot>
    <Shot {...SHOTS.pipeline} enter="rise" exit="rise">
      {pipelineShot(SHOTS.pipeline.over)}
    </Shot>
    <Shot {...SHOTS.spring} enter="rise" exit="rise">
      {springShot(SHOTS.spring.over)}
    </Shot>
    <Shot {...SHOTS.data} enter="rise" exit="zoom">
      {dataShot()}
    </Shot>
  </>
);
