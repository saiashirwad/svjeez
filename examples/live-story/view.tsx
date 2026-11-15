/** @jsxImportSource react */
/** @jsxRuntime automatic */
import type { Editor, State } from "@svjeez/live";
import { Code, Picture, Transport } from "@svjeez/react";
import { renderToStaticMarkup } from "react-dom/server";

/** A store that holds one state: the components read it on the server and never subscribe or send. */
const still = (state: State): Editor => ({
  getState: () => state,
  subscribe: () => () => {},
  send: () => {},
  destroy: () => {},
});

/** The editor as `@svjeez/react` renders it: the code with its controls, the picture and the transport. */
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
