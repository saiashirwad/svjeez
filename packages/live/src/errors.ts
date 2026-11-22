import { Data } from "effect";
import type { Id, Range, ReadOnlyReason } from "./types.ts";

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
}> {}

export class CompileError extends Data.TaggedError("CompileError")<{
  readonly file: string;
  readonly line: number;
  readonly col: number;
  readonly message: string;
}> {}

export class RenderError extends Data.TaggedError("RenderError")<{
  readonly message: string;
  readonly node?: Id;
}> {}

export class UnknownId extends Data.TaggedError("UnknownId")<{
  readonly target: Id;
}> {}

export class NotEditable extends Data.TaggedError("NotEditable")<{
  readonly target: Id;
  readonly prop: string;
  readonly reason: ReadOnlyReason;
}> {}

export class InvalidValue extends Data.TaggedError("InvalidValue")<{
  readonly target: Id;
  readonly prop: string;
  readonly issue: string;
}> {}

export class DuplicateId extends Data.TaggedError("DuplicateId")<{
  readonly id: Id;
  readonly ranges: readonly [Range, Range];
}> {}

export class StaleSource extends Data.TaggedError("StaleSource")<{
  readonly file: string;
  readonly expected: string;
  readonly actual: string;
}> {}

/** A `beforeEdit` hook refused an edit. */
export class Denied extends Data.TaggedError("Denied")<{
  readonly reason: string;
}> {}

/** A `validate` hook refused the state an edit would produce. */
export class Rejected extends Data.TaggedError("Rejected")<{
  readonly reason: string;
  readonly node?: Id;
}> {}

export type EditError = UnknownId | NotEditable | InvalidValue | DuplicateId | StaleSource;
