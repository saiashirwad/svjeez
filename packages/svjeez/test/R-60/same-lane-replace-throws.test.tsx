import { describe, expect, test } from "bun:test";
import { motion } from "svjeez";
import { spin, yaw } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("stacking", () => {
  test("two motions on one replace lane are an error", () => {
    const fill = (at: number) => motion().at(at).to({ fill: "#fff" }, 1);
    expect(() =>
      scene(<rect width={10} height={10} fill="#000" animation={[fill(1), fill(5)]} />),
    ).toThrow(/fill/);
  });
});

describe("properties", () => {
  test("a property lives on its element: two motions on it are an error", () => {
    expect(() =>
      scene(
        <g
          animation={[
            spin(),
            motion()
              .at(5)
              .to({ [yaw]: 0 }, 1),
          ]}
        />,
      ),
    ).toThrow(/--yaw:angle/);
  });
});
