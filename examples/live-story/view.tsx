/** @jsxImportSource react */
/** @jsxRuntime automatic */
import type { Editor, State } from "@svjeez/live";
import { Code, Picture, Transport } from "@svjeez/react";
import { renderToStaticMarkup } from "react-dom/server";

const still = (state: State): Editor => ({
  getState: () => state,
  subscribe: () => () => {},
  send: () => {},
  destroy: () => {},
});

export const view = (state: State): string => {
  const editor = still(state);

  return renderToStaticMarkup(
    <div className="story">
      <Code editor={editor} file="ball.tsx" />
      <div className="side">
        <Picture editor={editor} />
        <Transport editor={editor} />
      </div>
    </div>,
  );
};
