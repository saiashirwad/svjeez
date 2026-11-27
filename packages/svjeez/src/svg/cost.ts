export interface Cost {
  /** Animations the browser runs at once, a SMIL window counting for the share of the loop it is open. */
  readonly animations: number;
  /** Area, in hundreds of square units, of filters redrawn every frame, for the share of the loop they are. */
  readonly repaint: number;
}

interface Tag {
  readonly name: string;
  readonly attrs: string;
  readonly children: Tag[];
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

const SMIL = new Set(["animate", "set", "animateTransform"]);

const treeOf = (svg: string): Tag => {
  const root: Tag = { name: "", attrs: "", children: [] };
  const stack = [root];

  for (const [whole, closing, name, attrs, selfClosing] of svg.matchAll(
    /<(\/?)([A-Za-z][\w:-]*)((?:[^>"]|"[^"]*")*?)(\/?)>/g,
  )) {
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const tag: Tag = { name: name!, attrs: whole!.slice(1 + name!.length), children: [] };

    stack.at(-1)!.children.push(tag);

    if (!selfClosing && attrs !== undefined) stack.push(tag);
  }

  return root;
};

/** How much of the loop a SMIL window is open. */
const shareOf = (tag: string): number => {
  const dur = Number.parseFloat(attr(tag, "dur") ?? "");
  const loop = Number.parseFloat(attr(tag, "data-loop") ?? "");

  return attr(tag, "repeatCount") === "indefinite" || !(dur > 0) || !(loop > 0)
    ? 1
    : Math.min(1, dur / loop);
};

/** What a page built from this SVG keeps busy: running animations, and the area of filters redrawn every frame. */
export const costOf = (svg: string): Cost => {
  const styles = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n");
  const markup = svg.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
  const counts = new Map<string, number>();

  for (const m of styles.matchAll(/\.([\w-]+)\{animation-name:([^;}]*)/g))
    counts.set(m[1]!, m[2]!.split(",").length);

  const classesOf = (tag: Tag): string[] =>
    (attr(tag.attrs, "class") ?? "").split(/\s+/).filter(Boolean);

  const own = (tag: Tag): number =>
    SMIL.has(tag.name)
      ? shareOf(tag.attrs)
      : classesOf(tag).reduce((sum, name) => sum + (counts.get(name) ?? 0), 0);

  /** The share of the loop an element is drawn: a cull (a discrete scale to 0) stops what is inside it for the rest. */
  const drawn = (tag: Tag): number => {
    const cull = tag.children.find(
      (child) =>
        child.name === "animateTransform" &&
        attr(child.attrs, "type") === "scale" &&
        attr(child.attrs, "calcMode") === "discrete",
    );

    if (!cull) return 1;
    const times = (attr(cull.attrs, "keyTimes") ?? "").split(";").map(Number);

    return (attr(cull.attrs, "values") ?? "")
      .split(";")
      .reduce(
        (sum, value, index) => sum + (value === "0" ? 0 : (times[index + 1] ?? 1) - times[index]!),
        0,
      );
  };

  const total = (tag: Tag): number =>
    own(tag) + drawn(tag) * tag.children.reduce((sum, child) => sum + total(child), 0);

  const root = treeOf(markup);

  /** The share of every frame a filter's own animations redraw it, 0 when it holds still. */
  const redrawn = (tag: Tag): number =>
    Math.min(
      1,
      SMIL.has(tag.name)
        ? shareOf(tag.attrs)
        : classesOf(tag).some((name) => counts.has(name))
          ? 1
          : 0,
    ) || tag.children.reduce((sum, child) => Math.min(1, sum + redrawn(child)), 0);

  const filters = new Map<string, { tag: Tag; share: number }>();

  const visit = (tag: Tag): void => {
    if (tag.name === "filter") {
      const id = attr(tag.attrs, "id");

      if (id !== undefined) filters.set(id, { tag, share: redrawn(tag) });
    }

    tag.children.forEach(visit);
  };

  visit(root);

  /** A filtered element that has something animated inside it redraws its filter every frame. */
  const referenced = (tag: Tag, shown = 1): void => {
    const links = `${attr(tag.attrs, "filter") ?? ""} ${/filter:\\s*url\\(#[^)]+\\)/.exec(attr(tag.attrs, "style") ?? "")?.[0] ?? ""}`;
    const from = /url\(#([^)]+)\)/.exec(links)?.[1];
    const found = from === undefined ? undefined : filters.get(from);

    const here = shown * drawn(tag);

    if (found && tag.children.some((child) => total(child) > 0))
      found.share = Math.max(found.share, here);
    tag.children.forEach((child) => referenced(child, here));
  };

  referenced(root);

  let repaint = 0;

  for (const { tag, share } of filters.values()) {
    if (share === 0) continue;

    const [w, h] = [
      Number.parseFloat(attr(tag.attrs, "width") ?? ""),
      Number.parseFloat(attr(tag.attrs, "height") ?? ""),
    ];

    if (w > 0 && h > 0) repaint += ((w * h) / 10000) * share;
  }

  return {
    animations: Math.round(total(root) * 10) / 10,
    repaint: Math.round(repaint * 10) / 10,
  };
};
