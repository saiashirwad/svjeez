/** What the build writes into the Worker as the module "virtual:library" (scripts/library.ts). */
export interface Library {
  /** Each module a scene may reach, by name: an importable specifier, or a chunk the specifiers share. */
  readonly code: Readonly<Record<string, string>>;
  /** The chunks each module imports. */
  readonly imports: Readonly<Record<string, readonly string[]>>;
  /** world-atlas's TopoJSON files as text, by specifier. */
  readonly json: Readonly<Record<string, string>>;
  /** The preloaded font faces as base64, by "Family weight". */
  readonly fonts: Readonly<Record<string, string>>;
  /** The svjeez skill: SKILL.md, references/*.md and examples/*.tsx. */
  readonly skill: Readonly<Record<string, string>>;
}
