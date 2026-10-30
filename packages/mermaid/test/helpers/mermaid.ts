import { render } from "svjeez";
import { MermaidSyntaxError, parse, type FlowchartDoc, type StateDoc } from "../../src/index";

export const flow = (text: string): FlowchartDoc => {
  const doc = parse(text);

  if (doc.kind !== "flowchart") throw new Error(`expected a flowchart, got ${doc.kind}`);

  return doc;
};

export const state = (text: string): StateDoc => {
  const doc = parse(text);

  if (doc.kind !== "state") throw new Error(`expected a state diagram, got ${doc.kind}`);

  return doc;
};

/** The message of the error that `parse` throws for `text`. */
export const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof MermaidSyntaxError) return e.message;

    throw e;
  }

  throw new Error("parse() did not throw");
};

export const svg = (node: Parameters<typeof render>[1]) =>
  render({ width: 800, height: 600, duration: 12, title: "mermaid" }, node);

export const everyForm = `flowchart LR
      %% a comment
      A[Rect] --> B(Round)
      B ---> C([Stadium])
      C -.-> D{Decide}
      D ==> E((Circle))
      E --- F[[Sub]]
      F -- text --> G[(Store)]
      G -->|piped| A
      A -. dotted label .-> B
      B == thick label ==> C`;
