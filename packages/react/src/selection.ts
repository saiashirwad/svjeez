import { selection, type Editor } from "@svjeez/live";
import type { FocusEvent } from "react";

export const focusing = (editor: Editor, key: string) => {
  const { focus, blur } = selection(editor, key);

  return {
    onFocus: focus,
    onBlur: (e: FocusEvent<Element>) => blur(e.currentTarget, e.relatedTarget),
  };
};
