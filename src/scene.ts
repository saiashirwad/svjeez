import { Animator } from "./anim";
import { num } from "./format";
import { cloneNode, desc, defs as defsNode, serialize, style as styleNode, svg, title as titleNode, type ChildInput, type SvgNode } from "./svg";
import { validateSvg } from "./validate";

export interface ReducedMotionOptions {
  /** Seconds into the loop to hold. */
  at: number;
  /** Elements whose animations should be paused. */
  selector?: string;
}

export interface SceneOptions {
  width: number;
  height: number;
  title: string;
  desc?: string;
  /** Timeline length in seconds. Every animation is normalized to this. */
  duration: number;
  /** Fonts, classes, and page CSS. Emitted before generated keyframes. */
  css?: string;
  /** Extra CSS after keyframes: ambient loops, small overrides. */
  ambientCss?: string;
  baseTiming?: string;
  reducedMotion?: false | ReducedMotionOptions;
  /** Extra attributes for the root <svg>. */
  root?: Record<string, unknown>;
  /** A comment placed above the root element. */
  comment?: string;
  /** Validate ids, url() references, and keyframes after compiling. Defaults true. */
  validate?: boolean;
}

const flatten = (values: unknown[], label: string): SvgNode[] => {
  const out: SvgNode[] = [];
  const visit = (value: unknown): void => {
    if (value === null || value === undefined || value === false) return;
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (typeof value === "object" && "kind" in value) {
      out.push(value as SvgNode);
      return;
    }
    throw new Error(`${label} only accepts SVG nodes; received ${String(value)}.`);
  };
  for (const value of values) visit(value);
  return out;
};

export class Scene {
  readonly options: SceneOptions;
  readonly duration: number;
  private bodyNodes: SvgNode[] = [];
  private defNodes: SvgNode[] = [];
  private extraCss: string[] = [];

  constructor(options: SceneOptions) {
    if (!(options.width > 0) || !(options.height > 0)) {
      throw new Error("Scene dimensions must be positive.");
    }
    if (!(options.duration > 0)) throw new Error("Scene duration must be positive.");
    this.options = options;
    this.duration = options.duration;
  }

  add(...nodes: unknown[]): this {
    this.bodyNodes.push(...flatten(nodes, "Scene.add"));
    return this;
  }

  defs(...nodes: unknown[]): this {
    this.defNodes.push(...flatten(nodes, "Scene.defs"));
    return this;
  }

  css(css: string): this {
    if (css.trim()) this.extraCss.push(css.trim());
    return this;
  }

  private resolve(nodes: SvgNode[], animator: Animator): SvgNode[] {
    return nodes.map((node) => {
      if (node.kind === "fragment") {
        return { kind: "fragment", children: this.resolve(node.children, animator) };
      }
      if (node.kind !== "element") return node;
      const children = this.resolve(node.children, animator);
      if (!node.animation) return { ...node, children };
      const classes = animator.add(node.animation);
      const existing = node.attrs.class;
      return {
        ...node,
        attrs: { ...node.attrs, class: existing ? `${existing} ${classes}` : classes },
        children,
      };
    });
  }

  /** Build the root SVG node, resolving animation metadata into classes and keyframes. */
  toNode(): SvgNode {
    const animator = new Animator(this.duration, this.options.baseTiming);
    const body = this.resolve(this.bodyNodes, animator);
    const definitions = this.resolve(this.defNodes, animator);

    const css = [
      this.options.css?.trim(),
      animator.css(),
      this.options.ambientCss?.trim(),
      ...this.extraCss,
    ]
      .filter(Boolean)
      .join("\n\n");

    const reduced = this.options.reducedMotion === false ? undefined : this.options.reducedMotion ?? { at: this.duration * 0.85 };
    const reducedCss = reduced
      ? `@media (prefers-reduced-motion:reduce){${reduced.selector ?? ".a"}{animation-delay:-${num(Math.max(0, Math.min(this.duration, reduced.at)))}s!important;animation-play-state:paused!important}}`
      : "";

    const styles = [css, reducedCss].filter(Boolean).join("\n\n");
    const labelledBy = this.options.desc ? "t d" : "t";
    const rootAttrs = {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${num(this.options.width)} ${num(this.options.height)}`,
      width: num(this.options.width),
      height: num(this.options.height),
      role: "img",
      "aria-labelledby": labelledBy,
      ...this.options.root,
    };

    const content = [
      titleNode(this.options.title, { id: "t" }),
      this.options.desc ? desc(this.options.desc, { id: "d" }) : null,
      definitions.length > 0 ? defsNode({}, definitions) : null,
      styles ? styleNode(styles) : null,
      ...body,
    ].filter((entry): entry is SvgNode => entry !== null);

    return svg(rootAttrs, content);
  }

  render(): string {
    const source = serialize(this.toNode());
    if (this.options.validate !== false) {
      const result = validateSvg(source);
      if (result.errors.length > 0) {
        throw new Error(`Generated SVG is invalid:\n${result.errors.map((error) => `  - ${error}`).join("\n")}`);
      }
    }
    const comment = this.options.comment ? `<!-- ${this.options.comment} -->\n` : "";
    return `${comment}${source}\n`;
  }
}

export const scene = (options: SceneOptions): Scene => new Scene(options);
