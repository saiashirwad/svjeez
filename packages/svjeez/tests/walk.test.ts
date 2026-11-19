import { expect, test } from "bun:test";
import type { GroupNode, Scene, SceneNode } from "../src/model/ir";
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

test("walks children before masks", () => {
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
        group("group", [group("child", [], group("child mask"))], group("group mask")),
        group("second"),
      ],
      group("root mask", [group("mask child")], group("nested mask")),
    ),
  };

  const visited: string[] = [];

  walkScene(scene, (node) => {
    visited.push(node.key);
  });

  expect(visited).toEqual([
    "root",
    "group",
    "child",
    "child mask",
    "group mask",
    "second",
    "root mask",
    "mask child",
    "nested mask",
  ]);
});
