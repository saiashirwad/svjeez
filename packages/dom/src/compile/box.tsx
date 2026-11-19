/** @jsxImportSource svjeez */
import { Group, type SceneElement } from "svjeez";
import type { Common } from "svjeez/tools";
import type { ElementNode, Rect } from "../schema.ts";
import type { Context } from "./context.ts";
import { BIG, add, innerRadii, inset, outline, sub, type Radii, type Vec } from "./geometry.ts";
import { image } from "./image.tsx";
import { backgrounds, border, outlineOf, shadows, widthsOf, type Where } from "./paint.tsx";
import { isElement, type Paired } from "./pair.ts";
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

/**
 * An element as a group in its own frame: the origin of its transform, or its top-left corner without one.
 * `parent` is the parent's frame, in page coordinates, so every rect inside is measured from it.
 */
export const element = (
  { node: el, key, children: kids }: Paired<ElementNode>,
  parent: Vec,
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

  const content: SceneElement[] = [];

  for (const kid of kids)
    if (kid.node.type === "text") content.push(...text(kid.node, origin, kid.key, ctx));
    else if (isElement(kid)) content.push(element(kid, origin, `${path}/${kid.key}`, ctx));

  // The names the compiler gives its own parts start with "@", which no sibling key does.
  if (el.image) {
    const drawn = image(el.image, padding.box, "@image", `${path}/image`, ctx);

    if (drawn) content.unshift(drawn);
  }

  if (el.svg) content.unshift(vector(el.svg, padding.box, "@svg", `${path}/svg`, ctx));

  const cut = el.clip && padding.box.width > 0 && padding.box.height > 0;
  const forced = !cut && ctx.clips.has(path);
  const open = { x: -BIG, y: -BIG, width: BIG * 2, height: BIG * 2 };

  const clipBox: Rect = cut
    ? {
        x: el.clip!.x ? padding.box.x : -BIG,
        y: el.clip!.y ? padding.box.y : -BIG,
        width: el.clip!.x ? padding.box.width : BIG * 2,
        height: el.clip!.y ? padding.box.height : BIG * 2,
      }
    : forced
      ? open
      : padding.box;

  const children: SceneElement[] = [
    ...(cast?.below ?? []),
    ...backgrounds(el.background, el.backgrounds, where),
    ...(lit?.above ?? []),
    ...(el.border ? border(el.border, where) : []),
    ...(content.length > 0 && (cut || forced)
      ? [
          <Group key="@content" clip={outline(clipBox, forced ? undefined : padding.radii)}>
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
      {/* Pass 6 hangs an element's animations (`track()`) on this group, so they never collide with the lanes a morph drives on the group around it. */}
      <Group key="@track">{children}</Group>
    </Group>
  );
};
