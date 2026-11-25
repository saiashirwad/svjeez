import { ease, scene, span, track, type Paint, type Vec } from "svjeez";
import { BLIP, Blip, Pivot } from "./blip";

const [crouch, rise, fall] = span(5.8, 0.14).chain(0.2, 0.2);

const hop = track<Vec>([0, 0])
  .to([0, 2], crouch, ease.out)
  .to([0, -5], rise, ease.out)
  .to([0, 0], fall, ease.in);

const [sag, lift, drop, settle] = span(5.94, 0.16).chain(0.22, 0.12, 0.45);

const bulb = track(0)
  .to(3, sag)
  .to(-2, lift, ease.inOut)
  .to(3, drop, ease.in)
  .to(0, settle, ease.pop);

const light = span(10.8, 0.15);

const glow = track<Paint>(BLIP.yellow).to("#FFEC99", light).to(BLIP.yellow, light.next(0.6, 0.25));

export default scene(
  {
    size: [208, 208],
    duration: 12,
    title: "Blip",
    desc: "Blip, the svjeez mascot, sits still, blinks, hops once with its antenna bulb wobbling, blinks twice and lights its bulb.",
    still: 0,
  },
  () => (
    <Pivot around={[104, 95.5]} at={[104, 104]} motion={{ scale: 1.4 }}>
      <Blip blinks={[2.6, 8.9, 9.25]} body={{ offset: hop }} bulb={bulb} glow={glow} />
    </Pivot>
  ),
);
