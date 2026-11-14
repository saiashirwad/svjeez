import { statsOf, type Editor } from "@svjeez/live";
import { useEditorState } from "./editor.ts";

export function Stats({ editor }: { editor: Editor }) {
  const stats = useEditorState(editor, (s) => s.stats);

  return (
    <p className="sj-stats">
      {stats &&
        statsOf(stats).map((stat) => (
          <span className="sj-stat" key={stat.label}>
            <b>{stat.value}</b>
            {` ${stat.label}`}
          </span>
        ))}
    </p>
  );
}
