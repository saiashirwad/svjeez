import { expect, test } from "bun:test";
import type { Key } from "../src/svg/keys";
import { cssGroups } from "../src/svg/css";
import { ease } from "../src/model/time";

const key = (t: number, opacity: number, e = ease.hold): Key => ({
  t,
  values: { opacity },
  ease: e,
});

// A swap at 4s of a 6s loop: 4/6 is 66.6667%, which a 3-place percent must not round past the swap.
test("a visibility step lands at or before its time and steps exactly", () => {
  const alone = (keys: Key[]) =>
    cssGroups([{ key: "opacity", emit: "visibility", keys, period: 6, snapped: 6 }])[0]!;

  const old = alone([key(0, 1), key(4, 0)]);
  const next = alone([key(0, 0), key(4, 1)]);

  expect(old.body).toBe("0%{visibility:visible}66.666%{visibility:hidden}");
  expect(next.body).toBe("0%{visibility:hidden}66.666%{visibility:visible}");
  expect(old.timing).toBe("steps(1)");
});
