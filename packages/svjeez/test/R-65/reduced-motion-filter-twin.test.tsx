import { describe, expect, test } from "bun:test";
import { boil } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("effects", () => {
  test("a filter primitive channel gets a still twin for reduced motion", () => {
    const svg = scene(<rect width={10} height={10} filter={boil()} />);
    expect(svg).toContain('<filter id="f1s"');
    expect(svg).toContain('[filter="url(#f1)"]{filter:url(#f1s)}');
  });
});
