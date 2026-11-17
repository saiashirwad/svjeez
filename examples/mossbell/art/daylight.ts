import { ease, motion, span } from "svjeez";

/** One day in Mossbell, in scene seconds. Every loop in the world divides it. */
export const DAY = 240;

/** The tint laid over the world with multiply: white by day, amber at dusk, blue at night, pink at dawn. */
export const daylight = motion({ fill: "#ffffff" })
  .to({ fill: "#ffd2a6" }, span(118, 20), ease.inOut)
  .to({ fill: "#7c86c8" }, span(138, 22), ease.inOut)
  .to({ fill: "#ffcdb8" }, span(204, 18), ease.inOut)
  .to({ fill: "#ffffff" }, span(222, 16), ease.inOut);

/** Opacity for anything that lights up at night: windows and lamps. */
export const nightGlow = motion({ opacity: 0 })
  .to({ opacity: 1 }, span(132, 20), ease.inOut)
  .to({ opacity: 0 }, span(206, 16), ease.inOut);

/** The hour of the day, from 0 up to 24, at a scene time. The day starts at seven in the morning. */
export const hourAt = (seconds: number): number => (7 + ((seconds % DAY) / DAY) * 24) % 24;
