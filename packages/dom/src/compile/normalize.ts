import type { SceneElement } from "svjeez";
import { BIG, outline } from "./geometry.ts";

type Node = Extract<SceneElement, { type: "group" | "shape" | "text" | "picture" }>;

const isNode = (el: SceneElement): el is Node =>
  el.type === "group" || el.type === "shape" || el.type === "text" || el.type === "picture";

const keyOf = (el: Node): string => el.props.key ?? "";

/** What morph() needs equal for two nodes to blend, and the effects, which it only needs to agree in kind. */
const traits = (el: Node) => {
  const { blend, effects } = el.props;
  const stroke = el.type === "shape" ? el.props.stroke : undefined;
  const geometry = el.type === "shape" ? el.props.geometry : undefined;
  const holes = !!geometry && "rule" in geometry && geometry.rule === "evenodd";

  const base = JSON.stringify([
    el.type,
    blend ?? "normal",
    stroke && [stroke.cap, stroke.join, stroke.dash, stroke.fixedWidth, stroke.under],
    holes,
    el.type === "picture" && [
      el.props.src.href,
      el.props.width,
      el.props.height,
      el.props.fit,
      el.props.focus,
      el.props.zoom,
    ],
  ]);

  return { base, effects: (effects ?? []).map((effect) => effect.kind).join() };
};

const NO_CLIP = outline({ x: -BIG, y: -BIG, width: BIG * 2, height: BIG * 2 });

/**
 * Makes the same-keyed nodes of the states blendable, for the things morph() throws on. Where two states' node with one key differs in
 * kind, blend mode, stroke style, picture or effect kinds, they become two nodes (one leaves, one enters). A clip that some
 * states lack becomes a clip that cuts nothing, and effects that some states lack stay as they are: morph() blends those in.
 */
export const normalize = (states: readonly SceneElement[]): SceneElement[] =>
  align(states.map((state) => [state])).map((list) => list[0]!);

const align = (lists: readonly (readonly SceneElement[])[]): SceneElement[][] => {
  const found = new Map<string, (Node | undefined)[]>();

  lists.forEach((list, s) => {
    for (const el of list)
      if (isNode(el)) {
        const at = found.get(keyOf(el)) ?? lists.map(() => undefined);

        at[s] = el;
        found.set(keyOf(el), at);
      }
  });

  const made = new Map<SceneElement, SceneElement>();

  for (const [key, nodes] of found) {
    const variants: { base: string; effects: string }[] = [];

    const variantOf = (el: Node): number => {
      const { base, effects } = traits(el);

      let at = variants.findIndex(
        (one) => one.base === base && (!effects || !one.effects || one.effects === effects),
      );

      if (at < 0) at = variants.push({ base, effects }) - 1;
      else if (!variants[at]!.effects) variants[at] = { base, effects };

      return at;
    };

    const of = nodes.map((el) => el && variantOf(el));

    variants.forEach((_, v) => {
      const members = nodes.map((el, s) => (of[s] === v ? el : undefined));
      const clipped = members.some((el) => el?.props.clip !== undefined);
      const kids = align(members.map((el) => (el?.type === "group" ? el.children : [])));

      members.forEach((el, s) => {
        if (!el) return;

        const props = {
          ...el.props,
          ...(v > 0 && { key: `${key}!${v}` }),
          ...(clipped && el.props.clip === undefined && { clip: NO_CLIP }),
        };

        const next = { ...el, props, ...(el.type === "group" && { children: kids[s]! }) };

        // SAFETY: only key and clip change, and both are on every kind's props.
        made.set(el, next as SceneElement);
      });
    });
  }

  return lists.map((list) => list.map((el) => made.get(el) ?? el));
};
