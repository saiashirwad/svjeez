import { expect, test } from "bun:test";
import {
  breed,
  FIRST,
  mutate,
  numberSpec,
  parseGenome,
  random,
  specimenNo,
  withChoice,
  withGene,
} from "./genome";

test("a saved genome reads back as the same specimen", () => {
  const g = random();
  expect(parseGenome(JSON.parse(JSON.stringify(g)))).toEqual(g);
  expect(specimenNo(parseGenome(JSON.parse(JSON.stringify(FIRST)))!)).toBe(specimenNo(FIRST));
});

test("saved numbers are clamped and missing genes take the first specimen's", () => {
  const g = parseGenome({ length: 99, girth: -4, heads: 3 })!;
  expect(g.length).toBe(numberSpec("length").max);
  expect(g.girth).toBe(numberSpec("girth").min);
  expect(g.heads).toBe(3);
  expect(g.legs).toBe(FIRST.legs);
});

test("anything else in storage is dropped", () => {
  for (const bad of [
    null,
    5,
    "s",
    [],
    { seed: "x" },
    { length: "3" },
    { plan: "zzz" },
    { oid: 4 },
    { seed: -1 },
    { seed: 1.5 },
    { girth: NaN },
  ])
    expect(parseGenome(bad)).toBeUndefined();
});

test("a choice control accepts only that gene's options", () => {
  expect(withChoice(FIRST, "fur", "void").fur).toBe("void");
  expect(() => withChoice(FIRST, "fur", "plaid")).toThrow();
  expect(() => withChoice(FIRST, "length", "3")).toThrow();
});

test("mutation, breeding and rerolls stay inside every range", () => {
  for (let i = 0; i < 300; i++) {
    const g = i % 3 === 0 ? random() : i % 3 === 1 ? mutate(FIRST).genome : breed(FIRST, random());
    expect(parseGenome(g)).toEqual(g);
  }

  expect(withGene(FIRST, "length", 99).length).toBe(12);
});
