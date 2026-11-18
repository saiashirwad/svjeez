import type { SceneNode } from "./ir";

const KINDS = {
  group: "Group",
  shape: "Shape",
  text: "Text",
  image: "Image",
  instance: "Instance",
} as const;

export const tagOf = (kind: SceneNode["kind"]): string => `<${KINDS[kind]}>`;

export const nodeName = (node: SceneNode): string => {
  if (node.name !== undefined) return node.name;
  const last = node.key.split("/").at(-1) ?? "";

  return /^\d+$/.test(last) || last === "root" ? tagOf(node.kind) : `${tagOf(node.kind)} "${last}"`;
};
