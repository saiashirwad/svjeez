import { walkScene } from "../model/walk";
import { add, isGone, type Survey } from "./inspect-context";

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

export const hiddenTargets = (survey: Survey): void => {
  const byKey = new Map(survey.entries.map((entry) => [entry.node.key, entry]));
  const said = new Set<string>();

  for (const { verb, key } of survey.scene.authored?.actions ?? []) {
    const entry = byKey.get(key);

    if (!entry || !isGone(survey, entry) || said.has(`${verb}\u0000${key}`)) continue;
    said.add(`${verb}\u0000${key}`);
    add(survey, {
      code: "hidden-target",
      severity: "warning",
      key,
      message: `${verb} moves "${key}", which is never visible, so no one sees the move.`,
      hint: "Show the node at some time, or move the node that is seen.",
    });
  }
};
