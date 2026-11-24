import type { Source } from "./ir";

export interface Where {
  readonly node?: string;
  readonly key?: string;
  readonly source?: Source;
}

export const placeOf = ({ file, line, column }: Source): string =>
  [file || undefined, line, column].filter((part) => part !== undefined).join(":");

export class SceneError extends Error {
  override readonly name = "SceneError";
  readonly problem: string;
  readonly fix: string | undefined;
  readonly node: string | undefined;
  readonly key: string | undefined;
  readonly source: Source | undefined;

  constructor(problem: string, fix?: string, where: Where = {}, options?: { cause?: unknown }) {
    super(
      `${where.source ? `${placeOf(where.source)}: ` : ""}${problem}${fix ? ` ${fix}` : ""}`,
      options,
    );
    this.problem = problem;
    this.fix = fix;
    this.node = where.node;
    this.key = where.key;
    this.source = where.source;
  }

  at(where: Where): SceneError {
    if (this.source && this.node) return this;

    const made = new SceneError(
      this.problem,
      this.fix,
      {
        ...((this.node ?? where.node) !== undefined && { node: this.node ?? where.node }),
        ...((this.key ?? where.key) !== undefined && { key: this.key ?? where.key }),
        ...((this.source ?? where.source) && { source: this.source ?? where.source }),
      },
      { cause: this.cause },
    );

    made.stack = this.stack?.replace(this.message, made.message);

    return made;
  }
}

export const isSceneError = (error: unknown): error is SceneError =>
  error instanceof SceneError ||
  (error instanceof Error && error.name === "SceneError" && "problem" in error);

const isPlain = (error: Error): boolean => Object.getPrototypeOf(error) === Error.prototype;

export const located = (error: Error, where: Where): Error => {
  if (error instanceof SceneError) return error.at(where);

  if (!isPlain(error)) return error;
  const made = new SceneError(error.message, undefined, where, { cause: error });

  made.stack = error.stack?.replace(error.message, made.message);

  return made;
};
