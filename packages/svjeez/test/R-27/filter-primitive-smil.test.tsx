import { describe, expect, test } from "bun:test";
import { boil } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("effects", () => {
  test("a filter primitive channel compiles to SMIL", () => {
    const svg = scene(<rect width={10} height={10} filter={boil()} />);
    expect(svg).toContain('<animate attributeName="seed" ');
  });
});
