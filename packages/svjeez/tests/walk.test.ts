import { expect, test } from "bun:test";
import type { GroupNode, InstanceNode, Scene, SceneNode } from "../src/model/ir";
import { walkScene } from "../src/model/walk";

const base = {
  at: [0, 0],
  origin: [0, 0],
  box: { x: 0, y: 0, width: 0, height: 0 },
  layers: [],
  effects: [],
} as const;

const group = (key: string, children: SceneNode[] = [], mask?: SceneNode): GroupNode => ({
  ...base,
  kind: "group",
  key,
  children,
  mask,
});

const instance = (key: string, mask?: SceneNode): InstanceNode => ({
  ...base,
  kind: "instance",
  key,
  symbol: "used",
  mask,
});

test("walks children before masks, then visits declared symbols without expanding instances", () => {
  const scene: Scene = {
    size: [10, 10],
    duration: 0,
    title: "Traversal",
    loop: false,
    tokens: {},
    fonts: {},
    root: group(
      "root",
      [
        group("group", [instance("first use", group("instance mask"))], group("group mask")),
        instance("second use"),
      ],
      group("root mask", [group("mask child")], group("nested mask")),
    ),
    symbols: {
      used: group("used", [group("symbol child")], group("symbol mask")),
      unused: group("unused"),
    },
  };
  const visited: string[] = [];

  walkScene(scene, (node) => {
    visited.push(node.key);
  });

  expect(visited).toEqual([
    "root",
    "group",
    "first use",
    "instance mask",
    "group mask",
    "second use",
    "root mask",
    "mask child",
    "nested mask",
    "used",
    "symbol child",
    "symbol mask",
    "unused",
  ]);
});
