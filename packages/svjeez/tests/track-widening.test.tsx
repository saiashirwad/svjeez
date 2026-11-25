import { expect, test } from "bun:test";
import { span, track, type Anim } from "svjeez";

test("a track of a literal const widens to its primitive", () => {
  const p = { monthly: ["$12", "$24"], yearly: ["$120", "$240"] } as const;
  const state = "CLOSED" as const;

  const price: Anim<string> = track(p.monthly[0]).set(p.yearly[0], span(2, 0));
  const status: Anim<string> = track(state).set("SYN_SENT", span(0, 1));
  const n: Anim<number> = track(1 as const).to(2, span(0, 1));

  expect([price, status, n].length).toBe(3);
});
