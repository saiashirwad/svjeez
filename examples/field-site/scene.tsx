import { useEffect, useMemo, useRef } from "react";
import { mount, type Mounted } from "svjeez/page";

interface SceneProps {
  /** The scene's markup, from `import art from "./scene.tsx?svjeez&inline"`. */
  readonly svg: string;
  /** Called once the scene is mounted, with its clocks and slots; the function it returns runs before it is unmounted. */
  readonly onMount: (scene: Mounted) => () => void;
}

/**
 * An inline scene that React never renders inside: `mount()` takes over its clocks and draws its `<Shader>`s, and
 * unmounts with the component. The SVG fills the width of the span, and its height follows its viewBox.
 */
export const Scene = ({ svg, onMount }: SceneProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const latest = useRef(onMount);

  const markup = useMemo(
    () => ({
      __html: svg.replace(/^(<svg\b[^>]*?) width="[^"]*" height="[^"]*"/, '$1 width="100%"'),
    }),
    [svg],
  );

  useEffect(() => {
    latest.current = onMount;
  });

  useEffect(() => {
    const scene = mount(ref.current!.querySelector("svg")!);
    const stop = latest.current(scene);

    return () => {
      stop();
      scene.unmount();
    };
  }, [svg]);

  return (
    <span
      ref={ref}
      aria-hidden
      style={{ display: "block", lineHeight: 0 }}
      dangerouslySetInnerHTML={markup}
    />
  );
};
