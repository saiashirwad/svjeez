import type { Editor, Value } from "@svjeez/live";
import { ChoiceControl } from "./ChoiceControl.tsx";
import { ColorControl } from "./ColorControl.tsx";
import { EaseControl } from "./EaseControl.tsx";
import { NumberControl } from "./NumberControl.tsx";

export function Control({ editor, value }: { editor: Editor; value: Value }) {
  switch (value.kind) {
    case "number":
      return <NumberControl editor={editor} value={value} />;
    case "color":
      return <ColorControl editor={editor} value={value} />;
    case "ease":
      return <EaseControl editor={editor} value={value} />;
    case "choice":
      return <ChoiceControl editor={editor} value={value} />;
  }
}
