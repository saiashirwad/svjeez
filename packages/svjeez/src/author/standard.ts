/**
 * The two Standard Schema specs (standardschema.dev), written out here so svjeez needs no dependency to take a Zod,
 * Valibot or ArkType schema as a component's props.
 */

/** What a schema is asked to validate: any value at all, which is what makes it validate. */
export type Unparsed = {} | null | undefined;

/** Any schema that validates: Standard Schema v1. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> extends Types<Input, Output> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: Unparsed) => Result<Output> | Promise<Result<Output>>;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: readonly Issue[];
  }

  export interface Issue {
    readonly message: string;
    readonly path?: readonly (PropertyKey | PathSegment)[] | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export type InferInput<S extends StandardSchemaV1> = NonNullable<
    S["~standard"]["types"]
  >["input"];

  export type InferOutput<S extends StandardSchemaV1> = NonNullable<
    S["~standard"]["types"]
  >["output"];
}

/** A JSON Schema document, as the converter of a Standard JSON Schema returns it. */
export type JsonSchema = object;

/** A schema that also writes itself as JSON Schema: Standard JSON Schema v1. */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardJSONSchemaV1.Props<Input, Output>;
}

export namespace StandardJSONSchemaV1 {
  export interface Props<Input = unknown, Output = Input> extends StandardSchemaV1.Types<
    Input,
    Output
  > {
    readonly version: 1;
    readonly vendor: string;
    readonly jsonSchema: Converter;
  }

  export interface Converter {
    readonly input: (options: Options) => JsonSchema;
    readonly output: (options: Options) => JsonSchema;
  }

  export interface Options {
    /** The JSON Schema dialect to write: "draft-2020-12", "draft-07", "openapi-3.0", or a vendor's own. */
    readonly target: string;
    readonly libraryOptions?: object | undefined;
  }
}

/** Whether a schema also converts to JSON Schema, so a host can offer a form for its props. */
export const isStandardJsonSchema = (
  schema: StandardSchemaV1,
): schema is StandardSchemaV1 & StandardJSONSchemaV1 => "jsonSchema" in schema["~standard"];
