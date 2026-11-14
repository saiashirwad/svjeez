import { expect, test } from "bun:test";
import { kernTable } from "../src/font/subset";

test("kern pairs past one subtable go into the next and none are dropped", () => {
  const pairs = Array.from({ length: 25 }, (_, i) => [i, i + 1, -i - 1] as const);
  const table = new DataView(kernTable(pairs, 10)!.buffer);
  const pairCount = (at: number) => table.getUint16(at + 6);

  expect(table.getUint16(2)).toBe(3);

  const first = 4;
  const second = first + table.getUint16(first + 2);
  const third = second + table.getUint16(second + 2);

  expect([pairCount(first), pairCount(second), pairCount(third)]).toEqual([10, 10, 5]);
});

test("a full-size subtable's length fits its u16", () => {
  const pairs = Array.from({ length: 30_000 }, (_, i) => [i >> 8, i & 255, -1] as const);
  const table = new DataView(kernTable(pairs)!.buffer);

  expect(table.getUint16(2)).toBe(3);
  expect(table.getUint16(4 + 2)).toBe(14 + 6 * 10000);
});
