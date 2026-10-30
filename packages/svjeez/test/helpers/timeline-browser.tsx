import { render } from "svjeez";
import { renderFrames } from "svjeez/frames";

export const browser = await renderFrames(
  render({ width: 4, height: 4, duration: 1, title: "Probe" }, <rect width={4} height={4} />),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping frame tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);
