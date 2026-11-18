# @svjeez/react

React components for editing svjeez scene source with a preview, playback controls and controls for editable literals.

```sh
npm i @svjeez/react @svjeez/live svjeez
```

```tsx
import "@svjeez/live/editor.css";
import { Code, Picture, Transport, useEditor } from "@svjeez/react";

export const Lanterns = ({ source }: { source: string }) => {
  const scene = useEditor(source);

  return (
    <main>
      <Picture editor={scene} />
      <Transport editor={scene} />
      <Code editor={scene} file="lanterns.tsx" />
    </main>
  );
};
```

Call `useEditor(source)` to create the editor and send a `replace` message to load new source. Read custom state with `useEditorState`. Pass `first` when you have a prebuilt preview from [@svjeez/vite](https://www.npmjs.com/package/@svjeez/vite). Use the shared stylesheet’s `--sj-*` custom properties to theme the components.

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/edit.md)
