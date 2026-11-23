/** @jsxImportSource svjeez */
import { Group, Picture, picture, type SceneElement } from "svjeez";
import type { ImageContent, Rect } from "../schema.ts";
import type { Context } from "./context.ts";
import { outline } from "./geometry.ts";

/** The bytes of a `data:` URL, or undefined for anything else. */
export const bytesOf = (src: string): Uint8Array | undefined => {
  const data = /^data:([^,]*),(.*)$/s.exec(src);

  if (!data) return undefined;

  const [, head = "", body = ""] = data;

  try {
    return head.endsWith(";base64")
      ? Uint8Array.from(atob(decodeURIComponent(body)), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(body));
  } catch {
    return undefined;
  }
};

/** Where `object-position` puts one axis: its share of the free space. */
const along = (word: string | undefined, free: number, start: string, end: string): number => {
  if (word === undefined || word === "center") return free / 2;

  if (word === start) return 0;

  if (word === end) return free;

  return word.endsWith("%") ? (free * parseFloat(word)) / 100 : parseFloat(word) || 0;
};

/** An `<img>` as a Picture, sized and placed in `box` by object-fit and object-position. */
export const image = (
  content: ImageContent,
  box: Rect,
  key: string,
  path: string,
  ctx: Context,
): SceneElement | undefined => {
  const bytes = bytesOf(content.src);

  if (!bytes) {
    ctx.note(
      path,
      `an <img> whose src is not a data: URL is not drawn (${content.src.slice(0, 60)})`,
    );

    return undefined;
  }

  let src: ReturnType<typeof picture>;

  try {
    src = picture(bytes);
  } catch (error) {
    ctx.note(
      path,
      `an <img> that svjeez could not read is not drawn (${error instanceof Error ? error.message : String(error)})`,
    );

    return undefined;
  }

  const [nw, nh] = [content.width || src.width, content.height || src.height];
  const contain = Math.min(box.width / nw, box.height / nh);

  const scale =
    content.objectFit === "contain"
      ? contain
      : content.objectFit === "cover"
        ? Math.max(box.width / nw, box.height / nh)
        : content.objectFit === "none"
          ? 1
          : content.objectFit === "scale-down"
            ? Math.min(1, contain)
            : undefined;

  const [width, height] = scale === undefined ? [box.width, box.height] : [nw * scale, nh * scale];
  const [px, py] = content.objectPosition.split(/\s+/);

  const drawn = (
    <Picture
      key={scale !== undefined && (width > box.width || height > box.height) ? "picture" : key}
      src={src}
      fit="fill"
      width={width}
      height={height}
      at={[
        box.x + along(px, box.width - width, "left", "right"),
        box.y + along(py ?? px, box.height - height, "top", "bottom"),
      ]}
    />
  );

  // A picture that overflows its box (cover, none) is cut to it.
  return width > box.width || height > box.height ? (
    <Group key={key} clip={outline(box)}>
      {drawn}
    </Group>
  ) : (
    drawn
  );
};
