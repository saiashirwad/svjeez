/** @jsxImportSource svjeez */
import { Group, type SceneElement } from "svjeez";
import type { Common } from "svjeez/tools";
import type { ElementNode, Rect } from "../schema.ts";
import type { Context } from "./context.ts";
import { BIG, add, innerRadii, inset, outline, sub, type Radii, type Vec } from "./geometry.ts";
import { control } from "./control.tsx";
import { clipOf, filters, maskOf } from "./effects.tsx";
import { image } from "./image.tsx";
import { backgrounds, border, hides, outlineOf, shadows, widthsOf, type Where } from "./paint.tsx";
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
 * What `filter`, `clip-path` and `mask-image` do to everything the element draws, in CSS order: the filter first, the clip-path over it, then the mask.
 * Each is a group of its own, so the order is not up to a backend.
 */
const dressed = (el: ElementNode, drawn: SceneElement[], where: Where): SceneElement[] => {
  let out = drawn;

  if (el.filter) {
    const { effects, opacity } = filters(el.filter, where);

    if (effects.length > 0 || opacity !== 1)
      out = [
        <Group key="@filter" effects={effects} {...(opacity !== 1 && { opacity })}>
          {out}
        </Group>,
      ];
  }

  if (el.clipPath)
    out = [
      <Group key="@clip-path" clip={clipOf(el.clipPath, [where.box.x, where.box.y])}>
        {out}
      </Group>,
    ];

  if (el.masks)
    out = [
      <Group key="@mask" mask={maskOf(el.masks, where)}>
        {out}
      </Group>,
    ];

  return out;
};

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

  for (const note of el.notes ?? []) ctx.note(path, note);

  const radii: Radii | undefined = el.radii;
  const where: Where = { box, radii, path, ctx };

  const widths = widthsOf(el.border);
  const padding = { box: inset(box, widths), radii: innerRadii(radii, widths) };

  const motion = ctx.motions.get(path);

  const placed = transform && !motion?.transform ? decompose(transform.matrix) : undefined;

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
    if (kid.node.type === "text")
      content.push(...text(kid.node, origin, kid.key, `${path}/${kid.key}`, ctx));
    else if (isElement(kid)) content.push(element(kid, origin, `${path}/${kid.key}`, ctx));

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

  const drawn: SceneElement[] = [
    ...(cast?.below ?? []),
    ...backgrounds(
      el.background,
      el.backgrounds,
      where,
      motion?.fill,
      hides(el.border) ? padding.box : undefined,
    ),
    ...(lit?.above ?? []),
    ...(el.border ? border(el.border, where) : []),
    ...(el.control ? control(el.control, padding.box, ctx) : []),
    ...(content.length > 0 && (cut || forced)
      ? [
          <Group key="@content" clip={outline(clipBox, forced ? undefined : padding.radii)}>
            {content}
          </Group>,
        ]
      : content),
    ...(el.outline ? outlineOf(el.outline, where) : []),
  ];

  const children = dressed(el, drawn, where);

  const turned =
    placed &&
    (placed.rotate !== 0 || placed.scale[0] !== 1 || placed.scale[1] !== 1 || placed.skew !== 0);

  return (
    <Group
      key={key}
      offset={add(sub(origin, parent), placed?.translate ?? [0, 0])}
      {...(turned && {
        origin: "at",
        rotate: placed.rotate,
        scale: placed.scale,
        skew: placed.skew,
      })}
      {...(el.opacity !== undefined && !motion?.opacity && { opacity: el.opacity })}
      {...(blend && { blend })}
    >
      <Group
        key="@track"
        {...(motion?.transform && { origin: "at" as const, ...motion.transform })}
        {...(motion?.opacity && { opacity: motion.opacity })}
      >
        {children}
      </Group>
    </Group>
  );
};
