/** Where a JSX element was written, as the development transform reports it. */
export interface JsxSource {
  readonly fileName?: string;
  readonly lineNumber: number;
  readonly columnNumber?: number;
}

/** A source as `data-source` writes it: file, line and column, leaving out the parts that are unknown. */
export const place = ({ fileName, lineNumber, columnNumber }: JsxSource): string =>
  [fileName || undefined, lineNumber, columnNumber].filter((part) => part !== undefined).join(":");
