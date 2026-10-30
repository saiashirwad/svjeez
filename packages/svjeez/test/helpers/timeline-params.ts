import { ease } from "svjeez";
import { choice, color, count, easing, seconds } from "svjeez/params";

export const params = {
  flowers: count(5, { min: 1, max: 12, label: "how many" }),
  stagger: seconds(0.18, { max: 0.4 }),
  petal: color("#FF5D8F"),
  rise: easing(ease.bezier(0.2, 0.8, 0.2, 1)),
  fur: choice("ginger", ["ginger", "grey"]),
};
