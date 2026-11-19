/** @jsxImportSource svjeez */
import { Group, type SceneElement } from "svjeez";
import type { Common } from "svjeez/tools";
import type { ElementNode, Node, Rect } from "../schema.ts";
import { keyer, type Context } from "./context.ts";
import { add, innerRadii, inset, outline, sub, type Radii, type Vec } from "./geometry.ts";
import { image } from "./image.tsx";
import { backgrounds, border, outlineOf, shadows, widthsOf, type Where } from "./paint.tsx";
import { text } from "./text.tsx";
import { decompose } from "./transform.ts";
import { vector } from "./vector.tsx";

type Blend = Exclude<Common["blend"], "normal" | undefined>;

const BLENDS: readonly Blend[] = [
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

const blendOf = (mode: string | undefined): Blend | undefined =>
  BLENDS.find((blend) => blend === mode);

const BIG = 1e5;

/** What an element is called next to its siblings, so the same element gets the same key capture after capture. */
export const nameOf = (node: Node, index: number): string =>
  node.type === "text"
    ? `text[${index}]`
    : (node.key ?? node.part ?? node.id ?? `${node.tag}[${index}]`);

/**
 * An element as a group in its own frame: the origin of its transform, or its top-left corner without one.
 * `parent` is the parent's frame, in page coordinates, so every rect inside is measured from it.
 */
export const element = (
  el: ElementNode,
  parent: Vec,
  key: string,
  path: string,
  ctx: Context,
): SceneElement => {
  const { rect, transform } = el;
  const origin: Vec = transform?.origin ?? [rect.x, rect.y];

  const box: Rect = {
    x: rect.x - origin[0],
    y: rect.y - origin[1],
    width: rect.width,
    height: rect.height,
  };

  const radii: Radii | undefined = el.radii;
  const where: Where = { box, radii, path, ctx };

  const widths = widthsOf(el.border);
  const padding = { box: inset(box, widths), radii: innerRadii(radii, widths) };

  const placed = transform && decompose(transform.matrix);

  // Skew is the one part of a 2D matrix core has no way to say.
  if (placed?.skew) ctx.note(path, `a skew of ${placed.skew.toFixed(1)} degrees is ignored`);

  if (el.animations?.length)
    ctx.note(path, "animations are not compiled; the layout shows the captured moment");

  const blend = blendOf(el.blendMode);

  if (el.blendMode && el.blendMode !== "normal" && !blend)
    ctx.note(path, `mix-blend-mode ${el.blendMode} is drawn as normal`);

  const cast = el.shadows
    ? shadows(
        el.shadows.filter((one) => !one.inset),
        where,
        padding,
      )
    : undefined;

  const lit = el.shadows
    ? shadows(
        el.shadows.filter((one) => one.inset),
        where,
        padding,
      )
    : undefined;

  const name = keyer();

  const content: SceneElement[] = [];

  el.children.forEach((child, i) => {
    const childKey = name(nameOf(child, i));

    if (child.type === "text") content.push(...text(child, origin, childKey, name, ctx));
    else content.push(element(child, origin, childKey, `${path}/${childKey}`, ctx));
  });

  if (el.image) {
    const drawn = image(el.image, padding.box, name("image"), `${path}/image`, ctx);

    if (drawn) content.unshift(drawn);
  }

  if (el.svg) content.unshift(vector(el.svg, padding.box, name("svg"), `${path}/svg`, ctx));

  const cut = el.clip && padding.box.width > 0 && padding.box.height > 0;

  const clipBox: Rect = cut
    ? {
        x: el.clip!.x ? padding.box.x : -BIG,
        y: el.clip!.y ? padding.box.y : -BIG,
        width: el.clip!.x ? padding.box.width : BIG * 2,
        height: el.clip!.y ? padding.box.height : BIG * 2,
      }
    : padding.box;

  const children: SceneElement[] = [
    ...(cast?.below ?? []),
    ...backgrounds(el.background, el.backgrounds, where),
    ...(lit?.above ?? []),
    ...(el.border ? border(el.border, where) : []),
    ...(content.length > 0 && cut
      ? [
          <Group key={name("content")} clip={outline(clipBox, padding.radii)}>
            {content}
          </Group>,
        ]
      : content),
    ...(el.outline ? outlineOf(el.outline, where) : []),
  ];

  const turned = placed && (placed.rotate !== 0 || placed.scale[0] !== 1 || placed.scale[1] !== 1);

  return (
    <Group
      key={key}
      offset={add(sub(origin, parent), placed?.translate ?? [0, 0])}
      {...(turned && { origin: "at", rotate: placed.rotate, scale: placed.scale })}
      {...(el.opacity !== undefined && { opacity: el.opacity })}
      {...(blend && { blend })}
    >
      {children}
    </Group>
  );
};
