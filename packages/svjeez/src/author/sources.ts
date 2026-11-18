export interface JsxSource {
  readonly fileName?: string;
  readonly lineNumber: number;
  readonly columnNumber?: number;
}

export const place = ({ fileName, lineNumber, columnNumber }: JsxSource): string =>
  [fileName || undefined, lineNumber, columnNumber].filter((part) => part !== undefined).join(":");
