import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Code, Picture, Transport, useEditor } from "../../src/index.ts";

const scene = `import { render } from "svjeez";
export default () => render({ width: 400, height: 240, duration: 2, title: "Dot" }, <circle cx={120} r={30} fill="#FF5D8F" />);
`;

describe("rendering on a server", () => {
  test("draws the source with its controls and starts no compile", () => {
    const compiled: string[] = [];

    const Page = () => {
      const editor = useEditor(scene, {
        effects: {
          compile: (text) => {
            compiled.push(text);

            return new Promise(() => {});
          },
        },
      });

      return (
        <>
          <Picture editor={editor} />
          <Transport editor={editor} />
          <Code editor={editor} file="scene.tsx" />
        </>
      );
    };

    const html = renderToString(<Page />);
    expect(html).toContain('class="sj-code"');
    expect(html).toContain('<span class="sj-num" role="slider"');
    expect(html).toContain('aria-label="cx"');
    expect(html).toContain('class="sj-swatch" type="color"');
    expect(html).toContain('<header class="sj-file">scene.tsx</header>');
    expect(html).toContain('<figure class="sj-picture"></figure>');
    expect(compiled).toEqual([]);
  });
});
