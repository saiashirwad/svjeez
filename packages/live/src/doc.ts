// A scene file and the values of its params, as one immutable document. Setting a value rewrites the literal that
// declares it and nothing else, so the text stays the file its author wrote.
import { defaults, fit, type Param, type Schema, type Values } from "svjeez/params";
import { paramLiteral, parse, write, type Literal } from "./source";

export interface Doc<S extends Schema> {
  /** The file, with each value written where its param is declared. */
  readonly source: string;
  readonly values: Values<S>;
  /**
   * The document with `key` holding `value`, a number fitted to its param's range and step. When that is the value it
   * already holds, this same document, so `next === doc` means there is nothing to compile.
   */
  readonly set: <K extends keyof S & string>(key: K, value: Values<S>[K]) => Doc<S>;
}

/** The literal kind each param kind is declared with, as in `choice("circle", …)` declared by the string `"circle"`. */
const DECLARED_BY = {
  number: "number",
  color: "color",
  choice: "string",
  easing: "ease",
} as const satisfies Record<Param["kind"], Literal["kind"]>;

/** `text` as a document over `params`, its exports. Throws when a param is not declared with a literal of its kind. */
export const open = <S extends Schema>(text: string, params: S): Doc<S> => {
  const parsed = parse(text);

  const declared = Object.entries(params)
    .map(([key, param]) => {
      const literal = paramLiteral(parsed, key);

      if (literal?.kind !== DECLARED_BY[param.kind])
        throw new Error(`params.${key} is not declared with a ${param.kind} literal.`);

      return { key, param, literal };
    })
    .sort((a, b) => a.literal.range[0] - b.literal.range[0]);

  const at = (values: Values<S>): Doc<S> => {
    let source = "";
    let from = 0;

    for (const { key, param, literal } of declared) {
      const value: Param["value"] | undefined = values[key];

      // A value the file already declares keeps the text it is written with.
      if (value === param.value) continue;
      // SAFETY: `open` checked that each literal is of the kind its param holds, and `values[key]` is that param's value.
      source += text.slice(from, literal.range[0]) + write({ ...literal, value } as Literal);
      from = literal.range[1];
    }

    const doc: Doc<S> = {
      source: source + text.slice(from),
      values,
      set: (key, value) => {
        const param: Param | undefined = params[key];
        const next = param?.kind === "number" ? fit(param, Number(value)) : value;

        return next === values[key] ? doc : at({ ...values, [key]: next });
      },
    };

    return doc;
  };

  return at(defaults(params));
};
