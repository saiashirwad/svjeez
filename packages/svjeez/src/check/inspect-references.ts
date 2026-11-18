import { walkScene } from "../model/walk";
import { add, type Survey } from "./inspect-context";

export const unusedSymbols = (survey: Survey): void => {
  const used = new Set<string>();

  walkScene(survey.scene, (node) => {
    if (node.kind === "instance") used.add(node.symbol);
  });

  for (const [name, root] of Object.entries(survey.scene.symbols))
    if (!used.has(name))
      add(survey, {
        code: "unused-symbol",
        severity: "info",
        key: root.key,
        message: `The symbol "${name}" is never drawn: no instance uses it.`,
        hint: `Draw it with <Instance symbol={...} />, or remove it.`,
      });
};

export const unattachedRefs = (survey: Survey): void => {
  const { root, authored } = survey.scene;

  for (const { key, attached } of authored?.refs ?? []) {
    if (attached) continue;
    add(survey, {
      code: "unattached-ref",
      severity: "warning",
      key: root.key,
      message: `ref "${key}" is made, but no node takes it as ref={…}, so it points at nothing.`,
      hint: "Give the node it is for ref={…}, or remove the ref.",
    });
  }
};
