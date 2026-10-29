import { Code, Picture, Transport, useEditor, type Options } from "@svjeez/react";
import "@svjeez/live/editor.css";

export const scene = `import { enter, ease, render } from "svjeez";
export default () =>
  render(
    { width: 200, height: 120, duration: 4, title: "Dot" },
    <circle cx={40} cy={60} r={8} fill="#3EE6D6" animation={enter({ at: 0.5, over: 0.4 }, { scale: 0 }, ease.pop)} />,
  );
`;

export const App = ({ options }: { options?: Options }) => {
  const editor = useEditor(scene, options);

  return (
    <main>
      <Picture editor={editor} />
      <Transport editor={editor} />
      <Code
        editor={editor}
        file="dot.tsx"
        control={(value, plain) => <b data-kind={value.kind}>{plain}</b>}
      />
    </main>
  );
};
