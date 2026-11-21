import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type RefObject,
} from "react";
import { attach, type Attached, type AttachOptions } from "svjeez/page";

export type { AttachOptions, Mounted, StateValue, States } from "svjeez/page";

/** A scene as the browser gets it from `import art from "./scene.tsx?svjeez&inline"` (@svjeez/vite). */
export interface SceneArt {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  readonly title?: string;
  readonly desc?: string;
}

// The server has no layout to wait for, and React 18 warns about a layout effect there.
const useLayout = "document" in globalThis ? useLayoutEffect : useEffect;

/**
 * Binds the scene inside an element to the state React owns, with `attach()`: the first `state` shows at once, each
 * later one animates, and the scene is destroyed with the element. Put the returned ref on the element that holds
 * `art.svg` as its markup. A new `art`, or `places` with other contents, attaches afresh; `onMount` and the
 * identity of `places` and `state` are free to change on every render.
 */
export const useScene = <Element extends HTMLElement = HTMLElement>(
  art: Pick<SceneArt, "svg">,
  options: AttachOptions = {},
): RefObject<Element | null> => {
  const ref = useRef<Element>(null);
  const attached = useRef<Attached | undefined>(undefined);
  const latest = useRef(options);
  const state = JSON.stringify(options.state);
  const places = JSON.stringify(options.places);

  useLayout(() => {
    latest.current = options;
  });

  useLayout(() => {
    if (!ref.current) return;

    const made = attach(ref.current, {
      state: latest.current.state,
      places: latest.current.places,
      onMount: (scene) => latest.current.onMount?.(scene),
    });

    attached.current = made;

    return () => {
      attached.current = undefined;
      made.destroy();
    };
  }, [art.svg, places]);

  useLayout(() => {
    attached.current?.update({ state: latest.current.state });
  }, [state]);

  return ref;
};

export interface SceneProps
  extends
    Omit<HTMLAttributes<HTMLSpanElement>, "children" | "dangerouslySetInnerHTML">,
    AttachOptions {
  readonly scene: SceneArt;
  /**
   * Hidden from assistive technology by default: the control around the scene carries the role, the keyboard and the
   * name. `true` shows the scene as an image named by its title and description; a string names it instead.
   */
  readonly label?: boolean | string;
}

/** The root's own size is replaced by the wrapper's: its width follows the wrapper and its height follows its viewBox. */
const fitted = (svg: string) =>
  svg.replace(/^(<svg\b[^>]*?) width="[^"]*" height="[^"]*"/, '$1 width="100%"');

const named = (label: SceneProps["label"]) =>
  label === undefined || label === false
    ? { "aria-hidden": true as const }
    : label === true
      ? {}
      : { role: "img", "aria-label": label };

/**
 * A scene in a span that React never re-renders inside. React owns the state, the events and the accessibility; the
 * scene only draws, and moves between the states it declared. `style={{ width }}` resizes it, and its height follows.
 */
export const Scene = forwardRef<HTMLSpanElement, SceneProps>(function Scene(
  { scene: art, state, places, onMount, label, style, ...rest },
  forwarded,
) {
  const ref = useScene<HTMLSpanElement>(art, { state, places, onMount });
  const markup = useMemo(() => ({ __html: fitted(art.svg) }), [art.svg]);

  useImperativeHandle(forwarded, () => ref.current!, [ref]);

  return createElement("span", {
    ref,
    ...named(label),
    ...rest,
    style: {
      display: "inline-block",
      width: art.width,
      aspectRatio: `${art.width} / ${art.height}`,
      lineHeight: 0,
      ...style,
    },
    dangerouslySetInnerHTML: markup,
    // The browser may write the svg's markup a little differently from the string; it is the same scene.
    suppressHydrationWarning: true,
  });
});
