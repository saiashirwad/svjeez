/** Plain data only: everything here survives `JSON.stringify`, so a facade, an MCP server or another language can use it. */

export type Json = string | number | boolean | null | readonly Json[] | JsonObject;

export interface JsonObject {
  readonly [key: string]: Json;
}

/** A JSON Schema document. */
export type JsonSchema = JsonObject;

/** An element's id: `"note"`, or `"card.tsx#NoteCard/note"` when written inside the component `NoteCard` of `card.tsx`. */
export type Id = string;

export type Files = Readonly<Record<string, string>>;

/** Offsets are UTF-16 code units into the file's text, as `String.prototype.slice` counts them. */
export interface Range {
  readonly file: string;
  readonly from: number;
  readonly to: number;
}

export type Position = number | { readonly after: Id };

export type Edit =
  | { readonly op: "set"; readonly target: Id; readonly prop: string; readonly value: Json }
  | { readonly op: "unset"; readonly target: Id; readonly prop: string }
  | {
      readonly op: "insert";
      readonly parent: Id;
      readonly at: Position;
      readonly element: {
        readonly component: string;
        readonly id: Id;
        readonly props?: Readonly<Record<string, Json>>;
        /** The module that exports `component`. When the file does not import it yet, `import { component } from "from"` is added. */
        readonly from?: string;
      };
    }
  | { readonly op: "remove"; readonly target: Id }
  | { readonly op: "move"; readonly target: Id; readonly parent: Id; readonly at: Position }
  | { readonly op: "rename"; readonly target: Id; readonly to: Id }
  /** Replaces a whole file, or creates it. */
  | { readonly op: "replaceFile"; readonly file: string; readonly text: string };

export type ReadOnlyReason = "param" | "expression" | "spread";

export type Prop =
  | {
      readonly editable: true;
      readonly value: Json;
      readonly schema: JsonSchema;
      readonly range: Range;
    }
  | {
      readonly editable: false;
      readonly reason: ReadOnlyReason;
      readonly text: string;
      readonly range: Range;
      readonly param?: string;
    };

export interface Node {
  readonly id: Id;
  /** The tag as written. */
  readonly component: string;
  /** The key of its component in `Program.components`, when the tag names one. */
  readonly definition?: string;
  readonly range: Range;
  readonly props: Readonly<Record<string, Prop>>;
  readonly children: readonly Id[];
}

export interface Description {
  readonly root: Id;
  readonly nodes: Readonly<Record<Id, Node>>;
  readonly params: JsonSchema;
}

/** What an edit wrote: every file after the edit, and a unified diff of the files that changed. */
export interface Change {
  readonly files: Files;
  readonly diff: string;
}

/** How a literal prop is written in the source, which decides how a new value is written back. */
export type LiteralKind = "string" | "color" | "number" | "boolean" | "null" | "ease" | "json";

/** The way the value sits after `name`: `name`, `name="v"` or `name={v}`. */
export type AttributeForm = "shorthand" | "string" | "expression";

export type Attribute =
  | {
      readonly kind: "literal";
      readonly name: string;
      readonly lit: LiteralKind;
      readonly form: AttributeForm;
      readonly value: Json;
      /** The source text of the value, quotes and braces included. */
      readonly text: string;
      /** The whole attribute, `name` included. */
      readonly range: Range;
      /** Just the value, quotes and braces included. Absent for a shorthand. */
      readonly valueRange?: Range;
    }
  | {
      readonly kind: ReadOnlyReason;
      readonly name: string;
      readonly text: string;
      readonly range: Range;
      /** The scene or component parameter an expression reads, as `guest` in `guest.name`. */
      readonly param?: string;
    };

/** An element that has a literal `id`. Elements without one cannot be addressed and are not listed. */
export interface Element {
  readonly id: Id;
  /** The id as written in the source, without the scope. */
  readonly local: string;
  /** The `file#binding` of the `component(…)` it is written inside, or `""` for scene code. */
  readonly scope: string;
  /** The tag as written, `NoteCard` in `<NoteCard />`. See `definitionOf` for the component it stands for. */
  readonly component: string;
  readonly range: Range;
  /** The opening tag, or the whole tag when it is self-closing. */
  readonly open: Range;
  readonly selfClosing: boolean;
  /** Where the tag name ends, which is where a first attribute goes. */
  readonly nameEnd: number;
  /** Where a closing tag begins. Equal to `range.to` when self-closing. */
  readonly closeStart: number;
  /** The `"…"` of `id="…"`, quotes included. */
  readonly idRange: Range;
  /** The elements and `{…}` holes written directly between its tags, ids or not, in source order. */
  readonly childRanges: readonly Range[];
  readonly props: Readonly<Record<string, Attribute>>;
  /** Attributes in source order, `{...spread}` included. */
  readonly attributes: readonly Attribute[];
  readonly parent?: Id;
  readonly children: readonly Id[];
}

/** The component a JSX tag stands for. */
export interface Definition {
  /** Its export in `Program.components`: `/groups/a/card.tsx#Card` for a scene file, `wedding#Card` for a library. */
  readonly key: string;
  /** The scope of the ids written inside it, `card.tsx#Card`, when its source is among the files. */
  readonly scope?: string;
}

/** A `ref("…")` call. */
export interface Ref {
  /** The string it holds. */
  readonly id: string;
  /** The `file#binding` of the `component(…)` it is written inside, or `""`. */
  readonly scope: string;
  /** The quoted string, quotes included. */
  readonly range: Range;
}

export interface Duplicate {
  readonly id: Id;
  readonly ranges: readonly [Range, Range];
}

/** A set of files read into an index of elements, props and refs. Nothing in the source ran. */
export interface Parsed {
  readonly files: Files;
  /** The deepest nesting of JSX elements in any file, counting the ones with no id. */
  readonly maxDepth: number;
  /** What each JSX tag stands for, by file and tag. See `definitionOf`. */
  readonly definitions: Readonly<Record<string, Readonly<Record<string, Definition>>>>;
  /** A short hash of each file's text, to tell whether the source an edit was planned against has changed. */
  readonly hashes: Readonly<Record<string, string>>;
  /** Every element with an id, in source order. */
  readonly order: readonly Id[];
  readonly elements: Readonly<Record<Id, Element>>;
  readonly refs: readonly Ref[];
  /** Ids written twice in one scope. Only the first element of each is in `elements`. */
  readonly duplicates: readonly Duplicate[];
}
