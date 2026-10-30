import { describe, expect, test } from "bun:test";
import { css, render } from "svjeez";
import { spin, yaw } from "../helpers/compile-fixtures";

describe("properties", () => {
  test("css holes read a property by its render name", () => {
    const svg = render(
      { width: 10, height: 10, duration: 1, title: "T", css: css`.d{rotate:calc(${yaw} * ${2})}` },
      <g animation={spin()} />,
    );

    expect(svg).toContain(".d{rotate:calc(var(--p1) * 2)}");
  });
});
